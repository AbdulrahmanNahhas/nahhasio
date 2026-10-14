import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, realpath, stat, lstat, open, link } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname, posix } from "node:path";

import { getPublicMediaDirectory, getMediaDirectory } from "@arcadia/api/media-storage";
import {
  rpcInputs,
  rpcResults,
  imageOwnerKindSchema,
  imageSchema,
} from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

import type { Sql, TransactionSql } from "../db";
import { authorizeWrite, type EditorContext } from "./service";

const assetProjection = `jsonb_build_object('id',a.id,'path',a.path,'fileName',a.original_filename,'mimeType',a.mime_type,'byteSize',a.byte_size,'width',a.width,'height',a.height,'sha256',a.sha256,'createdAt',a.created_at,'health',case when a.deletion_error is not null then 'deletion-error' else 'healthy' end,'assignmentCount',(select count(*) from media_asset_assignments x where x.asset_id=a.id),'roles',coalesce((select jsonb_agg(role order by role) from (select distinct role::text as role from media_asset_assignments x where x.asset_id=a.id) r),'[]'::jsonb))`;
const ownerSpecs = {
  title: {
    table: "titles",
    column: "title_id",
    from: "titles t",
    label: "coalesce(t.title_ar,t.canonical_title)",
    context: "t.canonical_title",
  },
  installment: {
    table: "installments",
    column: "installment_id",
    from: "installments t join titles w on w.id=t.title_id",
    label: "t.title",
    context: "coalesce(w.title_ar,w.canonical_title)",
  },
  episode: {
    table: "episodes",
    column: "episode_id",
    from: "episodes t join installments i on i.id=t.installment_id join titles w on w.id=i.title_id",
    label: "coalesce(nullif(t.title,''),'الحلقة '||t.number::text)",
    context: "concat_ws(' / ',coalesce(w.title_ar,w.canonical_title),i.title)",
  },
  entity: {
    table: "entities",
    column: "entity_id",
    from: "entities t",
    label: "t.name",
    context: "case t.kind::text when 'person' then 'شخص' else 'استوديو / مؤسسة' end",
  },
} as const;

export async function listImages(sql: Sql, input: z.infer<typeof rpcInputs.assets>) {
  const order = {
    newest: "a.created_at desc,a.id",
    oldest: "a.created_at,a.id",
    name: "a.original_filename,a.id",
    size: "a.byte_size desc,a.id",
  }[input.sort];
  const where = `($1='' or strpos(lower(concat_ws(' ',a.original_filename,a.path,a.sha256)),lower($1))>0) and ($2='all' or ($2='assigned' and exists(select 1 from media_asset_assignments x where x.asset_id=a.id)) or ($2='unassigned' and not exists(select 1 from media_asset_assignments x where x.asset_id=a.id))) and ($3='all' or exists(select 1 from media_asset_assignments x where x.asset_id=a.id and x.role::text=$3))`;
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const params = [
      input.q,
      input.usage,
      input.role,
      input.pageSize,
      (input.page - 1) * input.pageSize,
    ];
    // Problem filters inspect all matching candidates before pagination, never just the visible page.
    // Bound this explicit scan; larger libraries must narrow search instead of returning partial counts.
    const scanning = input.health !== "all";
    const [count] = await tx.unsafe<{ total: string }[]>(
      `select count(*) as total from media_assets a where ${where}`,
      [input.q, input.usage, input.role],
    );
    if (scanning && Number(count?.total ?? 0) > 10000)
      throw new Error("فحص الملفات محدود بعشرة آلاف صورة؛ ضيّق البحث أو نوع الاستخدام أولاً.");
    const rows = await tx.unsafe<{ value: z.infer<typeof imageSchema> }[]>(
      `select ${assetProjection} as value from media_assets a where ${where} order by ${order} ${scanning ? "limit 10000" : "limit $4 offset $5"}`,
      scanning ? params.slice(0, 3) : params,
    );
    const checked: z.infer<typeof imageSchema>[] = [];
    for (let i = 0; i < rows.length; i += 8) {
      checked.push(
        ...(await Promise.all(
          rows
            .slice(i, i + 8)
            .map(async ({ value }) => ({ ...value, health: await fileHealth(value) })),
        )),
      );
    }
    const matched = checked.filter(
      (asset) =>
        input.health === "all" ||
        (input.health === "problems" ? asset.health !== "healthy" : asset.health === input.health),
    );

    return rpcResults.assets.parse({
      items: scanning
        ? matched.slice((input.page - 1) * input.pageSize, input.page * input.pageSize)
        : matched,
      total: scanning ? matched.length : Number(count?.total ?? 0),
      page: input.page,
      pageSize: input.pageSize,
    });
  });
}

export async function imageDetail(sql: Sql, id: string) {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const [row] = await tx.unsafe<{ value: z.infer<typeof rpcResults.assetDetail>["asset"] }[]>(
      `select ${assetProjection} as value from media_assets a where a.id=$1::uuid`,
      [id],
    );
    if (!row) throw new Error("الصورة غير موجودة؛ أعد تحميل المكتبة.");
    const assignments = await tx<
      { value: z.infer<typeof rpcResults.assetDetail>["assignments"][number] }[]
    >`
      select jsonb_build_object('id',x.id,'ownerId',coalesce(x.title_id,x.installment_id,x.episode_id,x.entity_id),'ownerKind',case when x.title_id is not null then 'title' when x.installment_id is not null then 'installment' when x.episode_id is not null then 'episode' else 'entity' end,'ownerLabel',coalesce(w.title_ar,w.canonical_title,i.title,nullif(e.title,''),case when e.id is not null then 'الحلقة '||e.number::text end,n.name),'ownerContext',concat_ws(' / ',coalesce(pw.title_ar,pw.canonical_title),coalesce(i.title,ep.title)),'workId',coalesce(w.id,i.title_id,ep.title_id),'entityKind',n.kind::text,'role',x.role::text,'isPrimary',x.is_primary) as value
      from media_asset_assignments x
      left join titles w on w.id=x.title_id
      left join installments i on i.id=x.installment_id
      left join episodes e on e.id=x.episode_id
      left join installments ep on ep.id=e.installment_id
      left join titles pw on pw.id=coalesce(i.title_id,ep.title_id)
      left join entities n on n.id=x.entity_id
      where x.asset_id=${id} order by x.is_primary desc,x.created_at desc,x.id`;
    return rpcResults.assetDetail.parse({
      asset: { ...row.value, health: await fileHealth(row.value) },
      deleteBlockedReason: await deletionBlock(tx, id),
      assignments: assignments.map((item) => item.value),
    });
  });
}

export async function imageOwners(sql: Sql, input: z.infer<typeof rpcInputs.assetOwners>) {
  const spec = ownerSpecs[input.kind];
  const rows = await sql.unsafe<{ value: z.infer<typeof rpcResults.assetOwners>[number] }[]>(
    `select jsonb_build_object('id',t.id,'label',${spec.label},'context',${spec.context},'primaryAssetId',p.asset_id,'primaryAssignmentId',p.id) as value from ${spec.from} left join lateral (select id,asset_id from media_asset_assignments x where x.${spec.column}=t.id and x.role::text=$2 and x.is_primary order by x.id limit 1) p on true where ($1='' or strpos(lower(concat_ws(' ',${spec.label},${spec.context})),lower($1))>0) order by ${spec.label},t.id limit 20`,
    [input.q, input.role],
  );
  return rpcResults.assetOwners.parse(rows.map((row) => row.value));
}

async function lockOwner(
  tx: TransactionSql,
  kind: z.infer<typeof imageOwnerKindSchema>,
  id: string,
) {
  const spec = ownerSpecs[kind];
  // Match complete-work saves: lock the title root before a part/episode owner.
  if (kind === "installment" || kind === "episode") {
    const from =
      kind === "installment"
        ? "installments i"
        : "episodes e join installments i on i.id=e.installment_id";
    const column = kind === "installment" ? "i.id" : "e.id";
    const [root] = await tx.unsafe<{ id: string }[]>(
      `select i.title_id as id from ${from} where ${column}=$1::uuid`,
      [id],
    );
    if (!root) throw new Error("السجل المرتبط لم يعد موجوداً.");
    await tx`select id from titles where id=${root.id} for update`;
  }
  const rows = await tx.unsafe<{ id: string }[]>(
    `select id from ${spec.table} where id=$1::uuid for update`,
    [id],
  );
  if (!rows.length) throw new Error("السجل المرتبط لم يعد موجوداً.");
}

export async function assignImage(
  sql: Sql,
  input: z.infer<typeof rpcInputs.assetAssign>,
  context: EditorContext,
) {
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    await lockOwner(tx, input.ownerKind, input.ownerId);
    const assets = await tx`select id from media_assets where id=${input.assetId} for share`;
    if (!assets.length) throw new Error("الصورة لم تعد موجودة.");
    const column = ownerSpecs[input.ownerKind].column;
    const before = await tx.unsafe<{ id: string; asset_id: string; is_primary: boolean }[]>(
      `select id,asset_id,is_primary from media_asset_assignments where ${column}=$1::uuid and role::text=$2 order by id for update`,
      [input.ownerId, input.role],
    );
    const primary = before.find((row) => row.is_primary);
    if (
      (primary?.id ?? null) !== input.expectedPrimaryId ||
      (primary?.asset_id ?? null) !== input.expectedPrimaryAssetId
    )
      throw new Error("تغيّرت الصورة الأساسية؛ أعد اختيار السجل ومراجعة الربط.");
    await tx.unsafe(
      `update media_asset_assignments set is_primary=false,updated_at=now() where ${column}=$1::uuid and role::text=$2 and is_primary`,
      [input.ownerId, input.role],
    );
    const existing = before.find((row) => row.asset_id === input.assetId);
    let assignmentId: string;
    if (existing) {
      await tx`update media_asset_assignments set is_primary=true,updated_at=now() where id=${existing.id}`;
      assignmentId = existing.id;
    } else {
      const [row] = await tx.unsafe<{ id: string }[]>(
        `insert into media_asset_assignments(asset_id,${column},role,is_primary) values($1::uuid,$2::uuid,$3::media_asset_role,true) returning id`,
        [input.assetId, input.ownerId, input.role],
      );
      if (!row) throw new Error("تعذّر ربط الصورة.");
      assignmentId = row.id;
    }
    await tx`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(${context.accountId},'admin.artwork.assign','media_asset_assignments',${assignmentId},'Desktop primary artwork assignment',${tx.json({ before, after: { assignmentId, assetId: input.assetId, ownerKind: input.ownerKind, ownerId: input.ownerId, role: input.role, isPrimary: true } })})`;
    return { assignmentId };
  });
}

export async function unlinkImage(
  sql: Sql,
  input: z.infer<typeof rpcInputs.assetUnlink>,
  context: EditorContext,
) {
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    const [candidate] = await tx<
      {
        id: string;
        title_id: string | null;
        installment_id: string | null;
        episode_id: string | null;
        entity_id: string | null;
        is_primary: boolean;
      }[]
    >`select id,title_id,installment_id,episode_id,entity_id,is_primary from media_asset_assignments where id=${input.assignmentId} and asset_id=${input.assetId}`;
    if (!candidate) throw new Error("تغيّر الربط أو أزيل؛ أعد تحميل تفاصيل الصورة.");
    const kind = candidate.title_id
      ? "title"
      : candidate.installment_id
        ? "installment"
        : candidate.episode_id
          ? "episode"
          : "entity";
    const ownerId =
      candidate.title_id ?? candidate.installment_id ?? candidate.episode_id ?? candidate.entity_id;
    if (!ownerId) throw new Error("ربط الصورة غير صالح.");
    await lockOwner(tx, kind, ownerId);
    const [current] = await tx<
      { value: z.infer<ReturnType<typeof z.json>>; is_primary: boolean }[]
    >`select to_jsonb(x) as value,is_primary from media_asset_assignments x where id=${input.assignmentId} and asset_id=${input.assetId} for update`;
    if (!current || current.is_primary !== input.expectedPrimary)
      throw new Error("تغيّرت حالة الربط؛ أعد تحميل تفاصيل الصورة.");
    await tx`delete from media_asset_assignments where id=${input.assignmentId}`;
    await tx`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(${context.accountId},'admin.artwork.unlink','media_asset_assignments',${input.assignmentId},'Desktop artwork unlink; asset retained',${tx.json({ before: current.value, after: null })})`;
    return { removed: true };
  });
}

async function fileHealth(
  asset: z.infer<typeof imageSchema>,
): Promise<z.infer<typeof imageSchema>["health"]> {
  if (!asset.path.startsWith("/media/")) return "unreadable";
  const uploaded = asset.path.startsWith("/media/uploads/");
  const root = uploaded ? getMediaDirectory() : getPublicMediaDirectory();
  const destination = resolve(
    root,
    `.${asset.path.slice(uploaded ? "/media/uploads".length : "/media".length)}`,
  );
  if (!contained(root, destination)) return "unreadable";
  try {
    const [canonicalRoot, canonicalFile] = await Promise.all([
      realpath(root),
      realpath(destination),
    ]);
    if (!contained(canonicalRoot, canonicalFile)) return "unreadable";
    const info = await stat(canonicalFile);
    if (!info.isFile()) return "unreadable";
    await access(canonicalFile, constants.R_OK);
    if (info.size !== asset.byteSize) return "size-mismatch";
    return asset.health === "deletion-error" ? "deletion-error" : "healthy";
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT"
      ? "missing"
      : "unreadable";
  }
}

async function deletionBlock(tx: TransactionSql, id: string): Promise<string | null> {
  const [row] = await tx<{ assigned: boolean; variants: boolean; revisions: boolean }[]>`
    select exists(select 1 from media_asset_assignments where asset_id=${id}) as assigned,
      exists(select 1 from media_assets where variant_of_asset_id=${id}) as variants,
      exists(select 1 from editorial_revisions r, media_assets a where a.id=${id}
        and (strpos(r.snapshot::text,a.id::text)>0 or strpos(r.snapshot::text,a.path)>0 or strpos(r.changes::text,a.id::text)>0 or strpos(r.changes::text,a.path)>0 or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and (strpos(r.snapshot::text,l.changes->>'compatibilityPath')>0 or strpos(r.changes::text,l.changes->>'compatibilityPath')>0)))) as revisions`;
  if (row?.assigned) return "أزل روابط الصورة بالسجلات قبل حذفها.";
  if (row?.variants) return "توجد نسخ مشتقة تعتمد على هذه الصورة.";
  if (row?.revisions) return "الصورة مستخدمة في سجل مراجعات محفوظ؛ يجب الاحتفاظ بها للاستعادة.";
  return null;
}

export async function deleteImage(
  sql: Sql,
  input: z.infer<typeof rpcInputs.assetDelete>,
  context: EditorContext,
) {
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    const [asset] = await tx<{ value: z.infer<ReturnType<typeof z.json>>; sha256: string }[]>`
      select to_jsonb(a) as value,sha256 from media_assets a where id=${input.id} for update`;
    if (!asset || asset.sha256 !== input.expectedSha256)
      throw new Error("تغيّرت الصورة؛ أعد تحميل المكتبة.");
    const blocked = await deletionBlock(tx, input.id);
    if (blocked) throw new Error(blocked);
    await tx`delete from media_assets where id=${input.id}`;
    await tx`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes)
      values(${context.accountId},'admin.artwork.delete','media_assets',${input.id},'Unused artwork record deleted; physical file retained for recovery',${tx.json({ before: asset.value, after: null, fileRetained: true })})`;
    return { removed: true, fileRetained: true };
  });
}

function contained(base: string, file: string) {
  const rel = relative(base, file);
  return rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel);
}

type RenameProposal = z.infer<typeof rpcResults.assetRenamePreview>[number];
function filenameSlug(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110)
    .replace(/-+$/g, "");
}
async function namingProposal(
  tx: TransactionSql,
  asset: z.infer<typeof imageSchema>,
): Promise<RenameProposal> {
  const owners = await tx<{ name: string; role: string }[]>`
    select concat_ws('-',coalesce(t.canonical_title,w.canonical_title,n.name),
      case when i.id is not null then 'installment-'||i.position::text when e.id is not null then 'installment-'||p.position::text||'-episode-'||e.number::text end) as name,x.role::text as role
    from media_asset_assignments x left join titles t on t.id=x.title_id
    left join installments i on i.id=x.installment_id left join episodes e on e.id=x.episode_id
    left join installments p on p.id=e.installment_id left join titles w on w.id=coalesce(i.title_id,p.title_id)
    left join entities n on n.id=x.entity_id where x.asset_id=${asset.id} order by x.id`;
  const names = [...new Set(owners.map((owner) => `${filenameSlug(owner.name)}-${owner.role}`))];
  const extension = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  }[asset.mimeType];
  const newFileName =
    names.length === 1 && extension ? `${names[0]}-${asset.id.slice(0, 8)}${extension}` : "";
  const health = await fileHealth(asset);
  const reason = !owners.length
    ? "لا توجد روابط لتحديد الاسم"
    : names.length !== 1
      ? "روابط متعددة بأسماء أو أدوار مختلفة؛ يحتاج مراجعة يدوية"
      : !extension
        ? "صيغة ملف غير مدعومة"
        : health !== "healthy"
          ? "ملف مفقود أو به مشكلة؛ أصلحه أولاً"
          : posix.basename(asset.path) === newFileName
            ? "الاسم منظم بالفعل"
            : null;
  return {
    id: asset.id,
    oldPath: asset.path,
    oldFileName: posix.basename(asset.path),
    newFileName,
    sha256: asset.sha256,
    reason,
  };
}
export async function previewImageNames(sql: Sql, ids: string[]) {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const rows = await tx.unsafe<{ value: z.infer<typeof imageSchema> }[]>(
      `select ${assetProjection} as value from media_assets a where a.id=any($1::uuid[]) order by a.id`,
      [ids],
    );
    const proposals: RenameProposal[] = [];
    for (const { value } of rows) proposals.push(await namingProposal(tx, value));
    return rpcResults.assetRenamePreview.parse(proposals);
  });
}
async function verifiedImageFile(asset: z.infer<typeof imageSchema>) {
  const uploaded = asset.path.startsWith("/media/uploads/");
  const root = await realpath(uploaded ? getMediaDirectory() : getPublicMediaDirectory());
  const path = await realpath(
    resolve(root, `.${asset.path.slice(uploaded ? "/media/uploads".length : "/media".length)}`),
  );
  if (!asset.path.startsWith("/media/") || !contained(root, path))
    throw new Error("مسار الصورة غير صالح.");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size !== asset.byteSize || before.size > 32 * 1024 * 1024)
      throw new Error("حجم الملف غير صالح لإعادة التسمية.");
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(65536);
    let total = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > before.size) throw new Error("تغيّر ملف الصورة أثناء التحقق.");
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await handle.stat();
    if (
      total !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      hash.digest("hex") !== asset.sha256
    )
      throw new Error("بصمة الملف غير مطابقة؛ لن يعاد تسميته.");
    return { path, info: before };
  } finally {
    await handle.close();
  }
}
export async function renameImages(
  sql: Sql,
  input: z.infer<typeof rpcInputs.assetRename>,
  context: EditorContext,
) {
  if (new Set(input.items.map((item) => item.id)).size !== input.items.length)
    throw new Error("اختيار الصور يحتوي على تكرار.");
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    await tx`select pg_advisory_xact_lock(23103, 710)`;
    const ids = input.items.map((item) => item.id);
    const rows = await tx.unsafe<{ value: z.infer<typeof imageSchema> }[]>(
      `select ${assetProjection} as value from media_assets a where a.id=any($1::uuid[]) order by a.id for update of a`,
      [ids],
    );
    if (rows.length !== input.items.length) throw new Error("تغيّرت الصور؛ أعد معاينة الأسماء.");
    // Validate the complete review before touching files. Never trust a caller-supplied name/path.
    const plans: { asset: z.infer<typeof imageSchema>; proposal: RenameProposal }[] = [];
    for (const { value: asset } of rows) {
      const expected = input.items.find((item) => item.id === asset.id);
      const proposal = await namingProposal(tx, asset);
      if (
        proposal.reason ||
        !expected ||
        proposal.oldPath !== expected.oldPath ||
        proposal.sha256 !== expected.sha256 ||
        proposal.newFileName !== expected.newFileName
      )
        throw new Error("تغيّر اسم أو ربط صورة؛ أعد المعاينة قبل التأكيد.");
      plans.push({ asset, proposal });
    }
    for (const { asset, proposal } of plans) {
      const source = await verifiedImageFile(asset);
      const destination = resolve(dirname(source.path), proposal.newFileName);
      try {
        await link(source.path, destination);
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
          throw new Error(
            "تعذّر إنشاء الاسم الجديد؛ لم تتغيّر سجلات الصور. تحقق من صلاحيات المجلد ودعم الروابط الصلبة.",
            { cause: error },
          );
      }
      const linked = await lstat(destination);
      if (!linked.isFile() || linked.dev !== source.info.dev || linked.ino !== source.info.ino)
        throw new Error("الاسم الجديد مستخدم لملف آخر؛ لن يستبدل.");
      const newPath = posix.join(posix.dirname(asset.path), proposal.newFileName);
      await tx`update media_assets set path=${newPath},original_filename=${proposal.newFileName},updated_at=now() where id=${asset.id}`;
      await tx`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes)
        values(${context.accountId},'admin.artwork.rename','media_assets',${asset.id},'Readable canonical artwork filename; original hard link retained for history/recovery',${tx.json({ before: { path: asset.path, fileName: asset.fileName }, after: { path: newPath, fileName: proposal.newFileName }, compatibilityPath: asset.path })})`;
    }
    return { renamed: plans.length, compatibilityLinksRetained: true };
  });
}

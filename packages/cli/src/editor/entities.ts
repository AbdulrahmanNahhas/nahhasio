import { createHash, randomUUID } from "node:crypto";

import {
  rpcInputs,
  rpcResults,
  adminEntitySummarySchema,
  adminEntityCreditSchema,
} from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

import { assertIdentifier, type Sql, type TransactionSql } from "../db";
import { loadSchema } from "../introspect";
import { authorizeWrite, type EditorContext } from "./service";

type Draft = z.infer<typeof rpcInputs.entitySave>["draft"];
const summary = `jsonb_build_object('id',e.id,'kind',e.kind::text,'name',e.name,'sortName',e.sort_name,'description',e.description,'updatedAt',e.updated_at,'artworkId',(select a.asset_id from media_asset_assignments a where a.entity_id=e.id order by a.is_primary desc,case a.role when 'profile' then 0 when 'logo' then 1 else 2 end,a.id limit 1),'workCount',(select count(distinct c.title_id) from contributions c where c.entity_id=e.id),'roles',coalesce((select jsonb_agg(label order by label) from (select distinct coalesce(nullif(r.label_ar,''),r.label_en) as label from contributions c join roles r on r.id=c.role_id where c.entity_id=e.id) s),'[]'::jsonb))`;
type EntityImage = { id: string; asset_id: string; role: string; is_primary: boolean };
type EntityRevisionInput = { draft: Draft; images: EntityImage[]; updatedAt: string };
function fingerprint(value: EntityRevisionInput) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
const entityWhere = `e.kind::text=$1 and ($2='' or strpos(lower(concat_ws(' ',e.name,e.sort_name)),lower($2))>0 or exists(select 1 from entity_aliases a where a.entity_id=e.id and strpos(lower(a.alias),lower($2))>0)) and ($3='all' or ($3='with')=exists(select 1 from media_asset_assignments a where a.entity_id=e.id)) and ($4='all' or ($4='linked' and exists(select 1 from contributions c where c.entity_id=e.id)) or ($4='unlinked' and not exists(select 1 from contributions c where c.entity_id=e.id)) or ($4='one' and (select count(distinct c.title_id) from contributions c where c.entity_id=e.id)=1)) and (($5='' and $6='') or exists(select 1 from contributions c join roles r on r.id=c.role_id where c.entity_id=e.id and ($5='' or r.slug=$5) and ($6='' or $6=any(c.languages))))`;
export async function listEntities(sql: Sql, input: z.infer<typeof rpcInputs.entityList>) {
  const order = {
    name: "e.sort_name,e.name,e.id",
    works:
      "(select count(distinct c.title_id) from contributions c where c.entity_id=e.id) desc,e.sort_name,e.id",
    updated: "e.updated_at desc,e.id",
  }[input.sort];

  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const params = [input.kind, input.q, input.image, input.usage, input.role, input.language];
    const rows = await tx.unsafe<{ value: unknown }[]>(
      `select ${summary} as value from entities e where ${entityWhere} order by ${order} limit 24 offset $7`,
      [...params, (input.page - 1) * 24],
    );
    const [total] = await tx.unsafe<{ count: string }[]>(
      `select count(*) as count from entities e where ${entityWhere}`,
      params,
    );
    return rpcResults.entityList.parse({
      items: rows.map((row) => row.value),
      total: Number(total?.count ?? 0),
    });
  });
}
/** Explicit bulk selection returns membership only, using exactly the list filters. */
export async function selectEntities(sql: Sql, input: z.infer<typeof rpcInputs.entitySelection>) {
  const rows = await sql.unsafe<{ id: string; name: string }[]>(
    `select e.id,e.name from entities e where ${entityWhere} order by e.id`,
    [input.kind, input.q, input.image, input.usage, input.role, input.language],
  );
  return rpcResults.entitySelection.parse(rows);
}
export async function dependencies(tx: TransactionSql, id: string) {
  const schema = await loadSchema(tx);
  const counts = new Map<string, number>();
  for (const table of schema.tables.values()) {
    // Aliases and artwork are owned child records, preserved in snapshots before removal.
    if (["entity_aliases", "media_asset_assignments"].includes(table.name)) continue;
    const columns = table.foreignKeys
      .filter((fk) => fk.referencesTable === "entities" && fk.referencesColumn === "id")
      .map((fk) => assertIdentifier(fk.column));
    if (!columns.length) continue;
    const [row] = await tx.unsafe<{ count: string }[]>(
      `select count(*) as count from public.${assertIdentifier(table.name)} where ${columns.map((column) => `"${column}"=$1::uuid`).join(" or ")}`,
      [id],
    );
    if (Number(row?.count)) counts.set(table.name, Number(row?.count));
  }
  const [sources] = await tx<
    { count: string }[]
  >`select count(*) as count from source_evidence where entity_id=${id} and entity_type in ('entities','entity','person','people','organization','studios')`;
  if (Number(sources?.count)) counts.set("source_evidence", Number(sources?.count));
  return [...counts].map(([table, count]) => ({ table, count }));
}
export async function snapshot(tx: TransactionSql, id: string, kind: string) {
  const [record] = await tx.unsafe<{ value: unknown }[]>(
    `select ${summary} as value from entities e where e.id=$1::uuid and e.kind::text=$2`,
    [id, kind],
  );
  if (!record) throw new Error("السجل لم يعد موجوداً أو لا ينتمي إلى هذا القسم.");
  const entity = adminEntitySummarySchema.parse(record.value);
  const aliases = await tx<
    { id: string; alias: string; language: string | null }[]
  >`select id,alias,language from entity_aliases where entity_id=${id} order by id`;
  const images = await tx<
    { id: string; asset_id: string; role: string; is_primary: boolean }[]
  >`select id,asset_id,role::text,is_primary from media_asset_assignments where entity_id=${id} order by id`;
  const credits = await tx<
    { value: unknown }[]
  >`select jsonb_build_object('workId',c.title_id,'workTitle',t.canonical_title,'roleId',c.role_id,'roleName',r.label_en,'roleLabel',coalesce(nullif(r.label_ar,''),r.label_en),'position',c.position,'isPrimary',c.is_primary,'languages',c.languages) as value from contributions c join titles t on t.id=c.title_id join roles r on r.id=c.role_id where c.entity_id=${id} order by c.position,t.sort_title,c.title_id,c.role_id`;
  const draft: Draft = {
    name: entity.name,
    sortName: entity.sortName,
    description: entity.description,
    aliases,
    credits: credits.map((row) => adminEntityCreditSchema.parse(row.value)),
    profileAssetId:
      images.find(
        (image) => image.role === (kind === "person" ? "profile" : "logo") && image.is_primary,
      )?.asset_id ?? null,
  };
  const revision = fingerprint({ draft, images, updatedAt: entity.updatedAt });
  return { entity, draft, images, revision };
}
export async function detailEntity(sql: Sql, input: z.infer<typeof rpcInputs.entityDetail>) {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const value = await snapshot(tx, input.id, input.kind);
    return rpcResults.entityDetail.parse({
      ...value,
      links: await dependencies(tx, input.id),
      imageCount: value.images.length,
    });
  });
}
export async function recordRevision(
  tx: TransactionSql,
  context: EditorContext,
  id: string,
  action: string,
  before: Awaited<ReturnType<typeof snapshot>> | null,
  after: Awaited<ReturnType<typeof snapshot>> | null,
) {
  const changes = z.json().parse({ before, after });
  await tx`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(${context.accountId},${`admin.entity.${action}`},'entities',${id},'Desktop entity editor',${tx.json(changes)})`;
  await tx`insert into editorial_revisions(actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes) select ${context.accountId},'entities',${id},coalesce(max(revision),0)+1,${action},'Desktop entity editor',${tx.json(z.json().parse(action === "delete" ? before : after))},${tx.json(changes)} from editorial_revisions where entity_type='entities' and entity_id=${id}`;
}

export async function lockEntityGraph(
  tx: TransactionSql,
  ids: string[],
  next: Draft["credits"] = [],
) {
  const previous = await tx.unsafe<{ title_id: string }[]>(
    `select distinct title_id from contributions where entity_id=any($1::uuid[])`,
    [ids],
  );
  const titleIds = [
    ...new Set([...previous.map((row) => row.title_id), ...next.map((credit) => credit.workId)]),
  ].toSorted();
  if (titleIds.length)
    await tx.unsafe(`select id from titles where id=any($1::uuid[]) order by id for update`, [
      titleIds,
    ]);
  if (ids.length)
    await tx.unsafe(`select id from entities where id=any($1::uuid[]) order by id for update`, [
      ids,
    ]);
}
export async function applyEntity(
  tx: TransactionSql,
  input: z.infer<typeof rpcInputs.entitySave>,
  context: EditorContext,
) {
  if (!input.id !== !input.revision) throw new Error("المراجعة الأصلية غير صالحة.");
  const aliasKeys = input.draft.aliases.map(
    (alias) => `${alias.alias.toLowerCase()}\u0000${alias.language ?? ""}`,
  );
  if (new Set(aliasKeys).size !== aliasKeys.length)
    throw new Error("الأسماء البديلة تحتوي على تكرار.");
  const aliasIds = input.draft.aliases.flatMap((alias) => (alias.id ? [alias.id] : []));
  if (new Set(aliasIds).size !== aliasIds.length) throw new Error("معرّفات الأسماء البديلة مكررة.");
  const creditKeys = input.draft.credits.map((credit) => `${credit.workId}:${credit.roleId}`);
  if (new Set(creditKeys).size !== creditKeys.length)
    throw new Error("العمل والدور مكرران في المساهمات.");
  const id = input.id ?? randomUUID();
  const before = input.id ? await snapshot(tx, id, input.kind) : null;
  if (before && before.revision !== input.revision)
    throw new Error("تغيّر السجل أو أعماله؛ أعد تحميله ومراجعة المسودة.");
  if (aliasIds.some((aliasId) => !before?.draft.aliases.some((alias) => alias.id === aliasId)))
    throw new Error("اسم بديل لا ينتمي إلى هذا السجل.");
  for (const credit of input.draft.credits) {
    const [reference] = await tx<
      { name: string; role: string; active: boolean; kind: string }[]
    >`select t.canonical_title as name,r.label_en as role,r.is_active as active,r.entity_kind::text as kind from titles t cross join roles r where t.id=${credit.workId} and r.id=${credit.roleId}`;
    if (
      !reference ||
      reference.kind !== input.kind ||
      reference.name !== credit.workTitle ||
      reference.role !== credit.roleName
    )
      throw new Error("تغيّر اسم العمل أو الدور؛ أعد اختيارهما من القائمة.");
    if (
      !reference.active &&
      !before?.draft.credits.some(
        (previous) => previous.roleId === credit.roleId && previous.workId === credit.workId,
      )
    )
      throw new Error("هذا الدور غير نشط؛ اختر دوراً متاحاً.");
  }
  if (
    input.draft.profileAssetId &&
    !(await tx`select id from media_assets where id=${input.draft.profileAssetId} for share`).length
  )
    throw new Error("الصورة المختارة لم تعد موجودة.");
  if (!before)
    await tx`insert into entities(id,kind,name,sort_name,description) values(${id},${input.kind},${input.draft.name},${input.draft.sortName},${input.draft.description})`;
  else
    await tx`update entities set name=${input.draft.name},sort_name=${input.draft.sortName},description=${input.draft.description},updated_at=now() where id=${id}`;
  for (const alias of before?.draft.aliases ?? [])
    if (!input.draft.aliases.some((next) => next.id === alias.id))
      await tx`delete from entity_aliases where id=${alias.id} and entity_id=${id}`;
  for (const alias of input.draft.aliases) {
    if (alias.id)
      await tx`update entity_aliases set alias=${alias.alias},language=${alias.language || null} where id=${alias.id} and entity_id=${id}`;
    else
      await tx`insert into entity_aliases(entity_id,alias,language) values(${id},${alias.alias},${alias.language || null})`;
  }
  // Reconcile only this person's contribution tuples. Work IDs and all other contributors stay intact.
  for (const credit of before?.draft.credits ?? [])
    if (
      !input.draft.credits.some(
        (next) => next.workId === credit.workId && next.roleId === credit.roleId,
      )
    )
      await tx`delete from contributions where entity_id=${id} and title_id=${credit.workId} and role_id=${credit.roleId}`;
  for (const credit of input.draft.credits)
    await tx`insert into contributions(title_id,entity_id,role_id,position,is_primary,languages) values(${credit.workId},${id},${credit.roleId},${credit.position},${credit.isPrimary},${credit.languages ?? []}::text[]) on conflict(title_id,entity_id,role_id) do update set position=excluded.position,is_primary=excluded.is_primary,languages=case when ${credit.languages !== undefined} then excluded.languages else contributions.languages end`;
  const role = input.kind === "person" ? "profile" : "logo";
  await tx`update media_asset_assignments set is_primary=false,updated_at=now() where entity_id=${id} and role::text=${role} and is_primary`;
  if (input.draft.profileAssetId) {
    const [assignment] = await tx<
      { id: string }[]
    >`select id from media_asset_assignments where entity_id=${id} and role::text=${role} and asset_id=${input.draft.profileAssetId} order by id limit 1 for update`;
    if (assignment)
      await tx`update media_asset_assignments set is_primary=true,updated_at=now() where id=${assignment.id}`;
    else
      await tx`insert into media_asset_assignments(entity_id,asset_id,role,is_primary) values(${id},${input.draft.profileAssetId},${role},true)`;
  }
  const after = await snapshot(tx, id, input.kind);
  await recordRevision(tx, context, id, before ? "update" : "create", before, after);
  return { id, created: !before };
}
export async function saveEntity(
  sql: Sql,
  input: z.infer<typeof rpcInputs.entitySave>,
  context: EditorContext,
) {
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    await lockEntityGraph(tx, input.id ? [input.id] : [], input.draft.credits);
    return applyEntity(tx, input, context);
  });
}
export async function deletePreview(
  sql: Sql,
  input: z.infer<typeof rpcInputs.entityDeletePreview>,
) {
  if (new Set(input.ids).size !== input.ids.length) throw new Error("الاختيار يحتوي على تكرار.");
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const result = [];
    for (const id of input.ids) {
      const value = await snapshot(tx, id, input.kind);
      result.push(
        rpcResults.entityDetail.parse({
          ...value,
          links: await dependencies(tx, id),
          imageCount: value.images.length,
        }),
      );
    }
    return result;
  });
}
export async function bulkDelete(
  sql: Sql,
  input: z.infer<typeof rpcInputs.entityBulkDelete>,
  context: EditorContext,
) {
  const ids = input.records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw new Error("الاختيار يحتوي على تكرار.");
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    await lockEntityGraph(tx, ids);
    const candidates = [];
    for (const record of input.records) {
      const before = await snapshot(tx, record.id, input.kind);
      if (before.revision !== record.revision)
        throw new Error("تغيّر سجل أو مساهماته؛ أعد مراجعة الحذف.");
      const links = await dependencies(tx, record.id);
      if (links.some((link) => link.table !== "contributions"))
        throw new Error(
          `لا يمكن حذف «${before.entity.name}»: توجد سياسات أو مراجع أو علاقات محفوظة.`,
        );
      if (before.draft.credits.length && !input.removeCredits)
        throw new Error("أكد إزالة مساهمات الأعمال قبل الحذف؛ لن تحذف الأعمال نفسها.");
      candidates.push(before);
    }
    let removedCredits = 0;
    for (const before of candidates) {
      const id = before.entity.id;
      await recordRevision(tx, context, id, "delete", before, null);
      removedCredits += before.draft.credits.length;
      await tx`delete from contributions where entity_id=${id}`;
      await tx`delete from media_asset_assignments where entity_id=${id}`;
      await tx`delete from entity_aliases where entity_id=${id}`;
      await tx`delete from entities where id=${id}`;
    }
    return { deleted: candidates.length, removedCredits };
  });
}
export async function entityOptions(
  sql: Sql,
  kind: z.infer<typeof rpcInputs.entityOptions>["kind"],
) {
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const works = await tx<
      { id: string; title: string; year: number | null }[]
    >`select id,canonical_title as title,release_year as year from titles order by sort_title,id limit 5001`;
    if (works.length > 5000)
      throw new Error("قائمة الأسماء تتجاوز الحد الحالي؛ تحتاج خدمة بحث مراجع مقسمة.");
    const roles = await tx<
      { id: string; name: string; label: string; slug: string; active: boolean }[]
    >`select id,label_en as name,coalesce(nullif(label_ar,''),label_en) as label,slug,is_active as active from roles where entity_kind::text=${kind} order by position,label_en,id`;
    return rpcResults.entityOptions.parse({ works, roles });
  });
}
export async function createEntityRole(
  sql: Sql,
  input: z.infer<typeof rpcInputs.entityRoleCreate>,
  context: EditorContext,
) {
  return sql.begin("isolation level serializable", async (tx) => {
    await authorizeWrite(tx, context);
    await tx`select pg_advisory_xact_lock(23103,711)`;
    const existing =
      await tx`select id from roles where slug=${input.slug} or (entity_kind::text=${input.kind} and lower(label_en)=lower(${input.name}))`;
    if (existing.length)
      throw new Error("الدور موجود بالفعل؛ اختره من القائمة أو استخدم اسماً ورمزاً مختلفين.");
    const [role] = await tx<
      { id: string }[]
    >`insert into roles(slug,label_en,label_ar,entity_kind,position,is_active) select ${input.slug},${input.name},${input.label || input.name},${input.kind}::entity_kind,coalesce(max(position),0)+1,true from roles returning id`;
    if (!role) throw new Error("تعذّر إضافة الدور.");
    await tx`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(${context.accountId},'admin.role.create','roles',${role.id},'Desktop role creation',${tx.json(input)})`;
    return role;
  });
}

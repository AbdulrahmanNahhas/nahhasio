import { searchArtworkDetailed } from "@arcadia/api/artwork";
import { storeMedia, storeMediaFromUrl } from "@arcadia/api/media-storage";
import { fetchTmdbSeason, fetchTmdbEpisodeImages, tmdbConfigured } from "@arcadia/api/tmdb";
import { rpcInputs, editorTables, jsonRow } from "@arcadia/contracts/editor-rpc";
/** Private bounded subprocess owned by the Rust API. No listener, arbitrary SQL or shell input. */
import { z } from "zod";

import { openDatabase, closeDatabase } from "../db";
import { loadSchema } from "../introspect";
import {
  entityOptions,
  createEntityRole,
  deletePreview,
  bulkDelete,
  listEntities,
  selectEntities,
  detailEntity,
  saveEntity,
} from "./entities";
import { readEntityJson, reviewEntityJson, saveEntityJson } from "./entity-json";
import {
  previewImageNames,
  renameImages,
  listImages,
  imageDetail,
  imageOwners,
  assignImage,
  unlinkImage,
  deleteImage,
} from "./images";
import {
  planetOptions,
  planetWorks,
  movePlanetWorks,
  planetDetail,
  savePlanet,
  deletePlanet,
} from "./planets";
import {
  loadWorkSnapshots,
  prepareWorkReview,
  prepareNewWorkReview,
  commitWorkReview,
  validateWorkDraft,
  inspectEpisodeDeletion,
  type EditorContext,
} from "./service";

const envelope = z.strictObject({
  operation: z.enum([
    "planetDetail",
    "planetSave",
    "planetDelete",
    "planetOptions",
    "planetWorks",
    "planetMove",
    "entityOptions",
    "entityRoleCreate",
    "entityDeletePreview",
    "entityBulkDelete",
    "entityJsonRead",
    "entityJsonReview",
    "entityJsonSave",
    "entityList",
    "entitySelection",
    "entityDetail",
    "entitySave",
    "assets",
    "assetDetail",
    "assetOwners",
    "assetAssign",
    "assetUnlink",
    "assetDelete",
    "assetRenamePreview",
    "assetRename",
    "read",
    "review",
    "save",
    "create",
    "parse",
    "links",
    "refs",
    "schema",
    "vocabulary",
    "media",
    "search",
    "season",
    "episodeImages",
    "ingest",
    "upload",
    "preview",
  ]),
  data: z.json(),
  context: z.strictObject({ accountId: z.string().uuid(), sessionKey: z.string().max(200) }),
});
const sql = openDatabase();
async function authorize(context: EditorContext) {
  const rows =
    await sql`select a.id from auth_sessions s join auth_users u on u.id=s.user_id join accounts a on a.auth_user_id=u.id where s.token=${context.sessionKey} and a.id=${context.accountId} and s.expires_at>now() and u.role in ('owner','admin') and a.kind='admin' and a.status='active' and (not u.banned or u.ban_expires<=now())`;
  if (!rows.length) throw new Error("انتهت الجلسة أو تغيّرت صلاحيات الإدارة.");
}
function imageUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    !["image.tmdb.org", "assets.fanart.tv", "s4.anilist.co"].includes(url.hostname)
  )
    throw new Error("مصدر الصورة غير مسموح.");
  return url;
}
async function register(
  stored: Awaited<ReturnType<typeof storeMedia>>,
  context: EditorContext,
  sourceUrl?: string,
) {
  return sql.begin(async (tx) => {
    const active =
      await tx`select a.id from accounts a join auth_users u on u.id=a.auth_user_id join auth_sessions s on s.user_id=u.id where a.id=${context.accountId} and s.token=${context.sessionKey} and s.expires_at>now() and a.status='active' and a.kind='admin' and u.role in ('owner','admin') and (not u.banned or u.ban_expires<=now()) for update of a,u,s`;
    if (!active.length) throw new Error("انتهت الجلسة.");
    const rows = await tx<
      { id: string; path: string }[]
    >`insert into media_assets(path,sha256,mime_type,byte_size,width,height,original_filename) values(${stored.relativePath},${stored.sha256},${stored.mimeType},${stored.byteSize},${stored.width},${stored.height},${stored.originalFilename}) on conflict (sha256) do update set sha256=excluded.sha256 returning id,path`;
    const row = rows[0];
    if (!row) throw new Error("تعذّر تسجيل الصورة.");
    await tx`insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(${context.accountId},'admin.artwork.ingest','media_assets',${row.id},'Desktop artwork registration',${tx.json({ path: row.path })})`;
    if (sourceUrl)
      await tx`insert into source_evidence(entity_type,entity_id,field_path,source_note,source_url,verification_status,checked_by_account_id,checked_at) values('media_assets',${row.id},'image','Imported image; assignment remains in the work draft',${sourceUrl},'verified',${context.accountId},now())`;
    return row;
  });
}
async function execute(input: z.infer<typeof envelope>) {
  await authorize(input.context);
  process.env.NAHHASIO_CLI_ACTOR = input.context.accountId;
  switch (input.operation) {
    case "planetDetail":
      return planetDetail(sql, rpcInputs.planetDetail.parse(input.data).id);
    case "planetSave":
      return savePlanet(sql, rpcInputs.planetSave.parse(input.data), input.context);
    case "planetDelete":
      return deletePlanet(sql, rpcInputs.planetDelete.parse(input.data), input.context);
    case "planetOptions":
      rpcInputs.planetOptions.parse(input.data);
      return planetOptions(sql);
    case "planetWorks":
      return planetWorks(sql, rpcInputs.planetWorks.parse(input.data));
    case "planetMove":
      return movePlanetWorks(sql, rpcInputs.planetMove.parse(input.data), input.context);
    case "entityOptions":
      return entityOptions(sql, rpcInputs.entityOptions.parse(input.data).kind);
    case "entityRoleCreate":
      return createEntityRole(sql, rpcInputs.entityRoleCreate.parse(input.data), input.context);
    case "entityDeletePreview":
      return deletePreview(sql, rpcInputs.entityDeletePreview.parse(input.data));
    case "entityBulkDelete":
      return bulkDelete(sql, rpcInputs.entityBulkDelete.parse(input.data), input.context);
    case "entityJsonRead":
      return readEntityJson(sql, rpcInputs.entityJsonRead.parse(input.data));
    case "entityJsonReview":
      return reviewEntityJson(sql, rpcInputs.entityJsonReview.parse(input.data), input.context);
    case "entityJsonSave":
      return saveEntityJson(sql, rpcInputs.entityJsonSave.parse(input.data), input.context);
    case "entitySelection":
      return selectEntities(sql, rpcInputs.entitySelection.parse(input.data));
    case "entityList":
      return listEntities(sql, rpcInputs.entityList.parse(input.data));
    case "entityDetail":
      return detailEntity(sql, rpcInputs.entityDetail.parse(input.data));
    case "entitySave":
      return saveEntity(sql, rpcInputs.entitySave.parse(input.data), input.context);
    case "assets":
      return listImages(sql, rpcInputs.assets.parse(input.data));
    case "assetRenamePreview":
      return previewImageNames(sql, rpcInputs.assetRenamePreview.parse(input.data).ids);
    case "assetRename":
      return renameImages(sql, rpcInputs.assetRename.parse(input.data), input.context);
    case "assetDelete":
      return deleteImage(sql, rpcInputs.assetDelete.parse(input.data), input.context);
    case "assetDetail":
      return imageDetail(sql, rpcInputs.assetDetail.parse(input.data).id);
    case "assetOwners":
      return imageOwners(sql, rpcInputs.assetOwners.parse(input.data));
    case "assetAssign":
      return assignImage(sql, rpcInputs.assetAssign.parse(input.data), input.context);
    case "assetUnlink":
      return unlinkImage(sql, rpcInputs.assetUnlink.parse(input.data), input.context);
    case "read":
      return loadWorkSnapshots(rpcInputs.read.parse(input.data).ids);
    case "review": {
      const p = rpcInputs.review.parse(input.data);
      return prepareWorkReview(p.json, p.originals, input.context);
    }
    case "save":
      return commitWorkReview(rpcInputs.save.parse(input.data).ticket, input.context);
    case "create":
      return prepareNewWorkReview(rpcInputs.create.parse(input.data).json, input.context);
    case "parse":
      return validateWorkDraft(rpcInputs.parse.parse(input.data).json);
    case "links": {
      const p = rpcInputs.links.parse(input.data);
      return inspectEpisodeDeletion(p.workId, p.episodeId);
    }
    case "media": {
      const p = rpcInputs.media.parse(input.data);
      const [row] = await sql<
        { id: string }[]
      >`select a.id from media_assets a where a.path=${p.path} or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and l.changes->>'compatibilityPath'=${p.path}) order by (a.path=${p.path}) desc limit 1`;
      if (!row) throw new Error("الصورة غير مسجلة.");
      return row;
    }
    case "search":
      return searchArtworkDetailed(rpcInputs.search.parse(input.data));
    case "season": {
      const p = rpcInputs.season.parse(input.data);
      if (!tmdbConfigured()) throw new Error("مفتاح TMDB غير مفعّل.");
      return fetchTmdbSeason({ ...p, language: "ar-SA" });
    }
    case "episodeImages": {
      if (!tmdbConfigured()) throw new Error("مفتاح TMDB غير مفعّل.");
      return fetchTmdbEpisodeImages(rpcInputs.episodeImages.parse(input.data));
    }
    case "ingest": {
      const p = rpcInputs.ingest.parse(input.data);
      imageUrl(p.url);
      return register(
        await storeMediaFromUrl({ url: p.url, assetType: p.role, ownerName: p.ownerName }),
        input.context,
        p.url,
      );
    }
    case "upload": {
      const p = rpcInputs.upload.parse(input.data);
      return register(await storeMedia({ ...p, assetType: p.role }), input.context);
    }
    case "preview": {
      const p = rpcInputs.preview.parse(input.data);
      const response = await fetch(imageUrl(p.url), {
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      const mime = response.headers.get("content-type")?.split(";")[0];
      if (!response.ok || !mime || !["image/png", "image/jpeg", "image/webp"].includes(mime))
        throw new Error("تعذّرت معاينة الصورة.");
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (!response.body) throw new Error("معاينة فارغة.");
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > 10 * 1024 * 1024) throw new Error("الصورة كبيرة جداً.");
        chunks.push(chunk);
      }
      return { dataUrl: `data:${mime};base64,${Buffer.concat(chunks).toString("base64")}` };
    }
    case "refs": {
      const p = rpcInputs.refs.parse(input.data);
      const params: (string | number)[] = [p.search, 50, p.offset];
      let where = "($1='' or strpos(lower(to_jsonb(t)::text),lower($1))>0)";
      const owners = `media_asset_assignments m
        left join installments i on i.id=m.installment_id
        left join episodes e on e.id=m.episode_id
        left join installments ei on ei.id=e.installment_id
        left join titles w on w.id=coalesce(m.title_id,i.title_id,ei.title_id)
        left join entities n on n.id=m.entity_id`;
      if (p.table === "media_assets")
        where = `($1='' or strpos(lower(to_jsonb(t)::text),lower($1))>0 or exists(select 1 from ${owners} where m.asset_id=t.id and (strpos(lower(concat_ws(' ',w.canonical_title,w.title_ar,n.name,i.title,e.title)),lower($1))>0 or exists(select 1 from title_aliases a where a.title_id=w.id and strpos(lower(a.title),lower($1))>0))))`;
      for (const [key, value] of Object.entries(p.filters)) {
        if (p.table === "media_assets" && key === "related_work") {
          const id = z.string().uuid().parse(value);
          params.push(id);
          where += ` and exists(select 1 from ${owners} where m.asset_id=t.id and w.id=$${params.length}::uuid)`;
          continue;
        }
        if (p.table === "media_assets" && key === "image_role") {
          const role = z.enum(["poster", "banner", "logo", "profile", "still"]).parse(value);
          const folders = {
            poster: "posters",
            banner: "banners",
            logo: "logos",
            profile: "profiles",
            still: "stills",
          };
          params.push(role, `/media/uploads/${folders[role]}/%`);
          where += ` and (exists(select 1 from media_asset_assignments m where m.asset_id=t.id and (m.role::text=$${params.length - 1} or ($${params.length - 1}='still' and m.episode_id is not null))) or t.path like $${params.length})`;
          continue;
        }
        if (
          ![
            "kind",
            "entity_kind",
            "organization_id",
            "id",
            "slug",
            "name",
            "canonical_title",
          ].includes(key) ||
          !z.union([z.string(), z.number(), z.boolean()]).safeParse(value).success
        )
          throw new Error("مرشح المراجع غير صالح.");
        params.push(String(value));
        where += ` and t."${key}"::text=$${params.length}`;
      }
      // The table and columns are constrained by fixed enums/allowlists above.
      return sql.begin("isolation level repeatable read read only", async (tx) => {
        const table = (await loadSchema(tx)).tables.get(p.table);
        const dated = table?.columns.some((column) => column.name === "created_at");
        const order =
          p.sort !== "default" && dated
            ? `t.created_at ${p.sort === "newest" ? "desc" : "asc"},t.id`
            : "t.id";
        const projection =
          p.table === "media_assets"
            ? `to_jsonb(t)||jsonb_build_object('owner_label',(select string_agg(distinct coalesce(nullif(w.title_ar,''),w.canonical_title,n.name),' · ') from ${owners} where m.asset_id=t.id))`
            : "to_jsonb(t)";
        const rows = await tx.unsafe<{ row: z.infer<typeof jsonRow> }[]>(
          `select ${projection} as row from public.${p.table} t where ${where} order by ${order} limit $2 offset $3`,
          params,
        );
        const counts = await tx.unsafe<{ total: string }[]>(
          `select count(*) as total from public.${p.table} t where ${where} and $2::integer>=0 and $3::integer>=0`,
          params,
        );
        if (p.table === "entities" && rows.length) {
          const images = await tx<
            { entity_id: string; path: string }[]
          >`select distinct on (x.entity_id) x.entity_id,a.path from media_asset_assignments x join media_assets a on a.id=x.asset_id where x.entity_id in ${tx(rows.map(({ row }) => z.string().uuid().parse(row.id)))} order by x.entity_id,x.is_primary desc,case x.role when 'profile' then 0 when 'logo' then 1 else 2 end,x.id`;
          for (const { row } of rows)
            row.artwork_path = images.find((image) => image.entity_id === row.id)?.path ?? null;
        }
        return {
          rows: rows.map((r) => r.row),
          total: Number(counts[0]?.total ?? 0),
          offset: p.offset,
        };
      });
    }
    case "schema": {
      const schema = await loadSchema(sql);
      return [...editorTables, "installments", "title_relations", "award_recognitions"].map(
        (name) => {
          const table = schema.tables.get(name);
          if (!table) throw new Error("جدول المراجع غير موجود.");
          return {
            name,
            writable: false,
            columns: table.columns.map((column) => ({
              name: column.name,
              data_type: column.type,
              nullable: column.nullable,
              primary: table.primaryKey.includes(column.name),
              generated: column.isGenerated,
              default_value: null,
              enum_values: column.enumValues ?? [],
            })),
          };
        },
      );
    }
    case "vocabulary": {
      const p = rpcInputs.vocabulary.parse(input.data);
      return Promise.all(
        [...new Set(p.tables)].map(async (table) => {
          const rows = await sql.unsafe<{ row: z.infer<typeof jsonRow> }[]>(
            `select to_jsonb(t) as row from public.${table} t order by id limit 2000`,
          );
          return {
            table,
            options: rows.map(({ row }) => ({
              value: z.string().parse(row.slug),
              label: z
                .string()
                .parse(row.label_ar ?? row.name_ar ?? row.label ?? row.name ?? row.slug),
            })),
          };
        }),
      );
    }
  }
}
let output: z.infer<ReturnType<typeof z.json>>;
try {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) throw new Error("الطلب كبير جداً.");
    chunks.push(chunk);
  }
  const input = envelope.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  const result = await execute(input);
  output = z.json().parse(JSON.parse(JSON.stringify({ ok: true, result })));
} catch (error) {
  const known =
    error instanceof z.ZodError
      ? error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 8)
          .join("\n")
      : error instanceof Error
        ? error.message
        : "تعذّرت العملية.";
  const database = z.object({ code: z.string() }).safeParse(error);
  output = {
    ok: false,
    message: database.success
      ? "تعارض أو تعذّر تنفيذ العملية في قاعدة البيانات؛ لم يُحفظ جزء من الدفعة."
      : known,
    status: database.success
      ? database.data.code.startsWith("08")
        ? 503
        : 409
      : known.includes("انتهت الجلسة")
        ? 403
        : /تغيّر|المراجعة|حُفظ/.test(known)
          ? 409
          : 400,
  };
} finally {
  await closeDatabase();
}
process.stdout.write(JSON.stringify(output));

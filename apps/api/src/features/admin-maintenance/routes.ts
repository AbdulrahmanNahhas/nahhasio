import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

import { database } from "../../database";
import { purgeUnreferencedMedia } from "../../media-assign";
import { storedMediaExists } from "../../media-storage";
import { currentFamilyAccount } from "../accounts/routes";
import { collectValidationIssues } from "./validation";

/**
 * Maintenance actions behind `/admin/archive` ("الصيانة") and the fix buttons on
 * `/admin/validation`. Each one does real work synchronously and records itself in
 * `background_jobs` with a result, so the page shows *what happened* (counts), not a spinner
 * over a row that was inserted as "completed" without doing anything — which is what the old
 * `POST /admin/archive/jobs` did.
 */
export const adminMaintenanceRoutes = new OpenAPIHono();

export const maintenanceJobTypes = [
  "validate",
  "inspect-media",
  "purge-orphans",
  "drop-missing",
  "export",
] as const;
export type MaintenanceJobType = (typeof maintenanceJobTypes)[number];

type JobResult = Record<string, number | string>;

async function recordJob(
  actorId: string,
  type: MaintenanceJobType,
  run: () => Promise<JobResult>,
): Promise<{ id: string; result: JobResult }> {
  const sql = database().client;
  const [job] = await sql`insert into background_jobs
    (created_by_account_id, type, status, progress, payload, started_at)
    values (${actorId}, ${type}, 'running', 0, '{}'::jsonb, now()) returning id`;
  const id = String(job?.id);
  try {
    const result = await run();
    await sql`update background_jobs set status='completed', progress=100,
      result=${JSON.stringify(result)}::jsonb, finished_at=now() where id=${id}`;
    return { id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشلت المهمة.";
    await sql`update background_jobs set status='failed', error=${message}, finished_at=now()
      where id=${id}`;
    throw error;
  }
}

/** Assets no assignment references: their rows and files can go. */
async function orphanAssetPaths() {
  const rows = await database().client`select path from media_assets a
    where not exists (select 1 from media_asset_assignments x where x.asset_id=a.id)`;
  return rows.map((row) => String(row.path));
}

async function runValidate(): Promise<JobResult> {
  const issues = await collectValidationIssues();
  return {
    total: issues.length,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
    autoRepairable: issues.filter((issue) => issue.autoRepairable).length,
  };
}

async function runInspectMedia(): Promise<JobResult> {
  const rows = await database().client`select a.path, a.byte_size,
    (select count(*)::int from media_asset_assignments x where x.asset_id=a.id) as usage
    from media_assets a`;
  let missing = 0;
  let orphans = 0;
  let bytes = 0;
  for (const row of rows) {
    bytes += Number(row.byte_size);
    if (Number(row.usage) === 0) orphans += 1;
    if (!(await storedMediaExists(String(row.path)))) missing += 1;
  }
  return { assets: rows.length, missing, orphans, bytes };
}

async function runPurgeOrphans(): Promise<JobResult> {
  const paths = await orphanAssetPaths();
  await purgeUnreferencedMedia(paths);
  const [left] = await database().client`select count(*)::int as count from media_assets a
    where not exists (select 1 from media_asset_assignments x where x.asset_id=a.id)`;
  return { candidates: paths.length, removed: paths.length - Number(left?.count ?? 0) };
}

/** Records whose file is gone from disk: delete the row (assignments cascade), nothing to purge. */
async function runDropMissing(): Promise<JobResult> {
  const sql = database().client;
  const rows = await sql`select id, path from media_assets`;
  let removed = 0;
  for (const row of rows) {
    if (await storedMediaExists(String(row.path))) continue;
    await sql`delete from media_assets where id=${row.id}`;
    removed += 1;
  }
  return { checked: rows.length, removed };
}

const runners = {
  validate: runValidate,
  "inspect-media": runInspectMedia,
  "purge-orphans": runPurgeOrphans,
  "drop-missing": runDropMissing,
  export: async () => ({ note: "استخدم زر التصدير لتنزيل الملف." }),
} satisfies Record<MaintenanceJobType, () => Promise<JobResult>>;

const jobInputSchema = z.object({ type: z.enum(maintenanceJobTypes) });

adminMaintenanceRoutes.post("/api/v1/admin/maintenance/jobs", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = jobInputSchema.safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "نوع المهمة غير صالح." }, 400);
  try {
    const outcome = await recordJob(
      current.account.id,
      parsed.data.type,
      runners[parsed.data.type],
    );
    return context.json(outcome, 201);
  } catch (error) {
    return context.json({ message: error instanceof Error ? error.message : "فشلت المهمة." }, 500);
  }
});

/** One-off fix for a single validation issue (the row button), without a job record. */
adminMaintenanceRoutes.post("/api/v1/admin/maintenance/repair", async (context) => {
  const current = await currentFamilyAccount(context.req.raw.headers);
  if (!current) return context.json({ message: "الحساب غير متاح." }, 401);
  const parsed = z.object({ issueId: z.string().min(1) }).safeParse(await context.req.json());
  if (!parsed.success) return context.json({ message: "معرّف غير صالح." }, 400);
  const [kind, id] = parsed.data.issueId.split(":");
  const sql = database().client;
  if (kind === "asset-orphan" && id) {
    const [asset] = await sql`select path from media_assets a where a.id=${id}
      and not exists (select 1 from media_asset_assignments x where x.asset_id=a.id)`;
    if (!asset) return context.json({ message: "الأصل لم يعد يتيماً." }, 409);
    await purgeUnreferencedMedia([String(asset.path)]);
    return context.json({ repaired: parsed.data.issueId });
  }
  if (kind === "asset-missing" && id) {
    const [asset] = await sql`select path from media_assets where id=${id}`;
    if (!asset) return context.json({ message: "السجل غير موجود." }, 404);
    if (await storedMediaExists(String(asset.path))) {
      return context.json({ message: "الملف موجود على القرص الآن؛ لا شيء لحذفه." }, 409);
    }
    await sql`delete from media_assets where id=${id}`;
    return context.json({ repaired: parsed.data.issueId });
  }
  return context.json({ message: "هذه الملاحظة تحتاج قراراً تحريرياً ولا تُصلح تلقائياً." }, 400);
});

const startedAt = Date.now();

/**
 * What the overview's "الخادم" card shows: database and media sizes, the migration head,
 * which integrations have keys, and the API's own version/uptime. Cheap queries only.
 */
adminMaintenanceRoutes.get("/api/v1/admin/health", async (context) => {
  const sql = database().client;
  const [db] = await sql`select pg_database_size(current_database())::bigint as bytes,
    (select count(*)::int from titles) as titles,
    (select count(*)::int from installments) as installments,
    (select count(*)::int from episodes) as episodes,
    (select count(*)::int from accounts) as accounts,
    (select count(*)::int from account_downloads) as downloads,
    (select max(created_at) from audit_logs) as last_admin_action`;
  // drizzle-kit's journal table: (id, hash, created_at as epoch ms) — no human name, so the count
  // and the timestamp of the newest one are what an admin can compare against the repo.
  const [migration] = await sql`select count(*)::int as applied, max(created_at)::bigint as latest
    from drizzle.__drizzle_migrations`.catch(() => [undefined]);
  const [media] =
    await sql`select count(*)::int as assets, coalesce(sum(byte_size),0)::bigint as bytes,
    count(*) filter (where deletion_error is not null)::int as deletion_failures from media_assets`;
  const [jobs] = await sql`select max(finished_at) filter (where type='validate') as last_validate,
    max(finished_at) filter (where type='inspect-media') as last_inspect from background_jobs`;
  const integrations = {
    tmdb: Boolean(process.env.TMDB_API_READ_ACCESS_KEY),
    fanart: Boolean(process.env.FANART_API_KEY),
    streamAddon: Boolean(process.env.NAHHASIO_STREAM_ADDON_URL),
    openSubtitles: Boolean(process.env.OPENSUBTITLES_API_KEY),
  };
  return context.json({
    api: {
      version: process.env.npm_package_version ?? null,
      node: process.version,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      environment: process.env.NODE_ENV ?? "development",
      mediaRoot:
        process.env.NAHHASIO_MEDIA_ROOT ??
        process.env.NAHHASIO_MEDIA_ROOT ??
        "data/media/uploads (default)",
    },
    database: {
      bytes: Number(db?.bytes ?? 0),
      titles: Number(db?.titles ?? 0),
      installments: Number(db?.installments ?? 0),
      episodes: Number(db?.episodes ?? 0),
      accounts: Number(db?.accounts ?? 0),
      downloads: Number(db?.downloads ?? 0),
      migration: migration
        ? {
            applied: Number(migration.applied),
            latestAt: migration.latest ? new Date(Number(migration.latest)).toISOString() : null,
          }
        : null,
      lastAdminAction: db?.last_admin_action
        ? new Date(String(db.last_admin_action)).toISOString()
        : null,
    },
    media: {
      assets: Number(media?.assets ?? 0),
      bytes: Number(media?.bytes ?? 0),
      deletionFailures: Number(media?.deletion_failures ?? 0),
    },
    maintenance: {
      lastValidate: jobs?.last_validate ? new Date(String(jobs.last_validate)).toISOString() : null,
      lastInspect: jobs?.last_inspect ? new Date(String(jobs.last_inspect)).toISOString() : null,
    },
    integrations,
  });
});

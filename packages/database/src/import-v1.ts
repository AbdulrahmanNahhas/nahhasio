import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import postgres from "postgres";

import { legacyArtworkPath, legacySourcePath } from "./legacy-source";

type Row = Record<string, unknown>;
type Report = {
  source: Record<string, number>;
  imported: Record<string, number>;
  skipped: Record<string, number>;
  unresolvedRelationships: Row[];
  ambiguousScores: Row[];
  manualMovieGrouping: Row[];
  missingArtwork: string[];
};

const repositoryRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const sourcePath = legacySourcePath();
const reportPath = resolve(
  process.env.ARCADIA_IMPORT_REPORT ?? repositoryRoot,
  process.env.ARCADIA_IMPORT_REPORT ? "" : "migration-report.json",
);
const dryRun = process.argv.includes("--dry-run");
if (!existsSync(sourcePath)) throw new Error(`SQLite source not found: ${sourcePath}`);
if (!process.env.DATABASE_URL && !dryRun)
  throw new Error("DATABASE_URL is required unless --dry-run is used");

const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const hasTable = (name: string) =>
  Boolean(
    source.prepare("select 1 from sqlite_master where type = 'table' and name = ?").get(name),
  );
const rows = (name: string) =>
  hasTable(name) ? (source.prepare(`select * from "${name}"`).all() as Row[]) : [];
const works = rows("works");
const mediaWorks = works.filter((work) => ["movie", "series", "anime"].includes(String(work.kind)));
const mediaIds = new Set(mediaWorks.map((work) => String(work.id)));
const seasons = rows("work_seasons").filter((row) => mediaIds.has(String(row.work_id)));
const units = rows("work_units").filter(
  (row) => mediaIds.has(String(row.work_id)) && row.unit_type === "episode",
);
const relations = rows("work_relations").filter(
  (row) => mediaIds.has(String(row.source_work_id)) || mediaIds.has(String(row.target_work_id)),
);
const scores = rows("personal_scores").filter((row) => mediaIds.has(String(row.work_id)));
const assets = rows("assets").filter(
  (row) => row.owner_type === "work" && mediaIds.has(String(row.owner_id)),
);
const installmentCount = new Map<string, number>();
for (const work of mediaWorks)
  installmentCount.set(
    String(work.id),
    work.kind === "movie"
      ? 1
      : Math.max(1, seasons.filter((season) => season.work_id === work.id).length),
  );

const report: Report = {
  source: {
    works: works.length,
    seasons: rows("work_seasons").length,
    units: rows("work_units").length,
  },
  imported: {
    titles: mediaWorks.length,
    installments: [...installmentCount.values()].reduce((a, b) => a + b, 0),
    episodes: units.length,
  },
  skipped: {
    nonMediaWorks: works.length - mediaWorks.length,
    nonEpisodeUnits: rows("work_units").length - units.length,
  },
  unresolvedRelationships: relations.filter(
    (row) => !mediaIds.has(String(row.source_work_id)) || !mediaIds.has(String(row.target_work_id)),
  ),
  ambiguousScores: scores.filter((row) => (installmentCount.get(String(row.work_id)) ?? 0) > 1),
  manualMovieGrouping: relations.filter(
    (row) =>
      row.relation_type === "sequel" &&
      mediaWorks.find((work) => work.id === row.source_work_id)?.kind === "movie" &&
      mediaWorks.find((work) => work.id === row.target_work_id)?.kind === "movie",
  ),
  missingArtwork: assets
    .map((asset) => String(asset.relative_path))
    .filter((path) => !existsSync(legacyArtworkPath(path))),
};

if (!dryRun) {
  const sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
  const titleIds = new Map(mediaWorks.map((work) => [String(work.id), randomUUID()]));
  await sql.begin(async (tx) => {
    for (const work of mediaWorks) {
      const titleId = titleIds.get(String(work.id)) as string;
      const workAssets = assets.filter((asset) => asset.owner_id === work.id);
      await tx`insert into titles (id, canonical_title, sort_title, summary, release_year) values (${titleId}, ${String(work.canonical_title)}, ${String(work.sort_title)}, ${String(work.summary ?? "")}, ${work.release_year as number | null}) on conflict (id) do nothing`;
      for (const sourceAsset of workAssets) {
        const path = String(sourceAsset.relative_path);
        const filePath = legacyArtworkPath(path);
        if (!existsSync(filePath)) continue;
        const bytes = readFileSync(filePath);
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        const role = String(sourceAsset.asset_type);
        if (!["poster", "banner", "logo"].includes(role)) continue;
        const [mediaAsset] = await tx`insert into media_assets
          (path, sha256, mime_type, byte_size, width, height, original_filename)
          values (${path}, ${sha256}, ${String(sourceAsset.mime_type)}, ${bytes.byteLength}, ${Math.max(1, Number(sourceAsset.width ?? 1))}, ${Math.max(1, Number(sourceAsset.height ?? 1))}, ${basename(path)})
          on conflict (sha256) do update set updated_at=now() returning id`;
        await tx`insert into media_asset_assignments (asset_id, role, title_id, is_primary)
          values (${mediaAsset?.id}, ${role}, ${titleId}, true) on conflict do nothing`;
      }
      const ownSeasons = seasons.filter((season) => season.work_id === work.id);
      const groups =
        work.kind === "movie"
          ? [
              {
                id: null,
                title: work.canonical_title,
                position: 0,
                runtime_minutes: work.runtime_minutes,
                release_at: work.original_release_at,
              },
            ]
          : ownSeasons.length
            ? ownSeasons
            : [
                {
                  id: null,
                  title: "Season 1",
                  position: 0,
                  runtime_minutes: null,
                  release_at: work.original_release_at,
                },
              ];
      for (const group of groups) {
        const installmentId = randomUUID();
        await tx`insert into installments (id, title_id, kind, position, title, runtime_minutes, release_date, status) values (${installmentId}, ${titleId}, ${work.kind === "movie" ? "movie" : "season"}, ${Number(group.position)}, ${String(group.title)}, ${group.runtime_minutes as number | null}, ${group.release_at ? new Date(Number(group.release_at) * 1000).toISOString().slice(0, 10) : null}, ${String(work.status ?? "unknown")})`;
        const groupUnits = units.filter(
          (unit) =>
            unit.work_id === work.id &&
            (group.id ? unit.season_id === group.id : unit.season_id == null),
        );
        for (const unit of groupUnits)
          await tx`insert into episodes (installment_id, number, position, title, runtime_minutes, release_date) values (${installmentId}, ${Number(unit.unit_number ?? unit.position)}, ${Number(unit.position)}, ${unit.title as string | null}, ${unit.runtime_minutes as number | null}, ${unit.release_at ? new Date(Number(unit.release_at) * 1000).toISOString().slice(0, 10) : null})`;
      }
    }
  });
  await sql.end();
}

source.close();
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ dryRun, reportPath, ...report.imported }, null, 2));
if (!dryRun) {
  await import("./import-v1-knowledge");
  await import("./consolidate-v1-franchises");
}

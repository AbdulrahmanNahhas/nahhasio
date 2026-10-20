import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

import Database from "better-sqlite3";
import postgres from "postgres";

import { legacyArtworkPath, legacySourcePath } from "./legacy-source";

type Row = Record<string, unknown>;
const sourcePath = legacySourcePath();
if (!existsSync(sourcePath)) throw new Error(`SQLite source not found: ${sourcePath}`);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const tableExists = (name: string) =>
  Boolean(source.prepare("select 1 from sqlite_master where type='table' and name=?").get(name));
const rows = (name: string) =>
  tableExists(name) ? (source.prepare(`select * from "${name}"`).all() as Row[]) : [];
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const metadata = (work: Row) => {
  try {
    return typeof work.metadata === "string"
      ? (JSON.parse(work.metadata) as Record<string, unknown>)
      : ((work.metadata ?? {}) as Record<string, unknown>);
  } catch {
    return {};
  }
};

const sourceWorks = rows("works").filter((work) =>
  ["movie", "series", "anime"].includes(String(work.kind)),
);
const targetTitles = await sql`select id, canonical_title, release_year from titles`;
const titleIds = new Map<string, string>();
for (const work of sourceWorks) {
  const target = targetTitles.find(
    (title) =>
      title.canonical_title === work.canonical_title &&
      (title.release_year === work.release_year || work.release_year == null),
  );
  if (target) titleIds.set(String(work.id), String(target.id));
}

const sourcePlanets = rows("planets");
const sourceEntities = rows("entities");
const legacyRoleMap: Record<string, string> = {
  author: "original_author",
  "original-author": "original_author",
  writer: "writer",
  screenwriter: "writer",
  director: "director",
  illustrator: "character_designer",
  artist: "art_director",
  "animation-studio": "animation_studio",
  "production-company": "production_company",
  developer: "production_company",
  publisher: "publisher",
  composer: "composer",
  editor: "writer",
  translator: "writer",
  creator: "creator",
};
const planetIds = new Map<string, string>();
const entityIds = new Map<string, string>();
const profileAssets = rows("assets").filter(
  (asset) => asset.owner_type === "entity" && asset.asset_type === "profile",
);

await sql.begin(async (tx) => {
  for (const planet of sourcePlanets) {
    const [existing] = await tx`select id from planets where slug=${String(planet.slug)}`;
    const id = existing?.id ?? randomUUID();
    planetIds.set(String(planet.id), String(id));
    await tx`insert into planets (id, slug, name_ar, name_en, icon, description, primary_color, secondary_color, display_order, is_active)
      values (${id}, ${planet.slug as string}, ${planet.name_ar as string}, ${planet.name_en as string | null}, ${planet.icon as string}, ${String(planet.description ?? "")}, ${planet.primary_color as string}, ${planet.secondary_color as string}, ${Number(planet.display_order ?? 0)}, ${Boolean(planet.is_active)})
      on conflict (slug) do update set name_ar=excluded.name_ar, name_en=excluded.name_en, icon=excluded.icon, description=excluded.description, primary_color=excluded.primary_color, secondary_color=excluded.secondary_color, display_order=excluded.display_order, is_active=excluded.is_active`;
  }
  for (const assignment of rows("work_planet_assignments")) {
    const titleId = titleIds.get(String(assignment.work_id));
    const planetId = planetIds.get(String(assignment.planet_id));
    if (titleId && planetId)
      await tx`insert into title_planets (title_id, planet_id, featured_rank) values (${titleId}, ${planetId}, ${assignment.featured_rank as number | null}) on conflict (title_id, planet_id) do update set featured_rank=excluded.featured_rank`;
  }

  for (const entity of sourceEntities) {
    const [existing] =
      await tx`select id from entities where kind=${entity.entity_type as string} and sort_name=${entity.sort_name as string}`;
    const id = existing?.id ?? randomUUID();
    entityIds.set(String(entity.id), String(id));
    const image = profileAssets.find((asset) => asset.owner_id === entity.id)?.relative_path as
      | string
      | undefined;
    await tx`insert into entities (id, kind, name, sort_name, description)
      values (${id}, ${entity.entity_type as string}, ${entity.name as string}, ${entity.sort_name as string}, ${String(entity.description ?? "")})
      on conflict (kind, sort_name) do update set name=excluded.name, description=excluded.description`;
    if (image) {
      const sourceAsset = profileAssets.find((asset) => asset.owner_id === entity.id);
      const filePath = legacyArtworkPath(image);
      if (sourceAsset && existsSync(filePath)) {
        const bytes = readFileSync(filePath);
        const [asset] = await tx`insert into media_assets
          (path, sha256, mime_type, byte_size, width, height, original_filename)
          values (${image}, ${createHash("sha256").update(bytes).digest("hex")}, ${String(sourceAsset.mime_type)}, ${bytes.byteLength}, ${Math.max(1, Number(sourceAsset.width ?? 1))}, ${Math.max(1, Number(sourceAsset.height ?? 1))}, ${basename(image)})
          on conflict (sha256) do update set updated_at=now() returning id`;
        await tx`insert into media_asset_assignments (asset_id, role, entity_id, is_primary)
          values (${asset?.id}, 'profile', ${id}, true) on conflict do nothing`;
      }
    }
  }
  for (const alias of rows("entity_aliases")) {
    const entityId = entityIds.get(String(alias.entity_id));
    if (entityId)
      await tx`insert into entity_aliases (entity_id, alias, language) select ${entityId}, ${alias.alias as string}, ${alias.language as string | null} where not exists (select 1 from entity_aliases where entity_id=${entityId} and alias=${alias.alias as string})`;
  }

  const targetRoles = await tx`select id, slug, entity_kind from roles`;
  for (const credit of rows("work_contributions")) {
    const titleId = titleIds.get(String(credit.work_id));
    const entityId = entityIds.get(String(credit.entity_id));
    const roleSlug = legacyRoleMap[String(credit.role)];
    if (!roleSlug) throw new Error(`Unsupported legacy contribution role: ${String(credit.role)}`);
    const sourceEntity = sourceEntities.find((entity) => entity.id === credit.entity_id);
    const role = targetRoles.find((item) => item.slug === roleSlug);
    if (role && sourceEntity && role.entity_kind !== sourceEntity.entity_type)
      throw new Error(`Legacy role ${String(credit.role)} is incompatible with its entity type`);
    if (titleId && entityId && role)
      await tx`insert into contributions (title_id, entity_id, role_id, position, is_primary) values (${titleId}, ${entityId}, ${role.id}, ${Number(credit.position ?? 0)}, ${Boolean(credit.is_primary)}) on conflict (title_id, entity_id, role_id) do update set position=excluded.position, is_primary=excluded.is_primary`;
  }

  const sourceTerms = rows("terms");
  const vocabularyTables: Record<string, string> = {
    genre: "genres",
    tone: "tones",
    tag: "tags",
    country: "countries",
  };
  for (const term of sourceTerms.filter((item) => item.vocabulary === "country"))
    await tx`insert into countries (slug, label_en, label_ar, position) values (${term.slug as string}, ${term.name as string}, ${String(term.label_ar ?? term.name)}, 0) on conflict (slug) do nothing`;
  const lookupIds = new Map<string, string>();
  for (const [vocabulary, table] of Object.entries(vocabularyTables)) {
    const lookup = await tx`select id, slug from ${tx(table)}`;
    for (const item of lookup) lookupIds.set(`${vocabulary}:${item.slug}`, String(item.id));
  }
  for (const link of rows("work_terms")) {
    const titleId = titleIds.get(String(link.work_id));
    const term = sourceTerms.find((item) => item.id === link.term_id);
    if (!titleId || !term) continue;
    if (term.vocabulary === "audience") {
      const value =
        String(term.slug) === "young-adult" ? "young-adult" : String(term.slug).toLowerCase();
      if (["general", "teen", "young-adult", "adult"].includes(value))
        await tx`update titles set audience=${value} where id=${titleId}`;
      continue;
    }
    const table = vocabularyTables[String(term.vocabulary)];
    const valueId = lookupIds.get(`${term.vocabulary}:${term.slug}`);
    const linkTable =
      term.vocabulary === "genre"
        ? "title_genres"
        : term.vocabulary === "tone"
          ? "title_tones"
          : term.vocabulary === "tag"
            ? "title_tags"
            : term.vocabulary === "country"
              ? "title_countries"
              : null;
    if (table && valueId && linkTable)
      await tx`insert into ${tx(linkTable)} (title_id, value_id) values (${titleId}, ${valueId}) on conflict do nothing`;
  }
  await tx`delete from title_tags where value_id in (
    select value_id from title_tags group by value_id having count(distinct title_id) < 3
  )`;

  for (const title of rows("work_titles")) {
    const titleId = titleIds.get(String(title.work_id));
    if (titleId && String(title.language ?? "").startsWith("ar"))
      await tx`update titles set title_ar=${title.title as string} where id=${titleId} and title_ar is null`;
    if (titleId && title.title_type !== "canonical")
      await tx`insert into title_aliases (title_id, title, language, script, is_preferred) values (${titleId}, ${title.title as string}, ${title.language as string | null}, ${title.script as string | null}, ${Boolean(title.is_preferred)}) on conflict do nothing`;
  }
  for (const work of sourceWorks) {
    const titleId = titleIds.get(String(work.id));
    if (!titleId) continue;
    const details = metadata(work);
    await tx`update titles set content_warnings=${typeof details.contentWarnings === "string" ? details.contentWarnings : null}, analysis_notes=${typeof details.analysisNotes === "string" ? details.analysisNotes : null} where id=${titleId}`;
    await tx`insert into media_asset_assignments (asset_id, role, installment_id, is_primary)
      select title_asset.asset_id, 'poster', i.id, true from installments i
      join media_asset_assignments title_asset on title_asset.title_id=${titleId} and title_asset.role='poster' and title_asset.is_primary
      where i.title_id=${titleId} and not exists (select 1 from media_asset_assignments own where own.installment_id=i.id and own.role='poster' and own.is_primary)
      on conflict do nothing`;
  }
  const scoresByWork = new Map<string, Record<string, number>>();
  for (const score of rows("personal_scores")) {
    const values = scoresByWork.get(String(score.work_id)) ?? {};
    values[String(score.criterion)] = Number(score.value);
    scoresByWork.set(String(score.work_id), values);
  }
  for (const [sourceWorkId, score] of scoresByWork) {
    const titleId = titleIds.get(sourceWorkId);
    if (!titleId) continue;
    const installmentRows =
      await tx`select id from installments where title_id=${titleId} order by position limit 1`;
    for (const installment of installmentRows)
      await tx`insert into installment_scores (installment_id, story, characters, depth, world_building, originality, craft)
        values (${installment.id}, ${score.story ?? null}, ${score.characters ?? null}, ${score.depth ?? null}, ${score.worldBuilding ?? null}, ${score.originality ?? null}, ${score.craft ?? null})
        on conflict (installment_id) do update set story=excluded.story, characters=excluded.characters, depth=excluded.depth, world_building=excluded.world_building, originality=excluded.originality, craft=excluded.craft`;
  }
  for (const link of rows("external_links")) {
    const titleId = titleIds.get(String(link.owner_id));
    if (titleId)
      await tx`insert into external_identities (title_id, provider, external_id, url) values (${titleId}, ${link.provider as string}, ${String(link.external_id ?? link.url)}, ${link.url as string}) on conflict do nothing`;
  }
  for (const relation of rows("work_relations")) {
    const sourceId = titleIds.get(String(relation.source_work_id));
    const targetId = titleIds.get(String(relation.target_work_id));
    if (sourceId && targetId)
      await tx`insert into title_relations (source_title_id, target_title_id, kind, notes) values (${sourceId}, ${targetId}, ${relation.relation_type as string}, ${String(relation.notes ?? "")}) on conflict do nothing`;
  }

  const dimensions = rows("risk_dimensions");
  for (const assessment of rows("work_risk_assessments")) {
    const titleId = titleIds.get(String(assessment.work_id));
    const dimension = dimensions.find((item) => item.id === assessment.dimension_id)?.slug;
    if (!titleId || !["sexuality", "behavioral", "theology"].includes(String(dimension))) continue;
    if (dimension === "sexuality")
      await tx`update titles set sexuality_risk=${assessment.level as string} where id=${titleId}`;
    if (dimension === "behavioral")
      await tx`update titles set behavioral_risk=${assessment.level as string} where id=${titleId}`;
    if (dimension === "theology")
      await tx`update titles set theology_risk=${assessment.level as string} where id=${titleId}`;
  }

  const relationshipTypes = rows("organization_relationship_types");
  for (const relation of rows("entity_relationships")) {
    const sourceId = entityIds.get(String(relation.source_entity_id));
    const targetId = entityIds.get(String(relation.target_entity_id));
    const type = relationshipTypes.find((item) => item.id === relation.relationship_type_id);
    if (sourceId && targetId)
      await tx`insert into organization_relations (source_id, target_id, relation_type, occurred_on, description)
      select ${sourceId}, ${targetId}, ${String(type?.name_ar ?? relation.relationship_type_id)}, ${relation.occurred_on as string | null}, ${String(relation.description ?? "")}
      where not exists (select 1 from organization_relations where source_id=${sourceId} and target_id=${targetId} and relation_type=${String(type?.name_ar ?? relation.relationship_type_id)})`;
  }
});

const counts = await sql`select
  (select count(*)::int from planets) as planets,
  (select count(*)::int from entities) as entities,
  (select count(*)::int from contributions) as contributions,
  (select count(*)::int from title_planets) as planet_assignments,
  (select count(*)::int from title_genres) as genres,
  (select count(*)::int from title_tags) as tags,
  (select count(*)::int from title_relations) as title_relations,
  (select count(*)::int from organization_relations) as organization_relations`;
source.close();
await sql.end();
console.log(JSON.stringify({ matchedTitles: titleIds.size, ...counts[0] }, null, 2));

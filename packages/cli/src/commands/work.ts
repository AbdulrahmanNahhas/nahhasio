/**
 * `nahhasio work apply` / `nahhasio work export` — whole-work editing as a single document.
 *
 * Creating a title the granular way means a dozen ordered commands across nine tables
 * (title, aliases, trivia, genres/tones/tags/countries, planet, credits, installments,
 * episodes, scores, awards, media) with UUIDs threaded between them. This command takes one JSON
 * document describing the finished state and reconciles the database to it inside one
 * transaction, so a partial failure leaves nothing behind.
 *
 * `export` emits the same shape it accepts, which makes "read, edit one field, apply" a safe
 * round trip and gives an agent a working template for any new work.
 */

import { readFile } from "node:fs/promises";

import {
  workDocument,
  installmentDocument,
  episodeDocument,
  creditDocument,
  awardDocument,
  type WorkDocument,
} from "@arcadia/contracts/work";
import { z } from "zod";

import type { ParsedArgs } from "../args";
import { boolFlag, stringFlag } from "../args";
import { parameters, recordAudit, type Sql, type TransactionSql } from "../db";
import { loadSchema, requireTable } from "../introspect";
import { CliError } from "../output";
import { resolveRef } from "../resolve";
import type { Row, SqlValue } from "../types";
export { workDocument, type WorkDocument } from "@arcadia/contracts/work";

type ApplyMode = "merge" | "replace";

type ApplyOutcome = { titleId: string; created: boolean };

/** Numeric columns arrive as strings from the driver; null stays null rather than becoming 0. */
function number(value: SqlValue): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** An award's `installment` field is either a 1-based position in this document or a UUID. */
function isPositionReference(value: number | string): value is number {
  return typeof value === "number";
}

/**
 * Sort key convention used across the catalog: the canonical title, lowercased. Leading
 * articles are deliberately kept — every one of the existing 172 rows sorts under "the …"
 * rather than under the following word.
 */
export function deriveSortTitle(canonicalTitle: string): string {
  return canonicalTitle.trim().toLowerCase();
}

const lookupTables = {
  genres: "title_genres",
  tones: "title_tones",
  tags: "title_tags",
  countries: "title_countries",
} as const;

type LookupName = keyof typeof lookupTables;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

async function resolveVocabulary(
  transaction: TransactionSql,
  table: LookupName,
  value: string,
  createMissing: boolean,
): Promise<string> {
  const rows = await transaction.unsafe<Array<{ id: string }>>(
    `select id from "${table}"
     where lower(btrim(slug)) = lower(btrim($1))
        or lower(btrim(label_en)) = lower(btrim($1))
        or lower(btrim(label_ar)) = lower(btrim($1))
     limit 2`,
    [value],
  );
  const first = rows[0];
  if (first) return first.id;
  if (!createMissing) {
    throw new CliError(
      `No ${table.slice(0, -1)} matches "${value}"`,
      `List them with "nahhasio ${table.slice(0, -1)} list", or pass --create-missing to add it.`,
    );
  }
  const inserted = await transaction.unsafe<Array<{ id: string }>>(
    `insert into "${table}" (slug, label_en, label_ar) values ($1, $2, $2) returning id`,
    [slugify(value), value],
  );
  const created = inserted[0];
  if (!created) throw new CliError(`Could not create ${table} term "${value}"`);
  return created.id;
}

async function resolveEntity(
  transaction: TransactionSql,
  name: string,
  roleKind: string,
  createMissing: boolean,
): Promise<string> {
  const rows = await transaction.unsafe<Array<{ id: string }>>(
    `select e.id from entities e
     where e.kind = $2 and (
       e.id::text = $1 or lower(btrim(e.name)) = lower(btrim($1)) or lower(btrim(e.sort_name)) = lower(btrim($1))
       or exists (select 1 from entity_aliases a
                  where a.entity_id = e.id and lower(btrim(a.alias)) = lower(btrim($1)))
     ) limit 2`,
    [name, roleKind],
  );
  const first = rows[0];
  if (first) return first.id;
  if (!createMissing) {
    throw new CliError(
      `No ${roleKind} named "${name}"`,
      `Create it with "nahhasio ${roleKind === "person" ? "person" : "studio"} create --set name='${name}' --set sort_name='${name}'", or pass --create-missing.`,
    );
  }
  const inserted = await transaction.unsafe<Array<{ id: string }>>(
    `insert into entities (kind, name, sort_name) values ($1, $2, $2) returning id`,
    [roleKind, name],
  );
  const created = inserted[0];
  if (!created) throw new CliError(`Could not create entity "${name}"`);
  return created.id;
}

async function syncLookup(
  transaction: TransactionSql,
  titleId: string,
  name: LookupName,
  values: readonly string[],
  mode: ApplyMode,
  createMissing: boolean,
): Promise<void> {
  const joinTable = lookupTables[name];
  const ids = new Set<string>();
  for (const value of values) {
    ids.add(await resolveVocabulary(transaction, name, value, createMissing));
  }
  if (mode === "replace") {
    const keep = [...ids];
    await transaction.unsafe(
      `delete from "${joinTable}" where title_id = $1${
        keep.length > 0 ? ` and value_id <> all($2::uuid[])` : ""
      }`,
      keep.length > 0 ? [titleId, keep] : [titleId],
    );
  }
  for (const id of ids) {
    await transaction.unsafe(
      `insert into "${joinTable}" (title_id, value_id) values ($1, $2) on conflict do nothing`,
      [titleId, id],
    );
  }
}

async function assignMedia(
  transaction: TransactionSql,
  owner: { column: string; id: string },
  media: Record<string, string | null>,
): Promise<void> {
  for (const [role, path] of Object.entries(media)) {
    if (!["poster", "banner", "logo", "profile", "still"].includes(role)) {
      throw new CliError(
        `Unknown media role "${role}"`,
        "Roles are poster, banner, logo, and profile.",
      );
    }
    if (!path) {
      await transaction.unsafe(
        `update media_asset_assignments set is_primary=false where "${owner.column}"=$1 and role=$2 and is_primary`,
        [owner.id, role],
      );
      continue;
    }
    const assets = await transaction.unsafe<Array<{ id: string }>>(
      `select a.id from media_assets a where a.path=$1 or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and l.changes->>'compatibilityPath'=$1) order by (a.path=$1) desc limit 1`,
      [path],
    );
    const asset = assets[0];
    if (!asset)
      throw new CliError(
        `No registered media asset at "${path}"`,
        `Ingest it first: nahhasio media ingest <file-or-url> --role ${role}`,
      );
    await transaction.unsafe(
      `update media_asset_assignments set is_primary=false where "${owner.column}"=$1 and role=$2 and is_primary and asset_id<>$3`,
      [owner.id, role, asset.id],
    );
    const existing = await transaction.unsafe<Array<{ id: string }>>(
      `select id from media_asset_assignments where "${owner.column}"=$1 and role=$2 and asset_id=$3 order by created_at limit 1`,
      [owner.id, role, asset.id],
    );
    if (existing[0])
      await transaction.unsafe(`update media_asset_assignments set is_primary=true where id=$1`, [
        existing[0].id,
      ]);
    else
      await transaction.unsafe(
        `insert into media_asset_assignments (asset_id,role,"${owner.column}",is_primary) values($1,$2,$3,true)`,
        [asset.id, role, owner.id],
      );
  }
}

const titleScalarColumns: Array<[keyof WorkDocument, string]> = [
  ["canonicalTitle", "canonical_title"],
  ["sortTitle", "sort_title"],
  ["titleAr", "title_ar"],
  ["summary", "summary"],
  ["contentWarnings", "content_warnings"],
  ["analysisNotes", "analysis_notes"],
  ["curatorNotes", "curator_notes"],
  ["releaseYear", "release_year"],
  ["format", "format"],
  ["isPrivate", "is_private"],
  ["workflowStatus", "workflow_status"],
  ["playbackPolicy", "playback_policy"],
  ["dubbingNotes", "dubbing_notes"],
  ["dubLanguages", "dub_languages"],
  ["qualityScore", "quality_score"],
  ["audience", "audience"],
  ["age", "age"],
  ["sexualityRisk", "sexuality_risk"],
  ["behavioralRisk", "behavioral_risk"],
  ["theologyRisk", "theology_risk"],
  ["tmdbId", "tmdb_id"],
  ["imdbId", "imdb_id"],
  ["anilistId", "anilist_id"],
  ["malId", "mal_id"],
];

async function upsertTitle(
  transaction: TransactionSql,
  document: WorkDocument,
  existingId: string | undefined,
  createId?: string,
): Promise<{ id: string; created: boolean }> {
  const values = new Map<string, SqlValue>();
  for (const [key, column] of titleScalarColumns) {
    const value = document[key];
    if (value !== undefined) values.set(column, value);
  }
  if (!values.has("sort_title")) {
    if (!existingId) values.set("sort_title", deriveSortTitle(document.canonicalTitle));
    else if (document.canonicalTitle !== undefined) {
      // Keep the stored sort key in step with a renamed title unless one was given explicitly.
      values.set("sort_title", deriveSortTitle(document.canonicalTitle));
    }
  }

  if (existingId) {
    const names = [...values.keys()];
    const parameterValues = [...values.values()];
    await transaction.unsafe(
      `update titles set ${names
        .map((name, index) => `"${name}" = $${index + 2}`)
        .join(", ")}, updated_at = now() where id = $1`,
      parameters([existingId, ...parameterValues]),
    );
    return { id: existingId, created: false };
  }

  if (createId) values.set("id", createId);
  const names = [...values.keys()];
  const rows = await transaction.unsafe<Array<{ id: string }>>(
    `insert into titles (${names.map((name) => `"${name}"`).join(", ")})
     values (${names.map((_name, index) => `$${index + 1}`).join(", ")}) returning id`,
    parameters([...values.values()]),
  );
  const row = rows[0];
  if (!row) throw new CliError("Insert into titles returned no row");
  return { id: row.id, created: true };
}

async function syncInstallments(
  transaction: TransactionSql,
  titleId: string,
  documents: readonly z.infer<typeof installmentDocument>[],
  mode: ApplyMode,
): Promise<Map<number, string>> {
  const existing = await transaction.unsafe<Array<{ id: string; position: number; title: string }>>(
    `select id, position, title from installments where title_id = $1`,
    parameters([titleId]),
  );
  const byId = new Map(existing.map((row) => [row.id, row]));
  const byPosition = new Map(existing.map((row) => [row.position, row]));
  const seen = new Set<string>();
  const positions = new Map<number, string>();

  for (const [index, document] of documents.entries()) {
    const position = document.position ?? index + 1;
    const match = document.id ? byId.get(document.id) : byPosition.get(position);
    const values = new Map<string, SqlValue>([
      ["kind", document.kind],
      ["position", position],
      ["title", document.title],
    ]);
    if (document.summary !== undefined) values.set("summary", document.summary);
    if (document.status !== undefined) values.set("status", document.status);
    if (document.releaseDate !== undefined) values.set("release_date", document.releaseDate);
    if (document.runtimeMinutes !== undefined)
      values.set("runtime_minutes", document.runtimeMinutes);
    for (const [key, column] of [
      ["audienceOverride", "audience_override"],
      ["ageOverride", "age_override"],
      ["sexualityRiskOverride", "sexuality_risk_override"],
      ["behavioralRiskOverride", "behavioral_risk_override"],
      ["theologyRiskOverride", "theology_risk_override"],
      ["tmdbId", "tmdb_id"],
      ["imdbId", "imdb_id"],
      ["anilistId", "anilist_id"],
      ["malId", "mal_id"],
    ] as const) {
      const value = document[key];
      if (value !== undefined) values.set(column, value);
    }

    let installmentId: string;
    if (match) {
      const names = [...values.keys()];
      await transaction.unsafe(
        `update installments set ${names
          .map((name, offset) => `"${name}" = $${offset + 2}`)
          .join(", ")}, updated_at = now() where id = $1`,
        parameters([match.id, ...values.values()]),
      );
      installmentId = match.id;
    } else {
      values.set("title_id", titleId);
      if (document.id) values.set("id", document.id);
      const names = [...values.keys()];
      const rows = await transaction.unsafe<Array<{ id: string }>>(
        `insert into installments (${names.map((name) => `"${name}"`).join(", ")})
         values (${names.map((_name, offset) => `$${offset + 1}`).join(", ")}) returning id`,
        parameters([...values.values()]),
      );
      const row = rows[0];
      if (!row) throw new CliError(`Could not insert installment "${document.title}"`);
      installmentId = row.id;
    }
    seen.add(installmentId);
    positions.set(position, installmentId);

    if (document.score) await upsertScore(transaction, installmentId, document.score);
    if (document.media)
      await assignMedia(
        transaction,
        { column: "installment_id", id: installmentId },
        document.media,
      );
    if (document.episodes) {
      await syncEpisodes(transaction, installmentId, document.episodes, mode);
    }
  }

  if (mode === "replace") {
    const keep = [...seen];
    await transaction.unsafe(
      `delete from installments where title_id = $1${
        keep.length > 0 ? ` and id <> all($2::uuid[])` : ""
      }`,
      keep.length > 0 ? [titleId, keep] : [titleId],
    );
  }
  return positions;
}

async function upsertScore(
  transaction: TransactionSql,
  installmentId: string,
  score: NonNullable<z.infer<typeof installmentDocument>["score"]>,
): Promise<void> {
  const columns: Array<[string, number | null | undefined]> = [
    ["story", score.story],
    ["characters", score.characters],
    ["depth", score.depth],
    ["world_building", score.worldBuilding],
    ["originality", score.originality],
    ["craft", score.craft],
  ];
  const provided = columns.filter(([, value]) => value !== undefined);
  if (provided.length === 0) return;
  const names = provided.map(([name]) => name);
  const scoreValues = provided.map(([, value]) => value ?? null);
  await transaction.unsafe(
    `insert into installment_scores (installment_id, ${names.map((name) => `"${name}"`).join(", ")})
     values ($1, ${names.map((_name, index) => `$${index + 2}`).join(", ")})
     on conflict (installment_id) do update set ${names
       .map((name) => `"${name}" = excluded."${name}"`)
       .join(", ")}, updated_at = now()`,
    [installmentId, ...scoreValues],
  );
}

async function syncEpisodes(
  transaction: TransactionSql,
  installmentId: string,
  documents: readonly z.infer<typeof episodeDocument>[],
  mode: ApplyMode,
): Promise<void> {
  const existing = await transaction.unsafe<Array<{ id: string; position: number }>>(
    `select id, position from episodes where installment_id = $1`,
    [installmentId],
  );
  const byId = new Map(existing.map((row) => [row.id, row]));
  const byPosition = new Map(existing.map((row) => [row.position, row]));
  const seen = new Set<string>();

  for (const [index, document] of documents.entries()) {
    const position = document.position ?? index + 1;
    const match = document.id ? byId.get(document.id) : byPosition.get(position);
    const values = new Map<string, SqlValue>([
      ["number", document.number],
      ["position", position],
    ]);
    if (document.title !== undefined) values.set("title", document.title);
    if (document.summary !== undefined) values.set("summary", document.summary);
    if (document.releaseDate !== undefined) values.set("release_date", document.releaseDate);
    if (document.runtimeMinutes !== undefined)
      values.set("runtime_minutes", document.runtimeMinutes);

    if (match) {
      if (document.media)
        await assignMedia(transaction, { column: "episode_id", id: match.id }, document.media);
      const names = [...values.keys()];
      await transaction.unsafe(
        `update episodes set ${names
          .map((name, offset) => `"${name}" = $${offset + 2}`)
          .join(", ")}, updated_at = now() where id = $1`,
        parameters([match.id, ...values.values()]),
      );
      seen.add(match.id);
      continue;
    }
    values.set("installment_id", installmentId);
    if (document.id) values.set("id", document.id);
    const names = [...values.keys()];
    const rows = await transaction.unsafe<Array<{ id: string }>>(
      `insert into episodes (${names.map((name) => `"${name}"`).join(", ")})
       values (${names.map((_name, offset) => `$${offset + 1}`).join(", ")}) returning id`,
      parameters([...values.values()]),
    );
    const row = rows[0];
    if (row) {
      seen.add(row.id);
      if (document.media)
        await assignMedia(transaction, { column: "episode_id", id: row.id }, document.media);
    }
  }

  if (mode === "replace") {
    const keep = [...seen];
    await transaction.unsafe(
      `delete from episodes where installment_id = $1${
        keep.length > 0 ? ` and id <> all($2::uuid[])` : ""
      }`,
      keep.length > 0 ? [installmentId, keep] : [installmentId],
    );
  }
}

async function syncCredits(
  transaction: TransactionSql,
  titleId: string,
  documents: readonly z.infer<typeof creditDocument>[],
  mode: ApplyMode,
  createMissing: boolean,
): Promise<void> {
  const pairs: Array<{ entityId: string; roleId: string }> = [];
  for (const [index, document] of documents.entries()) {
    const roles = await transaction.unsafe<Array<{ id: string; entity_kind: string }>>(
      `select id, entity_kind from roles
       where slug = $1 or lower(label_en) = lower($1) or lower(label_ar) = lower($1) limit 1`,
      [document.role],
    );
    const role = roles[0];
    if (!role) {
      throw new CliError(
        `Unknown credit role "${document.role}"`,
        'List valid roles with "nahhasio role list" or create a compatible role in the People/Studios editor.',
      );
    }
    const entityId = await resolveEntity(
      transaction,
      document.entity,
      role.entity_kind,
      createMissing,
    );
    await transaction.unsafe(
      `insert into contributions (title_id, entity_id, role_id, position, is_primary, languages)
       values ($1, $2, $3, $4, $5, $6::text[])
       on conflict (title_id, entity_id, role_id)
       do update set position = excluded.position, is_primary = excluded.is_primary,languages=case when $7::boolean then excluded.languages else contributions.languages end`,
      [
        titleId,
        entityId,
        role.id,
        document.position ?? index,
        document.isPrimary ?? false,
        document.languages ?? [],
        document.languages !== undefined,
      ],
    );
    pairs.push({ entityId, roleId: role.id });
  }
  if (mode === "replace") {
    // Two parallel arrays zipped by unnest: a credit survives only if the exact
    // (entity, role) pair appears in the document. Empty arrays clear every credit.
    await transaction.unsafe(
      `delete from contributions c
       where c.title_id = $1
         and not exists (
           select 1 from unnest($2::uuid[], $3::uuid[]) as kept(entity_id, role_id)
           where kept.entity_id = c.entity_id and kept.role_id = c.role_id
         )`,
      [titleId, pairs.map((pair) => pair.entityId), pairs.map((pair) => pair.roleId)],
    );
  }
}

async function syncAwards(
  transaction: TransactionSql,
  titleId: string,
  documents: readonly z.infer<typeof awardDocument>[],
  installmentPositions: Map<number, string>,
  createMissing: boolean,
): Promise<void> {
  for (const [index, document] of documents.entries()) {
    const organizations = await transaction.unsafe<
      Array<{ id: string; slug: string; name_ar: string }>
    >(
      `select id, slug, name_ar from award_organizations
       where id::text = $1 or slug = $1 or lower(name_ar) = lower($1) or lower(name_en) = lower($1) limit 1`,
      [document.organization],
    );
    let organization = organizations[0];
    if (!organization) {
      if (!createMissing) {
        throw new CliError(
          `No award organization matches "${document.organization}"`,
          'List them with "nahhasio award-org list", or pass --create-missing.',
        );
      }
      const inserted = await transaction.unsafe<
        Array<{ id: string; slug: string; name_ar: string }>
      >(
        `insert into award_organizations (slug, name_ar) values ($1, $2)
         returning id, slug, name_ar`,
        [slugify(document.organization), document.organization],
      );
      organization = inserted[0];
      if (!organization) throw new CliError("Could not create award organization");
    }

    const categories = await transaction.unsafe<Array<{ id: string }>>(
      `select id from award_categories
       where organization_id = $1 and (id::text = $2 or slug = $2 or lower(name_ar) = lower($2) or lower(name_en) = lower($2))
       limit 1`,
      [organization.id, document.category],
    );
    let categoryId = categories[0]?.id;
    if (!categoryId) {
      if (!createMissing) {
        throw new CliError(
          `Award organization "${organization.slug}" has no category "${document.category}"`,
          'List them with "nahhasio award-category list", or pass --create-missing.',
        );
      }
      const inserted = await transaction.unsafe<Array<{ id: string }>>(
        `insert into award_categories (organization_id, slug, name_ar) values ($1, $2, $3) returning id`,
        [organization.id, slugify(document.category), document.category],
      );
      categoryId = inserted[0]?.id;
    }

    let installmentId: string | null = null;
    if (document.installment !== null && document.installment !== undefined) {
      installmentId = isPositionReference(document.installment)
        ? (installmentPositions.get(document.installment) ?? null)
        : document.installment;
      if (!installmentId) {
        throw new CliError(
          `Award references installment ${String(document.installment)}, which this work does not have`,
        );
      }
    }

    if (document.ceremonyId) {
      const ceremonies =
        await transaction`select id from award_ceremonies where id = ${document.ceremonyId} and organization_id = ${organization.id} and year = ${document.year ?? null}`;
      if (!ceremonies.length)
        throw new CliError("Award ceremony must belong to the selected organization and year");
    }
    const values = [
      titleId,
      installmentId,
      organization.id,
      categoryId ?? null,
      organization.slug,
      organization.name_ar,
      document.category,
      document.year ?? null,
      document.result,
      document.isFeatured ?? false,
      document.sourceUrl ?? null,
      document.notes ?? null,
      document.position ?? index,
      document.ceremonyId ?? null,
    ];
    if (document.id) {
      const existing =
        await transaction`select title_id from award_recognitions where id = ${document.id}`;
      if (existing[0] && existing[0].title_id !== titleId)
        throw new CliError("Award does not belong to this work");
      if (existing.length) {
        await transaction.unsafe(
          `update award_recognitions set installment_id=$2::uuid, organization_id=$3, category_id=$4, organization_slug=$5, organization_name=$6, category=$7, year=$8::int, result=$9::award_result, is_featured=$10, source_url=$11, notes=$12, position=$13, ceremony_id=$14::uuid, updated_at=now() where title_id=$1 and id=$15::uuid`,
          parameters([...values, document.id]),
        );
      } else {
        await transaction.unsafe(
          `insert into award_recognitions (title_id, installment_id, organization_id, category_id, organization_slug, organization_name, category, year, result, is_featured, source_url, notes, position, ceremony_id, id) values ($1,$2::uuid,$3,$4,$5,$6,$7,$8::int,$9::award_result,$10,$11,$12,$13,$14::uuid,$15::uuid)`,
          parameters([...values, document.id]),
        );
      }
    } else {
      await transaction.unsafe(
        `insert into award_recognitions (title_id, installment_id, organization_id, category_id, organization_slug, organization_name, category, year, result, is_featured, source_url, notes, position, ceremony_id) select $1,$2::uuid,$3,$4,$5,$6,$7,$8::int,$9::award_result,$10,$11,$12,$13,$14::uuid where not exists (select 1 from award_recognitions existing where existing.title_id=$1 and existing.installment_id is not distinct from $2::uuid and existing.organization_slug=$5 and existing.category=$7 and existing.year is not distinct from $8::int and existing.result=$9::award_result)`,
        parameters(values),
      );
    }
  }
}

export async function workApply(
  sql: Sql,
  args: ParsedArgs,
  target: string | undefined,
  enclosingTransaction?: TransactionSql,
  replaceLists: readonly string[] = [],
  createId?: string,
) {
  const file = stringFlag(args, "file") ?? target;
  const inline = stringFlag(args, "json");
  if (!file && !inline) {
    throw new CliError(
      "No work document provided",
      'Pass a file: nahhasio work apply work.json — or --json \'{"canonicalTitle":"…"}\'. Start from "nahhasio work template".',
    );
  }
  // SAFETY: `file` is non-empty here — the guard above returns when both it and `inline` are unset.
  const raw = inline ?? (await readFile(file as string, "utf8"));
  let parsedJson: unknown;
  try {
    // SAFETY: the parsed value is immediately handed to workDocument.safeParse below, which is
    // the actual boundary check; `unknown` is the honest type until then.
    parsedJson = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new CliError(
      `The work document is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = workDocument.safeParse(parsedJson);
  if (!parsed.success) {
    throw new CliError(
      "The work document failed validation",
      parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; "),
    );
  }
  const document = parsed.data;
  const requestedMode = stringFlag(args, "mode") ?? "merge";
  if (requestedMode !== "merge" && requestedMode !== "replace") {
    throw new CliError("Invalid apply mode", "Use --mode merge or --mode replace.");
  }
  const mode: ApplyMode = requestedMode;
  const createMissing = boolFlag(args, "create-missing");
  const dryRun = boolFlag(args, "dry-run");
  if (enclosingTransaction && dryRun) throw new CliError("The caller owns transaction rollback.");

  const schema = await loadSchema(enclosingTransaction ?? sql);
  const titlesTable = requireTable(schema, "titles");

  let existingId = document.id;
  if (!existingId) {
    try {
      existingId = await resolveRef(
        enclosingTransaction ?? sql,
        titlesTable,
        document.canonicalTitle,
      );
    } catch {
      existingId = undefined;
    }
  }

  if (createId && (document.id || !enclosingTransaction))
    throw new CliError("Creation review owns the transaction and new identifier.");
  if (existingId && (createId || boolFlag(args, "create-only")))
    throw new CliError("A work with this title already exists; open the existing record instead.");

  const run = async (transaction: TransactionSql) => {
    const listMode = (field: string): ApplyMode =>
      replaceLists.includes(field) ? "replace" : mode;
    const { id: titleId, created } = await upsertTitle(transaction, document, existingId, createId);

    if (document.aliases) {
      if (listMode("aliases") === "replace") {
        await transaction.unsafe(
          `delete from title_aliases where title_id = $1 and not (title = any($2::text[]))`,
          [titleId, document.aliases],
        );
      }
      for (const alias of document.aliases) {
        await transaction.unsafe(
          `insert into title_aliases (title_id, title) values ($1, $2) on conflict do nothing`,
          [titleId, alias],
        );
      }
    }

    // Same `mode` convention as `syncLookup`'s vocabulary lists: `replace` makes the document's
    // array the complete, authoritative order; `merge` only appends the given facts (after
    // whatever positions already exist) without touching or reordering existing ones — there's
    // no id to merge entries against, so "append" is the closest analogue to "add without
    // removing".
    if (document.trivia && replaceLists.includes("trivia")) {
      const existingFacts = await transaction.unsafe<Array<{ id: string; position: number }>>(
        `select id, position from title_trivia where title_id = $1 order by position, id`,
        [titleId],
      );
      for (const [index, text] of document.trivia.entries()) {
        const existing = existingFacts[index];
        if (existing)
          await transaction.unsafe(`update title_trivia set text = $2 where id = $1`, [
            existing.id,
            text,
          ]);
        else
          await transaction.unsafe(
            `insert into title_trivia (title_id, position, text) values ($1, $2, $3)`,
            [
              titleId,
              (existingFacts.at(-1)?.position ?? -1) + index - existingFacts.length + 1,
              text,
            ],
          );
      }
      const removed = existingFacts.slice(document.trivia.length).map((fact) => fact.id);
      if (removed.length)
        await transaction.unsafe(`delete from title_trivia where id = any($1::uuid[])`, [removed]);
    } else if (document.trivia) {
      if (mode === "replace")
        await transaction.unsafe(`delete from title_trivia where title_id = $1`, [titleId]);
      const [row] = await transaction.unsafe<Array<{ next_position: number }>>(
        `select coalesce(max(position) + 1, 0) as next_position from title_trivia where title_id = $1`,
        [titleId],
      );
      const existingFacts =
        mode === "merge"
          ? await transaction.unsafe<Array<{ text: string }>>(
              `select text from title_trivia where title_id = $1`,
              [titleId],
            )
          : [];
      const knownFacts = new Set(existingFacts.map((fact) => fact.text));
      for (const [index, factText] of document.trivia
        .filter((text) => !knownFacts.has(text))
        .entries()) {
        await transaction.unsafe(
          `insert into title_trivia (title_id, position, text) values ($1, $2, $3)`,
          [titleId, Number(row?.next_position ?? 0) + index, factText],
        );
      }
    }

    for (const name of ["genres", "tones", "tags", "countries"] as const) {
      const values = document[name];
      if (values)
        await syncLookup(transaction, titleId, name, values, listMode(name), createMissing);
    }

    if (document.planets) {
      if (document.planets.length > 1)
        throw new CliError(
          "A work can belong to at most one planet.",
          "Choose one planet or leave the list empty.",
        );
      const planetIds: string[] = [];
      for (const planet of document.planets) {
        const rows = await transaction.unsafe<Array<{ id: string }>>(
          `select id from planets where slug = $1 or lower(name_ar) = lower($1) or lower(name_en) = lower($1) limit 1`,
          [planet],
        );
        const row = rows[0];
        if (!row) {
          throw new CliError(
            `No planet matches "${planet}"`,
            'List them with "nahhasio planet list".',
          );
        }
        planetIds.push(row.id);
      }
      // Remove the former membership before inserting the explicitly selected single planet.
      // Retain an unchanged membership's featured rank. An empty merge remains a no-op.
      if (planetIds.length || listMode("planets") === "replace")
        await transaction.unsafe(
          `delete from title_planets where title_id = $1 and not (planet_id = any($2::uuid[]))`,
          [titleId, planetIds],
        );
      for (const planetId of planetIds)
        await transaction.unsafe(
          `insert into title_planets (title_id, planet_id) values ($1, $2) on conflict do nothing`,
          [titleId, planetId],
        );
    }

    if (document.externalIds) {
      if (listMode("externalIds") === "replace") {
        await transaction.unsafe(
          `delete from external_identities e where e.title_id = $1 and e.installment_id is null
           and not exists (select 1 from unnest($2::text[], $3::text[]) as kept(provider, external_id)
             where lower(btrim(e.provider)) = lower(btrim(kept.provider)) and e.external_id = kept.external_id)`,
          [
            titleId,
            document.externalIds.map((item) => item.provider),
            document.externalIds.map((item) => item.externalId),
          ],
        );
      }
      for (const identity of document.externalIds) {
        await transaction.unsafe(
          `insert into external_identities (title_id, installment_id, provider, external_id, url)
           values ($1, null, $2, $3, $4)
           on conflict (coalesce(title_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        coalesce(installment_id, '00000000-0000-0000-0000-000000000000'::uuid),
                        lower(btrim(provider)), external_id)
           do update set url = excluded.url`,
          [titleId, identity.provider, identity.externalId, identity.url ?? null],
        );
      }
    }

    if (document.credits) {
      await syncCredits(transaction, titleId, document.credits, listMode("credits"), createMissing);
    }

    if (document.relations) {
      if (listMode("relations") === "replace") {
        const targets = [];
        for (const relation of document.relations)
          targets.push(await resolveRef(transaction, titlesTable, relation.target));
        await transaction.unsafe(
          `delete from title_relations r where r.source_title_id = $1
           and not exists (select 1 from unnest($2::uuid[], $3::text[]) as kept(target_id, kind)
             where r.target_title_id = kept.target_id and r.kind::text = kept.kind)`,
          [titleId, targets, document.relations.map((relation) => relation.kind)],
        );
      }
      for (const relation of document.relations) {
        const targetId = await resolveRef(transaction, titlesTable, relation.target);
        await transaction.unsafe(
          `insert into title_relations (source_title_id, target_title_id, kind, notes)
           values ($1, $2, $3, $4)
           on conflict (source_title_id, target_title_id, kind) do update set notes = excluded.notes`,
          [titleId, targetId, relation.kind, relation.notes ?? ""],
        );
      }
    }

    if (document.trailers) {
      const current = await transaction<
        { id: string; youtube_video_id: string }[]
      >`select id,youtube_video_id from title_trailers where title_id=${titleId} for update`;
      const ids: string[] = [];
      if (document.trailers.filter((trailer) => trailer.isPrimary).length > 1)
        throw new CliError("Choose one primary trailer.");
      await transaction`update title_trailers set is_primary=false where title_id=${titleId} and is_primary`;
      for (const [position, trailer] of document.trailers.entries()) {
        if (trailer.id && !current.some((row) => row.id === trailer.id)) {
          const [foreign] = await transaction`select id from title_trailers where id=${trailer.id}`;
          if (foreign) throw new CliError("Trailer belongs to another work.");
        }
        const existing = trailer.id
          ? current.find((item) => item.id === trailer.id)
          : current.find((item) => item.youtube_video_id === trailer.youtubeVideoId);
        if (existing) {
          await transaction`update title_trailers set youtube_video_id=${trailer.youtubeVideoId},title=${trailer.title ?? ""},language=${trailer.language ?? null},is_primary=${trailer.isPrimary ?? false},position=${trailer.position ?? position},updated_at=now() where id=${existing.id}`;
          ids.push(existing.id);
          continue;
        }
        const [row] = await transaction<
          { id: string }[]
        >`insert into title_trailers(id,title_id,youtube_video_id,title,language,is_primary,position) values(coalesce(${trailer.id ?? null}::uuid,gen_random_uuid()),${titleId},${trailer.youtubeVideoId},${trailer.title ?? ""},${trailer.language ?? null},${trailer.isPrimary ?? false},${trailer.position ?? position}) on conflict(title_id,youtube_video_id) do update set title=excluded.title,language=excluded.language,is_primary=excluded.is_primary,position=excluded.position,updated_at=now() returning id`;
        if (row) ids.push(row.id);
      }
      if (listMode("trailers") === "replace")
        await transaction`delete from title_trailers where title_id=${titleId} and not(id=any(${ids}::uuid[]))`;
    }
    if (document.media) {
      await assignMedia(transaction, { column: "title_id", id: titleId }, document.media);
    }

    const positions = document.installments
      ? await syncInstallments(transaction, titleId, document.installments, mode)
      : new Map(
          (
            await transaction<
              { position: number; id: string }[]
            >`select position, id from installments where title_id = ${titleId}`
          ).map((row) => [row.position, row.id]),
        );

    if (document.awards) {
      if (replaceLists.includes("awards")) {
        await transaction.unsafe(
          `delete from award_recognitions where title_id = $1 and not (id = any($2::uuid[]))`,
          [titleId, document.awards.flatMap((award) => (award.id ? [award.id] : []))],
        );
      } else if (mode === "replace") {
        await transaction.unsafe(
          `delete from award_recognitions where title_id = $1`,
          parameters([titleId]),
        );
      }
      await syncAwards(transaction, titleId, document.awards, positions, createMissing);
    }

    await recordAudit(transaction, {
      action: created ? "cli.work.create" : "cli.work.update",
      targetType: "titles",
      targetId: titleId,
      summary: `${created ? "Created" : "Updated"} "${document.canonicalTitle}" via work apply (${mode})`,
      changes: { mode, installments: document.installments?.length ?? 0 },
    });

    return { titleId, created };
  };

  if (dryRun) {
    let outcome: { titleId: string; created: boolean } | undefined;
    try {
      await sql.begin(async (transaction) => {
        outcome = await run(transaction);
        throw new RollbackSignal();
      });
    } catch (error) {
      if (!(error instanceof RollbackSignal)) throw error;
    }
    return {
      dryRun: true,
      rolledBack: true,
      mode,
      wouldCreate: outcome?.created ?? false,
      titleId: outcome?.titleId ?? null,
    };
  }

  const result: ApplyOutcome = enclosingTransaction
    ? await run(enclosingTransaction)
    : await sql.begin(run);
  return { ok: true, mode, created: result.created, titleId: result.titleId };
}

class RollbackSignal extends Error {
  constructor() {
    super("rollback");
    this.name = "RollbackSignal";
  }
}

export async function workExport(sql: Sql | TransactionSql, ref: string): Promise<WorkDocument> {
  const schema = await loadSchema(sql);
  const titleId = await resolveRef(sql, requireTable(schema, "titles"), ref);

  const [title] = await sql<Row[]>`
    select * from titles where id = ${titleId}`;
  if (!title) throw new CliError(`No title with id ${titleId}`);

  const [
    aliases,
    trivia,
    genres,
    tones,
    tags,
    countries,
    planets,
    credits,
    externalIds,
    relations,
    media,
    installments,
    awards,
  ] = await Promise.all([
    sql<
      Array<{ title: string }>
    >`select title from title_aliases where title_id = ${titleId} order by title`,
    sql<
      Array<{ text: string }>
    >`select text from title_trivia where title_id = ${titleId} order by position`,
    sql<
      Array<{ slug: string }>
    >`select g.slug from title_genres j join genres g on g.id = j.value_id where j.title_id = ${titleId} order by g.slug`,
    sql<
      Array<{ slug: string }>
    >`select g.slug from title_tones j join tones g on g.id = j.value_id where j.title_id = ${titleId} order by g.slug`,
    sql<
      Array<{ slug: string }>
    >`select g.slug from title_tags j join tags g on g.id = j.value_id where j.title_id = ${titleId} order by g.slug`,
    sql<
      Array<{ slug: string }>
    >`select g.slug from title_countries j join countries g on g.id = j.value_id where j.title_id = ${titleId} order by g.slug`,
    sql<
      Array<{ slug: string }>
    >`select p.slug from title_planets j join planets p on p.id = j.planet_id where j.title_id = ${titleId} order by p.slug`,
    sql<
      Array<{
        entity: string;
        role: string;
        is_primary: boolean;
        position: number;
        languages: string[];
      }>
    >`
        select e.name as entity, r.slug as role, c.is_primary, c.position,c.languages
        from contributions c join entities e on e.id = c.entity_id join roles r on r.id = c.role_id
        where c.title_id = ${titleId} order by c.position, c.entity_id, c.role_id`,
    sql<Array<{ provider: string; external_id: string; url: string | null }>>`
        select provider, external_id, url from external_identities where title_id = ${titleId} order by provider, external_id, id`,
    sql<Array<{ target: string; kind: string; notes: string }>>`
        select t.canonical_title as target, r.kind, r.notes
        from title_relations r join titles t on t.id = r.target_title_id
        where r.source_title_id = ${titleId} order by r.kind, r.target_title_id`,
    sql<Array<{ role: string; path: string }>>`
        select x.role, a.path from media_asset_assignments x join media_assets a on a.id = x.asset_id
        where x.title_id = ${titleId} and x.is_primary order by x.role, x.id`,
    sql<Row[]>`
        select i.*, s.story, s.characters, s.depth, s.world_building, s.originality, s.craft
        from installments i left join installment_scores s on s.installment_id = i.id
        where i.title_id = ${titleId} order by i.position, i.id`,
    sql<Row[]>`
        select id, position, ceremony_id, organization_slug, category, year, result, is_featured, source_url, notes, installment_id
        from award_recognitions where title_id = ${titleId} order by position, id`,
  ]);

  const episodeMedia = new Map<string, Record<string, string>>();
  const episodeArtwork = await sql<
    { episode_id: string; role: string; path: string }[]
  >`select m.episode_id,m.role,a.path from media_asset_assignments m join media_assets a on a.id=m.asset_id join episodes e on e.id=m.episode_id join installments i on i.id=e.installment_id where i.title_id=${titleId} and m.is_primary order by m.id`;
  for (const image of episodeArtwork)
    episodeMedia.set(image.episode_id, {
      ...episodeMedia.get(image.episode_id),
      [image.role]: image.path,
    });
  const episodesByInstallment = new Map<string, Row[]>();
  const mediaByInstallment = new Map<string, Record<string, string>>();
  if (installments.length > 0) {
    const episodeRows = await sql<Row[]>`
      select * from episodes where installment_id in ${sql(installments.map((row) => String(row.id)))}
      order by position, id`;
    const artwork = await sql<
      { installment_id: string; role: string; path: string }[]
    >`select x.installment_id, x.role, a.path from media_asset_assignments x join media_assets a on a.id = x.asset_id where x.installment_id in ${sql(installments.map((row) => String(row.id)))} and x.is_primary order by x.role, x.id`;
    for (const asset of artwork)
      mediaByInstallment.set(asset.installment_id, {
        ...mediaByInstallment.get(asset.installment_id),
        [asset.role]: asset.path,
      });
    for (const episode of episodeRows) {
      const key = String(episode.installment_id);
      const bucket = episodesByInstallment.get(key);
      if (bucket) bucket.push(episode);
      else episodesByInstallment.set(key, [episode]);
    }
  }

  const positionById = new Map(
    installments.map((row) => [String(row.id), Number(row.position)] as const),
  );

  // SAFETY: every assertion below reads a column straight out of `titles`, `installments`,
  // `episodes`, or `award_recognitions`. Each one is constrained by a Postgres enum or a NOT
  // NULL/nullable text column whose members are exactly the union being asserted, so the
  // database has already guaranteed the narrowing that TypeScript cannot see through `Row`.
  return {
    id: String(title.id),
    canonicalTitle: String(title.canonical_title),
    sortTitle: String(title.sort_title),
    titleAr: (title.title_ar as string | null) ?? null,
    summary: String(title.summary ?? ""),
    contentWarnings: (title.content_warnings as string | null) ?? null,
    analysisNotes: (title.analysis_notes as string | null) ?? null,
    curatorNotes: String(title.curator_notes ?? ""),
    releaseYear: number(title.release_year),
    format: title.format as "animated" | "live-action",
    isPrivate: Boolean(title.is_private),
    workflowStatus: title.workflow_status as WorkDocument["workflowStatus"],
    playbackPolicy: z.enum(["torrents-allowed", "files-only"]).parse(title.playback_policy),
    dubLanguages: z.array(z.string()).parse(title.dub_languages),
    dubbingNotes: String(title.dubbing_notes ?? ""),
    trailers: await sql<
      {
        id: string;
        youtube_video_id: string;
        title: string;
        language: string | null;
        is_primary: boolean;
        position: number;
      }[]
    >`select id,youtube_video_id,title,language,is_primary,position from title_trailers where title_id=${titleId} order by position,id`.then(
      (rows) =>
        rows.map((row) => ({
          id: row.id,
          youtubeVideoId: row.youtube_video_id,
          title: row.title,
          language: row.language,
          isPrimary: row.is_primary,
          position: row.position,
        })),
    ),
    qualityScore: Number(title.quality_score ?? 0),
    audience: title.audience as WorkDocument["audience"],
    age: title.age as WorkDocument["age"],
    sexualityRisk: title.sexuality_risk as WorkDocument["sexualityRisk"],
    behavioralRisk: title.behavioral_risk as WorkDocument["behavioralRisk"],
    theologyRisk: title.theology_risk as WorkDocument["theologyRisk"],
    tmdbId: number(title.tmdb_id),
    imdbId: (title.imdb_id as string | null) ?? null,
    anilistId: number(title.anilist_id),
    malId: number(title.mal_id),
    aliases: aliases.map((row) => row.title),
    trivia: trivia.map((row) => row.text),
    genres: genres.map((row) => row.slug),
    tones: tones.map((row) => row.slug),
    tags: tags.map((row) => row.slug),
    countries: countries.map((row) => row.slug),
    planets: planets.map((row) => row.slug),
    credits: credits.map((row) => ({
      entity: row.entity,
      role: row.role,
      languages: z.array(z.string()).parse(row.languages),
      isPrimary: row.is_primary,
      position: row.position,
    })),
    externalIds: externalIds.map((row) => ({
      provider: row.provider,
      externalId: row.external_id,
      url: row.url,
    })),
    relations: relations.map((row) => ({
      target: row.target,
      kind: row.kind as NonNullable<WorkDocument["relations"]>[number]["kind"],
      notes: row.notes,
    })),
    media: Object.fromEntries(media.map((row) => [row.role, row.path])),
    installments: installments.map((row) => ({
      id: String(row.id),
      kind: row.kind as "season" | "movie" | "special",
      position: Number(row.position),
      title: String(row.title),
      summary: String(row.summary ?? ""),
      status: row.status as "announced" | "airing" | "completed" | "unknown",
      releaseDate: (row.release_date as string | null) ?? null,
      runtimeMinutes: number(row.runtime_minutes),
      audienceOverride: (row.audience_override as string | null) ?? null,
      ageOverride: (row.age_override as string | null) ?? null,
      sexualityRiskOverride: (row.sexuality_risk_override as string | null) ?? null,
      behavioralRiskOverride: (row.behavioral_risk_override as string | null) ?? null,
      theologyRiskOverride: (row.theology_risk_override as string | null) ?? null,
      tmdbId: number(row.tmdb_id),
      imdbId: (row.imdb_id as string | null) ?? null,
      anilistId: number(row.anilist_id),
      malId: number(row.mal_id),
      score: {
        story: number(row.story),
        characters: number(row.characters),
        depth: number(row.depth),
        worldBuilding: number(row.world_building),
        originality: number(row.originality),
        craft: number(row.craft),
      },
      media: mediaByInstallment.get(String(row.id)) ?? {},
      episodes: (episodesByInstallment.get(String(row.id)) ?? []).map((episode) => ({
        id: String(episode.id),
        number: Number(episode.number),
        position: Number(episode.position),
        title: (episode.title as string | null) ?? null,
        summary: String(episode.summary ?? ""),
        releaseDate: (episode.release_date as string | null) ?? null,
        runtimeMinutes: number(episode.runtime_minutes),
        media: episodeMedia.get(String(episode.id)) ?? {},
      })),
    })),
    awards: awards.map((row) => ({
      id: String(row.id),
      ceremonyId: (row.ceremony_id as string | null) ?? null,
      position: Number(row.position),
      organization: String(row.organization_slug),
      category: String(row.category),
      year: number(row.year),
      result: row.result as "winner" | "nominee",
      installment: row.installment_id
        ? (positionById.get(String(row.installment_id)) ?? null)
        : null,
      isFeatured: Boolean(row.is_featured),
      sourceUrl: (row.source_url as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    })),
  };
}

/** A filled-in example document, so a new work starts from a working shape rather than prose. */
export function workTemplate(): WorkDocument {
  return {
    canonicalTitle: "Example Work",
    titleAr: "عمل تجريبي",
    summary: "ملخص عربي من ثلاث إلى خمس جمل.",
    contentWarnings: "عنف خفيف، مشاهد حزن.",
    analysisNotes: "لا توجد مشكلة عقدية.",
    releaseYear: 2024,
    playbackPolicy: "torrents-allowed",
    dubLanguages: [],
    dubbingNotes: "",
    trailers: [],
    format: "animated",
    workflowStatus: "draft",
    audience: "general",
    age: "all",
    sexualityRisk: "none",
    behavioralRisk: "low",
    theologyRisk: "none",
    aliases: ["Alternate Title"],
    trivia: ["الأصل والقصة: قصة أصلية.", "المكان: مكان خيالي مستوحى من واقع معيّن."],
    genres: ["adventure"],
    tones: ["heartwarming"],
    tags: [],
    countries: ["jp"],
    planets: ["adventure-fantasy"],
    credits: [{ entity: "Studio Name", role: "animation_studio", isPrimary: true, languages: [] }],
    externalIds: [],
    media: { poster: null, banner: null, logo: null },
    installments: [
      {
        kind: "season",
        position: 1,
        title: "الموسم الأول",
        summary: "",
        status: "completed",
        releaseDate: "2024-01-07",
        runtimeMinutes: 24,
        score: {
          story: 8,
          characters: 8.5,
          depth: 7.5,
          worldBuilding: 8,
          originality: 7.5,
          craft: 9,
        },
        episodes: [
          {
            number: 1,
            position: 1,
            title: "الحلقة الأولى",
            runtimeMinutes: 24,
            media: { still: null },
          },
        ],
      },
    ],
    awards: [],
  };
}

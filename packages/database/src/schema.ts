import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const audienceEnum = pgEnum("audience", ["general", "teen", "young-adult", "adult"]);
export const ageEnum = pgEnum("age_rating", ["all", "7+", "10+", "13+", "16+", "18+"]);
export const riskEnum = pgEnum("risk_level", ["none", "low", "medium", "high"]);
export const installmentKindEnum = pgEnum("installment_kind", ["season", "movie", "special"]);
/**
 * Animated vs. live action — the only half of a title's four-way type the catalog stores. The
 * other half (film vs. episodic) is read off the title's installments, so `animated-movie` /
 * `animated-series` / `live-action-movie` / `live-action-series` are always consistent with the
 * structure beneath the title. See `titleKindOf` in `@arcadia/domain`.
 */
export const titleFormatEnum = pgEnum("title_format", ["animated", "live-action"]);
export const releaseStatusEnum = pgEnum("release_status", [
  "announced",
  "airing",
  "completed",
  "unknown",
]);
export const entityKindEnum = pgEnum("entity_kind", ["person", "organization"]);
export const accountKindEnum = pgEnum("account_kind", ["admin", "family", "personal"]);
export const accountStatusEnum = pgEnum("account_status", ["invited", "active", "suspended"]);
export const moderationStatusEnum = pgEnum("moderation_status", ["published", "hidden"]);
export const mediaAssetRoleEnum = pgEnum("media_asset_role", [
  "poster",
  "banner",
  "logo",
  "profile",
  "still",
]);
export const trackKindEnum = pgEnum("track_kind", ["video", "audio", "subtitle"]);
export const relationKindEnum = pgEnum("title_relation_kind", [
  "sequel",
  "adaptation",
  "spin-off",
  "side-story",
  "compilation",
  "alternative",
  "related",
]);
export const awardResultEnum = pgEnum("award_result", ["winner", "nominee"]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "reply",
  "reaction",
  "review",
  "catalog",
  "system",
]);
export const collectionVisibilityEnum = pgEnum("collection_visibility", ["private", "family"]);
export const workflowStatusEnum = pgEnum("workflow_status", [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
]);
export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "pending",
  "accepted",
  "deferred",
  "dismissed",
]);
export const jobStatusEnum = pgEnum("background_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

const id = { id: uuid("id").primaryKey().defaultRandom() };
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};
/**
 * The four external-catalog identifiers Phase 0 of the player/torrent roadmap needs, kept as
 * typed columns (not `external_identities` rows) so they can be looked up and written without a
 * join, and so `tmdb`/`anilist` ingest can update-in-place instead of insert-or-noop. Present on
 * both `titles` and `installments`: a franchise title carries its own `anilist_id`/`mal_id`, while each film installment carries its own `tmdb_id`/`imdb_id` — Torrentio and
 * Jellyfin both key off the installment-level ids for movie playback.
 */
const externalIdColumns = {
  tmdbId: integer("tmdb_id"),
  imdbId: text("imdb_id"),
  anilistId: integer("anilist_id"),
  malId: integer("mal_id"),
  /** Retained recovery identifiers; not an active provider integration. */
  tvdbId: integer("tvdb_id"),
};

const classificationDefaults = {
  audience: audienceEnum("audience").notNull().default("general"),
  age: ageEnum("age").notNull().default("all"),
  sexualityRisk: riskEnum("sexuality_risk").notNull().default("none"),
  behavioralRisk: riskEnum("behavioral_risk").notNull().default("none"),
  theologyRisk: riskEnum("theology_risk").notNull().default("none"),
};

export const titles = pgTable(
  "titles",
  {
    ...id,
    canonicalTitle: text("canonical_title").notNull(),
    sortTitle: text("sort_title").notNull(),
    titleAr: text("title_ar"),
    summary: text("summary").notNull().default(""),
    contentWarnings: text("content_warnings"),
    analysisNotes: text("analysis_notes"),
    releaseYear: integer("release_year"),
    format: titleFormatEnum("format").notNull().default("animated"),
    isPrivate: boolean("is_private").notNull().default(false),
    workflowStatus: workflowStatusEnum("workflow_status").notNull().default("published"),
    playbackPolicy: text("playback_policy").notNull().default("torrents-allowed"),
    dubLanguages: text("dub_languages")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    dubbingNotes: text("dubbing_notes").notNull().default(""),
    qualityScore: integer("quality_score").notNull().default(0),
    curatorNotes: text("curator_notes").notNull().default(""),
    provenance: jsonb("provenance")
      .notNull()
      .default(sql`'{}'::jsonb`),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedByAccountId: uuid("verified_by_account_id"),
    ...externalIdColumns,
    ...classificationDefaults,
    ...timestamps,
  },
  (t) => [
    index("titles_sort_idx").on(t.sortTitle),
    index("titles_release_year_idx").on(t.releaseYear),
    index("titles_visibility_sort_idx").on(t.workflowStatus, t.isPrivate, t.sortTitle, t.id),
    index("titles_dub_languages_idx").using("gin", t.dubLanguages),
    check(
      "titles_playback_policy_check",
      sql`${t.playbackPolicy} in ('torrents-allowed','files-only')`,
    ),
    check("titles_dub_languages_check", sql`nahhasio_language_codes_valid(${t.dubLanguages})`),
    uniqueIndex("titles_tvdb_id_uq")
      .on(t.tvdbId)
      .where(sql`${t.tvdbId} is not null`),
    index("titles_search_trgm_idx").using("gin", sql`${t.canonicalTitle} gin_trgm_ops`),
    check("titles_imdb_id_check", sql`${t.imdbId} is null or ${t.imdbId} ~ '^tt[0-9]{7,10}$'`),
    uniqueIndex("titles_tmdb_id_uq")
      .on(t.tmdbId)
      .where(sql`${t.tmdbId} is not null`),
    uniqueIndex("titles_imdb_id_uq")
      .on(t.imdbId)
      .where(sql`${t.imdbId} is not null`),
    uniqueIndex("titles_anilist_id_uq")
      .on(t.anilistId)
      .where(sql`${t.anilistId} is not null`),
    uniqueIndex("titles_mal_id_uq")
      .on(t.malId)
      .where(sql`${t.malId} is not null`),
  ],
);
export const titleAliases = pgTable(
  "title_aliases",
  {
    ...id,
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    language: text("language"),
    script: text("script"),
    isPreferred: boolean("is_preferred").notNull().default(false),
  },
  (t) => [
    uniqueIndex("title_alias_identity_uq").on(t.titleId, t.title, t.language),
    uniqueIndex("title_alias_normalized_identity_uq").on(t.titleId, sql`lower(btrim(${t.title}))`),
    index("title_alias_search_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

/**
 * Reader-facing trivia: an ordered list of short Arabic facts about a title's origin,
 * setting, and production ("الأصل والقصة", "المكان", "حقائق بارزة" — house style documented in
 * the arcadia-cataloging skill), rendered as a plain list on the title page. Deliberately a
 * child table rather than a jsonb array — same shape as `titleAliases` — so each fact is its own
 * ordered, individually editable row.
 */
export const titleTrivia = pgTable(
  "title_trivia",
  {
    ...id,
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("title_trivia_title_position_uq").on(t.titleId, t.position),
    check("title_trivia_values_check", sql`btrim(${t.text}) <> ''`),
  ],
);

export const installments = pgTable(
  "installments",
  {
    ...id,
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    kind: installmentKindEnum("kind").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    releaseDate: date("release_date"),
    runtimeMinutes: integer("runtime_minutes"),
    status: releaseStatusEnum("status").notNull().default("unknown"),
    audienceOverride: audienceEnum("audience_override"),
    ageOverride: ageEnum("age_override"),
    sexualityRiskOverride: riskEnum("sexuality_risk_override"),
    behavioralRiskOverride: riskEnum("behavioral_risk_override"),
    theologyRiskOverride: riskEnum("theology_risk_override"),
    ...externalIdColumns,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("installments_tvdb_id_uq")
      .on(t.tvdbId)
      .where(sql`${t.tvdbId} is not null`),
    uniqueIndex("installments_title_position_uq").on(t.titleId, t.position),
    uniqueIndex("installments_id_title_uq").on(t.id, t.titleId),
    check(
      "installments_values_check",
      sql`${t.position} >= 0 and (${t.runtimeMinutes} is null or ${t.runtimeMinutes} >= 0)`,
    ),
    check(
      "installments_imdb_id_check",
      sql`${t.imdbId} is null or ${t.imdbId} ~ '^tt[0-9]{7,10}$'`,
    ),
    uniqueIndex("installments_tmdb_id_uq")
      .on(t.tmdbId)
      .where(sql`${t.tmdbId} is not null`),
    uniqueIndex("installments_imdb_id_uq")
      .on(t.imdbId)
      .where(sql`${t.imdbId} is not null`),
    uniqueIndex("installments_anilist_id_uq")
      .on(t.anilistId)
      .where(sql`${t.anilistId} is not null`),
    uniqueIndex("installments_mal_id_uq")
      .on(t.malId)
      .where(sql`${t.malId} is not null`),
  ],
);
export const awardOrganizations = pgTable(
  "award_organizations",
  {
    ...id,
    slug: text("slug").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    description: text("description").notNull().default(""),
    websiteUrl: text("website_url"),
    logoPath: text("logo_path"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("award_organizations_slug_uq").on(t.slug),
    check(
      "award_organizations_values_check",
      sql`btrim(${t.slug}) <> '' and btrim(${t.nameAr}) <> ''`,
    ),
  ],
);
export const awardCategories = pgTable(
  "award_categories",
  {
    ...id,
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => awardOrganizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("award_categories_organization_slug_uq").on(t.organizationId, t.slug),
    unique("award_categories_id_organization_uq").on(t.id, t.organizationId),
    index("award_categories_organization_idx").on(t.organizationId, t.isActive),
    check(
      "award_categories_values_check",
      sql`btrim(${t.slug}) <> '' and btrim(${t.nameAr}) <> ''`,
    ),
  ],
);
export const awardCeremonies = pgTable(
  "award_ceremonies",
  {
    ...id,
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => awardOrganizations.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    edition: integer("edition"),
    label: text("label").notNull().default(""),
    heldOn: date("held_on"),
    sourceUrl: text("source_url"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("award_ceremonies_organization_year_uq").on(t.organizationId, t.year),
    unique("award_ceremonies_id_organization_uq").on(t.id, t.organizationId),
    check("award_ceremonies_year_check", sql`${t.year} between 1900 and 2100`),
  ],
);
export const awardRecognitions = pgTable(
  "award_recognitions",
  {
    ...id,
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").references(() => installments.id, {
      onDelete: "cascade",
    }),
    organizationId: uuid("organization_id").references(() => awardOrganizations.id, {
      onDelete: "restrict",
    }),
    categoryId: uuid("category_id").references(() => awardCategories.id, {
      onDelete: "restrict",
    }),
    ceremonyId: uuid("ceremony_id").references(() => awardCeremonies.id, {
      onDelete: "set null",
    }),
    organizationSlug: text("organization_slug").notNull(),
    organizationName: text("organization_name").notNull(),
    category: text("category").notNull(),
    year: integer("year"),
    result: awardResultEnum("result").notNull(),
    isFeatured: boolean("is_featured").notNull().default(false),
    sourceUrl: text("source_url"),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("award_recognitions_title_idx").on(t.titleId),
    index("award_recognitions_installment_idx").on(t.installmentId),
    index("award_recognitions_filter_idx").on(t.organizationSlug, t.result),
    check(
      "award_recognitions_values_check",
      sql`btrim(${t.organizationSlug}) <> '' and btrim(${t.organizationName}) <> '' and btrim(${t.category}) <> '' and (${t.year} is null or ${t.year} between 1900 and 2100) and ${t.position} >= 0`,
    ),
    foreignKey({
      columns: [t.installmentId, t.titleId],
      foreignColumns: [installments.id, installments.titleId],
      name: "award_recognitions_installment_title_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.categoryId, t.organizationId],
      foreignColumns: [awardCategories.id, awardCategories.organizationId],
      name: "award_recognitions_category_organization_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.ceremonyId, t.organizationId],
      foreignColumns: [awardCeremonies.id, awardCeremonies.organizationId],
      name: "award_recognitions_ceremony_organization_fk",
    }).onDelete("restrict"),
    check(
      "award_recognitions_owner_check",
      sql`(${t.categoryId} is null and ${t.ceremonyId} is null) or ${t.organizationId} is not null`,
    ),
  ],
);
export const episodes = pgTable(
  "episodes",
  {
    ...id,
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => installments.id, { onDelete: "cascade" }),
    number: numeric("number", { precision: 8, scale: 2 }).notNull(),
    position: integer("position").notNull(),
    title: text("title"),
    summary: text("summary").notNull().default(""),
    releaseDate: date("release_date"),
    runtimeMinutes: integer("runtime_minutes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("episodes_installment_position_uq").on(t.installmentId, t.position),
    uniqueIndex("episodes_installment_number_uq").on(t.installmentId, t.number),
    uniqueIndex("episodes_id_installment_uq").on(t.id, t.installmentId),
    check(
      "episodes_values_check",
      sql`${t.position} >= 0 and (${t.runtimeMinutes} is null or ${t.runtimeMinutes} >= 0)`,
    ),
  ],
);
export const installmentScores = pgTable(
  "installment_scores",
  {
    installmentId: uuid("installment_id")
      .primaryKey()
      .references(() => installments.id, { onDelete: "cascade" }),
    story: numeric("story", { precision: 3, scale: 1 }),
    characters: numeric("characters", { precision: 3, scale: 1 }),
    depth: numeric("depth", { precision: 3, scale: 1 }),
    worldBuilding: numeric("world_building", { precision: 3, scale: 1 }),
    originality: numeric("originality", { precision: 3, scale: 1 }),
    craft: numeric("craft", { precision: 3, scale: 1 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "installment_scores_range_check",
      sql`(${t.story} is null or ${t.story} between 0 and 10) and (${t.characters} is null or ${t.characters} between 0 and 10) and (${t.depth} is null or ${t.depth} between 0 and 10) and (${t.worldBuilding} is null or ${t.worldBuilding} between 0 and 10) and (${t.originality} is null or ${t.originality} between 0 and 10) and (${t.craft} is null or ${t.craft} between 0 and 10)`,
    ),
  ],
);

function lookup(name: string) {
  return pgTable(
    name,
    {
      ...id,
      slug: text("slug").notNull().unique(),
      labelEn: text("label_en").notNull(),
      labelAr: text("label_ar").notNull(),
      descriptionEn: text("description_en").notNull().default(""),
      descriptionAr: text("description_ar").notNull().default(""),
      position: integer("position").notNull().default(0),
      isActive: boolean("is_active").notNull().default(true),
    },
    (t) => [check(`${name}_position_check`, sql`${t.position} >= 0`)],
  );
}
export const genres = lookup("genres");
export const tones = lookup("tones");
export const tags = lookup("tags");
export const countries = lookup("countries");
export const roles = pgTable(
  "roles",
  {
    ...id,
    slug: text("slug").notNull().unique(),
    labelEn: text("label_en").notNull(),
    labelAr: text("label_ar").notNull(),
    descriptionEn: text("description_en").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    entityKind: entityKindEnum("entity_kind").notNull(),
  },
  (t) => [
    check("roles_position_check", sql`${t.position} >= 0`),
    check(
      "roles_slug_check",
      sql`${t.slug} ~ '^[a-z][a-z0-9_]{0,79}$' and btrim(${t.labelEn}) <> '' and btrim(${t.labelAr}) <> ''`,
    ),
  ],
);
export const vocabularyLabels = pgTable(
  "vocabulary_labels",
  {
    vocabulary: text("vocabulary").notNull(),
    value: text("value").notNull(),
    labelEn: text("label_en").notNull(),
    labelAr: text("label_ar").notNull(),
    descriptionEn: text("description_en").notNull().default(""),
    descriptionAr: text("description_ar").notNull().default(""),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.vocabulary, t.value] }),
    check(
      "vocabulary_labels_vocabulary_check",
      sql`${t.vocabulary} in ('audiences','ages','risk-levels','release-statuses')`,
    ),
    check("vocabulary_labels_position_check", sql`${t.position} >= 0`),
  ],
);
function titleLookup(name: string, table: ReturnType<typeof lookup>) {
  return pgTable(
    name,
    {
      titleId: uuid("title_id")
        .notNull()
        .references(() => titles.id, { onDelete: "cascade" }),
      valueId: uuid("value_id")
        .notNull()
        .references(() => table.id, { onDelete: "restrict" }),
    },
    (t) => [
      primaryKey({ columns: [t.titleId, t.valueId] }),
      index(`${name}_value_idx`).on(t.valueId),
    ],
  );
}
export const titleGenres = titleLookup("title_genres", genres);
export const titleTones = titleLookup("title_tones", tones);
export const titleTags = titleLookup("title_tags", tags);
export const titleCountries = titleLookup("title_countries", countries);

export const planets = pgTable("planets", {
  ...id,
  slug: text("slug").notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en"),
  icon: text("icon").notNull(),
  description: text("description").notNull().default(""),
  primaryColor: text("primary_color").notNull(),
  secondaryColor: text("secondary_color").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});
export const titlePlanets = pgTable(
  "title_planets",
  {
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "restrict" }),
    featuredRank: integer("featured_rank"),
  },
  (t) => [
    primaryKey({ columns: [t.titleId, t.planetId] }),
    unique("title_planets_single_planet_uq").on(t.titleId),
    uniqueIndex("title_planets_featured_rank_uq")
      .on(t.planetId, t.featuredRank)
      .where(sql`${t.featuredRank} is not null`),
    check(
      "title_planets_featured_rank_check",
      sql`${t.featuredRank} is null or ${t.featuredRank} >= 0`,
    ),
    index("title_planets_planet_idx").on(t.planetId),
  ],
);

export const entities = pgTable(
  "entities",
  {
    ...id,
    kind: entityKindEnum("kind").notNull(),
    name: text("name").notNull(),
    sortName: text("sort_name").notNull(),
    description: text("description").notNull().default(""),
    urls: jsonb("urls").$type<{ label: string; url: string }[]>().notNull().default([]),
    ...timestamps,
  },
  (t) => [uniqueIndex("entities_kind_sort_uq").on(t.kind, t.sortName)],
);
export const entityAliases = pgTable(
  "entity_aliases",
  {
    ...id,
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    language: text("language"),
  },
  (t) => [uniqueIndex("entity_alias_normalized_uq").on(t.entityId, sql`lower(btrim(${t.alias}))`)],
);
export const contributions = pgTable(
  "contributions",
  {
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    languages: text("languages")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
  },
  (t) => [
    primaryKey({ columns: [t.titleId, t.entityId, t.roleId] }),
    index("contributions_entity_idx").on(t.entityId),
    index("contributions_role_idx").on(t.roleId),
    check("contributions_position_check", sql`${t.position} >= 0`),
    check("contributions_languages_check", sql`nahhasio_language_codes_valid(${t.languages})`),
  ],
);
export const organizationRelations = pgTable(
  "organization_relations",
  {
    ...id,
    sourceId: uuid("source_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    occurredOn: date("occurred_on"),
    description: text("description").notNull().default(""),
  },
  (t) => [
    check("organization_relation_distinct_check", sql`${t.sourceId} <> ${t.targetId}`),
    index("organization_relations_target_idx").on(t.targetId),
  ],
);
export const titleRelations = pgTable(
  "title_relations",
  {
    ...id,
    sourceTitleId: uuid("source_title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    targetTitleId: uuid("target_title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    kind: relationKindEnum("kind").notNull(),
    notes: text("notes").notNull().default(""),
  },
  (t) => [
    uniqueIndex("title_relations_pair_kind_uq").on(t.sourceTitleId, t.targetTitleId, t.kind),
    index("title_relations_target_idx").on(t.targetTitleId),
    check("title_relations_distinct_check", sql`${t.sourceTitleId} <> ${t.targetTitleId}`),
  ],
);
export const externalIdentities = pgTable(
  "external_identities",
  {
    ...id,
    titleId: uuid("title_id").references(() => titles.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").references(() => installments.id, {
      onDelete: "cascade",
    }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url"),
  },
  (t) => [
    // Scoped per owner, not global: two different titles/installments are allowed to reference
    // the same free-form URL (e.g. a shared franchise Wikipedia page). This table now only holds
    // free-form references (Wikipedia, official site, trailer, Fanart image ids) — the four
    // typed catalog ids (tmdb/imdb/anilist/mal) live on `titles`/`installments` directly.
    uniqueIndex("external_identity_provider_uq").on(
      sql`coalesce(${t.titleId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${t.installmentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`lower(btrim(${t.provider}))`,
      t.externalId,
    ),
    index("external_identities_title_idx").on(t.titleId),
    index("external_identities_installment_idx").on(t.installmentId),
    check("external_identity_provider_check", sql`btrim(${t.provider}) <> ''`),
    check("external_identity_owner_check", sql`num_nonnulls(${t.titleId}, ${t.installmentId}) = 1`),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    ...id,
    path: text("path").notNull(),
    sha256: text("sha256").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    originalFilename: text("original_filename").notNull(),
    deletionError: text("deletion_error"),
    focalX: integer("focal_x").notNull().default(50),
    focalY: integer("focal_y").notNull().default(50),
    variantOfAssetId: uuid("variant_of_asset_id").references((): AnyPgColumn => mediaAssets.id, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("media_assets_sha256_uq").on(t.sha256),
    uniqueIndex("media_assets_path_uq").on(t.path),
    check("media_assets_sha256_check", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
    check(
      "media_assets_mime_check",
      sql`${t.mimeType} in ('image/jpeg','image/png','image/webp','image/gif','image/avif')`,
    ),
    check(
      "media_assets_variant_self_check",
      sql`${t.variantOfAssetId} is null or ${t.variantOfAssetId} <> ${t.id}`,
    ),
    check(
      "media_assets_values_check",
      sql`${t.byteSize} > 0 and ${t.width} > 0 and ${t.height} > 0 and ${t.focalX} between 0 and 100 and ${t.focalY} between 0 and 100`,
    ),
    check(
      "media_assets_path_check",
      sql`${t.path} like '/media/%' and ${t.path} !~ '(^|/)\\.\\.(/|$)'`,
    ),
  ],
);

export const mediaAssetAssignments = pgTable(
  "media_asset_assignments",
  {
    ...id,
    assetId: uuid("asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    role: mediaAssetRoleEnum("role").notNull(),
    titleId: uuid("title_id").references(() => titles.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id").references(() => installments.id, {
      onDelete: "cascade",
    }),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    check(
      "media_assignment_one_owner_check",
      sql`num_nonnulls(${t.titleId}, ${t.installmentId}, ${t.episodeId}, ${t.entityId}) = 1`,
    ),
    uniqueIndex("media_assignment_identity_uq").on(
      t.assetId,
      t.role,
      sql`coalesce(${t.titleId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${t.installmentId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${t.episodeId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${t.entityId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    uniqueIndex("media_assignment_title_primary_uq")
      .on(t.titleId, t.role)
      .where(sql`${t.titleId} is not null and ${t.isPrimary}`),
    uniqueIndex("media_assignment_installment_primary_uq")
      .on(t.installmentId, t.role)
      .where(sql`${t.installmentId} is not null and ${t.isPrimary}`),
    uniqueIndex("media_assignment_episode_primary_uq")
      .on(t.episodeId, t.role)
      .where(sql`${t.episodeId} is not null and ${t.isPrimary}`),
    uniqueIndex("media_assignment_entity_primary_uq")
      .on(t.entityId, t.role)
      .where(sql`${t.entityId} is not null and ${t.isPrimary}`),
    index("media_assignments_asset_idx").on(t.assetId),
    index("media_assignments_title_idx").on(t.titleId),
    index("media_assignments_installment_idx").on(t.installmentId),
    index("media_assignments_episode_idx").on(t.episodeId),
    index("media_assignments_entity_idx").on(t.entityId),
  ],
);

/** Better Auth owns these four tables. Arcadia accounts remain the family-facing profile. */
export const user = pgTable(
  "auth_users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    username: text("username"),
    displayUsername: text("display_username"),
    role: text("role").notNull().default("member"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("auth_users_email_uq").on(t.email),
    uniqueIndex("auth_users_username_uq").on(t.username),
  ],
);
export const session = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    deviceId: uuid("device_id").references((): AnyPgColumn => devices.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("auth_sessions_token_uq").on(t.token),
    index("auth_sessions_user_idx").on(t.userId),
  ],
);
export const account = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [
    index("auth_accounts_user_idx").on(t.userId),
    uniqueIndex("auth_accounts_provider_identity_uq").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("auth_verifications_identifier_idx").on(t.identifier)],
);

export const accounts = pgTable(
  "accounts",
  {
    ...id,
    authUserId: text("auth_user_id").references(() => user.id, { onDelete: "cascade" }),
    kind: accountKindEnum("kind").notNull(),
    status: accountStatusEnum("status").notNull().default("invited"),
    slug: text("slug"),
    displayName: text("display_name").notNull(),
    avatarKey: text("avatar_key").notNull().default("avatar-1.png"),
    bio: text("bio").notNull().default(""),
    isDiscoverable: boolean("is_discoverable").notNull().default(true),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("accounts_auth_user_uq").on(t.authUserId),
    uniqueIndex("accounts_slug_uq").on(t.slug),
  ],
);
export const accountCapabilities = pgTable(
  "account_capabilities",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    capability: text("capability").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.capability] }),
    check(
      "account_capabilities_value_check",
      sql`${t.capability} in ('catalog.view','catalog.edit','people.edit','studios.edit','awards.edit','accounts.manage','policies.manage','social.moderate','media.manage','analytics.view')`,
    ),
  ],
);
export const accountInvites = pgTable(
  "account_invites",
  {
    ...id,
    tokenHash: text("token_hash").notNull(),
    displayName: text("display_name").notNull(),
    username: text("username").notNull(),
    kind: accountKindEnum("kind").notNull(),
    role: text("role").notNull().default("member"),
    avatarKey: text("avatar_key").notNull().default("avatar-1.png"),
    capabilities: text("capabilities")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    acceptedByAccountId: uuid("accepted_by_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_invites_token_hash_uq").on(t.tokenHash),
    check("account_invites_role_check", sql`${t.role} in ('owner','editor','member')`),
  ],
);
export const accountPreferences = pgTable(
  "account_preferences",
  {
    accountId: uuid("account_id")
      .primaryKey()
      .references(() => accounts.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().default("ar"),
    theme: text("theme").notNull().default("dark"),
    preferredAudio: text("preferred_audio")
      .array()
      .notNull()
      .default(sql`ARRAY['en','ar','es']::text[]`),
    allowedAudio: text("allowed_audio")
      .array()
      .notNull()
      .default(sql`ARRAY['ar','en','es']::text[]`),
    preferredSubtitles: text("preferred_subtitles")
      .array()
      .notNull()
      .default(sql`ARRAY['ar']::text[]`),
    subtitleMode: text("subtitle_mode").notNull().default("allowed"),
    canSwitchTracks: boolean("can_switch_tracks").notNull().default(true),
    autoplay: boolean("autoplay").notNull().default(false),
    hideSpoilers: boolean("hide_spoilers").notNull().default(true),
    notifyFamilyActivity: boolean("notify_family_activity").notNull().default(true),
    notifyReplies: boolean("notify_replies").notNull().default(true),
    spoilerMode: text("spoiler_mode").notNull().default("cover"),
    /**
     * Which of the four catalog types this account wants to see. Text rather than an enum array
     * so adding a type later needs no `ALTER TYPE`; `visibleTitleKindsSchema` (`@arcadia/domain`)
     * validates the values, and the check below keeps the list from ever being emptied.
     */
    visibleTitleKinds: text("visible_title_kinds")
      .array()
      .notNull()
      .default(
        sql`ARRAY['animated-movie','animated-series','live-action-movie','live-action-series']::text[]`,
      ),
    defaultSavedViewId: uuid("default_saved_view_id"),
    homeLayout: jsonb("home_layout")
      .notNull()
      .default(sql`'{}'::jsonb`),
    dashboardLayout: jsonb("dashboard_layout")
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (t) => [
    check(
      "account_preferences_visible_title_kinds_check",
      sql`array_length(${t.visibleTitleKinds}, 1) >= 1
        and ${t.visibleTitleKinds} <@ ARRAY['animated-movie','animated-series','live-action-movie','live-action-series']::text[]`,
    ),
  ],
);
export const accountContentPolicies = pgTable("account_content_policies", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  ...classificationDefaults,
  inclusionFilter: jsonb("inclusion_filter"),
});
export const accountAdminRestrictions = pgTable("account_admin_restrictions", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  ...classificationDefaults,
  notes: text("notes").notNull().default(""),
});
export const accountTitleBlocks = pgTable(
  "account_title_blocks",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.titleId] }),
    index("account_title_blocks_title_idx").on(t.titleId),
  ],
);
export const accountTagBlocks = pgTable(
  "account_tag_blocks",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.tagId] }),
    index("account_tag_blocks_tag_idx").on(t.tagId),
  ],
);
export const accountGenreBlocks = pgTable(
  "account_genre_blocks",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    genreId: uuid("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.genreId] }),
    index("account_genre_blocks_genre_idx").on(t.genreId),
  ],
);
export const accountEntityBlocks = pgTable(
  "account_entity_blocks",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.entityId] }),
    index("account_entity_blocks_entity_idx").on(t.entityId),
  ],
);
export const accountPlanetBlocks = pgTable(
  "account_planet_blocks",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    planetId: uuid("planet_id")
      .notNull()
      .references(() => planets.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.planetId] }),
    index("account_planet_blocks_planet_idx").on(t.planetId),
  ],
);
export const accountPlaybackStates = pgTable(
  "account_playback_states",
  {
    ...id,
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => installments.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id"),
    positionSeconds: integer("position_seconds").notNull().default(0),
    /**
     * Duration the player reported alongside `positionSeconds`, in seconds — needed to compute a
     * watched percentage. Nullable: a torrent-backed stream may not know its duration for a
     * while, and older rows written before this column existed never had one.
     */
    durationSeconds: integer("duration_seconds"),
    /**
     * Jellyfin-style watched flag. Auto-computed from `positionSeconds`/`durationSeconds` against
     * `AUTO_WATCHED_THRESHOLD` (`@arcadia/domain`) unless `playedManually` is set, in which case a
     * later progress write must not flip it back on its own. Replaces the old `completed` column
     * (same slot, renamed — see `docs/tracking-dashboard-i18n-roadmap.md` Phase B).
     */
    isPlayed: boolean("is_played").notNull().default(false),
    /** Set once a family member explicitly toggles watched/unwatched, so that choice sticks. */
    playedManually: boolean("played_manually").notNull().default(false),
    /** When `isPlayed` last became true — auto or manual. Null while unwatched. */
    playedAt: timestamp("played_at", { withTimezone: true }),
    /** Live `sub-delay` offset in milliseconds, restored alongside position on resume. */
    subtitleOffsetMs: integer("subtitle_offset_ms"),
    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    lastDeviceId: uuid("last_device_id").references((): AnyPgColumn => devices.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // `nullsNotDistinct` matters for movies/specials, which always carry a null `episodeId`: the
    // default Postgres behaviour (two NULLs are never equal for uniqueness) would let every
    // progress write for the same movie silently insert a brand-new row instead of updating the
    // one row a movie is supposed to have — exactly the assumption the read-side endpoints below
    // depend on.
    unique("account_playback_owner_uq")
      .on(t.accountId, t.installmentId, t.episodeId)
      .nullsNotDistinct(),
    foreignKey({
      columns: [t.episodeId, t.installmentId],
      foreignColumns: [episodes.id, episodes.installmentId],
      name: "account_playback_episode_installment_fk",
    }).onDelete("cascade"),
    index("account_playback_installment_idx").on(t.installmentId),
    index("account_playback_episode_idx").on(t.episodeId),
    check(
      "playback_position_check",
      sql`${t.positionSeconds} >= 0 and (${t.durationSeconds} is null or ${t.durationSeconds} >= 0)`,
    ),
    check("playback_revision_check", sql`${t.revision} >= 0`),
  ],
);

export const accountTitleStates = pgTable(
  "account_title_states",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    isFavorite: boolean("is_favorite").notNull().default(false),
    personalRating: integer("personal_rating"),
    notes: text("notes").notNull().default(""),
    /**
     * "Save for offline" (docs/deployment-and-release-roadmap.md §4) — deliberately independent
     * of `isFavorite`: favoriting is an editorial "I like this" signal, saving means "keep this
     * title's metadata and images available on my device even with no server reachable." A title
     * can be one, the other, both, or neither. This column only records the *fact* of having
     * saved something, so it syncs across an account's devices; the actual cached bytes (detail
     * JSON, poster/banner/logo) live client-side per device (IndexedDB), never here.
     */
    savedOffline: boolean("saved_offline").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.titleId] }),
    index("account_title_states_title_idx").on(t.titleId),
    check(
      "account_title_states_rating_check",
      sql`${t.personalRating} is null or ${t.personalRating} between 1 and 5`,
    ),
  ],
);
/**
 * Kept downloads, mirrored from each device's own registry (`src-tauri/src/downloads`). The
 * file lives on one device — `path` is that device's path and `device_id` its install id — so
 * this table never decides what plays; it only lets another device (or the admin) see that "the
 * living-room box has episode 3 on disk". Rows are written best-effort by the desktop app and
 * disappear when it removes the download.
 */
export const accountDownloads = pgTable(
  "account_downloads",
  {
    ...id,
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    installmentId: uuid("installment_id")
      .notNull()
      .references(() => installments.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    deviceName: text("device_name").notNull().default(""),
    path: text("path").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    state: text("state").notNull().default("completed"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.deviceId],
      foreignColumns: [devices.installationId],
      name: "account_downloads_device_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.episodeId, t.installmentId],
      foreignColumns: [episodes.id, episodes.installmentId],
      name: "account_downloads_episode_installment_fk",
    }).onDelete("cascade"),
    check("account_downloads_size_check", sql`${t.sizeBytes} >= 0`),
    uniqueIndex("account_downloads_unit_uq").on(
      t.accountId,
      t.deviceId,
      t.installmentId,
      sql`coalesce(${t.episodeId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    index("account_downloads_installment_idx").on(t.installmentId),
    index("account_downloads_episode_idx").on(t.episodeId),
    check(
      "account_downloads_state_check",
      sql`${t.state} in ('queued', 'downloading', 'paused', 'completed', 'failed')`,
    ),
  ],
);
export const titleReviews = pgTable(
  "title_reviews",
  {
    ...id,
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    /** Compatibility projection of account_title_states.personal_rating; synchronized by SQL triggers. */
    rating: integer("rating"),
    body: text("body").notNull().default(""),
    containsSpoilers: boolean("contains_spoilers").notNull().default(false),
    moderationStatus: moderationStatusEnum("moderation_status").notNull().default("published"),
    moderatedByAccountId: uuid("moderated_by_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("title_reviews_account_title_uq").on(t.accountId, t.titleId),
    index("title_reviews_title_idx").on(t.titleId, t.moderationStatus),
    check("title_reviews_rating_check", sql`${t.rating} between 1 and 5`),
    check("title_reviews_body_check", sql`char_length(${t.body}) <= 1200`),
  ],
);
export const titleComments = pgTable(
  "title_comments",
  {
    ...id,
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    containsSpoilers: boolean("contains_spoilers").notNull().default(false),
    moderationStatus: moderationStatusEnum("moderation_status").notNull().default("published"),
    ...timestamps,
  },
  (t) => [
    unique("title_comments_id_title_uq").on(t.id, t.titleId),
    foreignKey({
      columns: [t.parentId, t.titleId],
      foreignColumns: [t.id, t.titleId],
      name: "title_comments_parent_title_fk",
    }).onDelete("cascade"),
    check(
      "title_comments_parent_self_check",
      sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`,
    ),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "title_comments_parent_fk",
    }).onDelete("cascade"),
    index("title_comments_title_idx").on(t.titleId, t.createdAt),
    index("title_comments_parent_idx").on(t.parentId),
    check("title_comments_body_check", sql`char_length(btrim(${t.body})) between 1 and 1200`),
  ],
);
export const reviewReactions = pgTable(
  "review_reactions",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => titleReviews.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.reviewId, t.accountId, t.emoji] }),
    check(
      "review_reactions_emoji_check",
      sql`${t.emoji} in ('heart','clap','laugh','wow','think')`,
    ),
  ],
);
export const commentReactions = pgTable(
  "comment_reactions",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => titleComments.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.commentId, t.accountId, t.emoji] }),
    check(
      "comment_reactions_emoji_check",
      sql`${t.emoji} in ('heart','clap','laugh','wow','think')`,
    ),
  ],
);
export const notifications = pgTable(
  "notifications",
  {
    ...id,
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    actorAccountId: uuid("actor_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    kind: notificationKindEnum("kind").notNull(),
    titleId: uuid("title_id").references(() => titles.id, { onDelete: "cascade" }),
    objectId: uuid("object_id"),
    message: text("message").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_inbox_idx").on(t.accountId, t.readAt, t.createdAt)],
);

export const accountViewHistory = pgTable(
  "account_view_history",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
    visitCount: integer("visit_count").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.titleId] }),
    index("account_view_history_recent_idx").on(t.accountId, t.viewedAt),
    check("account_view_history_count_check", sql`${t.visitCount} > 0`),
  ],
);
export const savedViews = pgTable(
  "saved_views",
  {
    ...id,
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: jsonb("query")
      .notNull()
      .default(sql`'{}'::jsonb`),
    isDefault: boolean("is_default").notNull().default(false),
    notifyNew: boolean("notify_new").notNull().default(false),
    lastMatchedAt: timestamp("last_matched_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("saved_views_account_name_uq").on(t.accountId, sql`lower(btrim(${t.name}))`),
    uniqueIndex("saved_views_account_default_uq")
      .on(t.accountId)
      .where(sql`${t.isDefault}`),
  ],
);
export const collections = pgTable(
  "collections",
  {
    ...id,
    ownerAccountId: uuid("owner_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    visibility: collectionVisibilityEnum("visibility").notNull().default("private"),
    isSmart: boolean("is_smart").notNull().default(false),
    ranked: boolean("ranked").notNull().default(false),
    rules: jsonb("rules"),
    coverPath: text("cover_path"),
    ...timestamps,
  },
  (t) => [index("collections_owner_idx").on(t.ownerAccountId, t.updatedAt)],
);
export const collectionContributors = pgTable(
  "collection_contributors",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.accountId] })],
);
export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    note: text("note").notNull().default(""),
    addedByAccountId: uuid("added_by_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.titleId] }),
    index("collection_items_order_idx").on(t.collectionId, t.position),
    check("collection_items_position_check", sql`${t.position} >= 0`),
  ],
);
export const titleFollows = pgTable(
  "title_follows",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    reminderDays: integer("reminder_days").notNull().default(7),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.titleId] }),
    check("title_follows_days_check", sql`${t.reminderDays} between 0 and 365`),
  ],
);
export const familyRecommendations = pgTable(
  "family_recommendations",
  {
    ...id,
    senderAccountId: uuid("sender_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    recipientAccountId: uuid("recipient_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: recommendationStatusEnum("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("family_recommendations_recipient_idx").on(t.recipientAccountId, t.status)],
);
export const familyEvents = pgTable(
  "family_events",
  {
    ...id,
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    status: text("status").notNull().default("planning"),
    ...timestamps,
  },
  (t) => [
    index("family_events_schedule_idx").on(t.status, t.scheduledFor),
    check(
      "family_events_status_check",
      sql`${t.status} in ('planning','scheduled','completed','cancelled')`,
    ),
  ],
);
export const familyEventCandidates = pgTable(
  "family_event_candidates",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => familyEvents.id, { onDelete: "cascade" }),
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    nominatedByAccountId: uuid("nominated_by_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.titleId] })],
);
export const familyEventVotes = pgTable(
  "family_event_votes",
  {
    eventId: uuid("event_id").notNull(),
    titleId: uuid("title_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.titleId, t.accountId] }),
    foreignKey({
      columns: [t.eventId, t.titleId],
      foreignColumns: [familyEventCandidates.eventId, familyEventCandidates.titleId],
      name: "family_event_votes_candidate_fk",
    }).onDelete("cascade"),
  ],
);
export const auditLogs = pgTable(
  "audit_logs",
  {
    ...id,
    actorAccountId: uuid("actor_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    summary: text("summary").notNull().default(""),
    changes: jsonb("changes")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_target_idx").on(t.targetType, t.targetId, t.createdAt)],
);
export const editorialRevisions = pgTable(
  "editorial_revisions",
  {
    ...id,
    actorAccountId: uuid("actor_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    revision: integer("revision").notNull(),
    action: text("action").notNull(),
    summary: text("summary").notNull().default(""),
    snapshot: jsonb("snapshot").notNull(),
    changes: jsonb("changes")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("editorial_revisions_entity_revision_uq").on(t.entityType, t.entityId, t.revision),
    index("editorial_revisions_recent_idx").on(t.entityType, t.entityId, t.createdAt),
  ],
);
export const backgroundJobs = pgTable(
  "background_jobs",
  {
    ...id,
    createdByAccountId: uuid("created_by_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    payload: jsonb("payload")
      .notNull()
      .default(sql`'{}'::jsonb`),
    result: jsonb("result"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key"),
  },
  (t) => [
    index("background_jobs_status_idx").on(t.status, t.createdAt),
    check("background_jobs_progress_check", sql`${t.progress} between 0 and 100`),
    check(
      "background_jobs_attempts_check",
      sql`${t.attempts} >= 0 and ${t.maxAttempts} between 1 and 100 and ${t.attempts} <= ${t.maxAttempts}`,
    ),
    check(
      "background_jobs_lease_check",
      sql`(${t.leaseOwner} is null) = (${t.leaseExpiresAt} is null)`,
    ),
    uniqueIndex("background_jobs_idempotency_uq")
      .on(
        sql`coalesce(${t.createdByAccountId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
        t.type,
        t.idempotencyKey,
      )
      .where(sql`${t.idempotencyKey} is not null`),
    index("background_jobs_queue_idx").on(t.status, t.runAfter, t.createdAt),
  ],
);
export const sourceEvidence = pgTable(
  "source_evidence",
  {
    ...id,
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    fieldPath: text("field_path").notNull(),
    sourceNote: text("source_note").notNull(),
    sourceUrl: text("source_url"),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    checkedByAccountId: uuid("checked_by_account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("source_evidence_entity_idx").on(t.entityType, t.entityId, t.fieldPath)],
);

/** One durable identity per installed server; addresses and release versions are not identities. */
export const serverInstance = pgTable(
  "server_instance",
  {
    singleton: boolean("singleton").primaryKey().default(true),
    id: uuid("id").notNull().defaultRandom(),
    name: text("name").notNull().default("مكتبة العائلة"),
    ...timestamps,
  },
  (t) => [
    check("server_instance_singleton_check", sql`${t.singleton}`),
    unique("server_instance_id_uq").on(t.id),
  ],
);

/** Installation identity is independent of the accounts that log in on a shared device. */
export const devices = pgTable(
  "devices",
  {
    ...id,
    installationId: text("installation_id").notNull().unique(),
    name: text("name").notNull().default(""),
    platform: text("platform").notNull().default("unknown"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "devices_installation_id_check",
      sql`char_length(btrim(${t.installationId})) between 1 and 200`,
    ),
  ],
);

export const libraryRoots = pgTable(
  "library_roots",
  {
    ...id,
    name: text("name").notNull(),
    path: text("path").notNull().unique(),
    isReadOnly: boolean("is_read_only").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check(
      "library_roots_values_check",
      sql`btrim(${t.name}) <> '' and ${t.path} like '/%' and ${t.path} !~ '(^|/)\\.\\.(/|$)'`,
    ),
  ],
);

export const titleTrailers = pgTable(
  "title_trailers",
  {
    ...id,
    titleId: uuid("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    youtubeVideoId: text("youtube_video_id").notNull(),
    title: text("title").notNull().default(""),
    language: text("language"),
    isPrimary: boolean("is_primary").notNull().default(false),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("title_trailers_video_uq").on(t.titleId, t.youtubeVideoId),
    uniqueIndex("title_trailers_primary_uq")
      .on(t.titleId)
      .where(sql`${t.isPrimary}`),
    index("title_trailers_order_idx").on(t.titleId, t.position, t.id),
    check(
      "title_trailers_values_check",
      sql`${t.youtubeVideoId} ~ '^[A-Za-z0-9_-]{11}$' and ${t.position} >= 0 and (${t.language} is null or nahhasio_language_codes_valid(ARRAY[${t.language}]))`,
    ),
  ],
);

export const mediaFiles = pgTable(
  "media_files",
  {
    ...id,
    installmentId: uuid("installment_id").references(() => installments.id, {
      onDelete: "cascade",
    }),
    episodeId: uuid("episode_id").references(() => episodes.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    libraryRootId: uuid("library_root_id").references(() => libraryRoots.id, {
      onDelete: "restrict",
    }),
    relativePath: text("relative_path"),
    byteSize: bigint("byte_size", { mode: "bigint" }),
    sha256: text("sha256"),
    modifiedAt: timestamp("modified_at", { withTimezone: true }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    availability: text("availability").notNull().default("unknown"),
    probeMetadata: jsonb("probe_metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    durationSeconds: integer("duration_seconds"),
    probeVersion: text("probe_version"),
    ...timestamps,
  },
  (t) => [
    check(
      "media_file_single_owner_check",
      sql`num_nonnulls(${t.installmentId}, ${t.episodeId}) = 1`,
    ),
    check(
      "media_file_duration_check",
      sql`${t.durationSeconds} is null or ${t.durationSeconds} >= 0`,
    ),
    index("media_files_installment_idx").on(t.installmentId),
    index("media_files_episode_idx").on(t.episodeId),
    uniqueIndex("media_files_root_path_uq")
      .on(t.libraryRootId, t.relativePath)
      .where(sql`${t.libraryRootId} is not null`),
    check(
      "media_files_location_check",
      sql`(${t.libraryRootId} is null and ${t.relativePath} is null) or (${t.libraryRootId} is not null and ${t.relativePath} is not null and ${t.relativePath} <> '' and ${t.relativePath} not like '/%' and ${t.relativePath} !~ '(^|/)\\.\\.(/|$)')`,
    ),
    check(
      "media_files_values_check",
      sql`(${t.byteSize} is null or ${t.byteSize} >= 0) and (${t.sha256} is null or ${t.sha256} ~ '^[0-9a-f]{64}$') and ${t.availability} in ('unknown','present','missing','unreadable') and jsonb_typeof(${t.probeMetadata})='object'`,
    ),
  ],
);
export const mediaTracks = pgTable(
  "media_tracks",
  {
    ...id,
    mediaFileId: uuid("media_file_id")
      .notNull()
      .references(() => mediaFiles.id, { onDelete: "cascade" }),
    kind: trackKindEnum("kind").notNull(),
    streamIndex: integer("stream_index"),
    source: text("source").notNull().default("embedded"),
    relativePath: text("relative_path"),
    sha256: text("sha256"),
    provider: text("provider"),
    providerId: text("provider_id"),
    isHearingImpaired: boolean("is_hearing_impaired").notNull().default(false),
    language: text("language"),
    codec: text("codec"),
    title: text("title"),
    isDefault: boolean("is_default").notNull().default(false),
    isForced: boolean("is_forced").notNull().default(false),
  },
  (t) => [
    uniqueIndex("media_tracks_stream_uq").on(t.mediaFileId, t.streamIndex),
    check("media_tracks_stream_index_check", sql`${t.streamIndex} >= 0`),
    uniqueIndex("media_tracks_sidecar_uq")
      .on(t.mediaFileId, t.relativePath)
      .where(sql`${t.source}='external'`),
    check(
      "media_tracks_source_check",
      sql`(${t.source}='embedded' and ${t.streamIndex} is not null and ${t.relativePath} is null) or (${t.source}='external' and ${t.kind}='subtitle' and ${t.streamIndex} is null and ${t.relativePath} is not null and ${t.relativePath} <> '' and ${t.relativePath} not like '/%' and ${t.relativePath} !~ '(^|/)\\.\\.(/|$)')`,
    ),
    check("media_tracks_hash_check", sql`${t.sha256} is null or ${t.sha256} ~ '^[0-9a-f]{64}$'`),
  ],
);
export const jellyfinServers = pgTable("jellyfin_servers", {
  ...id,
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  externalServerId: text("external_server_id"),
  ...timestamps,
});
export const jellyfinItems = pgTable(
  "jellyfin_items",
  {
    ...id,
    serverId: uuid("server_id")
      .notNull()
      .references(() => jellyfinServers.id, { onDelete: "cascade" }),
    mediaFileId: uuid("media_file_id").references(() => mediaFiles.id, { onDelete: "set null" }),
    externalItemId: text("external_item_id").notNull(),
    etag: text("etag"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("jellyfin_item_external_uq").on(t.serverId, t.externalItemId)],
);

export const titlesRelations = relations(titles, ({ many }) => ({
  installments: many(installments),
  aliases: many(titleAliases),
  trivia: many(titleTrivia),
  awards: many(awardRecognitions),
}));
export const installmentsRelations = relations(installments, ({ one, many }) => ({
  title: one(titles, { fields: [installments.titleId], references: [titles.id] }),
  episodes: many(episodes),
  score: one(installmentScores),
  awards: many(awardRecognitions),
}));
export const awardRecognitionsRelations = relations(awardRecognitions, ({ one }) => ({
  title: one(titles, { fields: [awardRecognitions.titleId], references: [titles.id] }),
  installment: one(installments, {
    fields: [awardRecognitions.installmentId],
    references: [installments.id],
  }),
}));

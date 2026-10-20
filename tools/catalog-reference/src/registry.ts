/**
 * Friendly resource names layered over the introspected schema.
 *
 * Generic CRUD already works against any table by its real name, so nothing here is required
 * for correctness — the registry exists purely for ergonomics that save an agent round trips:
 * a short singular name, the columns worth showing in a list, the columns a human-readable
 * reference can be matched against, and a default sort order. Unregistered tables stay fully
 * reachable by passing the raw table name.
 */

export type ResourceScope = Record<string, string>;

export type Resource = {
  /** Command name, e.g. `title` in `nahhasio title list`. */
  name: string;
  table: string;
  aliases?: readonly string[];
  summary: string;
  /**
   * Columns a free-text reference is matched against, in priority order, when resolving
   * something like `nahhasio title get "Arcane"` to a primary key.
   */
  refColumns?: readonly string[];
  /** Columns scanned by `--search`; defaults to `refColumns`. */
  searchColumns?: readonly string[];
  /** Columns shown by `list` when `--columns` is not given. */
  listColumns?: readonly string[];
  /** Default `order by` clause for `list`. */
  orderBy?: string;
  /**
   * Fixed column values that both filter every read and are injected into every create —
   * how `person` and `studio` become distinct resources over the shared `entities` table.
   */
  scope?: ResourceScope;
};

export const resources: readonly Resource[] = [
  {
    name: "server",
    table: "server_instance",
    summary: "Stable server identity; deployment configuration, not a new server per launch.",
  },
  { name: "device", table: "devices", summary: "Registered installations and revocations." },
  {
    name: "library-root",
    table: "library_roots",
    summary: "Selected server video roots; scanning is pending.",
  },
  {
    name: "trailer",
    table: "title_trailers",
    summary: "Ordered YouTube trailers owned by a work.",
  },
  {
    name: "media-file",
    table: "media_files",
    summary: "Stored video links; runtime acquisition and linking are separate.",
  },
  {
    name: "media-track",
    table: "media_tracks",
    summary: "Audio and embedded or external subtitle tracks.",
  },
  {
    name: "playback",
    table: "account_playback_states",
    summary: "Account progress, explicit watched state and revisions.",
  },
  { name: "download", table: "account_downloads", summary: "Account/device download records." },
  {
    name: "jellyfin-server",
    table: "jellyfin_servers",
    summary: "Private Jellyfin backend configuration.",
  },
  { name: "jellyfin-item", table: "jellyfin_items", summary: "Stored-media backend mappings." },

  {
    name: "title",
    table: "titles",
    aliases: ["work", "titles"],
    summary: "Umbrella catalog records (a franchise or standalone work).",
    refColumns: ["canonical_title", "sort_title", "title_ar"],
    listColumns: [
      "id",
      "canonical_title",
      "title_ar",
      "release_year",
      "format",
      "workflow_status",
      "audience",
      "age",
      "sexuality_risk",
      "behavioral_risk",
      "theology_risk",
    ],
    orderBy: "sort_title",
  },
  {
    name: "alias",
    table: "title_aliases",
    summary: "Alternate titles for a work.",
    refColumns: ["title"],
    listColumns: ["id", "title_id", "title", "language", "script", "is_preferred"],
    orderBy: "title",
  },
  {
    name: "installment",
    table: "installments",
    aliases: ["season", "film", "movie", "special"],
    summary: "Seasons, films, and specials beneath a title.",
    refColumns: ["title"],
    listColumns: [
      "id",
      "title_id",
      "kind",
      "position",
      "title",
      "release_date",
      "runtime_minutes",
      "status",
    ],
    orderBy: "title_id, position",
  },
  {
    name: "episode",
    table: "episodes",
    summary: "Episodes beneath an installment.",
    refColumns: ["title"],
    listColumns: [
      "id",
      "installment_id",
      "number",
      "position",
      "title",
      "release_date",
      "runtime_minutes",
    ],
    orderBy: "installment_id, position",
  },
  {
    name: "score",
    table: "installment_scores",
    summary: "Editorial scores (0-10 per criterion) keyed by installment.",
    listColumns: [
      "installment_id",
      "story",
      "characters",
      "depth",
      "world_building",
      "originality",
      "craft",
    ],
    orderBy: "installment_id",
  },
  {
    name: "award",
    table: "award_recognitions",
    aliases: ["recognition"],
    summary: "Award wins and nominations attached to a title or installment.",
    refColumns: ["category"],
    listColumns: [
      "id",
      "title_id",
      "installment_id",
      "organization_name",
      "category",
      "year",
      "result",
      "is_featured",
    ],
    orderBy: "year desc nulls last, position",
  },
  {
    name: "award-org",
    table: "award_organizations",
    aliases: ["organization"],
    summary: "Award-granting bodies.",
    refColumns: ["slug", "name_ar", "name_en"],
    listColumns: ["id", "slug", "name_ar", "name_en", "is_active"],
    orderBy: "slug",
  },
  {
    name: "award-category",
    table: "award_categories",
    summary: "Categories offered by an award organization.",
    refColumns: ["slug", "name_ar", "name_en"],
    listColumns: ["id", "organization_id", "slug", "name_ar", "name_en", "is_active"],
    orderBy: "slug",
  },
  {
    name: "award-ceremony",
    table: "award_ceremonies",
    aliases: ["ceremony"],
    summary: "A specific year's edition of an award.",
    refColumns: ["label"],
    listColumns: ["id", "organization_id", "year", "edition", "label", "held_on"],
    orderBy: "year desc",
  },
  {
    name: "entity",
    table: "entities",
    summary: "People and organizations (studios, publishers, distributors).",
    refColumns: ["name", "sort_name"],
    listColumns: ["id", "kind", "name", "sort_name"],
    orderBy: "sort_name",
  },
  {
    name: "person",
    table: "entities",
    summary: "People only — a scoped view of entities.",
    refColumns: ["name", "sort_name"],
    listColumns: ["id", "name", "sort_name", "description"],
    orderBy: "sort_name",
    scope: { kind: "person" },
  },
  {
    name: "studio",
    table: "entities",
    aliases: ["org"],
    summary: "Organizations only — a scoped view of entities.",
    refColumns: ["name", "sort_name"],
    listColumns: ["id", "name", "sort_name", "description"],
    orderBy: "sort_name",
    scope: { kind: "organization" },
  },
  {
    name: "credit",
    table: "contributions",
    aliases: ["contribution"],
    summary: "Who did what on a title (title + entity + role).",
    listColumns: ["title_id", "entity_id", "role_id", "languages", "position", "is_primary"],
    orderBy: "title_id, position",
  },
  {
    name: "planet",
    table: "planets",
    aliases: ["universe"],
    summary: "Curated browse universes.",
    refColumns: ["slug", "name_ar", "name_en"],
    listColumns: ["id", "slug", "name_ar", "name_en", "icon", "display_order", "is_active"],
    orderBy: "display_order",
  },
  {
    name: "genre",
    table: "genres",
    summary: "Genre vocabulary.",
    refColumns: ["slug", "label_en", "label_ar"],
    listColumns: ["id", "slug", "label_en", "label_ar", "position", "is_active"],
    orderBy: "position, slug",
  },
  {
    name: "tone",
    table: "tones",
    summary: "Tone vocabulary.",
    refColumns: ["slug", "label_en", "label_ar"],
    listColumns: ["id", "slug", "label_en", "label_ar", "position", "is_active"],
    orderBy: "position, slug",
  },
  {
    name: "tag",
    table: "tags",
    summary: "Tag vocabulary.",
    refColumns: ["slug", "label_en", "label_ar"],
    listColumns: ["id", "slug", "label_en", "label_ar", "position", "is_active"],
    orderBy: "position, slug",
  },
  {
    name: "country",
    table: "countries",
    summary: "Country vocabulary.",
    refColumns: ["slug", "label_en", "label_ar"],
    listColumns: ["id", "slug", "label_en", "label_ar", "position", "is_active"],
    orderBy: "position, slug",
  },
  {
    name: "role",
    table: "roles",
    summary: "Credit roles, including custom roles; entity-kind compatibility is enforced.",
    refColumns: ["slug", "label_en", "label_ar"],
    listColumns: ["id", "slug", "entity_kind", "label_en", "label_ar", "position"],
    orderBy: "position",
  },
  {
    name: "relation",
    table: "title_relations",
    summary: "Sequel/adaptation/spin-off links between titles.",
    listColumns: ["id", "source_title_id", "target_title_id", "kind", "notes"],
    orderBy: "source_title_id",
  },
  {
    name: "org-relation",
    table: "organization_relations",
    summary: "Relationships between organizations.",
    listColumns: ["id", "source_id", "target_id", "relation_type", "occurred_on"],
    orderBy: "source_id",
  },
  {
    name: "external-id",
    table: "external_identities",
    summary:
      "Free-form references (Wikipedia, official site, Fanart image ids) for a title " +
      "or installment. The five typed catalog ids (tmdb/imdb/tvdb/anilist/mal) live as columns " +
      "on `title`/`installment` directly, not here.",
    listColumns: ["id", "title_id", "installment_id", "provider", "external_id", "url"],
    orderBy: "provider",
  },
  {
    name: "media-asset",
    table: "media_assets",
    aliases: ["asset", "image"],
    summary: "Content-addressed image files.",
    refColumns: ["path", "original_filename"],
    listColumns: ["id", "path", "mime_type", "width", "height", "byte_size"],
    orderBy: "created_at desc",
  },
  {
    name: "media-assignment",
    table: "media_asset_assignments",
    aliases: ["assignment"],
    summary: "Which asset serves which role for which owner.",
    listColumns: [
      "id",
      "asset_id",
      "role",
      "title_id",
      "installment_id",
      "episode_id",
      "entity_id",
      "is_primary",
    ],
    orderBy: "created_at desc",
  },
  {
    name: "account",
    table: "accounts",
    aliases: ["profile"],
    summary: "Family/personal/admin profiles.",
    refColumns: ["slug", "display_name"],
    listColumns: ["id", "kind", "status", "slug", "display_name", "is_discoverable"],
    orderBy: "display_name",
  },
  {
    name: "capability",
    table: "account_capabilities",
    summary: "Per-account admin capability grants.",
    listColumns: ["account_id", "capability", "granted_at"],
    orderBy: "account_id",
  },
  {
    name: "preference",
    table: "account_preferences",
    summary: "Per-account playback and interface preferences.",
    listColumns: ["account_id", "locale", "theme", "autoplay", "hide_spoilers"],
    orderBy: "account_id",
  },
  {
    name: "content-policy",
    table: "account_content_policies",
    aliases: ["policy"],
    summary: "Per-account maximum allowed classification.",
    orderBy: "account_id",
  },
  {
    name: "review",
    table: "title_reviews",
    summary: "Member reviews.",
    listColumns: ["id", "title_id", "account_id", "rating", "status", "created_at"],
    orderBy: "created_at desc",
  },
  {
    name: "comment",
    table: "title_comments",
    summary: "Member comments.",
    listColumns: ["id", "title_id", "account_id", "status", "created_at"],
    orderBy: "created_at desc",
  },
  {
    name: "collection",
    table: "collections",
    summary: "Curated member collections.",
    refColumns: ["title", "slug"],
    orderBy: "created_at desc",
  },
  {
    name: "library",
    table: "account_title_states",
    summary: "Per-account favorite/rating/notes for a title.",
    listColumns: ["account_id", "title_id", "is_favorite", "personal_rating", "updated_at"],
    orderBy: "updated_at desc",
  },
  {
    name: "audit",
    table: "audit_logs",
    summary: "Admin mutation trail.",
    listColumns: ["id", "created_at", "action", "target_type", "target_id", "summary"],
    orderBy: "created_at desc",
  },
  {
    name: "revision",
    table: "editorial_revisions",
    summary: "Editorial snapshots per entity.",
    listColumns: ["id", "entity_type", "entity_id", "revision", "action", "created_at"],
    orderBy: "created_at desc",
  },
  {
    name: "job",
    table: "background_jobs",
    summary: "Background job queue.",
    listColumns: ["id", "status", "created_at"],
    orderBy: "created_at desc",
  },
  {
    name: "source",
    table: "source_evidence",
    summary: "Provenance evidence backing catalog claims.",
    orderBy: "created_at desc",
  },
  {
    name: "invite",
    table: "account_invites",
    summary: "Outstanding account invitations.",
    listColumns: ["id", "display_name", "username", "kind", "role", "expires_at", "accepted_at"],
    orderBy: "created_at desc",
  },
];

const byName = new Map<string, Resource>();
for (const resource of resources) {
  byName.set(resource.name, resource);
  byName.set(resource.table, resource);
  for (const alias of resource.aliases ?? []) byName.set(alias, resource);
}

export function findResource(name: string): Resource | undefined {
  return byName.get(name) ?? byName.get(name.toLowerCase());
}

/**
 * Resolve a command word to a resource. Unregistered tables are still usable — they get a
 * synthetic resource so `nahhasio jellyfin_items list` works without a registry entry.
 */
export function resolveResource(name: string, knownTables: ReadonlySet<string>): Resource {
  const registered = findResource(name);
  if (registered) return registered;
  if (knownTables.has(name)) {
    return { name, table: name, summary: `Raw table "${name}".` };
  }
  const withUnderscores = name.replace(/-/g, "_");
  if (knownTables.has(withUnderscores)) {
    return { name, table: withUnderscores, summary: `Raw table "${withUnderscores}".` };
  }
  throw new Error(`Unknown resource or table "${name}"`);
}

export function resourceNames(): string[] {
  return resources.map((resource) => resource.name);
}

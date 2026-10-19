import {
  ageSchema,
  audienceSchema,
  riskLevelSchema,
  taxonomySchema,
  titleKindSchema,
  visibleTitleKindsSchema,
} from "@arcadia/domain";
import { z } from "zod";

import { adminAwardCeremonyInputSchema, externalIdFieldsSchema } from "./admin-catalog";
import {
  awardResultSchema,
  installmentKindSchema,
  installmentStatusSchema,
  scoreSchema,
  titleReleaseStatusSchema,
  workflowStatusSchema,
} from "./enums";

export * from "./admin-catalog";
export * from "./admin-field-registry";
export * from "./playback";
export {
  awardResultSchema,
  installmentKindSchema,
  installmentStatusSchema,
  scoreSchema,
  titleReleaseStatusSchema,
  workflowStatusSchema,
};
export const effectiveClassificationSchema = z.object({
  audience: audienceSchema,
  age: ageSchema,
  sexuality: riskLevelSchema,
  behavioral: riskLevelSchema,
  theology: riskLevelSchema,
});
export const awardRecognitionSchema = z.object({
  id: z.string().uuid(),
  organizationSlug: z.string().min(1),
  organizationName: z.string().min(1),
  category: z.string().min(1),
  year: z.number().int().min(1900).max(2100).nullable(),
  result: awardResultSchema,
  isFeatured: z.boolean(),
  installmentId: z.string().uuid().nullable(),
  installmentTitle: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  notes: z.string().nullable(),
});
export const publicAwardOrganizationSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  nameAr: z.string().min(1),
  nameEn: z.string().nullable(),
  description: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  logoPath: z.string().nullable(),
  winnerCount: z.number().int().min(0),
  nomineeCount: z.number().int().min(0),
  workCount: z.number().int().min(0),
});
export const publicAwardRecognitionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationSlug: z.string().min(1),
  organizationName: z.string().min(1),
  category: z.string().min(1),
  year: z.number().int().nullable(),
  result: awardResultSchema,
  isFeatured: z.boolean(),
  titleId: z.string().uuid(),
  title: z.string(),
  titleAr: z.string().nullable(),
  posterPath: z.string().nullable(),
  installmentId: z.string().uuid().nullable(),
  installmentTitle: z.string().nullable(),
});
export const publicAwardsDocumentSchema = z.object({
  organizations: z.array(publicAwardOrganizationSchema),
  recognitions: z.array(publicAwardRecognitionSchema),
});
export const episodeSchema = z.object({
  id: z.string().uuid(),
  number: z.number(),
  position: z.number().int(),
  title: z.string().nullable(),
  summary: z.string(),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  posterPath: z.string().nullable(),
});
export const installmentSchema = z
  .object({
    id: z.string().uuid(),
    titleId: z.string().uuid(),
    kind: installmentKindSchema,
    position: z.number().int(),
    title: z.string(),
    summary: z.string(),
    releaseDate: z.string().nullable(),
    runtimeMinutes: z.number().int().nullable(),
    status: installmentStatusSchema,
    posterPath: z.string().nullable(),
    episodeCount: z.number().int().min(0).nullable(),
    classification: effectiveClassificationSchema,
    classificationOverrides: z.array(z.string()),
    score: scoreSchema,
    rating: z.number().nullable(),
    awards: z.array(awardRecognitionSchema),
    episodes: z.array(episodeSchema).optional(),
    /** Whether this installment can actually resolve a stream today — the same id-availability
     *  rules the player's `GET .../streams` route itself applies (own id, or a sole-film title's
     *  id; a season additionally needs at least one integer-numbered episode). Independent of
     *  release status — this is a cataloging-completeness signal, not a "is it out yet" one. */
    isPlayable: z.boolean(),
  })
  .merge(externalIdFieldsSchema);
export const titleSummarySchema = z.object({
  id: z.string().uuid(),
  canonicalTitle: z.string(),
  /** The stored `format` (animated / live action) crossed with whether the title has any season
   *  installment — see `titleKindOf` in `@arcadia/domain`. Read-only: writers send `format`. */
  kind: titleKindSchema,
  titleAr: z.string().nullable(),
  summary: z.string(),
  posterPath: z.string().nullable(),
  bannerPath: z.string().nullable(),
  logoPath: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  releaseStatus: titleReleaseStatusSchema,
  isPrivate: z.boolean().optional(),
  /** Only for editors/owners (with `isPrivate`): the editorial workflow state, so the admin
   *  catalog can filter by it without a detail request per row. */
  workflowStatus: workflowStatusSchema.optional(),
  aliases: z.array(z.string()),
  contentWarnings: z.string().nullable(),
  analysisNotes: z.string().nullable(),
  genres: z.array(taxonomySchema("genres")),
  tones: z.array(taxonomySchema("tones")),
  tags: z.array(taxonomySchema("tags")),
  countries: z.array(z.string()),
  planet: z
    .object({ id: z.string().uuid(), slug: z.string(), nameAr: z.string(), icon: z.string() })
    .nullable(),
  score: z.object({
    rating: z.number().nullable(),
    scored: z.number().int(),
    total: z.number().int(),
    components: scoreSchema,
  }),
  classifications: z.array(effectiveClassificationSchema),
  credits: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      kind: z.enum(["person", "organization"]),
      role: z.string(),
      position: z.number().int().min(0).default(0),
      isPrimary: z.boolean().default(false),
    }),
  ),
  awards: z.array(awardRecognitionSchema),
  /** True when any of this title's installments is individually playable — see the matching note
   *  on `installmentSchema.isPlayable`. */
  isPlayable: z.boolean(),
});
export const titleDetailSchema = titleSummarySchema.merge(externalIdFieldsSchema).extend({
  /** Ordered list of short Arabic facts about the title's origin, setting, and production
   *  ("الأصل والقصة", "المكان", "حقائق بارزة") — see the arcadia-cataloging skill. Rendered as a
   *  plain list on the title page, distinct from `contentWarnings`/`analysisNotes`. */
  trivia: z.array(z.string()),
  installments: z.array(installmentSchema),
  relationships: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.string(),
      titleId: z.string().uuid(),
      title: z.string(),
      direction: z.enum(["outgoing", "incoming"]),
      notes: z.string(),
    }),
  ),
  externalIdentities: z.array(
    z.object({
      id: z.string().uuid(),
      provider: z.string(),
      externalId: z.string(),
      url: z.string().nullable(),
    }),
  ),
});
export const adminTitleDetailSchema = titleDetailSchema.extend({
  workflowStatus: workflowStatusSchema,
  qualityScore: z.number().int().min(0),
  curatorNotes: z.string(),
  provenance: z.record(z.string(), z.unknown()),
  verifiedAt: z.string().nullable(),
});
export const browseQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  mode: z.enum(["titles", "installments"]).default("titles"),
  genre: z.string().optional(),
  tone: z.string().optional(),
  tag: z.string().optional(),
  planet: z.string().optional(),
  sort: z.enum(["title", "release", "score"]).default("title"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
export const browseResponseSchema = z.object({
  items: z.array(z.union([titleSummarySchema, installmentSchema])),
  total: z.number().int(),
  mode: z.enum(["titles", "installments"]),
});
export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["ready", "unavailable"]),
  version: z.literal("v2"),
});

export const adminErrorSchema = z.object({
  message: z.string(),
  issues: z.array(z.unknown()).optional(),
});

export const adminEntityKindSchema = z.enum(["person", "organization"]);
export const adminEntityInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  sortName: z.string().trim().min(1),
  entityType: adminEntityKindSchema,
  description: z.string(),
  imagePath: z.string().trim().nullable(),
  aliases: z.array(z.string().trim().min(1)).default([]),
});
export const adminEntityContributionSchema = z.object({
  role: z.string().min(1),
  roleLabelAr: z.string(),
  position: z.number().int().min(0),
  isPrimary: z.boolean(),
});
export const adminEntityWorkSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  arabicTitle: z.string().nullable(),
  year: z.number().int().nullable(),
  kind: titleKindSchema,
  releaseStatus: titleReleaseStatusSchema,
  imagePath: z.string().nullable(),
  isPrivate: z.boolean(),
  contributions: z.array(adminEntityContributionSchema),
});
export const adminEntitySchema = adminEntityInputSchema.extend({
  id: z.string().uuid(),
  aliases: z.array(z.string()),
  workCount: z.number().int().min(0),
  works: z.array(adminEntityWorkSchema),
});
export const adminEntityContributionInputSchema = z.object({
  titleId: z.string().uuid(),
  role: z.string().min(1),
  position: z.number().int().min(0).default(0),
  isPrimary: z.boolean().default(false),
});
export const adminEntityContributionDeleteSchema = adminEntityContributionInputSchema.pick({
  titleId: true,
  role: true,
});

export const adminPlanetSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  icon: z.string(),
  description: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  displayOrder: z.number().int(),
  isActive: z.boolean(),
  workCount: z.number().int().min(0),
});

export const mediaAssetRoleSchema = z.enum(["poster", "banner", "logo", "profile", "still"]);
export const mediaOwnerSchema = z
  .object({
    titleId: z.string().uuid().optional(),
    installmentId: z.string().uuid().optional(),
    episodeId: z.string().uuid().optional(),
    entityId: z.string().uuid().optional(),
  })
  .refine((value) => Object.values(value).filter(Boolean).length === 1, {
    message: "Exactly one media owner is required",
  });
export const mediaAssetSchema = z.object({
  id: z.string().uuid(),
  path: z.string().startsWith("/media/"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  byteSize: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  originalFilename: z.string(),
  focalX: z.number().int().min(0).max(100),
  focalY: z.number().int().min(0).max(100),
  usageCount: z.number().int().min(0),
  health: z.enum(["healthy", "missing", "deletion-failed"]),
  deletionError: z.string().nullable(),
  assignments: z.array(
    z.object({
      id: z.string().uuid(),
      role: mediaAssetRoleSchema,
      isPrimary: z.boolean(),
      owner: mediaOwnerSchema,
      ownerLabel: z.string(),
    }),
  ),
});
export const adminMediaUploadSchema = z.object({
  dataUrl: z.string().max(14_000_000),
  fileName: z.string().trim().min(1).max(255),
  ownerName: z.string().trim().min(1).max(200),
  role: mediaAssetRoleSchema,
  owner: mediaOwnerSchema.optional(),
  isPrimary: z.boolean().default(true),
});
export const adminMediaAssignmentSchema = z.object({
  assetId: z.string().uuid(),
  role: mediaAssetRoleSchema,
  owner: mediaOwnerSchema,
  isPrimary: z.boolean().default(true),
});
export const adminMediaSearchSchema = z.object({
  q: z.string().trim().max(160).optional(),
  health: z
    .enum(["all", "healthy", "missing", "deletion-failed", "reused", "unused", "oversized"])
    .default("all"),
  role: mediaAssetRoleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Artwork roles TMDB/AniList/Fanart can supply — "profile" (people/studios) isn't sourced from
 * any of them, so it's deliberately excluded here even though `mediaAssetRoleSchema` allows it. */
export const artworkRoleSchema = z.enum(["poster", "banner", "logo"]);
export const artworkProviderSchema = z.enum(["tmdb", "anilist", "fanart"]);
export const artworkSearchQuerySchema = z.object({
  title: z.string().trim().min(1).max(200),
  seriesTitle: z.string().trim().min(1).max(200).optional(),
  year: z.coerce.number().int().min(1850).max(2100).optional(),
  /** Routes the search: the series/movie half picks TMDB's `/tv` vs `/movie` endpoint, and the
   *  animated half decides whether AniList is worth querying at all. */
  kind: titleKindSchema.optional(),
  role: artworkRoleSchema,
  /** A confirmed id already on the title/installment — when present, the matching provider
   * looks the row up directly instead of fuzzy-searching by `title`/`year`. */
  tmdbId: z.coerce.number().int().positive().optional(),
  anilistId: z.coerce.number().int().positive().optional(),
  season: z.coerce.number().int().nonnegative().optional(),
});
export const artworkCandidateSchema = z.object({
  provider: artworkProviderSchema,
  externalId: z.string().min(1),
  role: artworkRoleSchema,
  previewUrl: z.string().url(),
  downloadUrl: z.string().url(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  language: z.string().nullable(),
  /** What matched, e.g. the TMDB/AniList title — lets an admin sanity-check the source picked
   * the right work before trusting its images. */
  matchLabel: z.string(),
});
export const adminArtworkSearchResponseSchema = z.object({
  candidates: z.array(artworkCandidateSchema),
});
export const adminArtworkIngestSchema = z.object({
  downloadUrl: z.string().url(),
  role: artworkRoleSchema,
  ownerName: z.string().trim().min(1).max(200),
  owner: mediaOwnerSchema.optional(),
  isPrimary: z.boolean().default(true),
  provider: artworkProviderSchema,
  externalId: z.string().min(1),
  /** When set, also records the matched id on this owner: `tmdb`/`anilist` update the typed
   * `tmdb_id`/`anilist_id` column on the title or installment; `fanart` still writes an
   * `external_identities` row (it's an image id, not a catalog id). Exactly one of `titleId`/
   * `installmentId` is expected when either is set. */
  titleId: z.string().uuid().optional(),
  installmentId: z.string().uuid().optional(),
});

export const vocabularyNameSchema = z.enum([
  "genres",
  "tones",
  "tags",
  "countries",
  "roles",
  "audiences",
  "ages",
  "risk-levels",
  "release-statuses",
]);
export const vocabularyTermSchema = z.object({
  id: z.string().min(1),
  vocabulary: vocabularyNameSchema,
  slug: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  descriptionEn: z.string(),
  descriptionAr: z.string(),
  position: z.number().int().min(0),
  isActive: z.boolean(),
  usageCount: z.number().int().min(0),
  /** Set only for contribution roles; it determines who can receive the credit. */
  entityType: z.enum(["person", "organization"]).nullable(),
});
export const adminVocabularyInputSchema = z.object({
  id: z.string().min(1).optional(),
  vocabulary: vocabularyNameSchema,
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  labelEn: z.string().trim().min(1).max(120),
  labelAr: z.string().trim().min(1).max(120),
  descriptionEn: z.string().max(1000).default(""),
  descriptionAr: z.string().max(1000).default(""),
  position: z.number().int().min(0),
  isActive: z.boolean().default(true),
  entityType: z.enum(["person", "organization"]).nullable().default(null),
});

export const validationIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  category: z.enum(["integrity", "metadata", "media", "vocabulary", "jellyfin"]),
  entityType: z.string(),
  entityId: z.string(),
  title: z.string(),
  path: z.string(),
  message: z.string(),
  action: z.string(),
  repairPath: z.string().nullable(),
  autoRepairable: z.boolean(),
});
export const adminStatisticsSchema = z.object({
  visibility: z.array(z.object({ key: z.string(), value: z.number().int() })),
  kinds: z.array(z.object({ key: z.string(), value: z.number().int() })),
  releaseTimeline: z.array(z.object({ year: z.number().int(), value: z.number().int() })),
  installmentStatus: z.array(z.object({ key: z.string(), value: z.number().int() })),
  genres: z.array(z.object({ key: z.string(), labelAr: z.string(), value: z.number().int() })),
  tags: z.array(z.object({ key: z.string(), labelAr: z.string(), value: z.number().int() })),
  tones: z.array(z.object({ key: z.string(), labelAr: z.string(), value: z.number().int() })),
  countries: z.array(z.object({ key: z.string(), labelAr: z.string(), value: z.number().int() })),
  planets: z.array(z.object({ key: z.string(), labelAr: z.string(), value: z.number().int() })),
  scoreDistribution: z.array(z.object({ bucket: z.string(), value: z.number().int() })),
  scoreCoverage: z.object({ scored: z.number().int(), total: z.number().int() }),
  media: z.object({
    assets: z.number().int(),
    bytes: z.number().int(),
    reused: z.number().int(),
    roles: z.array(z.object({ key: z.string(), value: z.number().int() })),
    formats: z.array(z.object({ key: z.string(), value: z.number().int() })),
  }),
  contributors: z.array(
    z.object({ key: z.string(), labelAr: z.string(), value: z.number().int() }),
  ),
});

export const accountKindSchema = z.enum(["admin", "family", "personal"]);
export const accountStatusSchema = z.enum(["invited", "active", "suspended"]);
export const accountRoleSchema = z.enum(["owner", "editor", "member"]);
/**
 * Relative path to a curated static avatar beneath `public/media/avatars`. Keeping the filename
 * (including its extension) as the value lets the catalog grow without another schema release,
 * while this strict shape prevents path traversal or an arbitrary remote image URL.
 */
const legacyAvatarKeySchema = z.enum(["orbit-1", "orbit-2", "orbit-3", "orbit-4", "orbit-5"]);

const avatarAssetKeySchema = z
  .string()
  .regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|webp|jpe?g|avif)$/);

// Legacy device-profile data may outlive the database migration that replaces
// the former sprite keys. Keep it readable while AccountAvatar maps it to a
// current asset.
export const avatarKeySchema = z.union([legacyAvatarKeySchema, avatarAssetKeySchema]);
export const accountCapabilitySchema = z.enum([
  "catalog.view",
  "catalog.edit",
  "people.edit",
  "studios.edit",
  "awards.edit",
  "accounts.manage",
  "policies.manage",
  "social.moderate",
  "media.manage",
  "analytics.view",
]);
export const accountPreferencesSchema = z.object({
  /** `system` follows `prefers-color-scheme`; resolved on the client by `lib/theme.ts`. */
  theme: z.enum(["dark", "light", "system"]),
  preferredAudio: z.array(z.string()),
  allowedAudio: z.array(z.string()),
  subtitleMode: z.enum(["off", "allowed"]),
  canSwitchTracks: z.boolean(),
  autoplay: z.boolean(),
  hideSpoilers: z.boolean(),
  spoilerMode: z.enum(["cover", "hide", "show"]),
  /** Which of the four catalog types this account wants on its shelves. Enforced server-side
   *  through the visibility policy, so a deselected type disappears from browse, search, and
   *  its own detail page alike — never fewer than one type. */
  visibleTitleKinds: visibleTitleKindsSchema,
  notifyFamilyActivity: z.boolean(),
  notifyReplies: z.boolean(),
  defaultSavedViewId: z.string().uuid().nullable(),
  homeLayout: z.record(z.string(), z.unknown()),
  dashboardLayout: z.record(z.string(), z.unknown()),
});
export const familyAccountSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  displayName: z.string(),
  kind: accountKindSchema,
  role: accountRoleSchema,
  status: accountStatusSchema,
  avatarKey: avatarKeySchema,
  bio: z.string(),
  capabilities: z.array(accountCapabilitySchema),
  preferences: accountPreferencesSchema,
  contentPolicy: effectiveClassificationSchema,
  isCurrent: z.boolean(),
});
export const sessionAccountSchema = z.object({
  account: familyAccountSchema,
  expiresAt: z.string(),
  /** Whether a family-set ceiling or block list currently narrows this account below what
   *  `account.contentPolicy` alone would allow — never which titles, only that something is
   *  limited. See the Settings "الأمان"/content-limits explanation this backs. */
  contentRestricted: z.boolean(),
});
export const signInInputSchema = z.object({
  username: z.string().trim().min(3).max(30),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().default(true),
});
export const updateAccountInputSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  avatarKey: avatarKeySchema.optional(),
  bio: z.string().trim().max(280).optional(),
  preferences: accountPreferencesSchema.partial().optional(),
  contentPolicy: effectiveClassificationSchema.optional(),
});
export const createAccountInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(80),
  kind: accountKindSchema,
  role: accountRoleSchema.default("member"),
  avatarKey: avatarKeySchema,
  capabilities: z.array(accountCapabilitySchema).default([]),
});
export const createInviteInputSchema = createAccountInputSchema.omit({ password: true }).extend({
  expiresInHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(72),
});
export const acceptInviteInputSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(8).max(128),
});
export const adminUpdateAccountInputSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  kind: accountKindSchema.optional(),
  role: accountRoleSchema.optional(),
  status: accountStatusSchema.optional(),
  avatarKey: avatarKeySchema.optional(),
  capabilities: z.array(accountCapabilitySchema).optional(),
  contentPolicy: effectiveClassificationSchema.optional(),
  adminRestrictions: effectiveClassificationSchema.optional(),
  blockedTitleIds: z.array(z.string().uuid()).optional(),
  blockedTagIds: z.array(z.string().uuid()).optional(),
  blockedGenreIds: z.array(z.string().uuid()).optional(),
  blockedEntityIds: z.array(z.string().uuid()).optional(),
  blockedPlanetIds: z.array(z.string().uuid()).optional(),
});
const restrictionOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  description: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
});
export const accountRestrictionEditorSchema = z.object({
  blockedTitleIds: z.array(z.string().uuid()),
  blockedTagIds: z.array(z.string().uuid()),
  blockedGenreIds: z.array(z.string().uuid()),
  blockedEntityIds: z.array(z.string().uuid()),
  blockedPlanetIds: z.array(z.string().uuid()),
  options: z.object({
    titles: z.array(restrictionOptionSchema),
    tags: z.array(restrictionOptionSchema),
    genres: z.array(restrictionOptionSchema),
    entities: z.array(restrictionOptionSchema),
    planets: z.array(restrictionOptionSchema),
  }),
});
export const accountPolicyPreviewSchema = z.object({
  id: z.string().uuid(),
  username: z.string().nullable(),
  displayName: z.string(),
  kind: accountKindSchema,
  role: accountRoleSchema,
  status: accountStatusSchema,
  avatarKey: avatarKeySchema,
  capabilities: z.array(accountCapabilitySchema),
  contentPolicy: effectiveClassificationSchema,
  adminRestrictions: effectiveClassificationSchema,
  titleBlockCount: z.number().int().min(0),
  tagBlockCount: z.number().int().min(0),
  genreBlockCount: z.number().int().min(0),
  entityBlockCount: z.number().int().min(0),
  planetBlockCount: z.number().int().min(0),
  lastSeenAt: z.string().nullable(),
  authenticationReady: z.literal(true),
});

export const accountTitleStateSchema = z.object({
  titleId: z.string().uuid(),
  isFavorite: z.boolean(),
  personalRating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().max(2000),
  /** "Save for offline" — see the column's own doc comment in schema.ts. Independent of
   *  `isFavorite`. */
  savedOffline: z.boolean(),
  updatedAt: z.string(),
});
export const titleReviewSchema = z.object({
  id: z.string().uuid(),
  titleId: z.string().uuid(),
  author: familyAccountSchema.pick({ id: true, displayName: true, avatarKey: true }),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1200),
  containsSpoilers: z.boolean(),
  reactions: z.record(z.string(), z.number().int().min(0)),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const titleCommentSchema = z.object({
  id: z.string().uuid(),
  titleId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  author: familyAccountSchema.pick({ id: true, displayName: true, avatarKey: true }),
  body: z.string().min(1).max(1200),
  containsSpoilers: z.boolean(),
  reactions: z.record(z.string(), z.number().int().min(0)),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const socialReactionSchema = z.enum(["heart", "clap", "laugh", "wow", "think"]);
export const downloadStateSchema = z.enum([
  "queued",
  "downloading",
  "paused",
  "completed",
  "failed",
]);
/** One device's kept download of a film or episode — see `account_downloads` in schema.ts. */
export const accountDownloadSchema = z.object({
  id: z.string().uuid(),
  installmentId: z.string().uuid(),
  episodeId: z.string().uuid().nullable(),
  deviceId: z.string().min(1).max(64),
  deviceName: z.string().max(120),
  path: z.string().max(4096),
  sizeBytes: z.number().int().min(0),
  state: downloadStateSchema,
  updatedAt: z.string(),
});
export const upsertDownloadInputSchema = accountDownloadSchema.omit({ id: true, updatedAt: true });
export const upsertTitleStateInputSchema = z.object({
  isFavorite: z.boolean().optional(),
  personalRating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).optional(),
  savedOffline: z.boolean().optional(),
});
/**
 * `PUT /api/v1/me/playback` — a progress tick from the player (pause/exit/interval). `isPlayed`
 * is never accepted here: the server derives it from `positionSeconds`/`durationSeconds` against
 * `AUTO_WATCHED_THRESHOLD` (`@arcadia/domain`), unless the row was already marked
 * `playedManually`, in which case that choice sticks. Explicit watched/unwatched toggles go
 * through `markPlayedInputSchema` instead.
 */
export const upsertPlaybackInputSchema = z.object({
  installmentId: z.string().uuid(),
  episodeId: z.string().uuid().nullable().default(null),
  positionSeconds: z.number().int().min(0),
  /** Null until the player knows it (e.g. a torrent-backed stream still parsing the container). */
  durationSeconds: z.number().int().min(0).nullable().default(null),
  /** The live `sub-delay` offset, in milliseconds — restored alongside position on resume. Not
   *  sent means "leave whatever is already stored", so a plain progress tick never clobbers a
   *  previously-set offset. */
  subtitleOffsetMs: z.number().int().optional(),
});
/** One playback-progress row, as read back by the API. */
export const accountPlaybackStateSchema = z.object({
  id: z.string().uuid(),
  installmentId: z.string().uuid(),
  episodeId: z.string().uuid().nullable(),
  titleId: z.string().uuid(),
  positionSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().min(0).nullable(),
  isPlayed: z.boolean(),
  playedManually: z.boolean(),
  playedAt: z.string().nullable(),
  subtitleOffsetMs: z.number().int().nullable(),
  updatedAt: z.string(),
});
/** `PATCH /api/v1/me/playback/:installmentId/played` — an explicit watched/unwatched toggle. */
export const markPlayedInputSchema = z.object({
  episodeId: z.string().uuid().nullable().default(null),
  isPlayed: z.boolean(),
});
/**
 * Bulk "mark season/series as watched or unwatched". Scoped to one installment (a season's
 * episodes, or a single movie) when `installmentId` is set, or to every installment/episode under
 * the title when it's omitted — writes one `account_playback_states` row per episode/movie in a
 * single transaction.
 */
export const bulkMarkPlayedInputSchema = z.object({
  installmentId: z.string().uuid().nullable().default(null),
  isPlayed: z.boolean(),
});
/**
 * One resumable unit for the "My Space" dashboard's continue-watching/up-next row: a movie
 * (`episodeId: null`) or a single episode, enriched with the display fields the raw
 * `account_playback_states` row doesn't carry (title, poster, episode label) so the dashboard
 * doesn't need a second round trip per card.
 */
export const continueWatchingItemSchema = z.object({
  titleId: z.string().uuid(),
  title: z.string(),
  posterPath: z.string().nullable(),
  /** Landscape artwork, preferred over `posterPath` on resume/history surfaces: a 16:9 frame
   *  leaves room beside the art for a progress bar and time-remaining, which a 2:3 poster does
   *  not. Null when the title has no primary banner assigned — callers fall back to the poster. */
  bannerPath: z.string().nullable(),
  installmentId: z.string().uuid(),
  installmentTitle: z.string(),
  episodeId: z.string().uuid().nullable(),
  episodeLabel: z.string().nullable(),
  positionSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().min(0).nullable(),
});
export const continueWatchingResponseSchema = z.object({
  /** In-progress rows (`positionSeconds > 0`, not played), most recently touched first. */
  inProgress: z.array(continueWatchingItemSchema),
  /** The next unwatched unit per followed title that has no in-progress row of its own. */
  upNext: z.array(continueWatchingItemSchema),
  /** Titles where every trackable unit (movie/special, or every episode of every season) is
   *  marked played for this account — drives the watched badge on title-mode catalog cards. */
  watchedTitleIds: z.array(z.string().uuid()),
  /** Installments (a movie/special, or a season) whose own trackable units are all marked played
   *  — drives the watched badge on installment-mode catalog cards (the flattened browse view). */
  watchedInstallmentIds: z.array(z.string().uuid()),
});
export const watchHistoryItemSchema = continueWatchingItemSchema.extend({
  isPlayed: z.boolean(),
  playedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export const watchStatsSchema = z.object({
  inProgressCount: z.number().int().min(0),
  watchedThisMonth: z.number().int().min(0),
  totalHoursWatched: z.number().min(0),
});
export const upsertReviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1200).default(""),
  containsSpoilers: z.boolean().default(false),
});
export const createCommentInputSchema = z.object({
  parentId: z.string().uuid().nullable().default(null),
  body: z.string().trim().min(1).max(1200),
  containsSpoilers: z.boolean().default(false),
});
export const reactionInputSchema = z.object({ emoji: socialReactionSchema });
export const familyActivitySchema = z.object({
  id: z.string(),
  kind: z.enum(["review", "comment", "favorite"]),
  account: familyAccountSchema.pick({ id: true, displayName: true, avatarKey: true }),
  title: z.object({ id: z.string().uuid(), name: z.string(), posterPath: z.string().nullable() }),
  body: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  /** Emoji reaction counts (`review_reactions`/`comment_reactions`); empty for `favorite` rows,
   * which are not reactable objects. */
  reactions: z.record(z.string(), z.number().int().min(0)).default({}),
  createdAt: z.string(),
});
export const titleSocialSchema = z.object({
  state: accountTitleStateSchema.nullable(),
  reviews: z.array(titleReviewSchema),
  comments: z.array(titleCommentSchema),
});
export const notificationSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["reply", "reaction", "review", "catalog", "system"]),
  message: z.string(),
  titleId: z.string().uuid().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  actor: familyAccountSchema.pick({ id: true, displayName: true, avatarKey: true }).nullable(),
});
export const awardCategoryOptionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
});
export const awardOrganizationOptionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  categories: z.array(awardCategoryOptionSchema),
});
export const awardOptionsSchema = z.array(awardOrganizationOptionSchema);
export const adminAwardCategorySchema = awardCategoryOptionSchema.extend({
  description: z.string(),
  isActive: z.boolean(),
  recognitionCount: z.number().int().min(0),
});
export const adminAwardOrganizationSchema = awardOrganizationOptionSchema
  .omit({ categories: true })
  .extend({
    description: z.string(),
    logoPath: z.string().nullable(),
    isActive: z.boolean(),
    recognitionCount: z.number().int().min(0),
    workCount: z.number().int().min(0),
    winnerCount: z.number().int().min(0),
    nomineeCount: z.number().int().min(0),
    categories: z.array(adminAwardCategorySchema),
  });
export const adminAwardRecognitionSchema = awardRecognitionSchema.extend({
  organizationId: z.string().uuid().nullable(),
  categoryId: z.string().uuid().nullable(),
  titleId: z.string().uuid(),
  title: z.string(),
  titleAr: z.string().nullable(),
  isPrivate: z.boolean(),
});
export const adminAwardCeremonySchema = adminAwardCeremonyInputSchema.extend({
  id: z.string().uuid(),
});
export const adminAwardsDocumentSchema = z.object({
  organizations: z.array(adminAwardOrganizationSchema),
  recognitions: z.array(adminAwardRecognitionSchema),
  ceremonies: z.array(adminAwardCeremonySchema),
});
export const adminAwardOrganizationInputSchema = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameAr: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().max(160).nullable(),
  description: z.string().max(4000),
  websiteUrl: z.string().url().nullable(),
  logoPath: z.string().nullable(),
  isActive: z.boolean(),
});
export const adminAwardCategoryInputSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameAr: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().max(160).nullable(),
  description: z.string().max(4000),
  isActive: z.boolean(),
});
export const adminAwardRecognitionInputSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  categoryId: z.string().uuid(),
  titleId: z.string().uuid(),
  installmentId: z.string().uuid().nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  result: awardResultSchema,
  isFeatured: z.boolean(),
  sourceUrl: z.string().url().nullable(),
  notes: z.string().max(4000).nullable(),
});
export const createAwardOrganizationSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameAr: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().max(160).nullable().default(null),
  websiteUrl: z.string().url().nullable().default(null),
});
export const createAwardCategorySchema = z.object({
  organizationId: z.string().uuid(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameAr: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().max(160).nullable().default(null),
});

export const collectionVisibilitySchema = z.enum(["private", "family"]);
export const recommendationStatusSchema = z.enum(["pending", "accepted", "deferred", "dismissed"]);
export const jobStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);

const compactTitleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  posterPath: z.string().nullable(),
});
export const viewHistoryItemSchema = z.object({
  title: compactTitleSchema,
  viewedAt: z.string(),
  visitCount: z.number().int().positive(),
});
export const savedViewSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  query: z.record(z.string(), z.unknown()),
  isDefault: z.boolean(),
  notifyNew: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const savedViewInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  query: z.record(z.string(), z.unknown()).default({}),
  isDefault: z.boolean().default(false),
  notifyNew: z.boolean().default(false),
});
export const collectionItemSchema = z.object({
  title: compactTitleSchema,
  position: z.number().int().min(0),
  note: z.string().max(600),
  addedAt: z.string(),
});
export const collectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  visibility: collectionVisibilitySchema,
  isSmart: z.boolean(),
  ranked: z.boolean(),
  coverPath: z.string().nullable(),
  rules: z.record(z.string(), z.unknown()).nullable(),
  owner: familyAccountSchema.pick({ id: true, displayName: true, avatarKey: true }),
  contributorCount: z.number().int().min(0),
  items: z.array(collectionItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const collectionInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""),
  visibility: collectionVisibilitySchema.default("private"),
  isSmart: z.boolean().default(false),
  ranked: z.boolean().default(false),
  rules: z.record(z.string(), z.unknown()).nullable().default(null),
});
export const collectionItemInputSchema = z.object({
  titleId: z.string().uuid(),
  note: z.string().trim().max(600).default(""),
});
export const familyRecommendationSchema = z.object({
  id: z.string().uuid(),
  sender: familyAccountSchema.pick({ id: true, displayName: true, avatarKey: true }),
  recipient: familyAccountSchema.pick({ id: true, displayName: true, avatarKey: true }),
  title: compactTitleSchema,
  reason: z.string(),
  status: recommendationStatusSchema,
  createdAt: z.string(),
  respondedAt: z.string().nullable(),
});
export const createRecommendationInputSchema = z.object({
  recipientAccountId: z.string().uuid(),
  titleId: z.string().uuid(),
  reason: z.string().trim().min(1).max(400),
});
export const familyEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  notes: z.string(),
  scheduledFor: z.string().nullable(),
  status: z.enum(["planning", "scheduled", "completed", "cancelled"]),
  creator: familyAccountSchema.pick({ id: true, displayName: true, avatarKey: true }),
  candidates: z.array(
    z.object({
      title: compactTitleSchema,
      votes: z.number().int().min(0),
      votedByMe: z.boolean(),
    }),
  ),
  createdAt: z.string(),
});
export const familyEventInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(1000).default(""),
  scheduledFor: z.string().datetime().nullable().default(null),
  candidateTitleIds: z.array(z.string().uuid()).min(1).max(12),
});
export const auditEntrySchema = z.object({
  id: z.string().uuid(),
  actorName: z.string().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  summary: z.string(),
  changes: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export const editorialRevisionSchema = auditEntrySchema.extend({
  revision: z.number().int().positive(),
  snapshot: z.record(z.string(), z.unknown()),
});
export const backgroundJobSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  status: jobStatusSchema,
  progress: z.number().int().min(0).max(100),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export const archiveQualitySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  label: z.string(),
  score: z.number().int().min(0).max(100),
  issues: z.array(z.string()),
});
export const duplicateCandidateSchema = z.object({
  entityType: z.enum(["title", "entity"]),
  normalizedValue: z.string(),
  candidates: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
});
export const sourceEvidenceSchema = z.object({
  id: z.string().uuid(),
  entityType: z.string(),
  entityId: z.string(),
  fieldPath: z.string(),
  sourceNote: z.string(),
  sourceUrl: z.string().nullable(),
  verificationStatus: z.enum(["unverified", "verified", "rejected"]),
  checkedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const sourceEvidenceInputSchema = z.object({
  entityType: z.string().trim().min(1).max(40),
  entityId: z.string().trim().min(1).max(100),
  fieldPath: z.string().trim().min(1).max(120),
  sourceNote: z.string().trim().min(2).max(1000),
  sourceUrl: z.string().url().nullable().default(null),
  verificationStatus: z.enum(["unverified", "verified", "rejected"]).default("unverified"),
});
export const releaseCalendarItemSchema = z.object({
  installmentId: z.string().uuid(),
  titleId: z.string().uuid(),
  title: z.string(),
  installmentTitle: z.string(),
  kind: z.enum(["season", "movie", "special"]),
  releaseDate: z.string(),
  followed: z.boolean(),
  posterPath: z.string().nullable(),
});
export const permissionExplanationSchema = z.object({
  accountId: z.string().uuid(),
  targetType: z.string(),
  targetId: z.string(),
  allowed: z.boolean(),
  reasons: z.array(z.string()),
});

export type TitleSummary = z.infer<typeof titleSummarySchema>;
export type TitleDetail = z.infer<typeof titleDetailSchema>;
export type Installment = z.infer<typeof installmentSchema>;
export type InstallmentStatus = z.infer<typeof installmentStatusSchema>;
export type TitleReleaseStatus = z.infer<typeof titleReleaseStatusSchema>;
export type AwardRecognition = z.infer<typeof awardRecognitionSchema>;
export type AwardResult = z.infer<typeof awardResultSchema>;
export type BrowseResponse = z.infer<typeof browseResponseSchema>;
export type AdminTitleDetail = z.infer<typeof adminTitleDetailSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type ArtworkCandidate = z.infer<typeof artworkCandidateSchema>;
export type ArtworkProvider = z.infer<typeof artworkProviderSchema>;
export type AdminEntity = z.infer<typeof adminEntitySchema>;
export type AdminEntityInput = z.infer<typeof adminEntityInputSchema>;
export type AdminEntityContributionInput = z.infer<typeof adminEntityContributionInputSchema>;
export type AdminPlanet = z.infer<typeof adminPlanetSchema>;
export type VocabularyTerm = z.infer<typeof vocabularyTermSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type AdminStatistics = z.infer<typeof adminStatisticsSchema>;
export type AccountPolicyPreview = z.infer<typeof accountPolicyPreviewSchema>;
export type AccountKind = z.infer<typeof accountKindSchema>;
export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type AccountRole = z.infer<typeof accountRoleSchema>;
export type AccountCapability = z.infer<typeof accountCapabilitySchema>;
export type AvatarKey = z.infer<typeof avatarKeySchema>;
export type FamilyAccount = z.infer<typeof familyAccountSchema>;
export type SessionAccount = z.infer<typeof sessionAccountSchema>;
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountInputSchema>;
export type CreateAccountInput = z.infer<typeof createAccountInputSchema>;
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;
export type AdminUpdateAccountInput = z.infer<typeof adminUpdateAccountInputSchema>;
export type AccountRestrictionEditor = z.infer<typeof accountRestrictionEditorSchema>;
export type AccountTitleState = z.infer<typeof accountTitleStateSchema>;
export type AccountDownload = z.infer<typeof accountDownloadSchema>;
export type UpsertDownloadInput = z.infer<typeof upsertDownloadInputSchema>;
export type UpsertPlaybackInput = z.infer<typeof upsertPlaybackInputSchema>;
export type AccountPlaybackState = z.infer<typeof accountPlaybackStateSchema>;
export type MarkPlayedInput = z.infer<typeof markPlayedInputSchema>;
export type BulkMarkPlayedInput = z.infer<typeof bulkMarkPlayedInputSchema>;
export type ContinueWatchingItem = z.infer<typeof continueWatchingItemSchema>;
export type ContinueWatchingResponse = z.infer<typeof continueWatchingResponseSchema>;
export type WatchHistoryItem = z.infer<typeof watchHistoryItemSchema>;
export type WatchStats = z.infer<typeof watchStatsSchema>;
export type TitleReview = z.infer<typeof titleReviewSchema>;
export type TitleComment = z.infer<typeof titleCommentSchema>;
export type TitleSocial = z.infer<typeof titleSocialSchema>;
export type FamilyActivity = z.infer<typeof familyActivitySchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type AwardOrganizationOption = z.infer<typeof awardOrganizationOptionSchema>;
export type PublicAwardOrganization = z.infer<typeof publicAwardOrganizationSchema>;
export type PublicAwardRecognition = z.infer<typeof publicAwardRecognitionSchema>;
export type PublicAwardsDocument = z.infer<typeof publicAwardsDocumentSchema>;
export type AdminAwardsDocument = z.infer<typeof adminAwardsDocumentSchema>;
export type AdminAwardOrganizationInput = z.infer<typeof adminAwardOrganizationInputSchema>;
export type AdminAwardCategoryInput = z.infer<typeof adminAwardCategoryInputSchema>;
export type AdminAwardRecognitionInput = z.infer<typeof adminAwardRecognitionInputSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type CollectionItem = z.infer<typeof collectionItemSchema>;
export type SavedView = z.infer<typeof savedViewSchema>;
export type ViewHistoryItem = z.infer<typeof viewHistoryItemSchema>;
export type FamilyRecommendation = z.infer<typeof familyRecommendationSchema>;
export type FamilyEvent = z.infer<typeof familyEventSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type EditorialRevision = z.infer<typeof editorialRevisionSchema>;
export type BackgroundJob = z.infer<typeof backgroundJobSchema>;
export type ArchiveQuality = z.infer<typeof archiveQualitySchema>;
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;
export type ReleaseCalendarItem = z.infer<typeof releaseCalendarItemSchema>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type PermissionExplanation = z.infer<typeof permissionExplanationSchema>;

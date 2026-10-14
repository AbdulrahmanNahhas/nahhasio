// Generated from openapi.json. Do not edit.
import { z } from "zod";

export const FavoriteRequestSchema = z.strictObject({
  isFavorite: z.boolean(),
});
export type FavoriteRequest = z.infer<typeof FavoriteRequestSchema>;

export const WatchedRequestSchema = z.strictObject({
  installmentId: z.string().uuid().nullable(),
  episodeId: z.string().uuid().nullable(),
  isPlayed: z.boolean(),
});
export type WatchedRequest = z.infer<typeof WatchedRequestSchema>;

export const WatchSummarySchema = z.strictObject({
  catalogUnits: z.number().int().min(0),
  releasedUnits: z.number().int().min(0),
  watchedReleasedUnits: z.number().int().min(0),
  isFullyWatched: z.boolean(),
  watchState: z.enum(["unwatched", "in-progress", "watched"]),
});
export type WatchSummary = z.infer<typeof WatchSummarySchema>;

export const ViewerUnitStateSchema = z.strictObject({
  stateId: z.string().uuid().nullable(),
  installmentId: z.string().uuid(),
  episodeId: z.string().uuid().nullable(),
  isReleased: z.boolean(),
  positionSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().min(0).nullable(),
  isPlayed: z.boolean(),
  playedManually: z.boolean(),
  playedAt: z.string().nullable(),
  subtitleOffsetMs: z.number().int().nullable(),
  updatedAt: z.string().nullable(),
});
export type ViewerUnitState = z.infer<typeof ViewerUnitStateSchema>;

export const InstallmentViewerStateSchema = z.strictObject({
  installmentId: z.string().uuid(),
  summary: WatchSummarySchema,
});
export type InstallmentViewerState = z.infer<typeof InstallmentViewerStateSchema>;

export const WorkViewerStateSchema = z.strictObject({
  workId: z.string().uuid(),
  isFavorite: z.boolean(),
  units: z.array(ViewerUnitStateSchema),
  summary: WatchSummarySchema,
  installments: z.array(InstallmentViewerStateSchema),
});
export type WorkViewerState = z.infer<typeof WorkViewerStateSchema>;

export const ActivityAuthorSchema = z.strictObject({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarKey: z.string(),
});
export type ActivityAuthor = z.infer<typeof ActivityAuthorSchema>;

export const WorkActivityItemSchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.enum(["comment", "review"]),
  body: z.string(),
  containsSpoilers: z.boolean(),
  rating: z.number().int().min(1).max(5).nullable(),
  parentId: z.string().uuid().nullable(),
  author: ActivityAuthorSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkActivityItem = z.infer<typeof WorkActivityItemSchema>;

export const WorkActivityPageSchema = z.strictObject({
  workId: z.string().uuid(),
  items: z.array(WorkActivityItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type WorkActivityPage = z.infer<typeof WorkActivityPageSchema>;

export const ErrorSchema = z.strictObject({
  message: z.string(),
});
export type Error = z.infer<typeof ErrorSchema>;

export const UserSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["owner", "admin", "member"]),
  accountId: z.string().uuid(),
  kind: z.enum(["admin", "family", "personal"]),
  avatarKey: z.string(),
  bio: z.string(),
  isAdmin: z.boolean(),
  updatedAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const LoginRequestSchema = z.strictObject({
  email: z.string(),
  password: z.string().min(1).max(1024),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SessionSchema = z.strictObject({
  user: UserSchema,
  expiresAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

export const LoginResponseSchema = z.strictObject({
  token: z.string(),
  user: UserSchema,
  expiresAt: z.string(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const ArtworkSchema = z.strictObject({
  id: z.string().uuid(),
  url: z.string(),
  mimeType: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  byteSize: z.number().int(),
  sha256: z.string(),
  originalFilename: z.string(),
  focalX: z.number().int(),
  focalY: z.number().int(),
});
export type Artwork = z.infer<typeof ArtworkSchema>;

export const ScoreSummarySchema = z.strictObject({
  rating: z.number().nullable(),
  scored: z.number().int(),
  total: z.number().int(),
});
export type ScoreSummary = z.infer<typeof ScoreSummarySchema>;

export const WorkSummarySchema = z.strictObject({
  id: z.string().uuid(),
  canonicalTitle: z.string(),
  titleAr: z.string().nullable(),
  summary: z.string(),
  releaseYear: z.number().int().nullable(),
  format: z.enum(["animated", "live-action"]),
  audience: z.enum(["general", "teen", "young-adult", "adult"]),
  age: z.string(),
  poster: ArtworkSchema.nullable(),
  installmentCount: z.number().int(),
  episodeCount: z.number().int(),
  isPrivate: z.boolean(),
  score: ScoreSummarySchema,
  banner: ArtworkSchema.nullable(),
  logo: ArtworkSchema.nullable(),
});
export type WorkSummary = z.infer<typeof WorkSummarySchema>;

export const UpcomingInstallmentSchema = z.strictObject({
  id: z.string().uuid(),
  workId: z.string().uuid(),
  workTitle: z.string(),
  workTitleAr: z.string().nullable(),
  title: z.string(),
  kind: z.enum(["season", "movie", "special"]),
  releaseDate: z.string().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  episodeCount: z.number().int(),
  poster: ArtworkSchema.nullable(),
  score: ScoreSummarySchema,
});
export type UpcomingInstallment = z.infer<typeof UpcomingInstallmentSchema>;

export const HomeViewingItemSchema = z.strictObject({
  work: WorkSummarySchema,
  installmentId: z.string().uuid(),
  installmentTitle: z.string(),
  episodeId: z.string().uuid().nullable(),
  episodeNumber: z.string().nullable(),
  episodeTitle: z.string().nullable(),
  releaseDate: z.string().nullable(),
  artwork: ArtworkSchema.nullable(),
  positionSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().nullable(),
  isPlayed: z.boolean(),
});
export type HomeViewingItem = z.infer<typeof HomeViewingItemSchema>;

export const ReleaseEntrySchema = z.strictObject({
  id: z.string().uuid(),
  workId: z.string().uuid(),
  workTitle: z.string(),
  workTitleAr: z.string().nullable(),
  installmentId: z.string().uuid(),
  installmentTitle: z.string().nullable(),
  installmentKind: z.string(),
  episodeNumber: z.string().nullable(),
  title: z.string().nullable(),
  kind: z.enum(["installment", "episode"]),
  releaseDate: z.iso.date().nullable(),
  status: z.string(),
  runtimeMinutes: z.number().int().nullable(),
  episodeCount: z.number().int().min(0).nullable(),
  work: WorkSummarySchema.optional(),
  installment: UpcomingInstallmentSchema.optional(),
  viewing: HomeViewingItemSchema.nullable().optional(),
  poster: ArtworkSchema.nullable(),
});
export type ReleaseEntry = z.infer<typeof ReleaseEntrySchema>;

export const ReleasesPageSchema = z.strictObject({
  items: z.array(ReleaseEntrySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1).max(100000),
  pageSize: z.number().int().min(1).max(100),
  years: z.array(z.number().int().min(1).max(9999)),
  days: z.array(
    z.strictObject({
      date: z.iso.date(),
      count: z.number().int().min(1),
      previews: z.array(ReleaseEntrySchema).optional(),
    }),
  ),
  asOf: z.iso.date(),
});
export type ReleasesPage = z.infer<typeof ReleasesPageSchema>;

export const ArtworkAssignmentSchema = z.strictObject({
  id: z.string().uuid(),
  url: z.string(),
  mimeType: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  role: z.enum(["poster", "banner", "logo", "profile"]),
  isPrimary: z.boolean(),
  byteSize: z.number().int(),
  sha256: z.string(),
  originalFilename: z.string(),
  focalX: z.number().int(),
  focalY: z.number().int(),
});
export type ArtworkAssignment = z.infer<typeof ArtworkAssignmentSchema>;

export const VocabularySchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  descriptionEn: z.string(),
  descriptionAr: z.string(),
});
export type Vocabulary = z.infer<typeof VocabularySchema>;

export const ExternalIdsSchema = z.strictObject({
  tmdbId: z.number().int().nullable(),
  imdbId: z.string().nullable(),
  anilistId: z.number().int().nullable(),
  malId: z.number().int().nullable(),
});
export type ExternalIds = z.infer<typeof ExternalIdsSchema>;

export const ScoresSchema = z.strictObject({
  story: z.number().nullable(),
  characters: z.number().nullable(),
  depth: z.number().nullable(),
  worldBuilding: z.number().nullable(),
  originality: z.number().nullable(),
  craft: z.number().nullable(),
  updatedAt: z.string(),
});
export type Scores = z.infer<typeof ScoresSchema>;

export const ClassificationSchema = z.strictObject({
  audience: z.enum(["general", "teen", "young-adult", "adult"]),
  age: z.string(),
  sexualityRisk: z.enum(["none", "low", "medium", "high"]),
  behavioralRisk: z.enum(["none", "low", "medium", "high"]),
  theologyRisk: z.enum(["none", "low", "medium", "high"]),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const MediaTrackSchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.enum(["video", "audio", "subtitle"]),
  streamIndex: z.number().int(),
  language: z.string().nullable(),
  codec: z.string().nullable(),
  title: z.string().nullable(),
  isDefault: z.boolean(),
  isForced: z.boolean(),
});
export type MediaTrack = z.infer<typeof MediaTrackSchema>;

export const MediaFileSchema = z.strictObject({
  id: z.string().uuid(),
  durationSeconds: z.number().int().nullable(),
  jellyfinLinked: z.boolean(),
  tracks: z.array(MediaTrackSchema),
});
export type MediaFile = z.infer<typeof MediaFileSchema>;

export const EpisodeSchema = z.strictObject({
  id: z.string().uuid(),
  number: z.string(),
  position: z.number().int(),
  title: z.string().nullable(),
  summary: z.string(),
  releaseDate: z.iso.date().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  releaseState: z.enum(["unknown", "upcoming", "released"]),
  hasMediaFile: z.boolean(),
  classification: ClassificationSchema,
  artwork: z.array(ArtworkAssignmentSchema),
  mediaFiles: z.array(MediaFileSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const ClassificationOverridesSchema = z.strictObject({
  audience: z.enum(["general", "teen", "young-adult", "adult"]).nullable(),
  age: z.string().nullable(),
  sexualityRisk: z.enum(["none", "low", "medium", "high"]).nullable(),
  behavioralRisk: z.enum(["none", "low", "medium", "high"]).nullable(),
  theologyRisk: z.enum(["none", "low", "medium", "high"]).nullable(),
});
export type ClassificationOverrides = z.infer<typeof ClassificationOverridesSchema>;

export const ExternalReferenceSchema = z.strictObject({
  id: z.string().uuid(),
  provider: z.string(),
  externalId: z.string(),
  url: z.string().nullable(),
});
export type ExternalReference = z.infer<typeof ExternalReferenceSchema>;

export const InstallmentSchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.enum(["season", "movie", "special"]),
  position: z.number().int(),
  title: z.string(),
  summary: z.string(),
  releaseDate: z.iso.date().nullable(),
  runtimeMinutes: z.number().int().nullable(),
  status: z.enum(["announced", "airing", "completed", "unknown"]),
  externalIds: ExternalIdsSchema,
  scores: ScoresSchema.nullable(),
  hasMediaFile: z.boolean(),
  artwork: z.array(ArtworkAssignmentSchema),
  episodes: z.array(EpisodeSchema),
  classification: ClassificationSchema,
  classificationOverrides: ClassificationOverridesSchema,
  releaseState: z.enum(["unknown", "upcoming", "released"]),
  externalReferences: z.array(ExternalReferenceSchema),
  mediaFiles: z.array(MediaFileSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Installment = z.infer<typeof InstallmentSchema>;

export const AliasSchema = z.strictObject({
  title: z.string(),
  language: z.string().nullable(),
  isPreferred: z.boolean(),
  id: z.string().uuid(),
  script: z.string().nullable(),
});
export type Alias = z.infer<typeof AliasSchema>;

export const EntityAliasSchema = z.strictObject({
  alias: z.string(),
  language: z.string().nullable(),
});
export type EntityAlias = z.infer<typeof EntityAliasSchema>;

export const ContributionSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string(),
  kind: z.string(),
  role: z.string(),
  roleLabelEn: z.string(),
  roleLabelAr: z.string(),
  description: z.string(),
  aliases: z.array(EntityAliasSchema),
  artwork: z.array(ArtworkAssignmentSchema),
  isPrimary: z.boolean(),
  position: z.number().int(),
  roleId: z.string().uuid(),
  roleDescriptionEn: z.string(),
  roleDescriptionAr: z.string(),
});
export type Contribution = z.infer<typeof ContributionSchema>;

export const RelationSchema = z.strictObject({
  id: z.string().uuid(),
  workId: z.string().uuid(),
  canonicalTitle: z.string(),
  titleAr: z.string().nullable(),
  kind: z.string(),
  direction: z.enum(["outgoing", "incoming"]),
  notes: z.string(),
});
export type Relation = z.infer<typeof RelationSchema>;

export const PlanetSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  icon: z.string(),
  description: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  featuredRank: z.number().int().nullable(),
});
export type Planet = z.infer<typeof PlanetSchema>;

export const AwardOrganizationSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  description: z.string(),
  websiteUrl: z.string().nullable(),
});
export type AwardOrganization = z.infer<typeof AwardOrganizationSchema>;

export const AwardCategorySchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  description: z.string(),
});
export type AwardCategory = z.infer<typeof AwardCategorySchema>;

export const AwardCeremonySchema = z.strictObject({
  id: z.string().uuid(),
  year: z.number().int(),
  edition: z.number().int().nullable(),
  label: z.string(),
  heldOn: z.iso.date().nullable(),
  sourceUrl: z.string().nullable(),
});
export type AwardCeremony = z.infer<typeof AwardCeremonySchema>;

export const AwardRecognitionSchema = z.strictObject({
  id: z.string().uuid(),
  installmentId: z.string().uuid().nullable(),
  organizationSlug: z.string(),
  organizationName: z.string(),
  category: z.string(),
  year: z.number().int().nullable(),
  result: z.enum(["winner", "nominee"]),
  isFeatured: z.boolean(),
  sourceUrl: z.string().nullable(),
  notes: z.string().nullable(),
  position: z.number().int(),
  organization: AwardOrganizationSchema.nullable(),
  awardCategory: AwardCategorySchema.nullable(),
  ceremony: AwardCeremonySchema.nullable(),
});
export type AwardRecognition = z.infer<typeof AwardRecognitionSchema>;

export const WorkDetailSchema = z.strictObject({
  id: z.string().uuid(),
  canonicalTitle: z.string(),
  titleAr: z.string().nullable(),
  summary: z.string(),
  releaseYear: z.number().int().nullable(),
  format: z.enum(["animated", "live-action"]),
  audience: z.enum(["general", "teen", "young-adult", "adult"]),
  age: z.string(),
  poster: ArtworkSchema.nullable(),
  installmentCount: z.number().int(),
  episodeCount: z.number().int(),
  contentWarnings: z.string().nullable(),
  analysisNotes: z.string().nullable(),
  sexualityRisk: z.enum(["none", "low", "medium", "high"]),
  behavioralRisk: z.enum(["none", "low", "medium", "high"]),
  theologyRisk: z.enum(["none", "low", "medium", "high"]),
  externalIds: ExternalIdsSchema,
  aliases: z.array(AliasSchema),
  trivia: z.array(z.string()),
  genres: z.array(VocabularySchema),
  contributions: z.array(ContributionSchema),
  relations: z.array(RelationSchema),
  artwork: z.array(ArtworkAssignmentSchema),
  installments: z.array(InstallmentSchema),
  curatorNotes: z.string(),
  qualityScore: z.number().int(),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  externalReferences: z.array(ExternalReferenceSchema),
  tones: z.array(VocabularySchema),
  tags: z.array(VocabularySchema),
  countries: z.array(VocabularySchema),
  planets: z.array(PlanetSchema),
  awards: z.array(AwardRecognitionSchema),
  sortTitle: z.string(),
  isPrivate: z.boolean(),
  score: ScoreSummarySchema,
  banner: ArtworkSchema.nullable(),
  logo: ArtworkSchema.nullable(),
});
export type WorkDetail = z.infer<typeof WorkDetailSchema>;

export const WorkPageSchema = z.strictObject({
  items: z.array(WorkSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type WorkPage = z.infer<typeof WorkPageSchema>;

export const CatalogPlanetSchema = z.strictObject({
  id: z.string().uuid(),
  slug: z.string(),
  nameAr: z.string(),
  nameEn: z.string().nullable(),
  icon: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  count: z.number().int(),
});
export type CatalogPlanet = z.infer<typeof CatalogPlanetSchema>;

export const CatalogFiltersSchema = z.strictObject({
  genres: z.array(VocabularySchema),
  formats: z.array(z.string()),
  audiences: z.array(z.string()),
  statuses: z.array(z.string()),
  yearMin: z.number().int().nullable(),
  yearMax: z.number().int().nullable(),
  planets: z.array(CatalogPlanetSchema),
});
export type CatalogFilters = z.infer<typeof CatalogFiltersSchema>;

export const FamilyActivitySchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.enum(["comment", "review"]),
  body: z.string(),
  containsSpoilers: z.boolean(),
  rating: z.number().int().nullable(),
  createdAt: z.string(),
  authorName: z.string(),
  avatarKey: z.string(),
  work: WorkSummarySchema,
});
export type FamilyActivity = z.infer<typeof FamilyActivitySchema>;

export const EpisodesPageSchema = z.strictObject({
  items: z.array(HomeViewingItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type EpisodesPage = z.infer<typeof EpisodesPageSchema>;

export const HomeFeedSchema = z.strictObject({
  featured: z.array(WorkSummarySchema).optional(),
  recentEpisodes: z.array(HomeViewingItemSchema).optional(),
  resume: z.array(HomeViewingItemSchema).optional(),
  comments: z.array(FamilyActivitySchema),
  upcoming: z.array(UpcomingInstallmentSchema),
});
export type HomeFeed = z.infer<typeof HomeFeedSchema>;

export const CatalogCriteriaSchema = z.strictObject({
  story: z.number().nullable(),
  characters: z.number().nullable(),
  depth: z.number().nullable(),
  worldBuilding: z.number().nullable(),
  originality: z.number().nullable(),
  craft: z.number().nullable(),
});
export type CatalogCriteria = z.infer<typeof CatalogCriteriaSchema>;

export const EntityContributionRoleSchema = z.strictObject({
  entityId: z.string().uuid(),
  value: z.string(),
  label: z.string(),
});
export type EntityContributionRole = z.infer<typeof EntityContributionRoleSchema>;

export const CatalogEntrySchema = z.strictObject({
  watchProgress: z
    .strictObject({
      releasedUnits: z.number().int().min(0),
      watchedReleasedUnits: z.number().int().min(0),
    })
    .optional(),
  work: WorkSummarySchema,
  installment: UpcomingInstallmentSchema.nullable(),
  classification: ClassificationSchema,
  status: z.string(),
  watchState: z.string(),
  criteria: CatalogCriteriaSchema,
  contributionRoles: z.array(EntityContributionRoleSchema).optional(),
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;

export const CatalogPageSchema = z.strictObject({
  groups: z
    .array(
      z.strictObject({
        key: z.string(),
        count: z.number().int(),
      }),
    )
    .optional(),
  items: z.array(CatalogEntrySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type CatalogPage = z.infer<typeof CatalogPageSchema>;

export const FacetOptionSchema = z.strictObject({
  artworkId: z.string().uuid().nullable().optional(),
  value: z.string(),
  label: z.string(),
  count: z.number().int(),
  roles: z
    .array(
      z.strictObject({
        value: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
});
export type FacetOption = z.infer<typeof FacetOptionSchema>;

export const FacetGroupSchema = z.strictObject({
  key: z.string(),
  label: z.string(),
  options: z.array(FacetOptionSchema),
});
export type FacetGroup = z.infer<typeof FacetGroupSchema>;

export const FacetCatalogSchema = z.strictObject({
  groups: z.array(FacetGroupSchema),
  yearMin: z.number().int().nullable(),
  yearMax: z.number().int().nullable(),
});
export type FacetCatalog = z.infer<typeof FacetCatalogSchema>;

export const FacetSelectionSchema = z.strictObject({
  key: z.string(),
  include: z.array(z.string()),
  exclude: z.array(z.string()),
});
export type FacetSelection = z.infer<typeof FacetSelectionSchema>;

export const BrowseFiltersSchema = z.strictObject({
  facets: z.array(FacetSelectionSchema),
  minimumRating: z.number(),
  minimumScores: z.strictObject({
    story: z.number(),
    characters: z.number(),
    depth: z.number(),
    worldBuilding: z.number(),
    originality: z.number(),
    craft: z.number(),
  }),
});
export type BrowseFilters = z.infer<typeof BrowseFiltersSchema>;

export const RecommendationPageSchema = z.strictObject({
  items: z.array(WorkSummarySchema),
  basis: z.enum(["related", "personal", "editorial"]),
});
export type RecommendationPage = z.infer<typeof RecommendationPageSchema>;

export const ProfileUpdateSchema = z.strictObject({
  name: z.string().min(1).max(80),
  bio: z.string().max(500),
  avatarKey: z.enum(["nahhasio-library.svg", "nahhasio-orbit.svg"]),
  updatedAt: z.string(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export const PasswordUpdateSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});
export type PasswordUpdate = z.infer<typeof PasswordUpdateSchema>;

export const AccountMessageSchema = z.strictObject({
  message: z.string(),
});
export type AccountMessage = z.infer<typeof AccountMessageSchema>;

export const AdminWorkSchema = z.strictObject({
  id: z.string().uuid(),
  canonicalTitle: z.string(),
  titleAr: z.string().nullable(),
  releaseYear: z.number().int().nullable(),
  format: z.enum(["animated", "live-action"]),
  workflow: z.enum(["draft", "in_review", "approved", "published", "archived"]),
  isPrivate: z.boolean(),
  updatedAt: z.string(),
  verifiedAt: z.string().nullable(),
  isSeries: z.boolean(),
  installmentCount: z.number().int().min(0),
  episodeCount: z.number().int().min(0),
  posterId: z.string().uuid().nullable(),
});
export type AdminWork = z.infer<typeof AdminWorkSchema>;

export const AdminWorksPageSchema = z.strictObject({
  items: z.array(AdminWorkSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1).max(100000),
  pageSize: z.number().int().min(1).max(100),
});
export type AdminWorksPage = z.infer<typeof AdminWorksPageSchema>;

export const WorkFieldsSchema = z.strictObject({
  canonicalTitle: z.string().min(1).max(1000),
  sortTitle: z.string().min(1).max(1000),
  titleAr: z.string().max(1000).nullable(),
  summary: z.string().max(100000),
  contentWarnings: z.string().max(100000).nullable(),
  analysisNotes: z.string().max(100000).nullable(),
  curatorNotes: z.string().max(100000),
  releaseYear: z.number().int().min(1).max(9999).nullable(),
  format: z.enum(["animated", "live-action"]),
  workflow: z.enum(["draft", "in_review", "approved", "published", "archived"]),
  audience: z.enum(["general", "teen", "young-adult", "adult"]),
  age: z.enum(["all", "7+", "10+", "13+", "16+", "18+"]),
  sexualityRisk: z.enum(["none", "low", "medium", "high"]),
  behavioralRisk: z.enum(["none", "low", "medium", "high"]),
  theologyRisk: z.enum(["none", "low", "medium", "high"]),
  isPrivate: z.boolean(),
});
export type WorkFields = z.infer<typeof WorkFieldsSchema>;

export const WorkDraftSchema = z.strictObject({
  id: z.string().uuid(),
  revision: z.string().min(64).max(64),
  fields: WorkFieldsSchema,
});
export type WorkDraft = z.infer<typeof WorkDraftSchema>;

export const WorkDocumentSchema = z.strictObject({
  id: z.string().uuid(),
  revision: z.string().min(64).max(64),
  fields: WorkFieldsSchema,
  posterId: z.string().uuid().nullable(),
  installmentCount: z.number().int().min(0),
  episodeCount: z.number().int().min(0),
});
export type WorkDocument = z.infer<typeof WorkDocumentSchema>;

export const WorkDocumentsSchema = z.strictObject({
  documents: z.array(WorkDocumentSchema),
});
export type WorkDocuments = z.infer<typeof WorkDocumentsSchema>;

export const WorkReadRequestSchema = z.strictObject({
  ids: z.array(z.string().uuid()),
});
export type WorkReadRequest = z.infer<typeof WorkReadRequestSchema>;

export const WorkReviewRequestSchema = z.strictObject({
  documents: z.array(WorkDraftSchema),
});
export type WorkReviewRequest = z.infer<typeof WorkReviewRequestSchema>;

export const WorkSaveRequestSchema = z.strictObject({
  documents: z.array(WorkDraftSchema),
  ticket: z.string().max(100),
});
export type WorkSaveRequest = z.infer<typeof WorkSaveRequestSchema>;

export const WorkChangeSchema = z.strictObject({
  field: z.enum([
    "canonicalTitle",
    "sortTitle",
    "titleAr",
    "summary",
    "contentWarnings",
    "analysisNotes",
    "curatorNotes",
    "releaseYear",
    "format",
    "workflow",
    "audience",
    "age",
    "sexualityRisk",
    "behavioralRisk",
    "theologyRisk",
    "isPrivate",
  ]),
  before: z.string(),
  after: z.string(),
});
export type WorkChange = z.infer<typeof WorkChangeSchema>;

export const ReviewedWorkSchema = z.strictObject({
  id: z.string().uuid(),
  revision: z.string().min(64).max(64),
  fields: WorkFieldsSchema,
  changes: z.array(WorkChangeSchema),
});
export type ReviewedWork = z.infer<typeof ReviewedWorkSchema>;

export const WorkReviewSchema = z.strictObject({
  documents: z.array(ReviewedWorkSchema),
  ticket: z.string().max(100),
  expiresAt: z.number().int().min(0),
});
export type WorkReview = z.infer<typeof WorkReviewSchema>;

export const WorkSavedSchema = z.strictObject({
  saved: z.number().int().min(0),
  documents: z.array(WorkDocumentSchema),
});
export type WorkSaved = z.infer<typeof WorkSavedSchema>;

export const CatalogSnapshotSchema = z.strictObject({
  document: z.strictObject({
    id: z.string().uuid().optional(),
    canonicalTitle: z.string().min(1),
    sortTitle: z.string().optional(),
    titleAr: z.union([z.string(), z.null()]).optional(),
    summary: z.string().optional(),
    contentWarnings: z.union([z.string(), z.null()]).optional(),
    analysisNotes: z.union([z.string(), z.null()]).optional(),
    curatorNotes: z.string().optional(),
    releaseYear: z.union([z.number().int().min(1800).max(2200), z.null()]).optional(),
    format: z.enum(["animated", "live-action"]).optional(),
    isPrivate: z.boolean().optional(),
    workflowStatus: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
    qualityScore: z.number().int().min(0).max(9007199254740991).optional(),
    audience: z.enum(["general", "teen", "young-adult", "adult"]).optional(),
    age: z.enum(["all", "7+", "10+", "13+", "16+", "18+"]).optional(),
    sexualityRisk: z.enum(["none", "low", "medium", "high"]).optional(),
    behavioralRisk: z.enum(["none", "low", "medium", "high"]).optional(),
    theologyRisk: z.enum(["none", "low", "medium", "high"]).optional(),
    tmdbId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
    imdbId: z.union([z.string(), z.null()]).optional(),
    anilistId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
    malId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
    aliases: z.array(z.string().min(1)).optional(),
    trivia: z.array(z.string().min(1)).optional(),
    genres: z.array(z.string().min(1)).optional(),
    tones: z.array(z.string().min(1)).optional(),
    tags: z.array(z.string().min(1)).optional(),
    countries: z.array(z.string().min(1)).optional(),
    planets: z.array(z.string().min(1)).optional(),
    credits: z
      .array(
        z.strictObject({
          entity: z.string().min(1),
          role: z.string().min(1),
          isPrimary: z.boolean().optional(),
          position: z.number().int().min(0).max(9007199254740991).optional(),
        }),
      )
      .optional(),
    externalIds: z
      .array(
        z.strictObject({
          provider: z.string().min(1),
          externalId: z.string().min(1),
          url: z.union([z.string(), z.null()]).optional(),
        }),
      )
      .optional(),
    relations: z
      .array(
        z.strictObject({
          target: z.string().min(1),
          kind: z.enum([
            "sequel",
            "adaptation",
            "spin-off",
            "side-story",
            "compilation",
            "alternative",
            "related",
          ]),
          notes: z.string().optional(),
        }),
      )
      .optional(),
    media: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
    installments: z
      .array(
        z.strictObject({
          id: z.string().uuid().optional(),
          kind: z.enum(["season", "movie", "special"]).optional(),
          position: z.number().int().min(0).max(9007199254740991).optional(),
          title: z.string().min(1),
          summary: z.string().optional(),
          status: z.enum(["announced", "airing", "completed", "unknown"]).optional(),
          releaseDate: z.union([z.string(), z.null()]).optional(),
          runtimeMinutes: z
            .union([z.number().int().min(0).max(9007199254740991), z.null()])
            .optional(),
          audienceOverride: z.union([z.string(), z.null()]).optional(),
          ageOverride: z.union([z.string(), z.null()]).optional(),
          sexualityRiskOverride: z.union([z.string(), z.null()]).optional(),
          behavioralRiskOverride: z.union([z.string(), z.null()]).optional(),
          theologyRiskOverride: z.union([z.string(), z.null()]).optional(),
          tmdbId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
          imdbId: z.union([z.string(), z.null()]).optional(),
          anilistId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
          malId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
          score: z
            .strictObject({
              story: z.union([z.number().min(0).max(10), z.null()]).optional(),
              characters: z.union([z.number().min(0).max(10), z.null()]).optional(),
              depth: z.union([z.number().min(0).max(10), z.null()]).optional(),
              worldBuilding: z.union([z.number().min(0).max(10), z.null()]).optional(),
              originality: z.union([z.number().min(0).max(10), z.null()]).optional(),
              craft: z.union([z.number().min(0).max(10), z.null()]).optional(),
            })
            .optional(),
          media: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
          episodes: z
            .array(
              z.strictObject({
                id: z.string().uuid().optional(),
                number: z.number(),
                position: z.number().int().min(0).max(9007199254740991).optional(),
                title: z.union([z.string(), z.null()]).optional(),
                summary: z.string().optional(),
                releaseDate: z.union([z.string(), z.null()]).optional(),
                runtimeMinutes: z
                  .union([z.number().int().min(0).max(9007199254740991), z.null()])
                  .optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
    awards: z
      .array(
        z.strictObject({
          id: z.string().uuid().optional(),
          ceremonyId: z.union([z.string().uuid(), z.null()]).optional(),
          position: z.number().int().min(0).max(9007199254740991).optional(),
          organization: z.string().min(1),
          category: z.string().min(1),
          year: z.union([z.number().int().min(1900).max(2100), z.null()]).optional(),
          result: z.enum(["winner", "nominee"]),
          installment: z
            .union([
              z.union([z.number().int().min(-9007199254740991).max(9007199254740991), z.string()]),
              z.null(),
            ])
            .optional(),
          isFeatured: z.boolean().optional(),
          sourceUrl: z.union([z.string(), z.null()]).optional(),
          notes: z.union([z.string(), z.null()]).optional(),
        }),
      )
      .optional(),
  }),
  revision: z.string(),
});
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;

export const CatalogReadInputSchema = z.strictObject({
  ids: z.array(z.string().uuid()),
});
export type CatalogReadInput = z.infer<typeof CatalogReadInputSchema>;

export const CatalogReadCallSchema = z.strictObject({
  operation: z.enum(["read"]),
  data: CatalogReadInputSchema,
});
export type CatalogReadCall = z.infer<typeof CatalogReadCallSchema>;

export const CatalogReviewInputSchema = z.strictObject({
  json: z.string().max(4000000),
  originals: z.array(
    z.strictObject({
      id: z.string().uuid(),
      revision: z.string().min(64).max(64),
    }),
  ),
});
export type CatalogReviewInput = z.infer<typeof CatalogReviewInputSchema>;

export const CatalogReviewCallSchema = z.strictObject({
  operation: z.enum(["review"]),
  data: CatalogReviewInputSchema,
});
export type CatalogReviewCall = z.infer<typeof CatalogReviewCallSchema>;

export const CatalogSaveInputSchema = z.strictObject({
  ticket: z.string().max(8000000),
});
export type CatalogSaveInput = z.infer<typeof CatalogSaveInputSchema>;

export const CatalogSaveCallSchema = z.strictObject({
  operation: z.enum(["save"]),
  data: CatalogSaveInputSchema,
});
export type CatalogSaveCall = z.infer<typeof CatalogSaveCallSchema>;

export const CatalogCreateInputSchema = z.strictObject({
  json: z.string().max(4000000),
});
export type CatalogCreateInput = z.infer<typeof CatalogCreateInputSchema>;

export const CatalogCreateCallSchema = z.strictObject({
  operation: z.enum(["create"]),
  data: CatalogCreateInputSchema,
});
export type CatalogCreateCall = z.infer<typeof CatalogCreateCallSchema>;

export const CatalogParseInputSchema = z.strictObject({
  json: z.string().max(4000000),
});
export type CatalogParseInput = z.infer<typeof CatalogParseInputSchema>;

export const CatalogParseCallSchema = z.strictObject({
  operation: z.enum(["parse"]),
  data: CatalogParseInputSchema,
});
export type CatalogParseCall = z.infer<typeof CatalogParseCallSchema>;

export const CatalogLinksInputSchema = z.strictObject({
  workId: z.string().uuid(),
  episodeId: z.string().uuid(),
});
export type CatalogLinksInput = z.infer<typeof CatalogLinksInputSchema>;

export const CatalogLinksCallSchema = z.strictObject({
  operation: z.enum(["links"]),
  data: CatalogLinksInputSchema,
});
export type CatalogLinksCall = z.infer<typeof CatalogLinksCallSchema>;

export const CatalogRefsInputSchema = z.strictObject({
  table: z.enum([
    "genres",
    "tones",
    "tags",
    "countries",
    "planets",
    "entities",
    "roles",
    "titles",
    "award_organizations",
    "award_categories",
    "award_ceremonies",
    "media_assets",
  ]),
  search: z.string().max(300),
  offset: z.number().int().min(0).max(1000000).optional(),
  filters: z.record(z.string(), z.json()).optional(),
});
export type CatalogRefsInput = z.infer<typeof CatalogRefsInputSchema>;

export const CatalogRefsCallSchema = z.strictObject({
  operation: z.enum(["refs"]),
  data: CatalogRefsInputSchema,
});
export type CatalogRefsCall = z.infer<typeof CatalogRefsCallSchema>;

export const CatalogSchemaInputSchema = z.strictObject({});
export type CatalogSchemaInput = z.infer<typeof CatalogSchemaInputSchema>;

export const CatalogSchemaCallSchema = z.strictObject({
  operation: z.enum(["schema"]),
  data: CatalogSchemaInputSchema,
});
export type CatalogSchemaCall = z.infer<typeof CatalogSchemaCallSchema>;

export const CatalogVocabularyInputSchema = z.strictObject({
  tables: z.array(z.enum(["genres", "tones", "tags", "countries", "planets", "roles"])),
});
export type CatalogVocabularyInput = z.infer<typeof CatalogVocabularyInputSchema>;

export const CatalogVocabularyCallSchema = z.strictObject({
  operation: z.enum(["vocabulary"]),
  data: CatalogVocabularyInputSchema,
});
export type CatalogVocabularyCall = z.infer<typeof CatalogVocabularyCallSchema>;

export const CatalogMediaInputSchema = z.strictObject({
  path: z.string().max(1000),
});
export type CatalogMediaInput = z.infer<typeof CatalogMediaInputSchema>;

export const CatalogMediaCallSchema = z.strictObject({
  operation: z.enum(["media"]),
  data: CatalogMediaInputSchema,
});
export type CatalogMediaCall = z.infer<typeof CatalogMediaCallSchema>;

export const CatalogSearchInputSchema = z.strictObject({
  title: z.string().min(1).max(200),
  seriesTitle: z.string().min(1).max(200).optional(),
  year: z.number().int().min(1850).max(2100).optional(),
  kind: z
    .enum(["animated-movie", "animated-series", "live-action-movie", "live-action-series"])
    .optional(),
  role: z.enum(["poster", "banner", "logo"]),
  tmdbId: z.number().int().max(9007199254740991).optional(),
  anilistId: z.number().int().max(9007199254740991).optional(),
  season: z.number().int().min(0).max(9007199254740991).optional(),
});
export type CatalogSearchInput = z.infer<typeof CatalogSearchInputSchema>;

export const CatalogSearchCallSchema = z.strictObject({
  operation: z.enum(["search"]),
  data: CatalogSearchInputSchema,
});
export type CatalogSearchCall = z.infer<typeof CatalogSearchCallSchema>;

export const CatalogSeasonInputSchema = z.strictObject({
  tmdbId: z.number().int().max(9007199254740991),
  season: z.number().int().min(0).max(9007199254740991),
});
export type CatalogSeasonInput = z.infer<typeof CatalogSeasonInputSchema>;

export const CatalogSeasonCallSchema = z.strictObject({
  operation: z.enum(["season"]),
  data: CatalogSeasonInputSchema,
});
export type CatalogSeasonCall = z.infer<typeof CatalogSeasonCallSchema>;

export const CatalogIngestInputSchema = z.strictObject({
  url: z.string(),
  role: z.enum(["poster", "banner", "logo"]),
  ownerName: z.string().min(1).max(200),
});
export type CatalogIngestInput = z.infer<typeof CatalogIngestInputSchema>;

export const CatalogIngestCallSchema = z.strictObject({
  operation: z.enum(["ingest"]),
  data: CatalogIngestInputSchema,
});
export type CatalogIngestCall = z.infer<typeof CatalogIngestCallSchema>;

export const CatalogUploadInputSchema = z.strictObject({
  dataUrl: z.string().max(14000000),
  fileName: z.string().min(1).max(250),
  role: z.enum(["poster", "banner", "logo", "profile"]),
  ownerName: z.string().min(1).max(200),
});
export type CatalogUploadInput = z.infer<typeof CatalogUploadInputSchema>;

export const CatalogUploadCallSchema = z.strictObject({
  operation: z.enum(["upload"]),
  data: CatalogUploadInputSchema,
});
export type CatalogUploadCall = z.infer<typeof CatalogUploadCallSchema>;

export const CatalogPreviewInputSchema = z.strictObject({
  url: z.string(),
});
export type CatalogPreviewInput = z.infer<typeof CatalogPreviewInputSchema>;

export const CatalogPreviewCallSchema = z.strictObject({
  operation: z.enum(["preview"]),
  data: CatalogPreviewInputSchema,
});
export type CatalogPreviewCall = z.infer<typeof CatalogPreviewCallSchema>;

export const CatalogReadResultSchema = z.array(
  z.strictObject({
    document: z.strictObject({
      id: z.string().uuid().optional(),
      canonicalTitle: z.string().min(1),
      sortTitle: z.string().optional(),
      titleAr: z.union([z.string(), z.null()]).optional(),
      summary: z.string().optional(),
      contentWarnings: z.union([z.string(), z.null()]).optional(),
      analysisNotes: z.union([z.string(), z.null()]).optional(),
      curatorNotes: z.string().optional(),
      releaseYear: z.union([z.number().int().min(1800).max(2200), z.null()]).optional(),
      format: z.enum(["animated", "live-action"]).optional(),
      isPrivate: z.boolean().optional(),
      workflowStatus: z
        .enum(["draft", "in_review", "approved", "published", "archived"])
        .optional(),
      qualityScore: z.number().int().min(0).max(9007199254740991).optional(),
      audience: z.enum(["general", "teen", "young-adult", "adult"]).optional(),
      age: z.enum(["all", "7+", "10+", "13+", "16+", "18+"]).optional(),
      sexualityRisk: z.enum(["none", "low", "medium", "high"]).optional(),
      behavioralRisk: z.enum(["none", "low", "medium", "high"]).optional(),
      theologyRisk: z.enum(["none", "low", "medium", "high"]).optional(),
      tmdbId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
      imdbId: z.union([z.string(), z.null()]).optional(),
      anilistId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
      malId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
      aliases: z.array(z.string().min(1)).optional(),
      trivia: z.array(z.string().min(1)).optional(),
      genres: z.array(z.string().min(1)).optional(),
      tones: z.array(z.string().min(1)).optional(),
      tags: z.array(z.string().min(1)).optional(),
      countries: z.array(z.string().min(1)).optional(),
      planets: z.array(z.string().min(1)).optional(),
      credits: z
        .array(
          z.strictObject({
            entity: z.string().min(1),
            role: z.string().min(1),
            isPrimary: z.boolean().optional(),
            position: z.number().int().min(0).max(9007199254740991).optional(),
          }),
        )
        .optional(),
      externalIds: z
        .array(
          z.strictObject({
            provider: z.string().min(1),
            externalId: z.string().min(1),
            url: z.union([z.string(), z.null()]).optional(),
          }),
        )
        .optional(),
      relations: z
        .array(
          z.strictObject({
            target: z.string().min(1),
            kind: z.enum([
              "sequel",
              "adaptation",
              "spin-off",
              "side-story",
              "compilation",
              "alternative",
              "related",
            ]),
            notes: z.string().optional(),
          }),
        )
        .optional(),
      media: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
      installments: z
        .array(
          z.strictObject({
            id: z.string().uuid().optional(),
            kind: z.enum(["season", "movie", "special"]).optional(),
            position: z.number().int().min(0).max(9007199254740991).optional(),
            title: z.string().min(1),
            summary: z.string().optional(),
            status: z.enum(["announced", "airing", "completed", "unknown"]).optional(),
            releaseDate: z.union([z.string(), z.null()]).optional(),
            runtimeMinutes: z
              .union([z.number().int().min(0).max(9007199254740991), z.null()])
              .optional(),
            audienceOverride: z.union([z.string(), z.null()]).optional(),
            ageOverride: z.union([z.string(), z.null()]).optional(),
            sexualityRiskOverride: z.union([z.string(), z.null()]).optional(),
            behavioralRiskOverride: z.union([z.string(), z.null()]).optional(),
            theologyRiskOverride: z.union([z.string(), z.null()]).optional(),
            tmdbId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
            imdbId: z.union([z.string(), z.null()]).optional(),
            anilistId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
            malId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
            score: z
              .strictObject({
                story: z.union([z.number().min(0).max(10), z.null()]).optional(),
                characters: z.union([z.number().min(0).max(10), z.null()]).optional(),
                depth: z.union([z.number().min(0).max(10), z.null()]).optional(),
                worldBuilding: z.union([z.number().min(0).max(10), z.null()]).optional(),
                originality: z.union([z.number().min(0).max(10), z.null()]).optional(),
                craft: z.union([z.number().min(0).max(10), z.null()]).optional(),
              })
              .optional(),
            media: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
            episodes: z
              .array(
                z.strictObject({
                  id: z.string().uuid().optional(),
                  number: z.number(),
                  position: z.number().int().min(0).max(9007199254740991).optional(),
                  title: z.union([z.string(), z.null()]).optional(),
                  summary: z.string().optional(),
                  releaseDate: z.union([z.string(), z.null()]).optional(),
                  runtimeMinutes: z
                    .union([z.number().int().min(0).max(9007199254740991), z.null()])
                    .optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
      awards: z
        .array(
          z.strictObject({
            id: z.string().uuid().optional(),
            ceremonyId: z.union([z.string().uuid(), z.null()]).optional(),
            position: z.number().int().min(0).max(9007199254740991).optional(),
            organization: z.string().min(1),
            category: z.string().min(1),
            year: z.union([z.number().int().min(1900).max(2100), z.null()]).optional(),
            result: z.enum(["winner", "nominee"]),
            installment: z
              .union([
                z.union([
                  z.number().int().min(-9007199254740991).max(9007199254740991),
                  z.string(),
                ]),
                z.null(),
              ])
              .optional(),
            isFeatured: z.boolean().optional(),
            sourceUrl: z.union([z.string(), z.null()]).optional(),
            notes: z.union([z.string(), z.null()]).optional(),
          }),
        )
        .optional(),
    }),
    revision: z.string(),
  }),
);
export type CatalogReadResult = z.infer<typeof CatalogReadResultSchema>;

export const CatalogReviewResultSchema = z.strictObject({
  ticket: z.string(),
  expiresAt: z.number(),
  records: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      changes: z.array(
        z.strictObject({
          path: z.string(),
          before: z.union([z.json(), z.null()]),
          after: z.union([z.json(), z.null()]),
        }),
      ),
    }),
  ),
});
export type CatalogReviewResult = z.infer<typeof CatalogReviewResultSchema>;

export const CatalogSaveResultSchema = z.strictObject({
  saved: z.number(),
  createdId: z.union([z.string(), z.null()]),
});
export type CatalogSaveResult = z.infer<typeof CatalogSaveResultSchema>;

export const CatalogCreateResultSchema = z.strictObject({
  ticket: z.string(),
  expiresAt: z.number(),
  records: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      changes: z.array(
        z.strictObject({
          path: z.string(),
          before: z.union([z.json(), z.null()]),
          after: z.union([z.json(), z.null()]),
        }),
      ),
    }),
  ),
});
export type CatalogCreateResult = z.infer<typeof CatalogCreateResultSchema>;

export const CatalogParseResultSchema = z.strictObject({
  id: z.string().uuid().optional(),
  canonicalTitle: z.string().min(1),
  sortTitle: z.string().optional(),
  titleAr: z.union([z.string(), z.null()]).optional(),
  summary: z.string().optional(),
  contentWarnings: z.union([z.string(), z.null()]).optional(),
  analysisNotes: z.union([z.string(), z.null()]).optional(),
  curatorNotes: z.string().optional(),
  releaseYear: z.union([z.number().int().min(1800).max(2200), z.null()]).optional(),
  format: z.enum(["animated", "live-action"]).optional(),
  isPrivate: z.boolean().optional(),
  workflowStatus: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  qualityScore: z.number().int().min(0).max(9007199254740991).optional(),
  audience: z.enum(["general", "teen", "young-adult", "adult"]).optional(),
  age: z.enum(["all", "7+", "10+", "13+", "16+", "18+"]).optional(),
  sexualityRisk: z.enum(["none", "low", "medium", "high"]).optional(),
  behavioralRisk: z.enum(["none", "low", "medium", "high"]).optional(),
  theologyRisk: z.enum(["none", "low", "medium", "high"]).optional(),
  tmdbId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
  imdbId: z.union([z.string(), z.null()]).optional(),
  anilistId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
  malId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  trivia: z.array(z.string().min(1)).optional(),
  genres: z.array(z.string().min(1)).optional(),
  tones: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
  countries: z.array(z.string().min(1)).optional(),
  planets: z.array(z.string().min(1)).optional(),
  credits: z
    .array(
      z.strictObject({
        entity: z.string().min(1),
        role: z.string().min(1),
        isPrimary: z.boolean().optional(),
        position: z.number().int().min(0).max(9007199254740991).optional(),
      }),
    )
    .optional(),
  externalIds: z
    .array(
      z.strictObject({
        provider: z.string().min(1),
        externalId: z.string().min(1),
        url: z.union([z.string(), z.null()]).optional(),
      }),
    )
    .optional(),
  relations: z
    .array(
      z.strictObject({
        target: z.string().min(1),
        kind: z.enum([
          "sequel",
          "adaptation",
          "spin-off",
          "side-story",
          "compilation",
          "alternative",
          "related",
        ]),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  media: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
  installments: z
    .array(
      z.strictObject({
        id: z.string().uuid().optional(),
        kind: z.enum(["season", "movie", "special"]).optional(),
        position: z.number().int().min(0).max(9007199254740991).optional(),
        title: z.string().min(1),
        summary: z.string().optional(),
        status: z.enum(["announced", "airing", "completed", "unknown"]).optional(),
        releaseDate: z.union([z.string(), z.null()]).optional(),
        runtimeMinutes: z
          .union([z.number().int().min(0).max(9007199254740991), z.null()])
          .optional(),
        audienceOverride: z.union([z.string(), z.null()]).optional(),
        ageOverride: z.union([z.string(), z.null()]).optional(),
        sexualityRiskOverride: z.union([z.string(), z.null()]).optional(),
        behavioralRiskOverride: z.union([z.string(), z.null()]).optional(),
        theologyRiskOverride: z.union([z.string(), z.null()]).optional(),
        tmdbId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
        imdbId: z.union([z.string(), z.null()]).optional(),
        anilistId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
        malId: z.union([z.number().int().max(9007199254740991), z.null()]).optional(),
        score: z
          .strictObject({
            story: z.union([z.number().min(0).max(10), z.null()]).optional(),
            characters: z.union([z.number().min(0).max(10), z.null()]).optional(),
            depth: z.union([z.number().min(0).max(10), z.null()]).optional(),
            worldBuilding: z.union([z.number().min(0).max(10), z.null()]).optional(),
            originality: z.union([z.number().min(0).max(10), z.null()]).optional(),
            craft: z.union([z.number().min(0).max(10), z.null()]).optional(),
          })
          .optional(),
        media: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
        episodes: z
          .array(
            z.strictObject({
              id: z.string().uuid().optional(),
              number: z.number(),
              position: z.number().int().min(0).max(9007199254740991).optional(),
              title: z.union([z.string(), z.null()]).optional(),
              summary: z.string().optional(),
              releaseDate: z.union([z.string(), z.null()]).optional(),
              runtimeMinutes: z
                .union([z.number().int().min(0).max(9007199254740991), z.null()])
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  awards: z
    .array(
      z.strictObject({
        id: z.string().uuid().optional(),
        ceremonyId: z.union([z.string().uuid(), z.null()]).optional(),
        position: z.number().int().min(0).max(9007199254740991).optional(),
        organization: z.string().min(1),
        category: z.string().min(1),
        year: z.union([z.number().int().min(1900).max(2100), z.null()]).optional(),
        result: z.enum(["winner", "nominee"]),
        installment: z
          .union([
            z.union([z.number().int().min(-9007199254740991).max(9007199254740991), z.string()]),
            z.null(),
          ])
          .optional(),
        isFeatured: z.boolean().optional(),
        sourceUrl: z.union([z.string(), z.null()]).optional(),
        notes: z.union([z.string(), z.null()]).optional(),
      }),
    )
    .optional(),
});
export type CatalogParseResult = z.infer<typeof CatalogParseResultSchema>;

export const CatalogLinksResultSchema = z.array(
  z.strictObject({
    table: z.string(),
    count: z.number(),
  }),
);
export type CatalogLinksResult = z.infer<typeof CatalogLinksResultSchema>;

export const CatalogRefsResultSchema = z.strictObject({
  rows: z.array(z.record(z.string(), z.json())),
  offset: z.number(),
  total: z.number(),
});
export type CatalogRefsResult = z.infer<typeof CatalogRefsResultSchema>;

export const CatalogSchemaResultSchema = z.array(
  z.strictObject({
    name: z.string(),
    writable: z.boolean(),
    columns: z.array(
      z.strictObject({
        name: z.string(),
        data_type: z.string(),
        nullable: z.boolean(),
        primary: z.boolean(),
        generated: z.boolean(),
        default_value: z.union([z.string(), z.null()]),
        enum_values: z.array(z.string()),
      }),
    ),
  }),
);
export type CatalogSchemaResult = z.infer<typeof CatalogSchemaResultSchema>;

export const CatalogVocabularyResultSchema = z.array(
  z.strictObject({
    table: z.string(),
    options: z.array(
      z.strictObject({
        value: z.string(),
        label: z.string(),
      }),
    ),
  }),
);
export type CatalogVocabularyResult = z.infer<typeof CatalogVocabularyResultSchema>;

export const CatalogMediaResultSchema = z.strictObject({
  id: z.string().uuid(),
});
export type CatalogMediaResult = z.infer<typeof CatalogMediaResultSchema>;

export const CatalogSearchResultSchema = z.strictObject({
  candidates: z.array(
    z.strictObject({
      provider: z.enum(["tmdb", "anilist", "fanart"]),
      externalId: z.string().min(1),
      role: z.enum(["poster", "banner", "logo"]),
      previewUrl: z.string(),
      downloadUrl: z.string(),
      width: z.union([z.number().int().max(9007199254740991), z.null()]),
      height: z.union([z.number().int().max(9007199254740991), z.null()]),
      language: z.union([z.string(), z.null()]),
      matchLabel: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
});
export type CatalogSearchResult = z.infer<typeof CatalogSearchResultSchema>;

export const CatalogSeasonResultSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.json()),
  z.record(z.string(), z.json()),
]);
export type CatalogSeasonResult = z.infer<typeof CatalogSeasonResultSchema>;

export const CatalogIngestResultSchema = z.strictObject({
  id: z.string().uuid(),
  path: z.string(),
});
export type CatalogIngestResult = z.infer<typeof CatalogIngestResultSchema>;

export const CatalogUploadResultSchema = z.strictObject({
  id: z.string().uuid(),
  path: z.string(),
});
export type CatalogUploadResult = z.infer<typeof CatalogUploadResultSchema>;

export const CatalogPreviewResultSchema = z.strictObject({
  dataUrl: z.string(),
});
export type CatalogPreviewResult = z.infer<typeof CatalogPreviewResultSchema>;

export const CatalogPlanetDetailInputSchema = z.strictObject({
  id: z.string().uuid(),
});
export type CatalogPlanetDetailInput = z.infer<typeof CatalogPlanetDetailInputSchema>;

export const CatalogPlanetDetailCallSchema = z.strictObject({
  operation: z.enum(["planetDetail"]),
  data: CatalogPlanetDetailInputSchema,
});
export type CatalogPlanetDetailCall = z.infer<typeof CatalogPlanetDetailCallSchema>;

export const CatalogPlanetSaveInputSchema = z.strictObject({
  id: z.union([z.string().uuid(), z.null()]),
  revision: z.union([z.string().min(64).max(64), z.null()]),
  draft: z.strictObject({
    slug: z.string(),
    name: z.string().min(1).max(300),
    englishName: z.union([z.string().max(300), z.null()]),
    icon: z.string().min(1).max(64),
    description: z.string().max(20000),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    displayOrder: z.number().int().min(0).max(1000000),
    active: z.boolean(),
  }),
});
export type CatalogPlanetSaveInput = z.infer<typeof CatalogPlanetSaveInputSchema>;

export const CatalogPlanetSaveCallSchema = z.strictObject({
  operation: z.enum(["planetSave"]),
  data: CatalogPlanetSaveInputSchema,
});
export type CatalogPlanetSaveCall = z.infer<typeof CatalogPlanetSaveCallSchema>;

export const CatalogPlanetDeleteInputSchema = z.strictObject({
  id: z.string().uuid(),
  revision: z.string().min(64).max(64),
  confirmation: z.string().max(80),
});
export type CatalogPlanetDeleteInput = z.infer<typeof CatalogPlanetDeleteInputSchema>;

export const CatalogPlanetDeleteCallSchema = z.strictObject({
  operation: z.enum(["planetDelete"]),
  data: CatalogPlanetDeleteInputSchema,
});
export type CatalogPlanetDeleteCall = z.infer<typeof CatalogPlanetDeleteCallSchema>;

export const CatalogPlanetOptionsInputSchema = z.strictObject({});
export type CatalogPlanetOptionsInput = z.infer<typeof CatalogPlanetOptionsInputSchema>;

export const CatalogPlanetOptionsCallSchema = z.strictObject({
  operation: z.enum(["planetOptions"]),
  data: CatalogPlanetOptionsInputSchema,
});
export type CatalogPlanetOptionsCall = z.infer<typeof CatalogPlanetOptionsCallSchema>;

export const CatalogPlanetWorksInputSchema = z.strictObject({
  source: z.union([z.string().uuid(), z.null()]),
  q: z.string().max(300).optional(),
  page: z.number().int().min(1).max(100000).optional(),
});
export type CatalogPlanetWorksInput = z.infer<typeof CatalogPlanetWorksInputSchema>;

export const CatalogPlanetWorksCallSchema = z.strictObject({
  operation: z.enum(["planetWorks"]),
  data: CatalogPlanetWorksInputSchema,
});
export type CatalogPlanetWorksCall = z.infer<typeof CatalogPlanetWorksCallSchema>;

export const CatalogPlanetMoveInputSchema = z.strictObject({
  source: z.union([z.string().uuid(), z.null()]),
  destination: z.union([z.string().uuid(), z.null()]),
  records: z.array(
    z.strictObject({
      id: z.string().uuid(),
      revision: z.string().min(64).max(64),
    }),
  ),
});
export type CatalogPlanetMoveInput = z.infer<typeof CatalogPlanetMoveInputSchema>;

export const CatalogPlanetMoveCallSchema = z.strictObject({
  operation: z.enum(["planetMove"]),
  data: CatalogPlanetMoveInputSchema,
});
export type CatalogPlanetMoveCall = z.infer<typeof CatalogPlanetMoveCallSchema>;

export const CatalogEntityOptionsInputSchema = z.strictObject({
  kind: z.enum(["person", "organization"]),
});
export type CatalogEntityOptionsInput = z.infer<typeof CatalogEntityOptionsInputSchema>;

export const CatalogEntityOptionsCallSchema = z.strictObject({
  operation: z.enum(["entityOptions"]),
  data: CatalogEntityOptionsInputSchema,
});
export type CatalogEntityOptionsCall = z.infer<typeof CatalogEntityOptionsCallSchema>;

export const CatalogEntityRoleCreateInputSchema = z.strictObject({
  kind: z.enum(["person", "organization"]),
  slug: z.string(),
  name: z.string().min(1).max(300),
  label: z.string().max(300),
});
export type CatalogEntityRoleCreateInput = z.infer<typeof CatalogEntityRoleCreateInputSchema>;

export const CatalogEntityRoleCreateCallSchema = z.strictObject({
  operation: z.enum(["entityRoleCreate"]),
  data: CatalogEntityRoleCreateInputSchema,
});
export type CatalogEntityRoleCreateCall = z.infer<typeof CatalogEntityRoleCreateCallSchema>;

export const CatalogEntityDeletePreviewInputSchema = z.strictObject({
  kind: z.enum(["person", "organization"]),
  ids: z.array(z.string().uuid()),
});
export type CatalogEntityDeletePreviewInput = z.infer<typeof CatalogEntityDeletePreviewInputSchema>;

export const CatalogEntityDeletePreviewCallSchema = z.strictObject({
  operation: z.enum(["entityDeletePreview"]),
  data: CatalogEntityDeletePreviewInputSchema,
});
export type CatalogEntityDeletePreviewCall = z.infer<typeof CatalogEntityDeletePreviewCallSchema>;

export const CatalogEntityBulkDeleteInputSchema = z.strictObject({
  kind: z.enum(["person", "organization"]),
  records: z.array(
    z.strictObject({
      id: z.string().uuid(),
      revision: z.string().min(64).max(64),
    }),
  ),
  removeCredits: z.boolean(),
});
export type CatalogEntityBulkDeleteInput = z.infer<typeof CatalogEntityBulkDeleteInputSchema>;

export const CatalogEntityBulkDeleteCallSchema = z.strictObject({
  operation: z.enum(["entityBulkDelete"]),
  data: CatalogEntityBulkDeleteInputSchema,
});
export type CatalogEntityBulkDeleteCall = z.infer<typeof CatalogEntityBulkDeleteCallSchema>;

export const CatalogEntityJsonReadInputSchema = z.strictObject({
  kind: z.enum(["person", "organization"]),
  ids: z.array(z.string().uuid()),
});
export type CatalogEntityJsonReadInput = z.infer<typeof CatalogEntityJsonReadInputSchema>;

export const CatalogEntityJsonReadCallSchema = z.strictObject({
  operation: z.enum(["entityJsonRead"]),
  data: CatalogEntityJsonReadInputSchema,
});
export type CatalogEntityJsonReadCall = z.infer<typeof CatalogEntityJsonReadCallSchema>;

export const CatalogEntityJsonReviewInputSchema = z.strictObject({
  json: z.string().max(4000000),
  originals: z.array(
    z.strictObject({
      id: z.string().uuid(),
      revision: z.string().min(64).max(64),
    }),
  ),
});
export type CatalogEntityJsonReviewInput = z.infer<typeof CatalogEntityJsonReviewInputSchema>;

export const CatalogEntityJsonReviewCallSchema = z.strictObject({
  operation: z.enum(["entityJsonReview"]),
  data: CatalogEntityJsonReviewInputSchema,
});
export type CatalogEntityJsonReviewCall = z.infer<typeof CatalogEntityJsonReviewCallSchema>;

export const CatalogEntityJsonSaveInputSchema = z.strictObject({
  ticket: z.string().max(8000000),
});
export type CatalogEntityJsonSaveInput = z.infer<typeof CatalogEntityJsonSaveInputSchema>;

export const CatalogEntityJsonSaveCallSchema = z.strictObject({
  operation: z.enum(["entityJsonSave"]),
  data: CatalogEntityJsonSaveInputSchema,
});
export type CatalogEntityJsonSaveCall = z.infer<typeof CatalogEntityJsonSaveCallSchema>;

export const CatalogEntityListInputSchema = z.strictObject({
  kind: z.enum(["person", "organization"]),
  q: z.string().max(300).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  image: z.enum(["all", "with", "without"]).optional(),
  usage: z.enum(["all", "linked", "unlinked", "one"]).optional(),
  sort: z.enum(["name", "works", "updated"]).optional(),
});
export type CatalogEntityListInput = z.infer<typeof CatalogEntityListInputSchema>;

export const CatalogEntityListCallSchema = z.strictObject({
  operation: z.enum(["entityList"]),
  data: CatalogEntityListInputSchema,
});
export type CatalogEntityListCall = z.infer<typeof CatalogEntityListCallSchema>;

export const CatalogEntityDetailInputSchema = z.strictObject({
  id: z.string().uuid(),
  kind: z.enum(["person", "organization"]),
});
export type CatalogEntityDetailInput = z.infer<typeof CatalogEntityDetailInputSchema>;

export const CatalogEntityDetailCallSchema = z.strictObject({
  operation: z.enum(["entityDetail"]),
  data: CatalogEntityDetailInputSchema,
});
export type CatalogEntityDetailCall = z.infer<typeof CatalogEntityDetailCallSchema>;

export const CatalogEntitySaveInputSchema = z.strictObject({
  id: z.union([z.string().uuid(), z.null()]),
  kind: z.enum(["person", "organization"]),
  revision: z.union([z.string().min(64).max(64), z.null()]),
  draft: z.strictObject({
    name: z.string().min(1).max(300),
    sortName: z.string().min(1).max(300),
    description: z.string().max(20000),
    aliases: z.array(
      z.strictObject({
        id: z.union([z.string().uuid(), z.null()]),
        alias: z.string().min(1).max(300),
        language: z.union([z.string().max(30), z.null()]),
      }),
    ),
    profileAssetId: z.union([z.string().uuid(), z.null()]),
    credits: z.array(
      z.strictObject({
        workId: z.string().uuid(),
        workTitle: z.string(),
        roleId: z.string().uuid(),
        roleName: z.string(),
        roleLabel: z.string(),
        position: z.number().int().min(0).max(1000000),
        isPrimary: z.boolean(),
      }),
    ),
  }),
});
export type CatalogEntitySaveInput = z.infer<typeof CatalogEntitySaveInputSchema>;

export const CatalogEntitySaveCallSchema = z.strictObject({
  operation: z.enum(["entitySave"]),
  data: CatalogEntitySaveInputSchema,
});
export type CatalogEntitySaveCall = z.infer<typeof CatalogEntitySaveCallSchema>;

export const CatalogAssetRenamePreviewInputSchema = z.strictObject({
  ids: z.array(z.string().uuid()),
});
export type CatalogAssetRenamePreviewInput = z.infer<typeof CatalogAssetRenamePreviewInputSchema>;

export const CatalogAssetRenamePreviewCallSchema = z.strictObject({
  operation: z.enum(["assetRenamePreview"]),
  data: CatalogAssetRenamePreviewInputSchema,
});
export type CatalogAssetRenamePreviewCall = z.infer<typeof CatalogAssetRenamePreviewCallSchema>;

export const CatalogAssetRenameInputSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.string().uuid(),
      oldPath: z.string().max(2000),
      newFileName: z.string().max(250),
      sha256: z.string().min(64).max(64),
    }),
  ),
});
export type CatalogAssetRenameInput = z.infer<typeof CatalogAssetRenameInputSchema>;

export const CatalogAssetRenameCallSchema = z.strictObject({
  operation: z.enum(["assetRename"]),
  data: CatalogAssetRenameInputSchema,
});
export type CatalogAssetRenameCall = z.infer<typeof CatalogAssetRenameCallSchema>;

export const CatalogAssetsInputSchema = z.strictObject({
  q: z.string().max(300).optional(),
  page: z.number().int().min(1).max(100000).optional(),
  pageSize: z.number().int().min(1).max(48).optional(),
  usage: z.enum(["all", "assigned", "unassigned"]).optional(),
  health: z.enum(["all", "problems", "missing", "healthy"]).optional(),
  role: z.enum(["all", "poster", "banner", "logo", "profile"]).optional(),
  sort: z.enum(["newest", "oldest", "name", "size"]).optional(),
});
export type CatalogAssetsInput = z.infer<typeof CatalogAssetsInputSchema>;

export const CatalogAssetsCallSchema = z.strictObject({
  operation: z.enum(["assets"]),
  data: CatalogAssetsInputSchema,
});
export type CatalogAssetsCall = z.infer<typeof CatalogAssetsCallSchema>;

export const CatalogAssetDeleteInputSchema = z.strictObject({
  id: z.string().uuid(),
  expectedSha256: z.string().min(64).max(64),
});
export type CatalogAssetDeleteInput = z.infer<typeof CatalogAssetDeleteInputSchema>;

export const CatalogAssetDeleteCallSchema = z.strictObject({
  operation: z.enum(["assetDelete"]),
  data: CatalogAssetDeleteInputSchema,
});
export type CatalogAssetDeleteCall = z.infer<typeof CatalogAssetDeleteCallSchema>;

export const CatalogAssetDetailInputSchema = z.strictObject({
  id: z.string().uuid(),
});
export type CatalogAssetDetailInput = z.infer<typeof CatalogAssetDetailInputSchema>;

export const CatalogAssetDetailCallSchema = z.strictObject({
  operation: z.enum(["assetDetail"]),
  data: CatalogAssetDetailInputSchema,
});
export type CatalogAssetDetailCall = z.infer<typeof CatalogAssetDetailCallSchema>;

export const CatalogAssetOwnersInputSchema = z.strictObject({
  kind: z.enum(["title", "installment", "episode", "entity"]),
  role: z.enum(["poster", "banner", "logo", "profile"]),
  q: z.string().max(300),
});
export type CatalogAssetOwnersInput = z.infer<typeof CatalogAssetOwnersInputSchema>;

export const CatalogAssetOwnersCallSchema = z.strictObject({
  operation: z.enum(["assetOwners"]),
  data: CatalogAssetOwnersInputSchema,
});
export type CatalogAssetOwnersCall = z.infer<typeof CatalogAssetOwnersCallSchema>;

export const CatalogAssetAssignInputSchema = z.strictObject({
  assetId: z.string().uuid(),
  ownerKind: z.enum(["title", "installment", "episode", "entity"]),
  ownerId: z.string().uuid(),
  role: z.enum(["poster", "banner", "logo", "profile"]),
  expectedPrimaryId: z.union([z.string().uuid(), z.null()]),
  expectedPrimaryAssetId: z.union([z.string().uuid(), z.null()]),
});
export type CatalogAssetAssignInput = z.infer<typeof CatalogAssetAssignInputSchema>;

export const CatalogAssetAssignCallSchema = z.strictObject({
  operation: z.enum(["assetAssign"]),
  data: CatalogAssetAssignInputSchema,
});
export type CatalogAssetAssignCall = z.infer<typeof CatalogAssetAssignCallSchema>;

export const CatalogAssetUnlinkInputSchema = z.strictObject({
  assetId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  expectedPrimary: z.boolean(),
});
export type CatalogAssetUnlinkInput = z.infer<typeof CatalogAssetUnlinkInputSchema>;

export const CatalogAssetUnlinkCallSchema = z.strictObject({
  operation: z.enum(["assetUnlink"]),
  data: CatalogAssetUnlinkInputSchema,
});
export type CatalogAssetUnlinkCall = z.infer<typeof CatalogAssetUnlinkCallSchema>;

export const CatalogEditorCallSchema = z.union([
  CatalogPlanetDetailCallSchema,
  CatalogPlanetSaveCallSchema,
  CatalogPlanetDeleteCallSchema,
  CatalogPlanetOptionsCallSchema,
  CatalogPlanetWorksCallSchema,
  CatalogPlanetMoveCallSchema,
  CatalogEntityOptionsCallSchema,
  CatalogEntityRoleCreateCallSchema,
  CatalogEntityDeletePreviewCallSchema,
  CatalogEntityBulkDeleteCallSchema,
  CatalogEntityJsonReadCallSchema,
  CatalogEntityJsonReviewCallSchema,
  CatalogEntityJsonSaveCallSchema,
  CatalogEntityListCallSchema,
  CatalogEntityDetailCallSchema,
  CatalogEntitySaveCallSchema,
  CatalogAssetRenamePreviewCallSchema,
  CatalogAssetRenameCallSchema,
  CatalogAssetsCallSchema,
  CatalogAssetDeleteCallSchema,
  CatalogAssetDetailCallSchema,
  CatalogAssetOwnersCallSchema,
  CatalogAssetAssignCallSchema,
  CatalogAssetUnlinkCallSchema,
  CatalogReadCallSchema,
  CatalogReviewCallSchema,
  CatalogSaveCallSchema,
  CatalogCreateCallSchema,
  CatalogParseCallSchema,
  CatalogLinksCallSchema,
  CatalogRefsCallSchema,
  CatalogSchemaCallSchema,
  CatalogVocabularyCallSchema,
  CatalogMediaCallSchema,
  CatalogSearchCallSchema,
  CatalogSeasonCallSchema,
  CatalogIngestCallSchema,
  CatalogUploadCallSchema,
  CatalogPreviewCallSchema,
]);
export type CatalogEditorCall = z.infer<typeof CatalogEditorCallSchema>;

export const CatalogEditorReplySchema = z.strictObject({
  result: z.json(),
});
export type CatalogEditorReply = z.infer<typeof CatalogEditorReplySchema>;

export const CatalogAssetsResultSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.string().uuid(),
      path: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      byteSize: z.number(),
      width: z.number(),
      height: z.number(),
      sha256: z.string(),
      createdAt: z.string(),
      health: z.enum(["healthy", "missing", "unreadable", "size-mismatch", "deletion-error"]),
      assignmentCount: z.number(),
      roles: z.array(z.enum(["poster", "banner", "logo", "profile"])),
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type CatalogAssetsResult = z.infer<typeof CatalogAssetsResultSchema>;

export const CatalogAssetDetailResultSchema = z.strictObject({
  asset: z.strictObject({
    id: z.string().uuid(),
    path: z.string(),
    fileName: z.string(),
    mimeType: z.string(),
    byteSize: z.number(),
    width: z.number(),
    height: z.number(),
    sha256: z.string(),
    createdAt: z.string(),
    health: z.enum(["healthy", "missing", "unreadable", "size-mismatch", "deletion-error"]),
    assignmentCount: z.number(),
    roles: z.array(z.enum(["poster", "banner", "logo", "profile"])),
  }),
  assignments: z.array(
    z.strictObject({
      id: z.string().uuid(),
      ownerId: z.string().uuid(),
      ownerKind: z.enum(["title", "installment", "episode", "entity"]),
      ownerLabel: z.string(),
      ownerContext: z.string(),
      workId: z.union([z.string().uuid(), z.null()]),
      entityKind: z.union([z.enum(["person", "organization"]), z.null()]),
      role: z.enum(["poster", "banner", "logo", "profile"]),
      isPrimary: z.boolean(),
    }),
  ),
  deleteBlockedReason: z.union([z.string(), z.null()]),
});
export type CatalogAssetDetailResult = z.infer<typeof CatalogAssetDetailResultSchema>;

export const CatalogAssetOwnersResultSchema = z.array(
  z.strictObject({
    id: z.string().uuid(),
    label: z.string(),
    context: z.string(),
    primaryAssetId: z.union([z.string().uuid(), z.null()]),
    primaryAssignmentId: z.union([z.string().uuid(), z.null()]),
  }),
);
export type CatalogAssetOwnersResult = z.infer<typeof CatalogAssetOwnersResultSchema>;

export const CatalogAssetAssignResultSchema = z.strictObject({
  assignmentId: z.string().uuid(),
});
export type CatalogAssetAssignResult = z.infer<typeof CatalogAssetAssignResultSchema>;

export const CatalogAssetUnlinkResultSchema = z.strictObject({
  removed: z.boolean(),
});
export type CatalogAssetUnlinkResult = z.infer<typeof CatalogAssetUnlinkResultSchema>;

export const CatalogAssetDeleteResultSchema = z.strictObject({
  removed: z.boolean(),
  fileRetained: z.boolean(),
});
export type CatalogAssetDeleteResult = z.infer<typeof CatalogAssetDeleteResultSchema>;

export const CatalogAssetRenamePreviewResultSchema = z.array(
  z.strictObject({
    id: z.string().uuid(),
    oldPath: z.string().max(2000),
    newFileName: z.string().max(250),
    sha256: z.string().min(64).max(64),
    oldFileName: z.string(),
    reason: z.union([z.string(), z.null()]),
  }),
);
export type CatalogAssetRenamePreviewResult = z.infer<typeof CatalogAssetRenamePreviewResultSchema>;

export const CatalogAssetRenameResultSchema = z.strictObject({
  renamed: z.number(),
  compatibilityLinksRetained: z.boolean(),
});
export type CatalogAssetRenameResult = z.infer<typeof CatalogAssetRenameResultSchema>;

export const CatalogEntityListResultSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.string().uuid(),
      kind: z.enum(["person", "organization"]),
      name: z.string(),
      sortName: z.string(),
      description: z.string(),
      artworkId: z.union([z.string().uuid(), z.null()]),
      workCount: z.number(),
      roles: z.array(z.string()),
      updatedAt: z.string(),
    }),
  ),
  total: z.number(),
});
export type CatalogEntityListResult = z.infer<typeof CatalogEntityListResultSchema>;

export const CatalogEntityDetailResultSchema = z.strictObject({
  entity: z.strictObject({
    id: z.string().uuid(),
    kind: z.enum(["person", "organization"]),
    name: z.string(),
    sortName: z.string(),
    description: z.string(),
    artworkId: z.union([z.string().uuid(), z.null()]),
    workCount: z.number(),
    roles: z.array(z.string()),
    updatedAt: z.string(),
  }),
  draft: z.strictObject({
    name: z.string().min(1).max(300),
    sortName: z.string().min(1).max(300),
    description: z.string().max(20000),
    aliases: z.array(
      z.strictObject({
        id: z.union([z.string().uuid(), z.null()]),
        alias: z.string().min(1).max(300),
        language: z.union([z.string().max(30), z.null()]),
      }),
    ),
    profileAssetId: z.union([z.string().uuid(), z.null()]),
    credits: z.array(
      z.strictObject({
        workId: z.string().uuid(),
        workTitle: z.string(),
        roleId: z.string().uuid(),
        roleName: z.string(),
        roleLabel: z.string(),
        position: z.number().int().min(0).max(1000000),
        isPrimary: z.boolean(),
      }),
    ),
  }),
  revision: z.string().min(64).max(64),
  links: z.array(
    z.strictObject({
      table: z.string(),
      count: z.number(),
    }),
  ),
  imageCount: z.number(),
});
export type CatalogEntityDetailResult = z.infer<typeof CatalogEntityDetailResultSchema>;

export const CatalogEntitySaveResultSchema = z.strictObject({
  id: z.string().uuid(),
  created: z.boolean(),
});
export type CatalogEntitySaveResult = z.infer<typeof CatalogEntitySaveResultSchema>;

export const CatalogEntityJsonReviewResultSchema = z.strictObject({
  ticket: z.string(),
  expiresAt: z.number(),
  records: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      changes: z.array(
        z.strictObject({
          path: z.string(),
          before: z.union([z.json(), z.null()]),
          after: z.union([z.json(), z.null()]),
        }),
      ),
    }),
  ),
});
export type CatalogEntityJsonReviewResult = z.infer<typeof CatalogEntityJsonReviewResultSchema>;

export const CatalogEntityOptionsResultSchema = z.strictObject({
  works: z.array(
    z.strictObject({
      id: z.string().uuid(),
      title: z.string(),
      year: z.union([z.number(), z.null()]),
    }),
  ),
  roles: z.array(
    z.strictObject({
      id: z.string().uuid(),
      name: z.string(),
      label: z.string(),
      slug: z.string(),
      active: z.boolean(),
    }),
  ),
});
export type CatalogEntityOptionsResult = z.infer<typeof CatalogEntityOptionsResultSchema>;

export const CatalogEntityRoleCreateResultSchema = z.strictObject({
  id: z.string().uuid(),
});
export type CatalogEntityRoleCreateResult = z.infer<typeof CatalogEntityRoleCreateResultSchema>;

export const CatalogEntityDeletePreviewResultSchema = z.array(
  z.strictObject({
    entity: z.strictObject({
      id: z.string().uuid(),
      kind: z.enum(["person", "organization"]),
      name: z.string(),
      sortName: z.string(),
      description: z.string(),
      artworkId: z.union([z.string().uuid(), z.null()]),
      workCount: z.number(),
      roles: z.array(z.string()),
      updatedAt: z.string(),
    }),
    draft: z.strictObject({
      name: z.string().min(1).max(300),
      sortName: z.string().min(1).max(300),
      description: z.string().max(20000),
      aliases: z.array(
        z.strictObject({
          id: z.union([z.string().uuid(), z.null()]),
          alias: z.string().min(1).max(300),
          language: z.union([z.string().max(30), z.null()]),
        }),
      ),
      profileAssetId: z.union([z.string().uuid(), z.null()]),
      credits: z.array(
        z.strictObject({
          workId: z.string().uuid(),
          workTitle: z.string(),
          roleId: z.string().uuid(),
          roleName: z.string(),
          roleLabel: z.string(),
          position: z.number().int().min(0).max(1000000),
          isPrimary: z.boolean(),
        }),
      ),
    }),
    revision: z.string().min(64).max(64),
    links: z.array(
      z.strictObject({
        table: z.string(),
        count: z.number(),
      }),
    ),
    imageCount: z.number(),
  }),
);
export type CatalogEntityDeletePreviewResult = z.infer<
  typeof CatalogEntityDeletePreviewResultSchema
>;

export const CatalogEntityBulkDeleteResultSchema = z.strictObject({
  deleted: z.number(),
  removedCredits: z.number(),
});
export type CatalogEntityBulkDeleteResult = z.infer<typeof CatalogEntityBulkDeleteResultSchema>;

export const CatalogEntityJsonReadResultSchema = z.strictObject({
  document: z.strictObject({
    schemaVersion: z.number(),
    target: z.enum(["people", "studios"]),
    records: z.array(
      z.strictObject({
        id: z.string().uuid(),
        name: z.string().min(1).max(300),
        sortName: z.string().min(1).max(300),
        description: z.string().max(20000),
        aliases: z.array(
          z.strictObject({
            id: z.union([z.string().uuid(), z.null()]),
            alias: z.string().min(1).max(300),
            language: z.union([z.string().max(30), z.null()]),
          }),
        ),
        profileImage: z.union([z.string().max(2000), z.null()]),
        credits: z.array(
          z.strictObject({
            work: z.string().min(1).max(300),
            role: z.string().min(1).max(300),
            position: z.number().int().min(0).max(1000000),
            isPrimary: z.boolean(),
          }),
        ),
      }),
    ),
  }),
  originals: z.array(
    z.strictObject({
      id: z.string().uuid(),
      revision: z.string().min(64).max(64),
    }),
  ),
  previews: z.array(
    z.strictObject({
      id: z.string().uuid(),
      kind: z.enum(["person", "organization"]),
      name: z.string(),
      sortName: z.string(),
      description: z.string(),
      artworkId: z.union([z.string().uuid(), z.null()]),
      workCount: z.number(),
      roles: z.array(z.string()),
      updatedAt: z.string(),
    }),
  ),
});
export type CatalogEntityJsonReadResult = z.infer<typeof CatalogEntityJsonReadResultSchema>;

export const CatalogEntityJsonSaveResultSchema = z.strictObject({
  saved: z.number(),
});
export type CatalogEntityJsonSaveResult = z.infer<typeof CatalogEntityJsonSaveResultSchema>;

export const CatalogPlanetOptionsResultSchema = z.strictObject({
  planets: z.array(
    z.strictObject({
      id: z.string().uuid(),
      name: z.string(),
      englishName: z.union([z.string(), z.null()]),
      icon: z.string(),
      description: z.string(),
      active: z.boolean(),
      count: z.number(),
      displayOrder: z.number().int().min(-9007199254740991).max(9007199254740991),
    }),
  ),
  unassigned: z.number(),
});
export type CatalogPlanetOptionsResult = z.infer<typeof CatalogPlanetOptionsResultSchema>;

export const CatalogPlanetWorksResultSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.string().uuid(),
      title: z.string(),
      englishTitle: z.string(),
      year: z.union([z.number(), z.null()]),
      posterId: z.union([z.string().uuid(), z.null()]),
      memberships: z.array(
        z.strictObject({
          id: z.string().uuid(),
          name: z.string(),
          icon: z.string(),
          rank: z.union([z.number().int().min(-9007199254740991).max(9007199254740991), z.null()]),
        }),
      ),
      revision: z.string().min(64).max(64),
    }),
  ),
  total: z.number(),
});
export type CatalogPlanetWorksResult = z.infer<typeof CatalogPlanetWorksResultSchema>;

export const CatalogPlanetMoveResultSchema = z.strictObject({
  moved: z.number(),
});
export type CatalogPlanetMoveResult = z.infer<typeof CatalogPlanetMoveResultSchema>;

export const CatalogPlanetDetailResultSchema = z.strictObject({
  id: z.string().uuid(),
  draft: z.strictObject({
    slug: z.string(),
    name: z.string().min(1).max(300),
    englishName: z.union([z.string().max(300), z.null()]),
    icon: z.string().min(1).max(64),
    description: z.string().max(20000),
    primaryColor: z.string(),
    secondaryColor: z.string(),
    displayOrder: z.number().int().min(0).max(1000000),
    active: z.boolean(),
  }),
  revision: z.string().min(64).max(64),
  links: z.array(
    z.strictObject({
      table: z.string(),
      count: z.number().int().min(0).max(9007199254740991),
    }),
  ),
});
export type CatalogPlanetDetailResult = z.infer<typeof CatalogPlanetDetailResultSchema>;

export const CatalogPlanetSaveResultSchema = z.strictObject({
  id: z.string().uuid(),
  created: z.boolean(),
});
export type CatalogPlanetSaveResult = z.infer<typeof CatalogPlanetSaveResultSchema>;

export const CatalogPlanetDeleteResultSchema = z.strictObject({
  removed: z.boolean(),
});
export type CatalogPlanetDeleteResult = z.infer<typeof CatalogPlanetDeleteResultSchema>;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token: () => string | null;
  constructor(baseUrl: string, token: () => string | null) {
    this.baseUrl = baseUrl;
    this.token = token;
  }
  private async request(
    path: string,
    method: string,
    body?:
      | CatalogEditorCall
      | FavoriteRequest
      | LoginRequest
      | PasswordUpdate
      | ProfileUpdate
      | WatchedRequest
      | WorkReadRequest
      | WorkReviewRequest
      | WorkSaveRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
    const headers = new Headers();
    const token = this.token();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw new globalThis.Error(`API request failed (${response.status})`);
    return response;
  }
  async getReleases(
    query: {
      season?: number;
      year?: number;
      month?: number;
      day?: number;
      kind?: "all" | "installments" | "episodes";
      scope?: "year" | "upcoming" | "undated";
      page?: number;
      pageSize?: number;
    } = {},
    signal?: AbortSignal,
  ): Promise<ReleasesPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      "/api/v1/releases" + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return ReleasesPageSchema.parse(await response.json());
  }
  async getWorkState(id: string, signal?: AbortSignal): Promise<WorkViewerState> {
    const response = await this.request(
      `/api/v1/works/${encodeURIComponent(id)}/state`,
      "GET",
      undefined,
      signal,
    );
    return WorkViewerStateSchema.parse(await response.json());
  }
  async setFavorite(
    id: string,
    body: FavoriteRequest,
    signal?: AbortSignal,
  ): Promise<WorkViewerState> {
    const response = await this.request(
      `/api/v1/works/${encodeURIComponent(id)}/favorite`,
      "PUT",
      body,
      signal,
    );
    return WorkViewerStateSchema.parse(await response.json());
  }
  async setWatched(
    id: string,
    body: WatchedRequest,
    signal?: AbortSignal,
  ): Promise<WorkViewerState> {
    const response = await this.request(
      `/api/v1/works/${encodeURIComponent(id)}/watched`,
      "PATCH",
      body,
      signal,
    );
    return WorkViewerStateSchema.parse(await response.json());
  }
  async getWorkActivity(
    id: string,
    query: { page?: number } = {},
    signal?: AbortSignal,
  ): Promise<WorkActivityPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      `/api/v1/works/${encodeURIComponent(id)}/activity` + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return WorkActivityPageSchema.parse(await response.json());
  }
  async login(body: LoginRequest, signal?: AbortSignal): Promise<LoginResponse> {
    const response = await this.request("/api/v1/auth/login", "POST", body, signal);
    return LoginResponseSchema.parse(await response.json());
  }
  async getSession(signal?: AbortSignal): Promise<Session> {
    const response = await this.request("/api/v1/auth/session", "GET", undefined, signal);
    return SessionSchema.parse(await response.json());
  }
  async logout(signal?: AbortSignal): Promise<void> {
    const response = await this.request("/api/v1/auth/logout", "POST", undefined, signal);
    if (response.status !== 204) throw new globalThis.Error("Invalid logout response");
  }
  async listWorks(
    query: {
      page?: number;
      pageSize?: number;
      q?: string;
      sort?: "title" | "year-desc" | "year-asc" | "updated-desc" | "added-desc";
      format?: "animated" | "live-action";
      audience?: "general" | "teen" | "young-adult" | "adult";
      genre?: string;
      status?: "announced" | "airing" | "completed" | "unknown";
      yearFrom?: number;
      yearTo?: number;
      includePrivate?: boolean;
      planet?: string;
    } = {},
    signal?: AbortSignal,
  ): Promise<WorkPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      "/api/v1/works" + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return WorkPageSchema.parse(await response.json());
  }
  async getWork(id: string, signal?: AbortSignal): Promise<WorkDetail> {
    const response = await this.request(
      `/api/v1/works/${encodeURIComponent(id)}`,
      "GET",
      undefined,
      signal,
    );
    return WorkDetailSchema.parse(await response.json());
  }
  async getCatalogFilters(signal?: AbortSignal): Promise<CatalogFilters> {
    const response = await this.request("/api/v1/catalog/filters", "GET", undefined, signal);
    return CatalogFiltersSchema.parse(await response.json());
  }
  async getEpisodes(
    query: {
      kind?: "episodes" | "movies" | "all";
      visibility?: "public" | "private" | "all";
      watchState?: "all" | "watched" | "unwatched";
      includePrivate?: boolean;
      includeMovies?: boolean;
      q?: string;
      page?: number;
      pageSize?: number;
    } = {},
    signal?: AbortSignal,
  ): Promise<EpisodesPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      "/api/v1/catalog/episodes" + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return EpisodesPageSchema.parse(await response.json());
  }
  async getHomeFeed(signal?: AbortSignal): Promise<HomeFeed> {
    const response = await this.request("/api/v1/catalog/home", "GET", undefined, signal);
    return HomeFeedSchema.parse(await response.json());
  }
  async browseCatalog(
    query: {
      page?: number;
      pageSize?: number;
      q?: string;
      sort?: string;
      group?: "none" | "year" | "format" | "audience" | "status" | "watchState";
      view?: "works" | "installments";
      privacy?: "public" | "all" | "private";
      filters?: string;
      yearFrom?: number;
      yearTo?: number;
    } = {},
    signal?: AbortSignal,
  ): Promise<CatalogPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      "/api/v1/catalog/browse" + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return CatalogPageSchema.parse(await response.json());
  }
  async getCatalogFacets(
    query: { view?: "works" | "installments"; privacy?: "public" | "all" | "private" } = {},
    signal?: AbortSignal,
  ): Promise<FacetCatalog> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      "/api/v1/catalog/facets" + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return FacetCatalogSchema.parse(await response.json());
  }
  async getRecommendations(
    query: { workId?: string } = {},
    signal?: AbortSignal,
  ): Promise<RecommendationPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      "/api/v1/catalog/recommendations" + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return RecommendationPageSchema.parse(await response.json());
  }
  async getProfile(signal?: AbortSignal): Promise<User> {
    const response = await this.request("/api/v1/me", "GET", undefined, signal);
    return UserSchema.parse(await response.json());
  }
  async updateProfile(body: ProfileUpdate, signal?: AbortSignal): Promise<User> {
    const response = await this.request("/api/v1/me", "PATCH", body, signal);
    return UserSchema.parse(await response.json());
  }
  async updatePassword(body: PasswordUpdate, signal?: AbortSignal): Promise<AccountMessage> {
    const response = await this.request("/api/v1/me/password", "POST", body, signal);
    return AccountMessageSchema.parse(await response.json());
  }
  async getAdminAccess(signal?: AbortSignal): Promise<User> {
    const response = await this.request("/api/v1/admin/access", "GET", undefined, signal);
    return UserSchema.parse(await response.json());
  }
  async getAdminWorks(
    query: {
      page?: number;
      pageSize?: number;
      q?: string;
      format?: "animated" | "live-action";
      structure?: "movie" | "series";
      workflow?: "draft" | "in_review" | "approved" | "published" | "archived";
      visibility?: "public" | "private";
      gap?: "poster" | "summary" | "arabic-name" | "structure";
      sort?: "updated" | "title" | "year-desc" | "year-asc";
    } = {},
    signal?: AbortSignal,
  ): Promise<AdminWorksPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) params.set(key, String(value));
    const response = await this.request(
      "/api/v1/admin/works" + (params.size ? `?${params}` : ""),
      "GET",
      undefined,
      signal,
    );
    return AdminWorksPageSchema.parse(await response.json());
  }
  async getWorkDocument(id: string, signal?: AbortSignal): Promise<WorkDocument> {
    const response = await this.request(
      `/api/v1/admin/works/${encodeURIComponent(id)}`,
      "GET",
      undefined,
      signal,
    );
    return WorkDocumentSchema.parse(await response.json());
  }
  async readWorkDocuments(body: WorkReadRequest, signal?: AbortSignal): Promise<WorkDocuments> {
    const response = await this.request("/api/v1/admin/works/read", "POST", body, signal);
    return WorkDocumentsSchema.parse(await response.json());
  }
  async reviewWorkDocuments(body: WorkReviewRequest, signal?: AbortSignal): Promise<WorkReview> {
    const response = await this.request("/api/v1/admin/works/review", "POST", body, signal);
    return WorkReviewSchema.parse(await response.json());
  }
  async saveWorkDocuments(body: WorkSaveRequest, signal?: AbortSignal): Promise<WorkSaved> {
    const response = await this.request("/api/v1/admin/works/save", "POST", body, signal);
    return WorkSavedSchema.parse(await response.json());
  }
  async callCatalogEditor(
    body: CatalogEditorCall,
    signal?: AbortSignal,
  ): Promise<CatalogEditorReply> {
    const response = await this.request("/api/v1/admin/editor", "POST", body, signal);
    return CatalogEditorReplySchema.parse(await response.json());
  }
}

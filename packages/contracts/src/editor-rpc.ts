import { z } from "zod";

import { awardInputs, awardResults } from "./admin-awards";
export { awardDrafts, awardTables, awardDefinitionTables } from "./admin-awards";

import { entityInputs, entityResults } from "./admin-entities";
import { planetInputs, planetResults } from "./admin-planets";
export { planetWork as adminPlanetWorkSchema } from "./admin-planets";
export { planetDraft as adminPlanetDraftSchema } from "./admin-planets";
export { emptyPlanetDraft as adminEmptyPlanetDraft } from "./admin-planets";
export {
  entityDraft as adminEntityDraftSchema,
  entityCredit as adminEntityCreditSchema,
  entityJsonDocument as adminEntityJsonDocumentSchema,
  humanEntity as adminHumanEntitySchema,
  entitySummary as adminEntitySummarySchema,
} from "./admin-entities";
import { artworkSearchQuerySchema, artworkCandidateSchema } from "./index";
import { workDocument } from "./work-document";
export const editorTables = [
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
] as const;
export const jsonRow = z.record(z.string(), z.json());
export const snapshotSchema = z.object({ document: workDocument, revision: z.string() });
export const reviewSchema = z.object({
  ticket: z.string(),
  expiresAt: z.number(),
  records: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      changes: z.array(
        z.object({ path: z.string(), before: z.json().nullable(), after: z.json().nullable() }),
      ),
    }),
  ),
});
export const originalSchema = z.object({ id: z.string().uuid(), revision: z.string().length(64) });

export const imageRoleSchema = z.enum(["poster", "banner", "logo", "profile", "still"]);
export const imageOwnerKindSchema = z.enum(["title", "installment", "episode", "entity"]);
export const imageSchema = z.object({
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
  roles: z.array(imageRoleSchema),
});
export const imageAssignmentSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  ownerKind: imageOwnerKindSchema,
  ownerLabel: z.string(),
  ownerContext: z.string(),
  workId: z.string().uuid().nullable(),
  entityKind: z.enum(["person", "organization"]).nullable(),
  role: imageRoleSchema,
  isPrimary: z.boolean(),
});
export const imageOwnerSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  context: z.string(),
  primaryAssetId: z.string().uuid().nullable(),
  primaryAssignmentId: z.string().uuid().nullable(),
});

const imageRenameSelection = z.strictObject({
  id: z.string().uuid(),
  oldPath: z.string().max(2000),
  newFileName: z.string().max(250),
  sha256: z.string().length(64),
});
export const imageRenameProposal = imageRenameSelection.extend({
  oldFileName: z.string(),
  reason: z.string().nullable(),
});

export const rpcInputs = {
  ...awardInputs,
  ...planetInputs,
  ...entityInputs,
  assetRenamePreview: z.strictObject({ ids: z.array(z.string().uuid()).min(1).max(50) }),
  assetRename: z.strictObject({ items: z.array(imageRenameSelection).min(1).max(50) }),
  assets: z.strictObject({
    q: z.string().max(300).default(""),
    page: z.number().int().min(1).max(100000).default(1),
    pageSize: z.number().int().min(1).max(48).default(24),
    usage: z.enum(["all", "assigned", "unassigned"]).default("all"),
    health: z.enum(["all", "problems", "missing", "healthy"]).default("all"),
    role: z.enum(["all", "poster", "banner", "logo", "profile", "still"]).default("all"),
    sort: z.enum(["newest", "oldest", "name", "size"]).default("newest"),
  }),
  assetDelete: z.strictObject({ id: z.string().uuid(), expectedSha256: z.string().length(64) }),
  assetDetail: z.strictObject({ id: z.string().uuid() }),
  assetOwners: z.strictObject({
    kind: imageOwnerKindSchema,
    role: imageRoleSchema,
    q: z.string().max(300),
  }),
  assetAssign: z.strictObject({
    assetId: z.string().uuid(),
    ownerKind: imageOwnerKindSchema,
    ownerId: z.string().uuid(),
    role: imageRoleSchema,
    expectedPrimaryId: z.string().uuid().nullable(),
    expectedPrimaryAssetId: z.string().uuid().nullable(),
  }),
  assetUnlink: z.strictObject({
    assetId: z.string().uuid(),
    assignmentId: z.string().uuid(),
    expectedPrimary: z.boolean(),
  }),
  read: z.strictObject({ ids: z.array(z.string().uuid()).min(1) }),
  review: z.strictObject({
    json: z.string().max(4000000),
    originals: z.array(originalSchema).min(1),
  }),
  save: z.strictObject({ ticket: z.string().max(8000000) }),
  create: z.strictObject({ json: z.string().max(4000000) }),
  parse: z.strictObject({ json: z.string().max(4000000) }),
  links: z.strictObject({ workId: z.string().uuid(), episodeId: z.string().uuid() }),
  refs: z.strictObject({
    table: z.enum(editorTables),
    search: z.string().max(300),
    offset: z.number().int().min(0).max(1000000).default(0),
    filters: jsonRow.default({}),
    sort: z.enum(["default", "newest", "oldest"]).default("default"),
  }),
  schema: z.strictObject({}),
  vocabulary: z.strictObject({
    tables: z.array(z.enum(["genres", "tones", "tags", "countries", "planets", "roles"])).max(6),
  }),
  media: z.strictObject({ path: z.string().startsWith("/media/").max(1000) }),
  search: artworkSearchQuerySchema,
  season: z.strictObject({
    tmdbId: z.number().int().positive(),
    season: z.number().int().nonnegative(),
    groupId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,100}$/)
      .optional(),
  }),
  episodeImages: z.strictObject({
    tmdbId: z.number().int().positive(),
    season: z.number().int().nonnegative(),
    episode: z.number().int().positive(),
  }),
  ingest: z.strictObject({
    url: z.string().url(),
    role: z.enum(["poster", "banner", "logo", "still"]),
    ownerName: z.string().min(1).max(200),
  }),
  upload: z.strictObject({
    dataUrl: z.string().max(14000000),
    fileName: z.string().min(1).max(250),
    role: z.enum(["poster", "banner", "logo", "profile", "still"]),
    ownerName: z.string().min(1).max(200),
  }),
  preview: z.strictObject({ url: z.string().url() }),
};
export const tableSchema = z.object({
  name: z.string(),
  writable: z.boolean(),
  columns: z.array(
    z.object({
      name: z.string(),
      data_type: z.string(),
      nullable: z.boolean(),
      primary: z.boolean(),
      generated: z.boolean(),
      default_value: z.string().nullable(),
      enum_values: z.array(z.string()),
    }),
  ),
});
export const rpcResults = {
  ...awardResults,
  ...planetResults,
  entityJsonReview: reviewSchema,
  ...entityResults,
  assetRenamePreview: z.array(imageRenameProposal),
  assetRename: z.object({ renamed: z.number(), compatibilityLinksRetained: z.boolean() }),
  assets: z.object({
    items: z.array(imageSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
  assetDelete: z.object({ removed: z.boolean(), fileRetained: z.boolean() }),
  assetDetail: z.object({
    asset: imageSchema,
    assignments: z.array(imageAssignmentSchema),
    deleteBlockedReason: z.string().nullable(),
  }),
  assetOwners: z.array(imageOwnerSchema),
  assetAssign: z.object({ assignmentId: z.string().uuid() }),
  assetUnlink: z.object({ removed: z.boolean() }),
  read: z.array(snapshotSchema),
  review: reviewSchema,
  save: z.object({ saved: z.number(), createdId: z.string().nullable() }),
  create: reviewSchema,
  parse: workDocument,
  links: z.array(z.object({ table: z.string(), count: z.number() })),
  refs: z.object({ rows: z.array(jsonRow), offset: z.number(), total: z.number() }),
  schema: z.array(tableSchema),
  vocabulary: z.array(
    z.object({
      table: z.string(),
      options: z.array(z.object({ value: z.string(), label: z.string() })),
    }),
  ),
  media: z.object({ id: z.string().uuid() }),
  search: z.object({ candidates: z.array(artworkCandidateSchema), warnings: z.array(z.string()) }),
  season: z
    .array(
      z.object({
        number: z.number(),
        title: z.string().nullable(),
        summary: z.string(),
        releaseDate: z.string().nullable(),
        runtimeMinutes: z.number().nullable(),
        stillUrl: z.string().url().nullable(),
        sourceSeason: z.number().int().nonnegative().optional(),
        sourceEpisode: z.number().int().nonnegative().optional(),
        sourceLabel: z.string().optional(),
      }),
    )
    .nullable(),
  episodeImages: z
    .array(
      z.object({
        url: z.url(),
        previewUrl: z.url(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    )
    .max(60),
  ingest: z.object({ id: z.string().uuid(), path: z.string() }),
  upload: z.object({ id: z.string().uuid(), path: z.string() }),
  preview: z.object({ dataUrl: z.string() }),
};

import { z } from "zod";

export const entityKind = z.enum(["person", "organization"]);
export const entityAlias = z.strictObject({
  id: z.string().uuid().nullable(),
  alias: z.string().trim().min(1).max(300),
  language: z.string().trim().max(30).nullable(),
});
export const entityCredit = z.strictObject({
  workId: z.string().uuid(),
  workTitle: z.string(),
  roleId: z.string().uuid(),
  roleName: z.string(),
  roleLabel: z.string(),
  position: z.number().int().min(0).max(1000000),
  isPrimary: z.boolean(),
  languages: z
    .array(z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/))
    .max(30)
    .optional(),
});
export const entityLink = z.strictObject({
  label: z.string().trim().min(1).max(100),
  url: z
    .url()
    .max(2000)
    .refine((value) => {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    }, "استخدم رابط HTTP أو HTTPS دون بيانات دخول."),
});
export const entityRelation = z.strictObject({
  id: z.string().uuid().nullable(),
  entityId: z.string().uuid(),
  entityName: z.string().min(1).max(300),
  direction: z.enum(["outgoing", "incoming"]),
  relationType: z.string().trim().min(1).max(100),
  occurredOn: z.iso.date().nullable(),
  description: z.string().max(20000),
});
// Omission preserves existing values for older clients and JSON documents.
const entityReferences = {
  urls: z.array(entityLink).max(30).optional(),
  relations: z.array(entityRelation).max(200).optional(),
};
export const entityDraft = z.strictObject({
  ...entityReferences,
  name: z.string().trim().min(1).max(300),
  sortName: z.string().trim().min(1).max(300),
  description: z.string().max(20000),
  aliases: z.array(entityAlias).max(50),
  profileAssetId: z.string().uuid().nullable(),
  credits: z.array(entityCredit).max(500),
});
export const entitySummary = z.object({
  id: z.string().uuid(),
  kind: entityKind,
  name: z.string(),
  sortName: z.string(),
  description: z.string(),
  artworkId: z.string().uuid().nullable(),
  workCount: z.number(),
  roles: z.array(z.string()),
  updatedAt: z.string(),
});
export const entityDetail = z.object({
  entity: entitySummary,
  draft: entityDraft,
  revision: z.string().length(64),
  links: z.array(z.object({ table: z.string(), count: z.number() })),
  imageCount: z.number(),
});
const selectedEntities = z
  .array(z.object({ id: z.string().uuid(), revision: z.string().length(64) }))
  .min(1);
export const humanEntity = z.strictObject({
  ...entityReferences,
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(300),
  sortName: z.string().trim().min(1).max(300),
  description: z.string().max(20000),
  aliases: z.array(entityAlias).max(50),
  profileImage: z.string().max(2000).nullable(),
  credits: z
    .array(
      z.strictObject({
        work: z.string().min(1).max(300),
        role: z.string().min(1).max(300),
        position: z.number().int().min(0).max(1000000),
        isPrimary: z.boolean(),
        languages: z
          .array(z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/))
          .max(30)
          .optional(),
      }),
    )
    .max(500),
});
export const entityJsonDocument = z.strictObject({
  schemaVersion: z.literal(1),
  target: z.enum(["people", "studios"]),
  records: z.array(humanEntity).min(1),
});
export const entityOptions = z.object({
  works: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      year: z.number().nullable(),
      titleAr: z.string().nullable().optional(),
      posterId: z.string().uuid().nullable().optional(),
      aliases: z.array(z.string()).optional(),
      score: z.number().nullable().optional(),
    }),
  ),
  roles: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      label: z.string(),
      slug: z.string(),
      active: z.boolean(),
    }),
  ),
});
export const entityInputs = {
  entityOptions: z.strictObject({ kind: entityKind }),
  entityRoleCreate: z.strictObject({
    kind: entityKind,
    slug: z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/),
    name: z.string().trim().min(1).max(300),
    label: z.string().trim().max(300),
  }),
  entityDeletePreview: z.strictObject({
    kind: entityKind,
    ids: z.array(z.string().uuid()).min(1).max(50),
  }),
  entityBulkDelete: z.strictObject({
    kind: entityKind,
    records: selectedEntities.max(50),
    removeCredits: z.boolean(),
  }),
  entityJsonRead: z.strictObject({
    kind: entityKind,
    ids: z.array(z.string().uuid()).min(1),
  }),
  entityJsonReview: z.strictObject({
    json: z.string().max(4000000),
    originals: selectedEntities,
  }),
  entityJsonSave: z.strictObject({ ticket: z.string().max(8000000) }),
  entitySelection: z.strictObject({
    kind: entityKind,
    q: z.string().max(300).default(""),
    image: z.enum(["all", "with", "without"]).default("all"),
    usage: z.enum(["all", "linked", "unlinked", "one"]).default("all"),
    role: z.string().max(80).default(""),
    language: z.string().max(35).default(""),
  }),
  entityList: z.strictObject({
    kind: entityKind,
    q: z.string().max(300).default(""),
    page: z.number().int().min(1).max(100000).default(1),
    image: z.enum(["all", "with", "without"]).default("all"),
    usage: z.enum(["all", "linked", "unlinked", "one"]).default("all"),
    role: z.string().max(80).default(""),
    language: z.string().max(35).default(""),
    sort: z.enum(["name", "works", "updated"]).default("works"),
  }),
  entityDetail: z.strictObject({ id: z.string().uuid(), kind: entityKind }),
  entitySave: z.strictObject({
    id: z.string().uuid().nullable(),
    kind: entityKind,
    revision: z.string().length(64).nullable(),
    draft: entityDraft,
  }),
};
export const entityResults = {
  entityOptions,
  entitySelection: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  entityRoleCreate: z.object({ id: z.string().uuid() }),
  entityDeletePreview: z.array(entityDetail),
  entityBulkDelete: z.object({ deleted: z.number(), removedCredits: z.number() }),
  entityJsonRead: z.object({
    document: entityJsonDocument,
    originals: selectedEntities,
    previews: z.array(entitySummary),
  }),
  entityJsonSave: z.object({ saved: z.number() }),
  entityList: z.object({ items: z.array(entitySummary), total: z.number() }),
  entityDetail,
  entitySave: z.object({ id: z.string().uuid(), created: z.boolean() }),
};

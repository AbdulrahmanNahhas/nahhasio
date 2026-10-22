import { z } from "zod";

export const awardTables = [
  "award_organizations",
  "award_categories",
  "award_ceremonies",
  "award_recognitions",
] as const;
export const awardDefinitionTables = [
  "award_organizations",
  "award_categories",
  "award_ceremonies",
] as const;
const name = z.string().trim().min(1).max(300);
const optionalText = z.string().max(20000).nullable();
const url = z
  .string()
  .url()
  .max(2000)
  .regex(/^https?:\/\//)
  .nullable();
const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{0,99}$/);
export const awardDrafts = {
  award_organizations: z.strictObject({
    slug,
    name_ar: name,
    name_en: optionalText,
    description: z.string().max(20000),
    website_url: url,
    logo_path: z
      .string()
      .max(2000)
      .regex(/^\/media\//)
      .nullable(),
    is_active: z.boolean(),
  }),
  award_categories: z.strictObject({
    organization_id: z.string().uuid(),
    slug,
    name_ar: name,
    name_en: optionalText,
    description: z.string().max(20000),
    is_active: z.boolean(),
  }),
  award_ceremonies: z.strictObject({
    organization_id: z.string().uuid(),
    year: z.number().int().min(1900).max(2100),
    edition: z.number().int().min(1).max(10000).nullable(),
    label: z.string().max(300),
    held_on: z.iso.date().nullable(),
    source_url: url,
  }),
};
const row = z.record(z.string(), z.json());
export const awardInputs = {
  awardList: z.strictObject({
    table: z.enum(awardTables),
    organization: z.string().uuid().nullable(),
    q: z.string().max(300),
    page: z.number().int().min(1).max(100000),
    result: z.enum(["all", "winner", "nominee"]),
    category: z.string().uuid().nullable().default(null),
    ceremony: z.string().uuid().nullable().default(null),
    year: z.number().int().min(1900).max(2100).nullable().default(null),
    featured: z.boolean().default(false),
    source: z.enum(["all", "documented", "missing"]).default("all"),
    sort: z.enum(["newest", "oldest", "work"]).default("newest"),
  }),
  awardDetail: z.strictObject({ table: z.enum(awardDefinitionTables), id: z.string().uuid() }),
  awardSave: z.strictObject({
    table: z.enum(awardDefinitionTables),
    id: z.string().uuid().nullable(),
    revision: z.string().length(64).nullable(),
    draft: row,
  }),
  awardDelete: z.strictObject({
    table: z.enum(awardDefinitionTables),
    id: z.string().uuid(),
    revision: z.string().length(64),
    confirmation: z.string().max(100),
  }),
};
export const awardResults = {
  awardList: z.object({
    rows: z.array(row),
    total: z.number(),
    counts: z.record(z.string(), z.number()),
  }),
  awardDetail: z.object({
    row,
    revision: z.string().length(64),
    links: z.array(z.object({ table: z.string(), count: z.number() })),
  }),
  awardSave: z.object({ id: z.string().uuid(), created: z.boolean() }),
  awardDelete: z.object({ removed: z.literal(true) }),
};

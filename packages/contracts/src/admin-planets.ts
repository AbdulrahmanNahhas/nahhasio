import { z } from "zod";

const planetId = z.string().uuid().nullable();
export const planetDraft = z.strictObject({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,79}$/),
  name: z.string().trim().min(1).max(300),
  englishName: z.string().trim().max(300).nullable(),
  icon: z.string().trim().min(1).max(64),
  description: z.string().max(20000),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  displayOrder: z.number().int().min(0).max(1000000),
  active: z.boolean(),
});
// Editable catalog data defaults, not client presentation colors.
export const emptyPlanetDraft: z.infer<typeof planetDraft> = {
  slug: "",
  name: "",
  englishName: null,
  icon: "🪐",
  description: "",
  primaryColor: "#808080",
  secondaryColor: "#303030",
  displayOrder: 1,
  active: true,
};
const planetDefinition = z.object({
  id: z.string().uuid(),
  draft: planetDraft,
  revision: z.string().length(64),
  links: z.array(z.object({ table: z.string(), count: z.number().int().min(0) })),
});
const membership = z.object({
  id: z.string().uuid(),
  name: z.string(),
  icon: z.string(),
  rank: z.number().int().nullable(),
});
export const planetWork = z.object({
  id: z.string().uuid(),
  title: z.string(),
  englishTitle: z.string(),
  year: z.number().nullable(),
  posterId: z.string().uuid().nullable(),
  memberships: z.array(membership),
  revision: z.string().length(64),
});
export const planetInputs = {
  planetDetail: z.strictObject({ id: z.string().uuid() }),
  planetSave: z.strictObject({
    id: planetId,
    revision: z.string().length(64).nullable(),
    draft: planetDraft,
  }),
  planetDelete: z.strictObject({
    id: z.string().uuid(),
    revision: z.string().length(64),
    confirmation: z.string().max(80),
  }),
  planetOptions: z.strictObject({}),
  planetWorks: z.strictObject({
    source: planetId,
    q: z.string().max(300).default(""),
    page: z.number().int().min(1).max(100000).default(1),
  }),
  planetMove: z.strictObject({
    source: planetId,
    destination: planetId,
    records: z
      .array(z.strictObject({ id: z.string().uuid(), revision: z.string().length(64) }))
      .min(1)
      .max(50),
  }),
};
export const planetResults = {
  planetDetail: planetDefinition,
  planetSave: z.object({ id: z.string().uuid(), created: z.boolean() }),
  planetDelete: z.object({ removed: z.literal(true) }),
  planetOptions: z.object({
    planets: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        englishName: z.string().nullable(),
        icon: z.string(),
        description: z.string(),
        active: z.boolean(),
        count: z.number(),
        displayOrder: z.number().int(),
      }),
    ),
    unassigned: z.number(),
  }),
  planetWorks: z.object({ items: z.array(planetWork), total: z.number() }),
  planetMove: z.object({ moved: z.number() }),
};

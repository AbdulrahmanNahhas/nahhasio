import { z } from "zod";

const planetId = z.string().uuid().nullable();
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

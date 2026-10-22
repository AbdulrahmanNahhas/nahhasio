import { z } from "zod";

import { displayDefaults } from "./display-preferences";

export const displaySchema = z.strictObject({
  layout: z.enum(["poster", "banner", "logo", "table"]),
  size: z.enum(["compact", "normal", "comfortable"]),
  minimal: z.boolean(),
  borderless: z.boolean(),
  showScore: z.boolean(),
  showStatus: z.boolean(),
  showMetadata: z.boolean().optional(),
  showOriginalTitle: z.boolean().optional(),
  tableColumns: z
    .array(z.enum(["release", "status", "score", "audience", "age", "watchState", "format"]))
    .max(7)
    .optional(),
  tablePosters: z.boolean().optional(),
  tableTitle: z.enum(["arabic", "english", "both"]).optional(),
  tableDensity: z.enum(["compact", "normal"]).optional(),
});
const searchSchema = z.string().max(9000);
export const preferencesSchema = z.strictObject({
  version: z.literal(1),
  search: searchSchema,
  display: displaySchema,
  presets: z
    .array(
      z.strictObject({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(60),
        search: searchSchema,
        display: displaySchema,
      }),
    )
    .max(8),
});
export type BrowsePreferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: BrowsePreferences = {
  version: 1,
  search: "",
  display: displayDefaults,
  presets: [],
};
const rememberedKeys = ["view", "filters", "privacy", "sort", "group", "from", "to"];
/** Search text stays temporary. Explicit links override the remembered view. */
export function rememberedSearch(params: URLSearchParams) {
  const search = new URLSearchParams();
  for (const key of rememberedKeys) {
    const value = params.get(key);
    if (value) search.set(key, value);
  }
  return search.toString();
}

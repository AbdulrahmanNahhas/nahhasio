import { z } from "zod";
export const editorSearchSchema = z.object({
  target: z.enum(["works", "people", "studios"]).catch("works").default("works"),
  selection: z.enum(["", "works", "people", "studios"]).catch("").default(""),
  ids: z.string().max(4000000).catch("").default(""),
});

export const workEditorSearchSchema = z.object({
  section: z
    .enum(["identity", "structure", "indexing", "editorial", "images", "awards", "references"])
    .catch("identity")
    .default("identity"),
});

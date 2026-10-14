import { z } from "zod";
export const editorSearchSchema = z.object({
  target: z.enum(["works", "people", "studios"]).catch("works").default("works"),
  ids: z.string().max(1200).catch("").default(""),
});

export const workEditorSearchSchema = z.object({
  section: z
    .enum(["identity", "structure", "indexing", "editorial", "images", "awards", "references"])
    .catch("identity")
    .default("identity"),
});

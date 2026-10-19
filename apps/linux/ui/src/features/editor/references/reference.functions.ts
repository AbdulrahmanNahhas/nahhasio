import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway } from "@/lib/bridge";
const referenceTable = z.enum([
  "genres",
  "tags",
  "tones",
  "countries",
  "planets",
  "entities",
  "roles",
  "titles",
  "award_organizations",
  "award_categories",
  "award_ceremonies",
]);
export type ReferenceTable = z.infer<typeof referenceTable>;
export async function findReferences({
  data,
  signal,
}: {
  data: {
    table: ReferenceTable;
    search: string;
    filters?: Record<string, z.infer<ReturnType<typeof z.json>>>;
  };
  signal?: AbortSignal;
}) {
  const page = rpcResults.refs.parse(
    await gateway.editorCall(
      { operation: "refs", data: rpcInputs.refs.parse({ ...data, offset: 0 }) },
      signal,
    ),
  );
  return page.rows.map((row) => ({
    id: z.string().uuid().parse(row.id),
    image: z
      .string()
      .nullable()
      .parse(row.artwork_path ?? null),
    label: String(
      row.label_ar ??
        row.name_ar ??
        row.label ??
        row.name ??
        row.title_ar ??
        row.canonical_title ??
        row.slug ??
        row.year ??
        row.id,
    ),
    value: String(row.slug ?? row.name ?? row.canonical_title ?? row.id),
    organizationId: z
      .string()
      .uuid()
      .nullable()
      .parse(row.organization_id ?? null),
    year: z
      .number()
      .nullable()
      .parse(row.year ?? null),
    entityKind: z
      .enum(["person", "organization"])
      .nullable()
      .parse(row.entity_kind ?? row.kind ?? null),
  }));
}
export type ReferenceOption = Awaited<ReturnType<typeof findReferences>>[number];

export function referenceValueFilter(table: ReferenceTable, value: string) {
  const key = z.string().uuid().safeParse(value).success
    ? "id"
    : table === "entities"
      ? "name"
      : table === "titles"
        ? "canonical_title"
        : "slug";
  return { [key]: value };
}

export function vocabularyOptions() {
  return queryOptions({
    queryKey: ["admin", "editor", "vocabulary"],
    queryFn: async ({ signal }) =>
      rpcResults.vocabulary.parse(
        await gateway.editorCall(
          {
            operation: "vocabulary",
            data: { tables: ["genres", "tags", "tones", "countries", "planets", "roles"] },
          },
          signal,
        ),
      ),
    staleTime: 300000,
  });
}

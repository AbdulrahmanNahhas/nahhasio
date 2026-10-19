import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway } from "@/lib/bridge";
export type EntityDraft = z.infer<typeof rpcInputs.entitySave>["draft"];
export type EntityDetail = z.infer<typeof rpcResults.entityDetail>;
export type EntityKind = z.infer<typeof rpcInputs.entityList>["kind"];
export const entitySearchSchema = z.object({
  q: z.string().max(300).catch("").default(""),
  person: z
    .union([z.string().uuid(), z.literal("new"), z.literal("")])
    .catch("")
    .default(""),
  page: z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/)
    .refine((value) => Number(value) <= 100000)
    .catch("1")
    .default("1"),
  image: z.enum(["all", "with", "without"]).catch("all").default("all"),
  usage: z.enum(["all", "linked", "unlinked", "one"]).catch("all").default("all"),
  role: z.string().max(80).catch("").default(""),
  language: z.string().max(35).catch("").default(""),
  sort: z.enum(["name", "works", "updated"]).catch("works").default("works"),
  view: z.enum(["grid", "table"]).catch("grid").default("grid"),
});
export type EntitySearch = z.infer<typeof entitySearchSchema>;
export const entityKeys = { all: ["admin", "entities"] as const };
export function entityListOptions(kind: EntityKind, search: EntitySearch) {
  const data = {
    kind,
    q: search.q,
    page: Number(search.page),
    image: search.image,
    usage: search.usage,
    sort: search.sort,
    role: search.role,
    language: search.language,
  };
  return queryOptions({
    queryKey: [...entityKeys.all, "list", data],
    queryFn: async ({ signal }) =>
      rpcResults.entityList.parse(
        await gateway.editorCall({ operation: "entityList", data }, signal),
      ),
    staleTime: 30000,
  });
}
export function entityDetailOptions(kind: EntityKind, id: string) {
  return queryOptions({
    queryKey: [...entityKeys.all, "detail", kind, id],
    queryFn: async ({ signal }) =>
      rpcResults.entityDetail.parse(
        await gateway.editorCall({ operation: "entityDetail", data: { kind, id } }, signal),
      ),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
export async function saveEntity(data: z.infer<typeof rpcInputs.entitySave>) {
  return rpcResults.entitySave.parse(await gateway.editorCall({ operation: "entitySave", data }));
}
export type EntityOptions = z.infer<typeof rpcResults.entityOptions>;
export function entityOptionsQuery(kind: EntityKind) {
  return queryOptions({
    queryKey: [...entityKeys.all, "options", kind],
    queryFn: async ({ signal }) =>
      rpcResults.entityOptions.parse(
        await gateway.editorCall({ operation: "entityOptions", data: { kind } }, signal),
      ),
    staleTime: 60000,
  });
}
export function entityDeletePreviewOptions(kind: EntityKind, ids: string[]) {
  return queryOptions({
    queryKey: [...entityKeys.all, "delete-preview", kind, ids],
    queryFn: async ({ signal }) =>
      rpcResults.entityDeletePreview.parse(
        await gateway.editorCall({ operation: "entityDeletePreview", data: { kind, ids } }, signal),
      ),
    staleTime: 0,
  });
}
export async function bulkDeleteEntities(data: z.infer<typeof rpcInputs.entityBulkDelete>) {
  return rpcResults.entityBulkDelete.parse(
    await gateway.editorCall({ operation: "entityBulkDelete", data }),
  );
}
export async function createRole(data: z.infer<typeof rpcInputs.entityRoleCreate>) {
  return rpcResults.entityRoleCreate.parse(
    await gateway.editorCall({ operation: "entityRoleCreate", data }),
  );
}
export function entityJsonOptions(kind: EntityKind, ids: string[]) {
  return queryOptions({
    queryKey: [...entityKeys.all, "json", kind, ids],
    queryFn: async ({ signal }) =>
      rpcResults.entityJsonRead.parse(
        await gateway.editorCall({ operation: "entityJsonRead", data: { kind, ids } }, signal),
      ),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
export async function reviewEntityJson(data: z.infer<typeof rpcInputs.entityJsonReview>) {
  return rpcResults.entityJsonReview.parse(
    await gateway.editorCall({ operation: "entityJsonReview", data }),
  );
}
export async function saveEntityJson(ticket: string) {
  return rpcResults.entityJsonSave.parse(
    await gateway.editorCall({ operation: "entityJsonSave", data: { ticket } }),
  );
}

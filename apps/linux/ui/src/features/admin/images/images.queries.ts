import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway } from "@/lib/bridge";

import type { ImageFilters } from "./images-model";
export const imageKeys = {
  all: ["admin", "images"] as const,
  list: (filters: ImageFilters) => ["admin", "images", "list", filters] as const,
  detail: (id: string) => ["admin", "images", "detail", id] as const,
};
export function imagesOptions(filters: ImageFilters) {
  return queryOptions({
    queryKey: imageKeys.list(filters),
    queryFn: async ({ signal }) =>
      rpcResults.assets.parse(
        await gateway.editorCall(
          { operation: "assets", data: rpcInputs.assets.parse(filters) },
          signal,
        ),
      ),
    staleTime: 30000,
  });
}
export function imageOptions(id: string) {
  return queryOptions({
    queryKey: imageKeys.detail(id),
    queryFn: async ({ signal }) =>
      rpcResults.assetDetail.parse(
        await gateway.editorCall({ operation: "assetDetail", data: { id } }, signal),
      ),
    staleTime: 30000,
  });
}
export function ownersOptions(input: z.infer<typeof rpcInputs.assetOwners>) {
  return queryOptions({
    queryKey: ["admin", "images", "owners", input],
    queryFn: async ({ signal }) =>
      rpcResults.assetOwners.parse(
        await gateway.editorCall({ operation: "assetOwners", data: input }, signal),
      ),
    staleTime: 15000,
  });
}
export async function assignImage(data: z.infer<typeof rpcInputs.assetAssign>) {
  return rpcResults.assetAssign.parse(await gateway.editorCall({ operation: "assetAssign", data }));
}
export async function unlinkImage(data: z.infer<typeof rpcInputs.assetUnlink>) {
  return rpcResults.assetUnlink.parse(await gateway.editorCall({ operation: "assetUnlink", data }));
}

export async function deleteImage(data: z.infer<typeof rpcInputs.assetDelete>) {
  return rpcResults.assetDelete.parse(await gateway.editorCall({ operation: "assetDelete", data }));
}

import { queryOptions } from "@tanstack/react-query";

import { nativeCall } from "@/lib/bridge";

import { artworkCacheSchema, clientInfoSchema } from "./settings-model";
export {
  artworkCacheSchema,
  clientInfoSchema,
  sections,
  sectionSchema,
  diagnosticReport,
} from "./settings-model";

export const clientInfoOptions = () =>
  queryOptions({
    queryKey: ["client-info"],
    queryFn: async ({ signal }) =>
      clientInfoSchema.parse(await nativeCall("client.info", {}, signal)),
    staleTime: 60000,
    retry: false,
  });
export const artworkCacheOptions = () =>
  queryOptions({
    queryKey: ["artwork-cache"],
    queryFn: async ({ signal }) =>
      artworkCacheSchema.parse(await nativeCall("artworkCache.status", {}, signal)),
    staleTime: 5000,
    retry: false,
  });

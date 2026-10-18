import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { nativeAvailable, nativeCall } from "@/lib/bridge";

const jobSchema = z.object({
  workId: z.string().uuid(),
  completed: z.number(),
  total: z.number(),
  running: z.boolean(),
  error: z.string().nullable(),
});
export const offlineStatusSchema = z.object({
  scope: z.string().nullable(),
  active: z.boolean(),
  offline: z.boolean(),
  name: z.string().nullable(),
  pending: z.number().int().nonnegative(),
  job: jobSchema.nullable(),
});
export const savedWorksSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      posterId: z.string().uuid().nullable(),
      savedAt: z.string(),
      images: z.number(),
      pending: z.number(),
      conflict: z.boolean(),
    }),
  )
  .max(1000);
export const offlineStatusOptions = () =>
  queryOptions({
    queryKey: ["offline", "status"],
    queryFn: async ({ signal }) =>
      offlineStatusSchema.parse(await nativeCall("offline.status", {}, signal)),
    enabled: nativeAvailable(),
    networkMode: "always",
    refetchInterval: 3000,
    retry: false,
  });
export const savedWorksOptions = () =>
  queryOptions({
    queryKey: ["offline", "works"],
    queryFn: async ({ signal }) =>
      savedWorksSchema.parse(await nativeCall("offline.list", {}, signal)),
    networkMode: "always",
    refetchInterval: 5000,
    retry: false,
  });
export async function changeOfflineMode(client: QueryClient, accountId?: string) {
  await client.cancelQueries();
  await nativeCall(accountId ? "offline.open" : "offline.close", accountId ? { accountId } : {});
  client.clear();
  window.dispatchEvent(new Event("nahhasio:server-changed"));
  window.location.hash = "#/downloads";
  await client.invalidateQueries();
}
export const syncSavedWorks = async () =>
  z
    .object({
      synced: z.number(),
      conflicts: z.array(z.string().uuid()),
    })
    .parse(await nativeCall("offline.sync", {}, undefined, 120000));

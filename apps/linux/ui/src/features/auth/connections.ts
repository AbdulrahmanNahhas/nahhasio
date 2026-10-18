import { ServerInfoSchema } from "@nahhasio/api-contract";
import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { nativeCall } from "@/lib/bridge";

const savedServer = z.object({ url: z.string().url().max(2048), name: z.string().min(1).max(80) });
export const connectionsSchema = z.object({
  selected: z.string().url(),
  servers: z.array(savedServer).min(1).max(8),
});
export type SavedServer = z.infer<typeof savedServer>;
export const connectionKey = ["connections"] as const;
export const connectionsOptions = () =>
  queryOptions({
    queryKey: connectionKey,
    queryFn: async ({ signal }) =>
      connectionsSchema.parse(await nativeCall("servers.list", {}, signal)),
    networkMode: "always",
    staleTime: Infinity,
  });
export const probeServer = async (url: string, signal?: AbortSignal) =>
  z
    .object({ url: z.string().url(), info: ServerInfoSchema })
    .parse(await nativeCall("servers.probe", { url }, signal));
export const probeOptions = (url: string | undefined) =>
  queryOptions({
    queryKey: ["connection-status", url],
    queryFn: ({ signal }) => probeServer(url ?? "", signal),
    enabled: Boolean(url),
    staleTime: 30000,
    networkMode: "always",
  });
export async function selectServer(client: QueryClient, input: SavedServer) {
  await client.cancelQueries();
  const state = connectionsSchema.parse(await nativeCall("servers.select", input));
  await client.cancelQueries();
  client.clear();
  client.setQueryData(connectionKey, state);
  client.setQueryData(["session"], null);
  window.dispatchEvent(new Event("nahhasio:server-changed"));
  await client.invalidateQueries({ queryKey: ["session"] });
  return state;
}
export async function updateServer(
  command: "servers.save" | "servers.remove",
  server: SavedServer,
) {
  return connectionsSchema.parse(await nativeCall(command, server));
}

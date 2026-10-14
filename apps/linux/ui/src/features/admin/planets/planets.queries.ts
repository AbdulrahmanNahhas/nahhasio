import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway } from "@/lib/bridge";

export const planetSearchSchema = z.object({
  source: z
    .union([z.string().uuid(), z.literal("none")])
    .catch("none")
    .default("none"),
  q: z.string().max(300).catch("").default(""),
  page: z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/)
    .refine((value) => Number(value) <= 100000)
    .catch("1")
    .default("1"),
});
export type PlanetSearch = z.infer<typeof planetSearchSchema>;
export type PlanetWork = z.infer<typeof rpcResults.planetWorks>["items"][number];
export type PlanetDraft = z.infer<typeof rpcInputs.planetSave>["draft"];
export type PlanetDetail = z.infer<typeof rpcResults.planetDetail>;
export const planetKeys = ["admin", "planets"] as const;
export const planetOptionsQuery = () =>
  queryOptions({
    queryKey: [...planetKeys, "options"],
    queryFn: async ({ signal }) =>
      rpcResults.planetOptions.parse(
        await gateway.editorCall({ operation: "planetOptions", data: {} }, signal),
      ),
    staleTime: 30000,
  });
export function planetWorksQuery(search: PlanetSearch) {
  const data = {
    source: search.source === "none" ? null : search.source,
    q: search.q,
    page: Number(search.page),
  };
  return queryOptions({
    queryKey: [...planetKeys, "works", data],
    queryFn: async ({ signal }) =>
      rpcResults.planetWorks.parse(
        await gateway.editorCall({ operation: "planetWorks", data }, signal),
      ),
    staleTime: 30000,
  });
}
export async function moveWorks(data: z.infer<typeof rpcInputs.planetMove>) {
  return rpcResults.planetMove.parse(await gateway.editorCall({ operation: "planetMove", data }));
}
export function planetDetailQuery(id: string) {
  return queryOptions({
    queryKey: [...planetKeys, "detail", id],
    queryFn: async ({ signal }) =>
      rpcResults.planetDetail.parse(
        await gateway.editorCall({ operation: "planetDetail", data: { id } }, signal),
      ),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
export async function savePlanet(data: z.infer<typeof rpcInputs.planetSave>) {
  return rpcResults.planetSave.parse(await gateway.editorCall({ operation: "planetSave", data }));
}
export async function deletePlanet(data: z.infer<typeof rpcInputs.planetDelete>) {
  return rpcResults.planetDelete.parse(
    await gateway.editorCall({ operation: "planetDelete", data }),
  );
}

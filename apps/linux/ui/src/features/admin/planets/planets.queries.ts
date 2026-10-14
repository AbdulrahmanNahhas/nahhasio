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

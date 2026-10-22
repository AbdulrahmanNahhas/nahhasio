import { queryOptions } from "@tanstack/react-query";

import { gateway } from "@/lib/bridge";

export const serverOverviewQuery = () =>
  queryOptions({
    queryKey: ["admin", "server", "overview"],
    queryFn: ({ signal }) => gateway.serverOverview(signal),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
export const serverSettingsQuery = () =>
  queryOptions({
    queryKey: ["admin", "server", "settings"],
    queryFn: ({ signal }) => gateway.serverSettings(signal),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

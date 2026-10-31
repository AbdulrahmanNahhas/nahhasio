import { queryOptions } from "@tanstack/react-query";

import { gateway } from "@/lib/bridge";

export const homeOptions = () =>
  queryOptions({
    queryKey: ["catalog", "home"],
    queryFn: ({ signal }) => gateway.home(signal),
    staleTime: 30000,
  });

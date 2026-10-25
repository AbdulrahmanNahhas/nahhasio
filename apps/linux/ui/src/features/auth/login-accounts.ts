import { queryOptions } from "@tanstack/react-query";

import { gateway, nativeAvailable } from "@/lib/bridge";

export const loginAccountsOptions = (server: string | undefined, enabled = true) =>
  queryOptions({
    queryKey: ["login-accounts", server],
    queryFn: ({ signal }) => gateway.loginAccounts(signal),
    enabled: Boolean(server) && enabled && nativeAvailable(),
    networkMode: "always",
    staleTime: 30000,
    gcTime: 0,
    retry: false,
  });

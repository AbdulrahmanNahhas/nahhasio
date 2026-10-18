import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { gateway, nativeAvailable, nativeCall } from "@/lib/bridge";

import { connectionsOptions } from "../auth/connections";
import {
  preferencesSchema,
  defaultPreferences,
  type BrowsePreferences,
} from "./browse-preferences-model";
export {
  defaultPreferences,
  rememberedSearch,
  type BrowsePreferences,
} from "./browse-preferences-model";

export function useBrowsePreferences() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });
  const connections = useQuery(connectionsOptions());
  const scope = `${connections.data?.selected ?? ""}:${session.data?.user.accountId ?? ""}`;
  const key = ["native", "browse-preferences", scope] as const;
  const enabled = nativeAvailable() && Boolean(session.data && connections.data);
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      preferencesSchema.nullable().parse(await nativeCall("browsePreferences.load", {}, signal)) ??
      defaultPreferences,
    enabled,
    networkMode: "always",
    staleTime: Infinity,
    retry: false,
  });
  const save = useMutation({
    scope: { id: `browse-preferences:${scope}` },
    mutationFn: async (value: BrowsePreferences) => {
      const parsed = preferencesSchema.parse(value);
      if (!enabled) throw new Error("لم يكتمل تحميل حساب المكتبة؛ أعد المحاولة.");
      z.object({ ok: z.literal(true) }).parse(await nativeCall("browsePreferences.save", parsed));
    },
    onMutate: (value) => {
      client.setQueryData(key, value);
    },
    networkMode: "always",
    retry: false,
  });
  return { query, save, scope, loading: enabled && query.isPending };
}

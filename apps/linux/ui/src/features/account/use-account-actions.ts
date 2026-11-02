import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { gateway } from "@/lib/bridge";

import { switchAccount } from "../auth/remembered-accounts";
import { changeOfflineMode } from "../player/saved-works-data";
import { navigate } from "../shell/navigation";

export function useAccountActions(accountId: string) {
  const client = useQueryClient();
  const local = useMutation({
    networkMode: "always",
    mutationFn: () => changeOfflineMode(client, accountId),
    onError: (error) => toast.add({ type: "error", title: error.message }),
  });
  const switching = useMutation({
    networkMode: "always",
    mutationFn: () => switchAccount(client),
    onSuccess: () => navigate("/home"),
  });
  const logout = useMutation({
    mutationFn: gateway.logout,
    onSettled: async () => {
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      });
      client.setQueryData(["session"], null);
      window.dispatchEvent(new Event("nahhasio:signed-out"));
      navigate("/home");
    },
  });
  return { local, switching, logout };
}

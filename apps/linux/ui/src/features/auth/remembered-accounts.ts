import { SessionSchema } from "@nahhasio/api-contract";
import type { QueryClient } from "@tanstack/react-query";

import { nativeCall } from "@/lib/bridge";

export async function switchAccount(client: QueryClient, accountId?: string) {
  await client.cancelQueries();
  try {
    const session = SessionSchema.nullable().parse(
      await nativeCall("accounts.switch", { accountId: accountId ?? null }),
    );
    return session;
  } finally {
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
    client.setQueryData(["session"], null);
    window.dispatchEvent(new Event("nahhasio:session-changed"));
  }
}

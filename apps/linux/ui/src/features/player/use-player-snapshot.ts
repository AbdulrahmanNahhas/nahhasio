import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/toast";
import { nativeAvailable, nativeCall } from "@/lib/bridge";

import { callPlayer, type PlayerRequest, type PlayerSnapshot } from "./bridge";

export const playerSnapshotKey = ["native", "player", "snapshot"] as const;

// Ordering metadata only. The authoritative snapshot lives exclusively in Query.
const coordinators = new WeakMap<QueryClient, { revision: number; closed: Set<string> }>();
function coordinator(client: QueryClient) {
  let value = coordinators.get(client);
  if (!value) {
    value = { revision: 0, closed: new Set() };
    coordinators.set(client, value);
  }
  return value;
}

export function usePlayerSnapshot() {
  const client = useQueryClient();
  const order = coordinator(client);
  const query = useQuery({
    queryKey: playerSnapshotKey,
    enabled: nativeAvailable(),
    queryFn: async ({ signal }) => {
      const revision = order.revision;
      const next = await callPlayer({ command: "player.status", payload: {} }, signal);
      const current = client.getQueryData<PlayerSnapshot>(playerSnapshotKey);
      if (revision !== order.revision || (next.sessionId && order.closed.has(next.sessionId))) {
        if (current) return current;
        throw new Error("وصل تحديث قديم للمشغّل.");
      }
      if (current?.sessionId && current.sessionId !== next.sessionId) {
        order.closed.add(current.sessionId);
      }
      return next;
    },
    refetchInterval: (value) => (value.state.data?.active ? 250 : 1000),
    refetchIntervalInBackground: false,
    staleTime: 0,
    retry: false,
    networkMode: "always",
  });
  const mutation = useMutation({
    mutationKey: ["native", "player", "command"],
    scope: { id: "native-player" },
    networkMode: "always",
    mutationFn: async (request: PlayerRequest) => {
      // Commands and polling cannot race to replace one another's snapshots.
      order.revision += 1;
      await client.cancelQueries({ queryKey: playerSnapshotKey, exact: true });
      try {
        if ("sessionId" in request.payload) {
          const current = client.getQueryData<PlayerSnapshot>(playerSnapshotKey);
          if (
            current?.sessionId !== request.payload.sessionId ||
            order.closed.has(request.payload.sessionId)
          ) {
            throw new Error("انتهت جلسة هذا الفيديو.");
          }
        }
        if (request.command === "player.close") {
          const snapshot = client.getQueryData<PlayerSnapshot>(playerSnapshotKey);
          const saved = client.getQueryData<readonly { id: string }[]>(["offline", "works"]);
          const scope = client.getQueryData<{ scope: string | null }>(["offline", "status"])?.scope;
          if (
            scope &&
            snapshot?.workId &&
            snapshot.installmentId &&
            snapshot.sourceKind &&
            snapshot.duration > 0 &&
            saved?.some((work) => work.id === snapshot.workId)
          ) {
            try {
              await nativeCall(
                "offline.progress",
                {
                  workId: snapshot.workId,
                  scope,
                  installmentId: snapshot.installmentId,
                  episodeId: snapshot.episodeId ?? null,
                  positionSeconds: Math.floor(snapshot.position),
                  durationSeconds: Math.floor(snapshot.duration),
                },
                undefined,
                5000,
              );
            } catch {
              toast.add({ type: "error", title: "تعذّر حفظ آخر تقدم للمشاهدة على الجهاز" });
            }
          }
        }
        const next = await callPlayer(request);
        if (request.command === "player.close") order.closed.add(request.payload.sessionId);
        if (next.sessionId && order.closed.has(next.sessionId))
          throw new Error("وصل تحديث لجلسة مغلقة.");
        const current = client.getQueryData<PlayerSnapshot>(playerSnapshotKey);
        if (current?.sessionId && current.sessionId !== next.sessionId) {
          order.closed.add(current.sessionId);
        }
        client.setQueryData(playerSnapshotKey, next);
        return next;
      } finally {
        order.revision += 1;
        await client.cancelQueries({ queryKey: playerSnapshotKey, exact: true });
        await client.invalidateQueries({ queryKey: playerSnapshotKey, exact: true });
      }
    },
    retry: false,
  });
  return {
    snapshot: query.data,
    error: mutation.error ?? query.error,
    pending: mutation.isPending,
    command: mutation.mutate,
    commandAsync: mutation.mutateAsync,
  };
}

export type PlayerController = ReturnType<typeof usePlayerSnapshot>;

// Library playback uses the same ordering guard as the native player controls.
export async function runPlayerAction(client: QueryClient, action: () => Promise<PlayerSnapshot>) {
  const order = coordinator(client);
  const revision = ++order.revision;
  await client.cancelQueries({ queryKey: playerSnapshotKey, exact: true });
  try {
    const next = await action();
    if (order.revision === revision && !(next.sessionId && order.closed.has(next.sessionId))) {
      const current = client.getQueryData<PlayerSnapshot>(playerSnapshotKey);
      if (current?.sessionId && current.sessionId !== next.sessionId)
        order.closed.add(current.sessionId);
      client.setQueryData(playerSnapshotKey, next);
    }
  } finally {
    order.revision += 1;
    await client.cancelQueries({ queryKey: playerSnapshotKey, exact: true });
    await client.invalidateQueries({ queryKey: playerSnapshotKey, exact: true });
  }
}

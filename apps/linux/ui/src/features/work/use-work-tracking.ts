import type { TrackingChange } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { gateway } from "../../lib/bridge";
import type { WatchedSelection } from "../../lib/bridge";

export const workStateKey = (id: string) => ["viewer", "work", id] as const;

export function useWorkTracking(id: string, enabled = true) {
  const client = useQueryClient();
  const state = useQuery({
    queryKey: workStateKey(id),
    enabled,
    networkMode: "always",
    queryFn: ({ signal }) => gateway.workState(id, signal),
  });
  const indexes = useMemo(() => {
    const unitByEpisode = new Map<string, NonNullable<typeof state.data>["units"][number]>();
    const unitsByInstallment = new Map<string, NonNullable<typeof state.data>["units"]>();
    for (const unit of state.data?.units ?? []) {
      if (unit.episodeId !== null) unitByEpisode.set(unit.episodeId, unit);
      const units = unitsByInstallment.get(unit.installmentId) ?? [];
      units.push(unit);
      unitsByInstallment.set(unit.installmentId, units);
    }
    return { unitByEpisode, unitsByInstallment };
  }, [state.data]);
  const refresh = async (next: Awaited<ReturnType<typeof gateway.workState>>) => {
    await client.cancelQueries({ queryKey: workStateKey(id) });
    client.setQueryData(workStateKey(id), next);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["catalog"] }),
      client.invalidateQueries({ queryKey: ["home"] }),
    ]);
  };
  const favorite = useMutation({
    mutationFn: (isFavorite: boolean) => gateway.setFavorite(id, isFavorite),
    onSuccess: refresh,
  });
  const watched = useMutation({
    networkMode: "always",
    mutationFn: (selection: WatchedSelection) => gateway.setWatched(id, selection),
    onSuccess: refresh,
  });
  const progress = useMutation({
    mutationFn: (change: TrackingChange) => gateway.syncTracking(id, change),
    onSuccess: refresh,
    onError: () => {
      void client.invalidateQueries({ queryKey: workStateKey(id) });
    },
  });
  return {
    state,
    ...indexes,
    favorite,
    watched,
    progress,
    pending: favorite.isPending || watched.isPending,
    error: watched.error ?? favorite.error,
  };
}
export type WorkTracking = ReturnType<typeof useWorkTracking>;

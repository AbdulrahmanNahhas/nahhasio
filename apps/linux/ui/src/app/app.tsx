import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Login } from "../features/auth/login";
import { Library } from "../features/library/library";
import { PlayerHost, usePlayerSnapshot } from "../features/player";
import { DownloadDialog } from "../features/player/download-dialog";
import type { PlayerEpisode } from "../features/player/episode-panel";
import { openWatch } from "../features/player/playback";
import { savedDownloadOptions } from "../features/player/saved-downloads";
import {
  WatchTargetSchema,
  watchRequestEvent,
  type WatchTarget,
} from "../features/player/watch-request";
import { episodeNumberLabel, pickArtwork } from "../features/work/format";
import { gateway } from "../lib/bridge";
export function App() {
  const client = useQueryClient();
  const player = usePlayerSnapshot();
  const playerCommandAsync = player.commandAsync;
  const requestGeneration = useRef(0);
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null);
  const [download, setDownload] = useState<{ target: WatchTarget; sessionId: string } | null>(null);
  const playing = Boolean(player.snapshot?.active);

  useEffect(() => {
    const watch = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const parsed = WatchTargetSchema.safeParse(event.detail);
      if (!parsed.success) return;
      if (parsed.data.intent === "download") {
        setDownload({ target: parsed.data, sessionId: crypto.randomUUID() });
        return;
      }
      const generation = ++requestGeneration.current;
      setWatchTarget(null);
      void openWatch(parsed.data, { commandAsync: playerCommandAsync }, client)
        .finally(() => {
          if (generation === requestGeneration.current) setWatchTarget(parsed.data);
        })
        .catch(() => {
          // Source errors live in the source query/native snapshot, not fake playback state.
        });
    };
    window.addEventListener(watchRequestEvent, watch);
    return () => window.removeEventListener(watchRequestEvent, watch);
  }, [playerCommandAsync, client]);

  useEffect(() => {
    // Native video is beneath WebKit. Restore the ordinary page surface on exit.
    document.body.classList.toggle("bg-background", !playing);
    return () => document.body.classList.add("bg-background");
  }, [playing]);

  useEffect(() => {
    const clear = () => {
      requestGeneration.current++;
      setWatchTarget(null);
      if (player.snapshot?.sessionId)
        void playerCommandAsync({
          command: "player.close",
          payload: { sessionId: player.snapshot.sessionId },
        }).catch(() => {});
      void client.cancelQueries().then(() => {
        client.removeQueries({
          predicate: (query) => query.queryKey[0] !== "session" && query.queryKey[0] !== "native",
        });
        setDownload(null);
        client.setQueryData(["session"], null);
        return undefined;
      });
    };
    window.addEventListener("nahhasio:signed-out", clear);
    return () => window.removeEventListener("nahhasio:signed-out", clear);
  }, [client, player.snapshot?.sessionId, playerCommandAsync]);

  useEffect(() => {
    const changed = () => {
      requestGeneration.current++;
      setWatchTarget(null);
      setDownload(null);
    };
    window.addEventListener("nahhasio:server-changed", changed);
    return () => window.removeEventListener("nahhasio:server-changed", changed);
  }, []);

  const session = useQuery({
    queryKey: ["session"],
    networkMode: "always",
    queryFn: ({ signal }) => gateway.session(signal),
    refetchInterval: 60000,
  });

  const saved = useQuery({
    ...savedDownloadOptions(),
    enabled: Boolean(session.data) && playing,
    refetchInterval: 5000,
  });
  const watchWork = useQuery({
    queryKey: ["work", player.snapshot?.workId ?? watchTarget?.workId],
    queryFn: ({ signal }) => gateway.work(player.snapshot?.workId ?? watchTarget!.workId, signal),
    enabled:
      playing &&
      (player.snapshot?.sourceKind !== "local" || Boolean(player.snapshot.workId)) &&
      Boolean(player.snapshot?.workId ?? watchTarget),
  });
  const selectedInstallment =
    watchWork.data?.installments.find(
      (installment) =>
        installment.id === (player.snapshot?.installmentId ?? watchTarget?.installmentId),
    ) ?? watchWork.data?.installments[0];
  const episodes: PlayerEpisode[] | undefined =
    player.snapshot?.sourceKind === "local" && !player.snapshot.workId
      ? undefined
      : selectedInstallment?.episodes
          .toSorted((a, b) => a.position - b.position)
          .map((episode) => {
            const number = episodeNumberLabel(episode.number);
            return {
              id: episode.id,
              number,
              title: episode.title || `الحلقة ${number}`,
              detail: `الحلقة ${number}`,
              image:
                pickArtwork(episode.artwork, "still") ??
                pickArtwork(episode.artwork, "banner") ??
                pickArtwork(selectedInstallment.artwork, "banner") ??
                pickArtwork(watchWork.data?.artwork ?? [], "banner"),
              summary: episode.summary,
              runtimeMinutes: episode.runtimeMinutes,
              downloaded:
                saved.data?.some(
                  (file) =>
                    file.available &&
                    file.target.workId === watchWork.data?.id &&
                    file.target.episodeId === episode.id,
                ) ?? false,
              disabled: episode.releaseState === "upcoming",
              disabledReason:
                episode.releaseState === "upcoming" ? "قادم" : "موعد الإصدار غير معروف",
              current: episode.id === (player.snapshot?.episodeId ?? watchTarget?.episodeId),
            };
          });
  if (playing && session.data)
    return (
      <PlayerHost
        player={player}
        episodes={episodes}
        installmentTitle={selectedInstallment?.title}
        sourceTarget={player.snapshot?.sourceKind === "local" ? null : watchTarget}
        onSelectEpisode={(episode) => {
          if (!watchTarget || !selectedInstallment) return;
          const selectedEpisode = selectedInstallment.episodes.find(
            (item) => item.id === episode.id,
          );
          if (!selectedEpisode || selectedEpisode.releaseState === "upcoming") return;
          const number = episodeNumberLabel(selectedEpisode.number);
          const title = `الحلقة ${number}${selectedEpisode.title ? ` · ${selectedEpisode.title}` : ""}`;
          const target = {
            ...watchTarget,
            intent: "watch" as const,
            installmentId: selectedInstallment.id,
            episodeId: episode.id,
            title: `${watchWork.data?.titleAr || watchWork.data?.canonicalTitle} · ${title}`,
          };
          const generation = ++requestGeneration.current;
          setWatchTarget(null);
          void openWatch(target, { commandAsync: playerCommandAsync }, client)
            .finally(() => {
              if (generation === requestGeneration.current) setWatchTarget(target);
            })
            .catch(() => {});
        }}
      />
    );

  if (!session.data)
    return <Login restoring={session.isLoading} sessionError={session.error?.message} />;

  return (
    <>
      <Library user={session.data.user} />
      {download && (
        <DownloadDialog
          key={download.sessionId}
          target={download.target}
          sessionId={download.sessionId}
          onClose={() => setDownload(null)}
        />
      )}
    </>
  );
}

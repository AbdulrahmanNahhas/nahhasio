import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, FolderOpen, Globe, Link2, Radio, SkipForward, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { nativeCall } from "@/lib/bridge";

import { AnimeSource } from "./anime-source";
import { DirectLinkForm } from "./browser-playback";
import { HomeSources } from "./home-sources";
import { ProviderMenu } from "./provider-browser";
import { TorrentSources } from "./source-controls";
import {
  embedAction,
  embedStatusKey,
  embedStatusOptions,
  offerKey,
  openEmbed,
  providerOptions,
  type ProviderOffer,
} from "./stream-providers";
import { playerSnapshotKey, type PlayerController } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";

type Mode = "torrent" | "embed" | "direct";
const priority = [
  "vidora",
  "vidrift",
  "cinextream",
  "vidsrc",
  "vidnest",
  "vidlink",
  "vidzee",
] satisfies ProviderOffer["provider"][];

function orderedOffers(offers: ProviderOffer[], anime: boolean) {
  const ordered = priority.flatMap((provider) =>
    offers.filter((offer) => offer.provider === provider && offer.available),
  );
  const isFallback = (offer: ProviderOffer) =>
    offer.audio === "sub" || (anime && offer.provider === "vidzee");
  return [...ordered.filter((offer) => !isFallback(offer)), ...ordered.filter(isFallback)];
}

type Action =
  | { kind: "open"; offer: ProviderOffer }
  | { kind: "present" | "close" | "file" }
  | { kind: "switch"; mode: Mode };

export function SourceControls(props: {
  target: WatchTarget | null;
  player: PlayerController;
  onPlaybackStarted?: () => void;
}) {
  const sessionId = props.player.snapshot?.sessionId ?? "";
  return (
    <SessionSelection
      key={`${sessionId}:${props.target?.workId}:${props.target?.installmentId}:${props.target?.episodeId}`}
      {...props}
      sessionId={sessionId}
    />
  );
}

function SessionSelection({
  sessionId,
  target,
  player,
  onPlaybackStarted,
}: {
  sessionId: string;
  target: WatchTarget | null;
  player: PlayerController;
  onPlaybackStarted?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("torrent");
  const tried = useRef(new Set<string>());
  const client = useQueryClient();
  const listing = useQuery(providerOptions(sessionId, target));
  const status = useQuery(embedStatusOptions(sessionId));
  const torrentOpening = useIsMutating({ mutationKey: ["native", "source", sessionId] });
  const animeOpening = useIsMutating({ mutationKey: ["anime", "play", sessionId] });
  useEffect(() => {
    if (!sessionId) return;
    const refresh = () =>
      void client.invalidateQueries({ queryKey: embedStatusKey(sessionId), exact: true });
    window.addEventListener("nahhasio:embed-state", refresh);
    return () => window.removeEventListener("nahhasio:embed-state", refresh);
  }, [client, sessionId]);
  function pickFile() {
    void player
      .commandAsync({ command: "player.pickVideo", payload: {} })
      .then((next) => {
        if (next.sourceKind === "local") onPlaybackStarted?.();
        return next;
      })
      .catch(() => {});
  }
  const action = useMutation({
    mutationKey: ["native", "embed-action", sessionId],
    scope: { id: "native-embed" },
    onMutate: (request) => {
      if (request.kind === "open") tried.current.add(offerKey(request.offer));
    },
    mutationFn: async (request: Action) => {
      if (request.kind === "open") {
        if (!target) throw new Error("اختر عملًا من المكتبة أولًا.");
        return openEmbed(sessionId, request.offer, target);
      }
      return embedAction(sessionId, request.kind === "present" ? "present" : "close");
    },
    onSuccess: (next, request) => {
      client.setQueryData(embedStatusKey(sessionId), next);
      if (request.kind === "switch") setMode(request.mode);
      if (request.kind === "file") pickFile();
    },
    networkMode: "always",
    retry: false,
  });
  const direct = useMutation({
    mutationFn: (url: string) =>
      nativeCall("stream.direct", {
        sessionId,
        url,
        target: {
          workId: target?.workId,
          installmentId: target?.installmentId ?? null,
          episodeId: target?.episodeId ?? null,
        },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: playerSnapshotKey, exact: true });
      onPlaybackStarted?.();
    },
    retry: false,
  });
  const opened = Boolean(status.data && status.data.phase !== "closed");
  const busy =
    action.isPending ||
    direct.isPending ||
    player.pending ||
    torrentOpening > 0 ||
    animeOpening > 0 ||
    !sessionId;
  const error = action.error ?? direct.error ?? listing.error ?? status.error;
  const filesOnly = listing.data?.filesOnly;
  const offers = listing.data?.providers ?? [];
  const ranked = listing.data?.providers;
  const anime = listing.data?.anime ?? false;
  const phase = status.data?.phase;
  const openSource = action.mutate;
  const failedToOpen = action.isError && action.variables?.kind === "open";
  useEffect(() => {
    if (mode !== "embed" || !ranked || busy || !target) return;
    if (phase !== "failed" && !failedToOpen && tried.current.size > 0) return;
    if (phase === "loading" || phase === "loaded") return;
    const ordered = orderedOffers(ranked, anime).filter(
      (offer) => !tried.current.has(offerKey(offer)),
    );
    const next = ordered.find((offer) => offer.preferred) ?? ordered[0];
    if (next) {
      tried.current.add(offerKey(next));
      openSource({ kind: "open", offer: next });
    }
  }, [anime, busy, failedToOpen, mode, openSource, phase, ranked, target]);
  const selected = offers.find(
    (offer) => offer.provider === status.data?.provider && offer.audio === status.data?.audio,
  );
  const ordered = orderedOffers(offers, anime);
  const selectedIndex = selected ? ordered.indexOf(selected) : -1;
  const nextProvider = selectedIndex >= 0 ? ordered[selectedIndex + 1] : undefined;
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
      aria-label="اختيار طريقة المشاهدة"
    >
      <HomeSources target={target} player={player} onPlaybackStarted={onPlaybackStarted} />
      {filesOnly ? (
        <p className="text-sm text-muted-foreground">هذا العمل يُشغّل من الملفات فقط.</p>
      ) : (
        <Tabs
          value={mode}
          className="min-h-0 flex-1 gap-4"
          onValueChange={(value) => {
            if (value !== "torrent" && value !== "embed" && value !== "direct") return;
            action.reset();
            direct.reset();
            if (opened && value !== "embed") action.mutate({ kind: "switch", mode: value });
            else setMode(value);
          }}
        >
          <div className="flex shrink-0 items-center gap-2">
            <TabsList
              className="h-auto min-w-0 flex-1 flex-wrap justify-start"
              aria-label="طريقة المشاهدة"
            >
              <TabsTrigger value="torrent" disabled={busy || listing.isPending || listing.isError}>
                <Radio data-icon="inline-start" />
                تورنت
              </TabsTrigger>
              <TabsTrigger value="embed" disabled={busy || listing.isPending || listing.isError}>
                <Globe data-icon="inline-start" />
                خوادم الفيديو
              </TabsTrigger>
              {target && (
                <TabsTrigger value="direct" disabled={busy}>
                  <Link2 data-icon="inline-start" />
                  فتح رابط فيديو
                </TabsTrigger>
              )}
            </TabsList>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label="خيارات المصدر"
                  />
                }
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={busy}
                    onClick={() => (opened ? action.mutate({ kind: "file" }) : pickFile())}
                  >
                    <FolderOpen data-icon="inline-start" />
                    فتح فيديو من الجهاز
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 scroll-fade-y overflow-y-auto overscroll-contain px-1 py-2">
            {error && (
              <Alert variant="destructive" className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <AlertTitle>تعذّر تجهيز المصدر</AlertTitle>
                  <AlertDescription>{error.message}</AlertDescription>
                </div>
                {listing.isError && (
                  <Button variant="outline" size="sm" onClick={() => void listing.refetch()}>
                    إعادة المحاولة
                  </Button>
                )}
              </Alert>
            )}
            <TabsContent value="direct">
              <DirectLinkForm busy={busy} onPlay={(url) => direct.mutate(url)} />
            </TabsContent>
            {listing.isPending && mode !== "direct" && (
              <div className="flex flex-col gap-3" role="status" aria-label="جارٍ تجهيز المصادر">
                <Skeleton className="h-10" />
                <Skeleton className="h-32" />
              </div>
            )}
            {listing.isSuccess && (
              <TabsContent value="torrent">
                <TorrentSources
                  target={target}
                  player={player}
                  onPlaybackStarted={onPlaybackStarted}
                />
              </TabsContent>
            )}
            {listing.isSuccess && (
              <TabsContent value="embed" className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ProviderMenu
                    offers={offers}
                    anime={listing.data?.anime}
                    selected={selected}
                    disabled={busy}
                    onSelect={(offer) => action.mutate({ kind: "open", offer })}
                  />
                  {nextProvider && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="المصدر التالي"
                      title={`المصدر التالي · ${nextProvider.name}`}
                      disabled={busy}
                      onClick={() => action.mutate({ kind: "open", offer: nextProvider })}
                    >
                      <SkipForward className="rtl:rotate-180" />
                    </Button>
                  )}
                  {selected && opened && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => action.mutate({ kind: "present" })}
                    >
                      إظهار المشغّل
                    </Button>
                  )}
                </div>
                {status.data?.error && (
                  <Alert variant="destructive">
                    <AlertTitle>تعذّر تحميل المشغّل</AlertTitle>
                    <AlertDescription>{status.data.error}</AlertDescription>
                  </Alert>
                )}
                {opened && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => action.mutate({ kind: "close" })}
                  >
                    <X data-icon="inline-start" />
                    إغلاق المشغّل
                  </Button>
                )}
                {listing.data?.anime && target && (
                  <details className="rounded-xl border border-border p-4">
                    <summary className="cursor-pointer font-medium">بحث مباشر عن بث الأنمي</summary>
                    <div className="pt-4">
                      <AnimeSource
                        sessionId={sessionId}
                        target={target}
                        query={listing.data.animeQuery ?? target.title}
                        onPlaybackStarted={onPlaybackStarted}
                      />
                    </div>
                  </details>
                )}
              </TabsContent>
            )}
          </div>
        </Tabs>
      )}
    </section>
  );
}

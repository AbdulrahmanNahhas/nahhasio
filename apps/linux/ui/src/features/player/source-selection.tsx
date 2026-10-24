import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, FolderOpen, Globe, Radio, Tv, X } from "lucide-react";
import { useEffect, useState } from "react";

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

import { AnimeSource } from "./anime-source";
import { ProviderBrowser } from "./provider-browser";
import { TorrentSources } from "./source-controls";
import {
  embedAction,
  embedStatusKey,
  embedStatusOptions,
  openEmbed,
  providerOptions,
  type ProviderOffer,
} from "./stream-providers";
import type { PlayerController } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";

type Mode = "torrent" | "anime" | "embed";
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
  const client = useQueryClient();
  const listing = useQuery(providerOptions(sessionId, target));
  const status = useQuery(embedStatusOptions(sessionId));
  const torrentOpening = useIsMutating({ mutationKey: ["native", "source", sessionId] });
  const animeOpening = useIsMutating({ mutationKey: ["anime", "play", sessionId] });
  useEffect(() => {
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
  const opened = Boolean(status.data && status.data.phase !== "closed");
  const busy =
    action.isPending || player.pending || torrentOpening > 0 || animeOpening > 0 || !sessionId;
  const error = action.error ?? listing.error ?? status.error;
  const filesOnly = listing.data?.filesOnly;
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
      aria-label="اختيار طريقة المشاهدة"
    >
      {filesOnly ? (
        <>
          <Alert>
            <AlertTitle>ملفات فقط</AlertTitle>
            <AlertDescription>المشاهدة من الملفات المرتبطة أو من الجهاز.</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => (opened ? action.mutate({ kind: "file" }) : pickFile())}
          >
            <FolderOpen data-icon="inline-start" />
            فتح فيديو من الجهاز
          </Button>
        </>
      ) : (
        <Tabs
          value={mode}
          className="min-h-0 flex-1 gap-4"
          onValueChange={(value) => {
            if (value !== "torrent" && value !== "anime" && value !== "embed") return;
            action.reset();
            if (opened && value !== "embed") action.mutate({ kind: "switch", mode: value });
            else setMode(value);
          }}
        >
          <div className="flex shrink-0 items-center gap-2">
            <TabsList className="min-w-0 flex-1" aria-label="طريقة المشاهدة">
              <TabsTrigger value="torrent" disabled={busy || listing.isPending || listing.isError}>
                <Radio data-icon="inline-start" />
                تورنت
              </TabsTrigger>
              {listing.data?.anime && target && (
                <TabsTrigger value="anime" disabled={busy}>
                  <Tv data-icon="inline-start" />
                  بث الأنمي
                </TabsTrigger>
              )}
              <TabsTrigger value="embed" disabled={busy || listing.isPending || listing.isError}>
                <Globe data-icon="inline-start" />
                خوادم الفيديو
              </TabsTrigger>
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
            {listing.isPending ? (
              <div className="flex flex-col gap-3" role="status" aria-label="جارٍ تجهيز المصادر">
                <Skeleton className="h-10" />
                <Skeleton className="h-32" />
              </div>
            ) : (
              listing.isSuccess && (
                <>
                  <TabsContent value="torrent">
                    <TorrentSources
                      target={target}
                      player={player}
                      onPlaybackStarted={onPlaybackStarted}
                    />
                  </TabsContent>
                  {listing.data.anime && target && (
                    <TabsContent value="anime">
                      <AnimeSource
                        sessionId={sessionId}
                        target={target}
                        query={listing.data.animeQuery ?? target.title}
                        onPlaybackStarted={onPlaybackStarted}
                      />
                    </TabsContent>
                  )}
                  <TabsContent value="embed">
                    <ProviderBrowser
                      offers={listing.data.providers}
                      anime={listing.data.anime}
                      busy={busy}
                      status={status.data}
                      onOpen={(offer) => action.mutate({ kind: "open", offer })}
                      onPresent={() => action.mutate({ kind: "present" })}
                    />
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
                  </TabsContent>
                </>
              )
            )}
          </div>
        </Tabs>
      )}
    </section>
  );
}

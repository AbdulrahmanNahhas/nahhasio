import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Radio, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

type Action = { kind: "open"; offer: ProviderOffer } | { kind: "present" | "close" | "torrent" };
export function SourceControls(props: {
  target: WatchTarget | null;
  player: PlayerController;
  onPlaybackStarted?: () => void;
}) {
  const sessionId = props.player.snapshot?.sessionId ?? "";
  return (
    <SessionSelection
      key={`${sessionId}:${props.target?.installmentId}:${props.target?.episodeId}`}
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
  const [mode, setMode] = useState<"embed" | "torrent">("embed");
  const client = useQueryClient();
  const listing = useQuery(providerOptions(sessionId, target));
  const status = useQuery(embedStatusOptions(sessionId));
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: embedStatusKey(sessionId), exact: true });
    };
    window.addEventListener("nahhasio:embed-state", refresh);
    return () => window.removeEventListener("nahhasio:embed-state", refresh);
  }, [client, sessionId]);
  const action = useMutation({
    mutationKey: ["native", "embed-action", sessionId],
    scope: { id: "native-embed" },
    mutationFn: async (request: Action) => {
      if (request.kind === "open") {
        if (!target) throw new Error("اختر عملًا من المكتبة أولًا.");
        return openEmbed(sessionId, request.offer, target);
      }
      return embedAction(sessionId, request.kind === "torrent" ? "close" : request.kind);
    },
    onSuccess: (next, request) => {
      client.setQueryData(embedStatusKey(sessionId), next);
      if (request.kind === "torrent") setMode("torrent");
    },
    networkMode: "always",
    retry: false,
  });
  const opened = status.data && status.data.phase !== "closed";
  const busy = action.isPending || player.pending || !sessionId;
  const error = action.error ?? listing.error ?? status.error;
  if (listing.data?.filesOnly)
    return (
      <Alert>
        <AlertTitle>ملفات فقط</AlertTitle>
        <AlertDescription>المشاهدة من الملفات المرتبطة أو من الجهاز.</AlertDescription>
      </Alert>
    );
  const options = (
    <div className="flex min-w-0 flex-col gap-4">
      <ToggleGroup
        aria-label="طريقة المشاهدة"
        value={[mode]}
        variant="outline"
        spacing={1}
        disabled={busy || listing.isPending || listing.isError}
        onValueChange={(values: string[]) => {
          action.reset();
          if (values[0] === "embed") setMode("embed");
          if (values[0] === "torrent") {
            if (opened) action.mutate({ kind: "torrent" });
            else setMode("torrent");
          }
        }}
      >
        <ToggleGroupItem value="torrent">
          <Radio data-icon="inline-start" />
          تورنت
        </ToggleGroupItem>
        <ToggleGroupItem value="embed">
          <Globe data-icon="inline-start" />
          خوادم الفيديو
        </ToggleGroupItem>
      </ToggleGroup>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تجهيز المصدر</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
          {listing.isError && (
            <Button variant="outline" size="sm" onClick={() => void listing.refetch()}>
              إعادة المحاولة
            </Button>
          )}
        </Alert>
      )}
      {listing.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="جارٍ تجهيز المزوّدين">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : mode === "torrent" ? (
        <TorrentSources target={target} player={player} onPlaybackStarted={onPlaybackStarted} />
      ) : (
        <ProviderBrowser
          offers={listing.data?.providers ?? []}
          anime={listing.data?.anime ?? false}
          busy={busy}
          status={status.data}
          onOpen={(offer) => action.mutate({ kind: "open", offer })}
          onPresent={() => action.mutate({ kind: "present" })}
        />
      )}
      {mode === "embed" && status.data?.error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل المشغّل</AlertTitle>
          <AlertDescription>{status.data.error}</AlertDescription>
        </Alert>
      )}
      {opened && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => action.mutate({ kind: "close" })}
          >
            <X data-icon="inline-start" />
            إغلاق المشغّل
          </Button>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              حالة الحماية والمزوّد
            </summary>
            <p className="mt-2">
              الحماية المحلية: {status.data?.filterReady ? "جاهزة" : "غير مؤكدة"} · النوافذ
              المحجوبة: {status.data?.blockedPopups ?? 0} · تقدم المشاهدة غير متصل
            </p>
          </details>
        </div>
      )}
    </div>
  );
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="اختيار طريقة المشاهدة">
      {listing.data?.anime && target ? (
        <>
          <AnimeSource
            sessionId={sessionId}
            target={target}
            query={listing.data.animeQuery ?? target.title}
            onPlaybackStarted={onPlaybackStarted}
          />
          <Collapsible>
            <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
              تريد المزيد؟ التورنت وخوادم الفيديو
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">{options}</CollapsibleContent>
          </Collapsible>
        </>
      ) : (
        options
      )}
    </section>
  );
}

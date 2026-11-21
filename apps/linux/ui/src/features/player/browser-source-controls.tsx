import type { WorkDetail } from "@nahhasio/api-contract";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { WorkTracking } from "@/features/work/use-work-tracking";
import { nativeCall } from "@/lib/bridge";

import { BrowserEmbeds } from "./browser-embeds";
import { BrowserVideo, DirectLinkForm } from "./browser-playback";
import { browserSources } from "./browser-providers";
import { HomeSources } from "./home-sources";
import type { PlayerController } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";

export function BrowserSourceControls({
  work,
  target,
  player,
  navigation,
  videoRef,
  tracking,
}: {
  work: WorkDetail;
  target: WatchTarget;
  player: PlayerController;
  navigation: ReactNode;
  videoRef: RefObject<HTMLDivElement | null>;
  tracking: WorkTracking;
}) {
  const [view, setView] = useState<
    { kind: "embed" | "direct" } | { kind: "video"; url: string; home: boolean }
  >({ kind: "embed" });
  const filesOnly = work.playbackPolicy === "files-only";
  const homeUrl = view.kind === "video" && view.home ? view.url : null;
  useEffect(() => {
    if (!homeUrl) return;
    return () => {
      void nativeCall("browser.homeClose", { url: homeUrl }).catch(() => {});
    };
  }, [homeUrl]);

  const unit = target.episodeId ? tracking.unitByEpisode.get(target.episodeId) : undefined;
  const record = tracking.progress.mutate;
  const lastAttempt = useRef(0);
  const recordCompletion = useCallback(
    (position: number, duration: number) => {
      const current = Math.floor(position);
      const length = Math.floor(duration);
      const now = Date.now();
      if (
        !unit?.isReleased ||
        unit.isPlayed ||
        unit.playedManually ||
        !Number.isSafeInteger(length) ||
        length <= 0 ||
        length > 31536000 ||
        !Number.isSafeInteger(current) ||
        current < 0 ||
        current > length ||
        current * 10 < length * 9 ||
        now - lastAttempt.current < 10000
      )
        return;
      lastAttempt.current = now;
      record({
        installmentId: unit.installmentId,
        episodeId: unit.episodeId,
        expectedUpdatedAt: unit.updatedAt,
        expectedRevision: unit.revision,
        isPlayed: null,
        positionSeconds: current,
        durationSeconds: length,
      });
    },
    [record, unit],
  );
  const listing = view.kind === "embed" && !filesOnly ? browserSources(work, target) : null;
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="مصادر الفيديو">
      {listing ? (
        <BrowserEmbeds
          sources={listing.sources}
          anime={listing.anime}
          identity={listing.identity}
          onProgress={recordCompletion}
          navigation={navigation}
          videoRef={videoRef}
        >
          <HomeSources
            inMenu
            target={target}
            player={player}
            onBrowserPlay={(url) => setView({ kind: "video", url, home: true })}
          />
          <DropdownMenuItem onClick={() => setView({ kind: "direct" })}>
            فتح رابط فيديو
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <span>تورنت</span>
            <span className="ms-auto text-xs">تطبيق Linux</span>
          </DropdownMenuItem>
        </BrowserEmbeds>
      ) : (
        <>
          <div
            ref={videoRef}
            className="flex aspect-video min-h-0 flex-col overflow-hidden rounded-xl bg-background sm:rounded-2xl"
            aria-label="منطقة الفيديو"
          >
            {view.kind === "video" ? (
              <BrowserVideo
                key={view.url}
                url={view.url}
                onProgress={view.home ? recordCompletion : undefined}
              />
            ) : view.kind === "direct" ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <DirectLinkForm
                  busy={false}
                  onPlay={(url) => setView({ kind: "video", url, home: false })}
                />
              </div>
            ) : (
              <p className="grid flex-1 place-items-center p-4 text-center">
                هذا العمل يُشغّل من الملفات فقط.
              </p>
            )}
          </div>
          <div
            className="flex min-w-0 items-center justify-between gap-2"
            aria-label="أدوات المشاهدة"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {!filesOnly && (
                <Button variant="outline" size="sm" onClick={() => setView({ kind: "embed" })}>
                  خوادم الفيديو
                </Button>
              )}
              {filesOnly && (
                <HomeSources
                  target={target}
                  player={player}
                  onBrowserPlay={(url) => setView({ kind: "video", url, home: true })}
                />
              )}
            </div>
            {navigation}
          </div>
        </>
      )}
    </section>
  );
}

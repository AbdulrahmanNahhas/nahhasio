import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";

import { Failure } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/features/editor/fields/work-fields";
import { episodeNumberLabel, pickArtwork } from "@/features/work/format";
import { useWorkTracking } from "@/features/work/use-work-tracking";
import { WorkDiscussion } from "@/features/work/work-discussion";

import { BrowserSourceControls } from "./browser-source-controls";
import { MovieInfo } from "./movie-info";
import { MovieInstallments } from "./movie-installments";
import { PlayerHost } from "./player-host";
import { isUpcomingTarget } from "./release-eligibility";
import { savedDownloadOptions } from "./saved-downloads";
import { SourceControls } from "./source-selection";
import type { PlayerController } from "./use-player-snapshot";
import { useVideoViewport, VideoBackdrop } from "./use-video-viewport";
import { WatchAbout, WatchActions, WatchDetails, WatchEpisodeNavigation } from "./watch-details";
import { WatchEpisodeSidebar } from "./watch-episode-sidebar";
import type { WatchTarget } from "./watch-request";

type Part = WorkDetail["installments"][number];
type Episode = Part["episodes"][number];

const sidebarBreakpoint = "(min-width: 80rem)";

function subscribeToSidebarWidth(onChange: () => void) {
  const query = window.matchMedia(sidebarBreakpoint);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function hasDesktopSidebarWidth() {
  return window.matchMedia(sidebarBreakpoint).matches;
}

export function WatchPage({
  player,
  sourceReady,
  work,
  target,
  accountId,
  offline,
  onWatch,
  onLeave,
  browserPreview,
  startupError,
  error,
  onRetry,
}: {
  player: PlayerController;
  sourceReady: boolean;
  work?: WorkDetail;
  target: WatchTarget | null;
  accountId?: string;
  offline: boolean;
  onWatch: (target: WatchTarget) => void;
  onLeave: () => void;
  browserPreview: boolean;
  startupError: Error | null;
  error?: Error | null;
  onRetry: () => void;
}) {
  const s = player.snapshot;
  const nativeHeader = s?.active && document.documentElement.hasAttribute("data-native-shell");
  const [theaterRequested, setTheater] = useState(false);
  const wide = useSyncExternalStore(subscribeToSidebarWidth, hasDesktopSidebarWidth);
  const theater = wide && theaterRequested;
  const [episodesOpen, setEpisodesOpen] = useState(true);
  const catalogVideo = Boolean(work || target?.workId || s?.workId);
  const [browsePart, setBrowsePart] = useState("");
  const tracking = useWorkTracking(work?.id ?? "", Boolean(work));
  const video = useRef<HTMLDivElement>(null);
  const viewport = useVideoViewport(video, s?.sessionId, s?.fullscreen ?? false);
  const saved = useQuery({
    ...savedDownloadOptions(),
    enabled: !browserPreview,
    refetchInterval: 5000,
  });
  const playingPart =
    work?.installments.find((unit) => unit.id === (target?.installmentId ?? s?.installmentId)) ??
    work?.installments[0];
  const isStandalone = playingPart?.kind === "movie" || playingPart?.kind === "special";
  const singleStandalone = isStandalone && work?.installments.length === 1;
  const mixedWork = Boolean(
    work?.installments.some((item) => item.kind === "season") &&
    work.installments.some((item) => item.kind !== "season"),
  );
  const movieCollection =
    isStandalone && !mixedWork && Boolean(work && work.installments.length > 1);
  const hasEpisodeNavigation =
    !isStandalone && Boolean(work) && (s?.sourceKind !== "local" || Boolean(s?.workId));
  const hasSidebar = hasEpisodeNavigation || singleStandalone || movieCollection || mixedWork;
  const sidebarLabel = theater ? "إظهار القائمة الجانبية" : "إخفاء القائمة الجانبية";
  const part = work?.installments.find((unit) => unit.id === browsePart) ?? playingPart;
  const partStatus =
    part?.id === playingPart?.id ? (s?.sourceKind ? "playing" : "selected") : "browsing";
  const mixedStandalone = mixedWork && Boolean(part && part.kind !== "season");
  const showEpisodeSidebar = !mixedStandalone && (hasEpisodeNavigation || mixedWork);
  const parts = work?.installments.toSorted((a, b) => a.position - b.position) ?? [];
  const partIndex = parts.findIndex((item) => item.id === part?.id);
  const beforePart = parts[partIndex - 1];
  const afterPart = parts[partIndex + 1];
  function browse(id: string) {
    setBrowsePart(id);
  }
  const partSelector = work && part && (
    <SelectField
      alignItemWithTrigger={false}
      hideLabel
      label="الأجزاء والمواسم"
      value={part.id}
      items={parts.map((item) => ({
        value: item.id,
        label: `${item.title} · ${item.kind === "movie" ? "فيلم" : item.kind === "special" ? "عرض خاص" : item.episodes.length ? `${item.episodes.length} حلقة` : item.kind === "season" ? "موسم" : "عرض خاص"}`,
      }))}
      onChange={browse}
    />
  );
  const episode = playingPart?.episodes.find(
    (item) => item.id === (target?.episodeId ?? s?.episodeId),
  );
  const title = episode
    ? episode.title || `الحلقة ${episodeNumberLabel(episode.number)}`
    : playingPart?.title || target?.title || s?.title || "المشاهدة";
  const actions = work && (
    <WatchActions
      work={work}
      part={playingPart}
      episode={episode}
      title={title}
      tracking={tracking}
      onLeave={onLeave}
    />
  );
  function choose(selectedPart: Part, selectedEpisode?: Episode) {
    if (!work || isUpcomingTarget(selectedPart, selectedEpisode)) return;
    setBrowsePart(selectedPart.id);
    onWatch({
      workId: work.id,
      installmentId: selectedPart.id,
      episodeId: selectedEpisode?.id,
      intent: "watch",
      title: `${work.titleAr || work.canonicalTitle} · ${selectedEpisode?.title || selectedPart.title}`,
    });
  }
  const ordered = playingPart?.episodes.toSorted((a, b) => a.position - b.position) ?? [];
  const currentIndex = ordered.findIndex((item) => item.id === episode?.id);
  const previous = ordered[currentIndex - 1];
  const next = ordered[currentIndex + 1];
  function episodeProgress(item: Episode) {
    if (item.id === episode?.id && s?.sourceKind && s.duration > 0)
      return Math.min(100, (s.position / s.duration) * 100);
    const state = tracking.unitByEpisode.get(item.id);
    return state && !state.isPlayed && state.durationSeconds
      ? Math.min(100, (state.positionSeconds / state.durationSeconds) * 100)
      : 0;
  }
  const episodeNavigation = (
    <WatchEpisodeNavigation
      onPrevious={
        hasEpisodeNavigation && playingPart && previous && !isUpcomingTarget(playingPart, previous)
          ? () => choose(playingPart, previous)
          : undefined
      }
      onNext={
        hasEpisodeNavigation && playingPart && next && !isUpcomingTarget(playingPart, next)
          ? () => choose(playingPart, next)
          : undefined
      }
    />
  );
  const browserControls = import.meta.env.DEV && browserPreview && work && target && !error;
  const actualVideo = (
    <div
      ref={video}
      className={
        s?.fullscreen
          ? "fixed inset-0"
          : s?.sourceKind
            ? "relative aspect-video w-full overflow-hidden sm:rounded-2xl"
            : "relative min-h-96 w-full overflow-hidden rounded-xl md:aspect-video md:rounded-2xl xl:min-h-112"
      }
      aria-label="منطقة الفيديو"
    >
      <PlayerHost
        player={player}
        embedded
        hideEpisodes={!hasEpisodeNavigation}
        sourceTarget={sourceReady ? target : null}
        installmentTitle={playingPart?.title}
        episodes={(isStandalone ? [] : ordered).map((item) => ({
          id: item.id,
          title: item.title || `الحلقة ${episodeNumberLabel(item.number)}`,
          number: item.number,
          summary: item.summary,
          runtimeMinutes: item.runtimeMinutes,
          image: item.still ?? pickArtwork(item.artwork, "still"),
          current: item.id === episode?.id,
          disabled: playingPart ? isUpcomingTarget(playingPart, item) : false,
          disabledReason: "قادم",
        }))}
        onSelectEpisode={(item) => {
          const selected = ordered.find((candidate) => candidate.id === item.id);
          if (selected && playingPart) choose(playingPart, selected);
        }}
      />
      {!s?.sourceKind && !s?.fullscreen && (
        <div
          className="absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 md:rounded-2xl xl:p-6"
          aria-label="مصادر الفيديو"
        >
          {import.meta.env.DEV && browserPreview ? (
            error ? (
              <Failure error={error} retry={onRetry} />
            ) : (
              <p role="status">جارٍ تحميل مصادر الفيديو…</p>
            )
          ) : startupError ? (
            <Failure error={startupError} retry={target ? () => onWatch(target) : undefined} />
          ) : target && sourceReady && s?.sessionId ? (
            <SourceControls target={target} player={player} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <p>
                {target || s?.buffering
                  ? "جارٍ تجهيز مصادر الفيديو…"
                  : "اختر ملفًا من جهازك لبدء المشاهدة"}
              </p>
              {!catalogVideo && (
                <Button
                  onClick={() => player.command({ command: "player.pickVideo", payload: {} })}
                >
                  فتح فيديو من الجهاز
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
  if (s?.fullscreen)
    return <div className="fixed inset-0 isolate bg-transparent">{actualVideo}</div>;
  return (
    <main
      id="main-content"
      className="fixed inset-0 isolate overflow-y-auto bg-transparent"
      dir="rtl"
      aria-label="صفحة المشاهدة"
    >
      <VideoBackdrop viewport={viewport} />
      {!nativeHeader && !work && (
        <header className="mx-auto flex max-w-screen-2xl items-center gap-2 px-3 py-1.5 sm:px-6 xl:pt-2 xl:pb-0">
          <Button variant="ghost" onClick={onLeave}>
            <ArrowRight data-icon="inline-start" />
            العودة
          </Button>
        </header>
      )}
      <div
        className={
          theater || !hasSidebar
            ? "mx-auto flex max-w-screen-2xl flex-col gap-5 px-4 py-3 sm:px-6"
            : "mx-auto flex max-w-screen-2xl flex-col gap-5 px-4 py-3 sm:px-6 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start"
        }
      >
        <div className="flex min-w-0 flex-col gap-4 xl:col-start-1">
          {work && (
            <header className="flex min-w-0 items-start gap-2" aria-label="أدوات العمل">
              <div className="min-w-0 flex-1">{actions}</div>
              {wide && hasSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={sidebarLabel}
                  aria-expanded={!theater}
                  title={sidebarLabel}
                  onClick={() => setTheater((value) => !value)}
                >
                  {theater ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              )}
            </header>
          )}
          {browserControls ? (
            <BrowserSourceControls
              key={`${target.workId}:${target.installmentId}:${target.episodeId}`}
              work={work}
              target={target}
              player={player}
              navigation={episodeNavigation}
              videoRef={video}
              tracking={tracking}
            />
          ) : (
            <div className="flex min-w-0 flex-col gap-2">
              {actualVideo}
              {episodeNavigation}
            </div>
          )}
          <WatchDetails
            work={work}
            part={playingPart}
            episode={episode}
            title={title}
            onLeave={onLeave}
          />
          {error && <Failure error={error} retry={onRetry} />}
        </div>
        {hasSidebar && !theater && (
          <div className="contents xl:sticky xl:top-4 xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:block xl:min-w-0 xl:self-start">
            {singleStandalone && work && playingPart && (
              <MovieInfo
                work={work}
                installment={playingPart}
                offline={offline}
                onLeave={onLeave}
                status={s?.sourceKind ? "playing" : "selected"}
              />
            )}
            {movieCollection && work && playingPart && (
              <MovieInstallments
                work={work}
                selectedId={playingPart.id}
                playing={Boolean(s?.sourceKind)}
                pending={player.pending}
                tracking={tracking}
                offline={offline}
                onLeave={onLeave}
                onSelect={(item) =>
                  choose(item, item.kind === "season" ? item.episodes[0] : undefined)
                }
              />
            )}
            {mixedStandalone && work && part && (
              <MovieInfo
                work={work}
                installment={part}
                status={partStatus}
                offline={offline}
                onLeave={onLeave}
                selector={partSelector}
                showRecommendations={false}
                navigation={
                  <>
                    <Button
                      disabled={
                        player.pending ||
                        (part.id === playingPart?.id && Boolean(s?.sourceKind)) ||
                        isUpcomingTarget(part)
                      }
                      onClick={() => choose(part)}
                    >
                      {part.id === playingPart?.id && s?.sourceKind
                        ? "قيد التشغيل"
                        : part.kind === "special"
                          ? "مشاهدة العرض الخاص"
                          : "مشاهدة الفيلم"}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        disabled={!beforePart}
                        onClick={() => {
                          if (beforePart) browse(beforePart.id);
                        }}
                      >
                        <ChevronRight data-icon="inline-start" />
                        الجزء السابق
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!afterPart}
                        onClick={() => {
                          if (afterPart) browse(afterPart.id);
                        }}
                      >
                        الجزء التالي
                        <ChevronLeft data-icon="inline-end" />
                      </Button>
                    </div>
                  </>
                }
              />
            )}
            {showEpisodeSidebar && part && work && (
              <WatchEpisodeSidebar
                key={part.id}
                activeId={episode?.id}
                playing={Boolean(s?.sourceKind && !s.paused && !s.ended)}
                pending={player.pending}
                disabled={isUpcomingTarget(part)}
                expanded={episodesOpen}
                onExpand={() => setEpisodesOpen(!episodesOpen)}
                onChoose={(item) => {
                  choose(part, item);
                  if (!wide) video.current?.closest("main")?.scrollTo({ top: 0 });
                }}
                season={
                  parts.length > 1 ? (
                    partSelector
                  ) : (
                    <h2 className="text-base font-semibold">{part.title}</h2>
                  )
                }
                rows={part.episodes.map((item) => ({
                  episode: item,
                  imageId: (item.still ?? pickArtwork(item.artwork, "still") ?? work.banner)?.id,
                  state: tracking.unitByEpisode.get(item.id),
                  downloaded:
                    saved.data?.some(
                      (file) =>
                        file.available &&
                        file.target.workId === work.id &&
                        file.target.episodeId === item.id,
                    ) ?? false,
                  progress: episodeProgress(item),
                }))}
              />
            )}
          </div>
        )}
        {work && <WatchAbout work={work} part={playingPart} episode={episode} />}
        {work ? (
          <div className="min-w-0 border-t border-border pt-4 xl:col-start-1">
            <WorkDiscussion key={work.id} id={work.id} accountId={accountId} offline={offline} />
          </div>
        ) : error || !catalogVideo ? null : (
          <Skeleton className="h-28 xl:col-start-1" />
        )}
      </div>
    </main>
  );
}

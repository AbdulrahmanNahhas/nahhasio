import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownUp,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Eye,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Artwork } from "@/components/artwork";
import { Failure } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemGroup } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/features/editor/fields/work-fields";
import { episodeNumberLabel, pickArtwork } from "@/features/work/format";
import { useWorkTracking } from "@/features/work/use-work-tracking";

import { MovieInfo } from "./movie-info";
import { MovieInstallments } from "./movie-installments";
import { PlayerHost } from "./player-host";
import { savedDownloadOptions } from "./saved-downloads";
import { SourceControls } from "./source-selection";
import type { PlayerController } from "./use-player-snapshot";
import { useVideoViewport, VideoBackdrop } from "./use-video-viewport";
import { WatchDetails } from "./watch-details";
import { WatchDiscussion } from "./watch-discussion";
import type { WatchTarget } from "./watch-request";

type Part = WorkDetail["installments"][number];
type Episode = Part["episodes"][number];
export function WatchPage({
  player,
  sourceReady,
  work,
  target,
  accountId,
  offline,
  onWatch,
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
  error?: Error | null;
  onRetry: () => void;
}) {
  const s = player.snapshot!;
  const nativeHeader = document.documentElement.hasAttribute("data-native-shell");
  const [theater, setTheater] = useState(false);
  useEffect(() => {
    const toggle = () => setTheater((value) => !value);
    window.addEventListener("nahhasio:toggle-episodes", toggle);
    return () => window.removeEventListener("nahhasio:toggle-episodes", toggle);
  }, []);
  const [episodesOpen, setEpisodesOpen] = useState(false);
  const catalogVideo = Boolean(work || target?.workId || s.workId);
  const [browsePart, setBrowsePart] = useState("");
  const [search, setSearch] = useState("");
  const [descending, setDescending] = useState(false);
  const [unwatched, setUnwatched] = useState(false);
  const tracking = useWorkTracking(work?.id ?? "", Boolean(work));
  const video = useRef<HTMLDivElement>(null);
  const viewport = useVideoViewport(video, s.sessionId ?? "", s.fullscreen);
  const saved = useQuery({ ...savedDownloadOptions(), refetchInterval: 5000 });
  const playingPart =
    work?.installments.find((unit) => unit.id === (target?.installmentId ?? s.installmentId)) ??
    work?.installments[0];
  const isStandalone = playingPart?.kind === "movie" || playingPart?.kind === "special";
  const singleStandalone = isStandalone && work?.installments.length === 1;
  const mixedWork = Boolean(
    work?.installments.some((item) => item.kind === "season") &&
    work.installments.some((item) => item.kind !== "season"),
  );
  const movieCollection =
    isStandalone && !mixedWork && Boolean(work && work.installments.length > 1);
  const hasEpisodeNavigation = !isStandalone && Boolean(work) && s.sourceKind !== "local";
  const hasSidebar = hasEpisodeNavigation || singleStandalone || movieCollection || mixedWork;
  const part = work?.installments.find((unit) => unit.id === browsePart) ?? playingPart;
  const partStatus =
    part?.id === playingPart?.id ? (s.sourceKind ? "playing" : "selected") : "browsing";
  const mixedStandalone = mixedWork && Boolean(part && part.kind !== "season");
  const showEpisodeSidebar = !mixedStandalone && (hasEpisodeNavigation || mixedWork);
  const parts = work?.installments.toSorted((a, b) => a.position - b.position) ?? [];
  const partIndex = parts.findIndex((item) => item.id === part?.id);
  const beforePart = parts[partIndex - 1];
  const afterPart = parts[partIndex + 1];
  function browse(id: string) {
    setBrowsePart(id);
    setSearch("");
  }
  const partSelector = work && part && (
    <SelectField
      alignItemWithTrigger={false}
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
    (item) => item.id === (target?.episodeId ?? s.episodeId),
  );
  const title = episode
    ? episode.title || `الحلقة ${episodeNumberLabel(episode.number)}`
    : playingPart?.title || s.title;
  function choose(selectedPart: Part, selectedEpisode?: Episode) {
    if (
      !work ||
      selectedEpisode?.releaseState === "upcoming" ||
      selectedPart.status === "announced" ||
      selectedPart.releaseState === "upcoming"
    )
      return;
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
  const episodes =
    part?.episodes
      .filter((item) => !unwatched || !tracking.unitByEpisode.get(item.id)?.isPlayed)
      .filter((item) =>
        `${item.number} ${item.title ?? ""}`
          .normalize("NFKD")
          .replace(/\p{M}|ـ/gu, "")
          .toLowerCase()
          .includes(
            search
              .normalize("NFKD")
              .replace(/\p{M}|ـ/gu, "")
              .trim()
              .toLowerCase(),
          ),
      )
      .toSorted((a, b) => (descending ? b.position - a.position : a.position - b.position)) ?? [];
  function episodeProgress(item: Episode) {
    if (item.id === episode?.id && s.sourceKind && s.duration > 0)
      return Math.min(100, (s.position / s.duration) * 100);
    const state = tracking.unitByEpisode.get(item.id);
    return state && !state.isPlayed && state.durationSeconds
      ? Math.min(100, (state.positionSeconds / state.durationSeconds) * 100)
      : 0;
  }
  const close = () =>
    player.command({ command: "player.close", payload: { sessionId: s.sessionId! } });
  const actualVideo = (
    <div
      ref={video}
      className={
        s.fullscreen
          ? "fixed inset-0"
          : s.sourceKind
            ? "relative aspect-video w-full overflow-hidden rounded-2xl"
            : "relative min-h-112 w-full overflow-hidden rounded-2xl sm:aspect-video"
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
          disabled: item.releaseState === "upcoming",
          disabledReason: "قادم",
        }))}
        onSelectEpisode={(item) => {
          const selected = ordered.find((candidate) => candidate.id === item.id);
          if (selected && playingPart) choose(playingPart, selected);
        }}
      />
      {!s.sourceKind && !s.fullscreen && (
        <div
          className="absolute inset-0 flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-6"
          aria-label="مصادر الفيديو"
        >
          {target && sourceReady ? (
            <SourceControls target={target} player={player} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <p>
                {target || s.buffering
                  ? "جارٍ تجهيز مصادر الفيديو…"
                  : "اختر ملفًا من جهازك لبدء المشاهدة"}
              </p>
              <Button onClick={() => player.command({ command: "player.pickVideo", payload: {} })}>
                فتح فيديو من الجهاز
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
  if (s.fullscreen)
    return <div className="fixed inset-0 isolate bg-transparent">{actualVideo}</div>;
  return (
    <main
      id="main-content"
      className="fixed inset-0 isolate overflow-y-auto bg-transparent"
      dir="rtl"
      aria-label="صفحة المشاهدة"
    >
      <VideoBackdrop viewport={viewport} />
      {!nativeHeader && (
        <header className="flex items-center justify-between gap-4 bg-background px-4 py-3 sm:px-6">
          <Button variant="ghost" onClick={close}>
            <ArrowLeft data-icon="inline-start" />
            العودة
          </Button>
          {hasSidebar && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                theater
                  ? singleStandalone || mixedStandalone
                    ? "إظهار معلومات الفيلم"
                    : movieCollection
                      ? "إظهار قائمة الأفلام"
                      : "إظهار قائمة الحلقات"
                  : "توسيع الفيديو"
              }
              title="وضع المسرح"
              onClick={() => setTheater(!theater)}
            >
              {theater ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          )}
        </header>
      )}
      <div
        className={
          theater || !hasSidebar
            ? "mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 pb-8 sm:px-6"
            : "mx-auto grid max-w-screen-2xl items-start gap-6 px-4 pb-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
        }
      >
        <div className="flex min-w-0 flex-col gap-5 xl:mt-4">
          {actualVideo}
          <WatchDetails
            work={work}
            part={playingPart}
            episode={episode}
            title={title}
            tracking={tracking}
            onLeave={close}
            onPrevious={
              hasEpisodeNavigation && previous && previous.releaseState !== "upcoming"
                ? () => {
                    if (playingPart) choose(playingPart, previous);
                  }
                : undefined
            }
            onNext={
              hasEpisodeNavigation && next && next.releaseState !== "upcoming"
                ? () => {
                    if (playingPart) choose(playingPart, next);
                  }
                : undefined
            }
          />
          {error && <Failure error={error} retry={onRetry} />}
        </div>
        {singleStandalone && work && playingPart && !theater && (
          <MovieInfo
            work={work}
            installment={playingPart}
            offline={offline}
            onLeave={close}
            status={s.sourceKind ? "playing" : "selected"}
          />
        )}
        {movieCollection && work && playingPart && !theater && (
          <MovieInstallments
            work={work}
            selectedId={playingPart.id}
            playing={Boolean(s.sourceKind)}
            pending={player.pending}
            tracking={tracking}
            offline={offline}
            onLeave={close}
            onSelect={(item) => choose(item, item.kind === "season" ? item.episodes[0] : undefined)}
          />
        )}
        {mixedStandalone && work && part && !theater && (
          <MovieInfo
            work={work}
            installment={part}
            status={partStatus}
            offline={offline}
            onLeave={close}
            selector={partSelector}
            showRecommendations={false}
            navigation={
              <>
                <Button
                  disabled={
                    player.pending ||
                    (part.id === playingPart?.id && Boolean(s.sourceKind)) ||
                    part.status === "announced" ||
                    part.releaseState === "upcoming"
                  }
                  onClick={() => choose(part)}
                >
                  {part.id === playingPart?.id && s.sourceKind
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
        {showEpisodeSidebar && !theater && (
          <aside
            className="flex max-h-[calc(100dvh-6rem)] min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 xl:sticky xl:top-4 xl:row-span-2"
            aria-label="حلقات العمل"
          >
            <Button
              className="xl:hidden"
              variant="ghost"
              aria-expanded={episodesOpen}
              onClick={() => setEpisodesOpen(!episodesOpen)}
            >
              {episodesOpen ? "إخفاء الحلقات" : `إظهار الحلقات · ${part?.episodes.length ?? 0}`}
            </Button>
            <div
              className={
                episodesOpen
                  ? "flex min-h-0 flex-1 flex-col gap-4"
                  : "hidden min-h-0 flex-1 flex-col gap-4 xl:flex"
              }
            >
              {work && part ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold">الحلقات</h2>
                    <Badge variant="outline">{part.episodes.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {partStatus === "playing"
                      ? "قيد التشغيل"
                      : partStatus === "selected"
                        ? "المحدد للمشاهدة"
                        : "تستعرض هذا الجزء"}
                  </p>
                  {work.installments.length > 1 ? (
                    partSelector
                  ) : (
                    <p className="text-sm text-muted-foreground">{part.title}</p>
                  )}
                  <InputGroup>
                    <InputGroupAddon>
                      <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                      value={search}
                      placeholder="ابحث عن حلقة…"
                      aria-label="بحث في الحلقات"
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </InputGroup>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">{episodes.length} حلقة</span>
                    <Button
                      variant={unwatched ? "secondary" : "ghost"}
                      size="sm"
                      aria-label="إظهار غير المشاهدة فقط"
                      title="غير المشاهدة فقط"
                      aria-pressed={unwatched}
                      onClick={() => setUnwatched(!unwatched)}
                    >
                      <Eye data-icon="inline-start" />
                      غير المشاهدة
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDescending(!descending)}>
                      <ArrowDownUp />
                      {descending ? "الأحدث أولًا" : "الأقدم أولًا"}
                    </Button>
                  </div>
                  <ItemGroup
                    className="min-h-0 flex-1 scroll-fade-y overflow-y-auto"
                    aria-label="قائمة الحلقات"
                  >
                    {episodes.map((item) => (
                      <div role="listitem" key={item.id}>
                        <Item
                          size="xs"
                          variant={item.id === episode?.id ? "muted" : "default"}
                          className="flex-nowrap items-start text-start"
                          render={
                            <button
                              type="button"
                              disabled={
                                player.pending ||
                                item.releaseState === "upcoming" ||
                                part.status === "announced"
                              }
                              aria-current={item.id === episode?.id ? "true" : undefined}
                              onClick={() => choose(part, item)}
                            />
                          }
                        >
                          <div className="relative w-24 shrink-0">
                            <Artwork
                              id={
                                (
                                  item.still ??
                                  pickArtwork(item.artwork, "still") ??
                                  pickArtwork(part.artwork, "banner") ??
                                  work.banner
                                )?.id
                              }
                              alt=""
                              className="aspect-video w-full rounded-lg object-cover"
                            />
                            <span className="absolute start-1 top-1">
                              <Badge variant="secondary">{episodeNumberLabel(item.number)}</Badge>
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <strong className="line-clamp-2 text-sm font-medium" dir="auto">
                              {item.title || `الحلقة ${episodeNumberLabel(item.number)}`}
                            </strong>
                            <span className="text-xs text-muted-foreground">
                              {item.runtimeMinutes ? `${item.runtimeMinutes} دقيقة` : ""}
                            </span>
                            {item.id === episode?.id && (
                              <span className="text-xs text-primary">
                                {s.sourceKind ? "قيد التشغيل" : "الحلقة المحددة"}
                              </span>
                            )}
                            {tracking.unitByEpisode.get(item.id)?.isPlayed && (
                              <span className="text-xs text-muted-foreground">تمّت المشاهدة</span>
                            )}
                            {episodeProgress(item) > 0 && (
                              <Progress
                                value={episodeProgress(item)}
                                aria-label={`تقدم الحلقة ${episodeNumberLabel(item.number)}`}
                              />
                            )}
                            {item.releaseState === "upcoming" && (
                              <span className="text-xs text-muted-foreground">قادم</span>
                            )}
                            {saved.data?.some(
                              (file) => file.available && file.target.episodeId === item.id,
                            ) && (
                              <span className="text-xs text-muted-foreground">
                                محمّلة على الجهاز
                              </span>
                            )}
                          </div>
                        </Item>
                      </div>
                    ))}
                    {!episodes.length && (
                      <p className="p-3 text-sm text-muted-foreground">لا توجد حلقات مطابقة.</p>
                    )}
                  </ItemGroup>
                </>
              ) : (
                <Skeleton className="h-64" />
              )}
            </div>
          </aside>
        )}
        {work ? (
          <div className="min-w-0 border-t border-border pt-6 xl:col-start-1">
            <WatchDiscussion key={work.id} id={work.id} accountId={accountId} offline={offline} />
          </div>
        ) : error || !catalogVideo ? null : (
          <Skeleton className="h-40" />
        )}
      </div>
    </main>
  );
}

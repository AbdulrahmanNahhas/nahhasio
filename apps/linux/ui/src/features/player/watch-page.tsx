import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Eye,
} from "lucide-react";
import { useRef, useState } from "react";

import { Artwork } from "@/components/artwork";
import { Failure } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField } from "@/features/editor/fields/work-fields";
import { workLink } from "@/features/shell/navigation";
import { episodeNumberLabel, pickArtwork } from "@/features/work/format";
import { useWorkTracking } from "@/features/work/use-work-tracking";
import { WatchedControl } from "@/features/work/watched-control";

import { sourceOptions } from "./playback";
import { PlayerHost } from "./player-host";
import { savedDownloadOptions } from "./saved-downloads";
import { SourceControls } from "./source-controls";
import type { PlayerController } from "./use-player-snapshot";
import { useVideoViewport, VideoBackdrop } from "./use-video-viewport";
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
  const [theater, setTheater] = useState(false);
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
  const isMovie = playingPart?.kind === "movie";
  const hasEpisodeNavigation = !isMovie && Boolean(work) && s.sourceKind !== "local";
  const part = work?.installments.find((unit) => unit.id === browsePart) ?? playingPart;
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
      selectedPart.status === "announced"
    )
      return;
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
        s.fullscreen ? "fixed inset-0" : "relative aspect-video w-full overflow-hidden rounded-2xl"
      }
      aria-label="منطقة الفيديو"
    >
      <PlayerHost
        player={player}
        embedded
        hideEpisodes={!hasEpisodeNavigation}
        sourceTarget={sourceReady ? target : null}
        installmentTitle={playingPart?.title}
        episodes={(isMovie ? [] : ordered).map((item) => ({
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
          className="absolute inset-0 overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-6"
          aria-label="مصادر الفيديو"
        >
          {target && sourceReady ? (
            <WatchSources target={target} player={player} />
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
      <header className="flex items-center justify-between gap-4 bg-background px-4 py-3 sm:px-6">
        <Button variant="ghost" onClick={close}>
          <ArrowRight />
          العودة
        </Button>
        {hasEpisodeNavigation && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={theater ? "إظهار قائمة الحلقات" : "توسيع الفيديو"}
            title="وضع المسرح"
            onClick={() => setTheater(!theater)}
          >
            {theater ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
      </header>
      <div
        className={
          theater || !hasEpisodeNavigation
            ? "mx-auto flex max-w-screen-2xl flex-col gap-6 px-4 pb-8 sm:px-6"
            : "mx-auto grid max-w-screen-2xl items-start gap-6 px-4 pb-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
        }
      >
        <div className="flex min-w-0 flex-col gap-6">
          {actualVideo}
          <section
            className="flex flex-col gap-4 rounded-2xl bg-background py-2"
            aria-label="تفاصيل المشاهدة"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-2">
                <h1 className="text-xl font-semibold sm:text-2xl" dir="auto">
                  {title}
                </h1>
                {work && (
                  <a
                    href={workLink(work.id)}
                    className="text-sm text-primary"
                    onClick={(event) => {
                      event.preventDefault();
                      close();
                      window.location.hash = workLink(work.id);
                    }}
                  >
                    {work.titleAr || work.canonicalTitle}
                  </a>
                )}
              </div>
              {hasEpisodeNavigation && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!previous || previous.releaseState === "upcoming"}
                    onClick={() => {
                      if (previous && playingPart) choose(playingPart, previous);
                    }}
                  >
                    <ChevronRight />
                    السابقة
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!next || next.releaseState === "upcoming"}
                    onClick={() => {
                      if (next && playingPart) choose(playingPart, next);
                    }}
                  >
                    التالية
                    <ChevronLeft />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isMovie && playingPart && (
                <Badge variant="outline" className="h-9 px-3">
                  {playingPart.title}
                </Badge>
              )}
              {episode && (
                <Badge variant="secondary" className="h-9 px-3">
                  الحلقة {episodeNumberLabel(episode.number)}
                </Badge>
              )}
              {(episode?.runtimeMinutes ?? playingPart?.runtimeMinutes) && (
                <Badge variant="outline" className="h-9 px-3">
                  {episode?.runtimeMinutes ?? playingPart?.runtimeMinutes} دقيقة
                </Badge>
              )}
              <Badge variant="outline" className="h-9 px-3">
                {s.sourceKind ? "المصدر متصل" : "لم يبدأ التشغيل"}
              </Badge>
              {work && playingPart && (
                <WatchedControl
                  tracking={tracking}
                  installmentId={playingPart.id}
                  episodeId={episode?.id}
                  label={title}
                  compact
                />
              )}
              {isMovie && work && playingPart && (
                <div className="ms-auto w-full sm:w-64">
                  <SelectField
                    label="الإصدار"
                    hideLabel
                    value={playingPart.id}
                    alignItemWithTrigger={false}
                    items={work.installments.map((item) => ({ value: item.id, label: item.title }))}
                    onChange={(id) => {
                      const selected = work.installments.find((item) => item.id === id);
                      if (selected)
                        choose(
                          selected,
                          selected.kind === "movie" ? undefined : selected.episodes[0],
                        );
                    }}
                  />
                </div>
              )}
            </div>
            {(episode?.summary || playingPart?.summary || work?.summary) && (
              <details className="rounded-xl border border-border bg-card p-4" open>
                <summary className="cursor-pointer text-sm font-medium">
                  عن {episode ? "الحلقة" : "الإصدار"}
                </summary>
                <p dir="auto" className="mt-3 text-sm leading-loose whitespace-pre-line">
                  {episode?.summary || playingPart?.summary || work?.summary}
                </p>
              </details>
            )}
            {error && <Failure error={error} retry={onRetry} />}
          </section>
        </div>
        {hasEpisodeNavigation && !theater && (
          <aside
            className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-4 pb-0 xl:row-span-2 xl:sticky xl:top-4 max-h-[90vh]!"
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
                  ? "flex min-h-0 flex-col gap-4"
                  : "hidden min-h-0 flex-col gap-4 xl:flex"
              }
            >
              {work && part ? (
                <>
                  <SelectField
                    alignItemWithTrigger={false}
                    label="الأجزاء والمواسم"
                    value={part.id}
                    items={work.installments.map((item) => ({
                      value: item.id,
                      label: `${item.title} · ${item.episodes.length} حلقة`,
                    }))}
                    onChange={(id) => {
                      setBrowsePart(id);
                      setSearch("");
                    }}
                  />
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
                      size="icon-sm"
                      aria-label="إظهار غير المشاهدة فقط"
                      title="غير المشاهدة فقط"
                      aria-pressed={unwatched}
                      onClick={() => setUnwatched(!unwatched)}
                    >
                      <Eye />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDescending(!descending)}>
                      <ArrowDownUp />
                      {descending ? "الأحدث أولًا" : "الأقدم أولًا"}
                    </Button>
                  </div>
                  <div className="flex max-h-160 flex-col gap-2 scroll-fade-y overflow-y-auto">
                    {episodes.map((item) => (
                      <button
                        key={item.id}
                        disabled={item.releaseState === "upcoming" || part.status === "announced"}
                        aria-current={item.id === episode?.id ? "true" : undefined}
                        onClick={() => choose(part, item)}
                        className="flex min-w-0 items-start gap-3 rounded-xl border border-transparent p-2 text-start outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-current:border-border aria-current:bg-muted"
                      >
                        <div className="relative w-28 shrink-0">
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
                          <strong className="line-clamp-2 text-sm" dir="auto">
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
                            <span className="text-xs text-muted-foreground">محمّلة على الجهاز</span>
                          )}
                        </div>
                      </button>
                    ))}
                    {!episodes.length && (
                      <p className="p-3 text-sm text-muted-foreground">
                        {part.kind === "movie" ? "هذا الإصدار فيلم مستقل." : "لا توجد حلقات مطابقة."}
                      </p>
                    )}
                    {part.kind === "movie" && (
                      <Button variant="outline" onClick={() => choose(part)}>
                        مشاهدة الفيلم
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Skeleton className="h-64" />
              )}
            </div>
          </aside>
        )}
        {work ? (
          <div className="rounded-2xl bg-background py-3">
            <WatchDiscussion key={work.id} id={work.id} accountId={accountId} offline={offline} />
          </div>
        ) : error || !catalogVideo ? null : (
          <Skeleton className="h-40" />
        )}
      </div>
    </main>
  );
}

function WatchSources({ target, player }: { target: WatchTarget; player: PlayerController }) {
  const sources = useQuery(sourceOptions(player.snapshot?.sessionId ?? "", target));
  if (sources.isError)
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-lg font-semibold">تعذّر البحث عن المصادر</h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {sources.error.message}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => void sources.refetch()}>إعادة المحاولة</Button>
          <Button
            variant="outline"
            onClick={() => player.command({ command: "player.pickVideo", payload: {} })}
          >
            فتح فيديو من الجهاز
          </Button>
        </div>
      </div>
    );
  if (sources.isPending)
    return (
      <div className="flex min-h-full items-center justify-center" role="status">
        جارٍ البحث عن مصادر الفيديو…
      </div>
    );
  return <SourceControls target={target} player={player} />;
}

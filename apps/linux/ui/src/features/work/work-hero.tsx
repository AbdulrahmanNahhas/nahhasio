import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { Menu, MenuCheckboxItem, MenuGroup, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { cn } from "cn";
import { Download, Ellipsis, FileVideo, Heart, Play } from "lucide-react";
import { Fragment } from "react";

import { SdkMenuContent, sdkMenuItemClassName } from "@/components/ui-sdk/menu";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Progress } from "../../components/ui-sdk/progress";
import { Button, buttonVariants } from "../../components/ui/button";
import { isUpcomingTarget } from "../player/release-eligibility";
import { SaveWorkControl } from "../player/saved-works";
import { offlineStatusOptions } from "../player/saved-works-data";
import { requestDownload, requestWatch } from "../player/watch-request";
import { ageLabel, episodeNumberLabel, statusLabels } from "./format";
import type { WorkTracking } from "./use-work-tracking";
import { WatchedControl } from "./watched-control";
import { WorkGenres } from "./work-genres";
import { WorkDetails, WorkScore } from "./work-overlays";
import { WorkSourcesMenu } from "./work-sources-menu";
import { WorkTrailers } from "./work-trailers";

export function releaseStatus(work: WorkDetail) {
  const statuses = work.installments.map((item) => item.status);
  if (statuses.length && statuses.every((status) => status === "completed")) return "completed";
  if (statuses.includes("airing")) return "airing";
  if (statuses.includes("announced")) return "announced";
  return "unknown";
}

export function WorkHero({ work, tracking }: { work: WorkDetail; tracking: WorkTracking }) {
  const status = releaseStatus(work);
  const navigation = useCardNavigation();
  const seasons = work.installments.filter((item) => item.kind === "season").length;
  const title = work.titleAr || work.canonicalTitle;
  const artworkId = work.banner?.id ?? work.poster?.id;
  const runtime =
    seasons === 0 && work.installments.length === 1 ? work.installments[0].runtimeMinutes : null;
  const length =
    seasons > 1
      ? seasons === 2
        ? "موسمان"
        : `${seasons} مواسم`
      : seasons === 1 && work.episodeCount > 0
        ? `${work.episodeCount} حلقة`
        : runtime
          ? `${runtime} دقيقة`
          : work.installmentCount > 1
            ? `${work.installmentCount} إصدارات`
            : null;
  const releaseNotice = status === "airing" || status === "announced";
  const metadata = [work.age ? ageLabel(work.age) : null, work.releaseYear, length].filter(Boolean);
  const filesOnly = work.playbackPolicy === "files-only";
  const state = tracking.state.data;
  const isFavorite = state?.isFavorite ?? false;
  const offline = useQuery(offlineStatusOptions());
  const available: Array<{ installmentId: string; episodeId?: string }> = [];
  for (const part of work.installments) {
    if (isUpcomingTarget(part)) continue;
    if (part.kind === "season") {
      for (const episode of part.episodes)
        if (episode.releaseState !== "upcoming")
          available.push({ installmentId: part.id, episodeId: episode.id });
    } else available.push({ installmentId: part.id });
  }
  const unitFor = (target: (typeof available)[number]) =>
    target.episodeId
      ? tracking.unitByEpisode.get(target.episodeId)
      : tracking.unitsByInstallment
          .get(target.installmentId)
          ?.find((unit) => unit.episodeId === null);
  const resume = available
    .filter((target) => {
      const unit = unitFor(target);
      return unit && !unit.isPlayed && unit.positionSeconds > 0;
    })
    .toSorted(
      (a, b) =>
        (Date.parse(unitFor(b)?.updatedAt ?? "") || 0) -
        (Date.parse(unitFor(a)?.updatedAt ?? "") || 0),
    )[0];
  const next = resume ?? available.find((target) => !unitFor(target)?.isPlayed) ?? available[0];
  const nextPart = work.installments.find((part) => part.id === next?.installmentId);
  const nextEpisode = nextPart?.episodes.find((episode) => episode.id === next?.episodeId);
  const nextTitle = nextEpisode
    ? nextEpisode.title || `الحلقة ${episodeNumberLabel(nextEpisode.number)}`
    : nextPart?.title;
  const progress = state?.summary;
  const isCompleted = Boolean(
    progress?.isFullyWatched || (state?.units.length && state.units.every((unit) => unit.isPlayed)),
  );
  const resumeUnit = resume ? unitFor(resume) : undefined;
  const playbackProgress =
    progress?.releasedUnits === 1 && resumeUnit?.durationSeconds
      ? Math.round(Math.min(0.99, resumeUnit.positionSeconds / resumeUnit.durationSeconds) * 100)
      : null;
  const watchProgress =
    playbackProgress ??
    (progress?.releasedUnits ? (progress.watchedReleasedUnits / progress.releasedUnits) * 100 : 0);

  return (
    <header data-work-hero className="relative isolate w-full min-w-0">
      {artworkId && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-76 mask-b-from-50% mask-b-to-100% sm:h-88 lg:h-full lg:mask-b-from-56%">
            <Artwork
              id={artworkId}
              alt=""
              className="size-full object-cover object-top lg:object-center"
              transparentFallback
              priority
              width={1920}
            />
            <div className="absolute inset-0 bg-linear-to-t from-background/55 via-background/20 via-35% to-transparent to-72%" />
            <div className="absolute inset-0 hidden bg-linear-to-l from-background/80 via-background/5 via-55% to-transparent lg:block" />
            <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background/55 to-transparent" />
          </div>
        </div>
      )}
      <div
        className={cn(
          "mx-auto grid w-full min-w-0 max-w-screen-2xl items-end gap-6 px-5 pb-7 sm:px-8 lg:grid-cols-3 lg:gap-10 lg:px-14 lg:pb-10",
          artworkId ? "pt-60 sm:pt-72 lg:min-h-work-hero lg:pt-48" : "pt-24 lg:pt-28",
        )}
      >
        <div className="flex min-w-0 max-w-xl flex-col items-center gap-4 sm:items-start lg:col-span-2">
          <h1
            className="w-full font-display text-center text-4xl leading-tight font-bold sm:text-start sm:text-5xl lg:text-6xl"
            dir="auto"
          >
            {work.logo ? (
              <>
                <Artwork
                  id={work.logo.id}
                  alt=""
                  className="mx-auto h-20 w-full max-w-80 object-contain drop-shadow-lg sm:mx-0 sm:h-24 sm:object-right lg:h-32 lg:max-w-md"
                  fallback={
                    <span
                      aria-hidden
                      className="self-start text-start font-display text-4xl font-bold text-foreground sm:text-5xl"
                    >
                      {title}
                    </span>
                  }
                  transparentFallback
                  priority
                />
                <span className="sr-only">{title}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {(metadata.length > 0 || releaseNotice || work.isPrivate || filesOnly) && (
            <div
              className="flex w-fit max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-input/30 px-4 py-2.5 text-sm text-foreground/90 backdrop-blur-sm sm:justify-start sm:text-base"
              role="group"
              aria-label="معلومات العمل"
            >
              {metadata.map((fact, index) => (
                <Fragment key={fact}>
                  {index > 0 && <span className="h-3 w-px shrink-0 bg-border" aria-hidden />}
                  <bdi className="tabular-nums">{fact}</bdi>
                </Fragment>
              ))}
              {releaseNotice && (
                <span className="inline-flex shrink-0 items-center gap-1.5 font-medium">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      status === "airing" ? "bg-success" : "bg-warning",
                    )}
                    aria-hidden
                  />
                  {statusLabels.get(status)}
                </span>
              )}
              {work.isPrivate && <span>خاص</span>}
              {filesOnly && (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5"
                  title="التشغيل من الملفات فقط"
                >
                  <FileVideo className="size-3.5" aria-hidden />
                  ملفات فقط
                </span>
              )}
            </div>
          )}
          <WorkGenres genres={work.genres} hero />
          <div
            className="flex w-full flex-wrap items-center gap-1.5"
            role="group"
            aria-label="إجراءات العمل"
          >
            <Button
              className="h-12 flex-1 px-3! font-semibold sm:flex-none sm:px-6!"
              size="lg"
              {...navigation}
              disabled={!next || tracking.state.isPending}
              onClick={() => requestWatch({ workId: work.id, ...next, title })}
            >
              <Play data-icon="inline-start" className="fill-current" aria-hidden />
              {resume ? "تابع المشاهدة" : isCompleted ? "إعادة المشاهدة" : "شاهد الآن"}
            </Button>
            <SaveWorkControl id={work.id} />
            <WorkTrailers trailers={work.trailers ?? []} />
            <Menu modal={false}>
              <MenuTrigger
                {...navigation}
                className={buttonVariants({
                  variant: "outline",
                  size: "icon-lg",
                  className: "size-12",
                })}
                aria-label="المزيد من إجراءات العمل"
                title="المزيد من إجراءات العمل"
              >
                <Ellipsis aria-hidden />
              </MenuTrigger>
              <SdkMenuContent align="end">
                <MenuGroup>
                  <MenuItem
                    className={sdkMenuItemClassName}
                    disabled={available.length === 0}
                    onSelect={() => requestDownload({ workId: work.id, title })}
                  >
                    <Download className="size-4" aria-hidden />
                    تنزيل الفيديو
                  </MenuItem>
                  <MenuCheckboxItem
                    className={sdkMenuItemClassName}
                    value="favorite"
                    checked={isFavorite}
                    closeOnSelect={false}
                    disabled={!state || tracking.pending || offline.data?.offline}
                    onCheckedChange={(value) => tracking.favorite.mutate(value)}
                  >
                    <Heart
                      className={cn("size-4 shrink-0", isFavorite && "fill-current")}
                      aria-hidden
                    />
                    {isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
                  </MenuCheckboxItem>
                </MenuGroup>
                <WorkSourcesMenu work={work} />
              </SdkMenuContent>
            </Menu>
          </div>
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card/65 backdrop-blur-sm lg:w-full lg:max-w-80 lg:justify-self-end",
            isCompleted ? "p-2" : "p-3",
          )}
        >
          {!isCompleted && (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2">
                  <span className="text-xs text-muted-foreground">التالي للمشاهدة</span>
                  <strong className="truncate text-sm font-semibold" dir="auto">
                    {next ? nextTitle || title : "لا يوجد إصدار متاح بعد"}
                  </strong>
                </div>
                <WatchedControl tracking={tracking} label="العمل" compact concise={false} />
              </div>
              <div className="flex flex-col gap-1.5 px-2">
                {playbackProgress !== null ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    تقدّم المشاهدة <bdi>{playbackProgress}%</bdi>
                  </p>
                ) : progress && progress.releasedUnits > 0 ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    شوهد {progress.watchedReleasedUnits} من {progress.releasedUnits}
                  </p>
                ) : null}
                <Progress
                  className="**:data-[slot=progress-track]:h-1.5"
                  aria-label="تقدّم المشاهدة"
                  value={watchProgress}
                />
              </div>
            </>
          )}
          <div
            className={cn(
              "flex min-w-0 items-center gap-2",
              !isCompleted && "border-t border-foreground/10 pt-3",
            )}
          >
            {isCompleted && <WatchedControl tracking={tracking} label="العمل" compact />}
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <WorkDetails work={work} status={status} compact={isCompleted} />
              <WorkScore work={work} compact={isCompleted} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

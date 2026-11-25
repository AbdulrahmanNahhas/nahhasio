import type {
  CatalogEntry,
  ScoreSummary,
  UpcomingInstallment,
  WorkSummary,
} from "@nahhasio/api-contract";
import { cn } from "cn";
import { CalendarDays, Film, Star, Tv } from "lucide-react";
import type { ReactNode } from "react";

import { optionLabel } from "../features/catalog/filter-model";
import { workLink } from "../features/shell/navigation";
import { Artwork } from "./artwork";
import { useCardNavigation } from "./card-navigation";
import { CatalogStateBadge } from "./catalog-state-badge";
import { scoreTone } from "./score-tone";
import { Badge } from "./ui/badge";
import { useCardTilt } from "./use-card-tilt";

export function ScoreBadge({ score }: { score: ScoreSummary }) {
  return (
    <Badge
      variant="secondary"
      className="h-auto gap-1.5 bg-background/90 px-2.5 py-1 text-xs"
      title={`التقييم المحسوب · ${score.scored} من ${score.total} أجزاء مقيّمة`}
    >
      <Star className="fill-(--gold) text-(--gold)" data-icon="inline-start" aria-hidden="true" />
      {score.rating === null ? "غير مقيّم" : score.rating.toFixed(1)}
      {score.total > 1 && (
        <small className="text-[9px] text-muted-foreground">
          {score.scored}/{score.total}
        </small>
      )}
    </Badge>
  );
}

function CardScore({ score }: { score: ScoreSummary }) {
  if (score.rating === null) return null;
  const value = Math.round(score.rating * 10);
  const label = `التقييم المحسوب ${value} من 100 · ${score.scored} من ${score.total} أجزاء مقيّمة`;
  return (
    <span
      className={cn(
        "absolute inset-s-2 top-2 grid size-9 place-items-center rounded-full border-2 border-score-ink/15 text-xs font-bold text-score-ink tabular-nums shadow-sm",
        scoreTone(value).background,
      )}
      role="img"
      aria-label={label}
      title={label}
    >
      {value}
    </span>
  );
}

export function MediaCard({
  work,
  installment,
  entry,
  onSelect,
  layout = "poster",
  mediaType,
  minimal = false,
  borderless = false,
  showTitle = true,
  showScore = true,
  showStatus = true,
  browsePresentation = false,
  showMetadata = true,
  showOriginalTitle = false,
  titleLanguage = "arabic",
  action,
  withinWork = false,
}: {
  work?: WorkSummary;
  installment?: UpcomingInstallment;
  entry?: CatalogEntry;
  onSelect?: (id: string, installmentId?: string) => void;
  layout?: "poster" | "banner" | "logo";
  mediaType?: "movies" | "series";
  minimal?: boolean;
  borderless?: boolean;
  showTitle?: boolean;
  showScore?: boolean;
  showStatus?: boolean;
  browsePresentation?: boolean;
  showMetadata?: boolean;
  showOriginalTitle?: boolean;
  titleLanguage?: "arabic" | "english";
  action?: ReactNode;
  withinWork?: boolean;
}) {
  const navigation = useCardNavigation();
  const { hoverTilt, chooseTilt } = useCardTilt();
  const parent = entry?.work ?? work;
  const unit = entry?.installment ?? installment;
  if (!parent && !unit) return null;

  const workId = parent?.id ?? unit?.workId ?? "";
  const title = unit?.title ?? (parent?.titleAr || parent?.canonicalTitle || "");
  const poster = unit?.poster ?? parent?.poster;
  const banner = unit?.banner ?? parent?.banner;
  const bareLogo = borderless && layout === "logo";
  const landscape = browsePresentation && layout === "banner";
  const image =
    layout === "banner"
      ? (banner ?? poster)
      : layout === "logo"
        ? bareLogo && (minimal || browsePresentation)
          ? parent?.logo
          : (parent?.logo ?? poster)
        : poster;
  const score = unit?.score ?? parent?.score;
  const year = unit ? unit.releaseDate?.slice(0, 4) : parent?.releaseYear;

  const watched = entry?.watchState === "watched";
  const watching = entry?.watchState === "in-progress";
  const status = entry?.status ?? (installment ? "announced" : null);
  const visibleStatus =
    !minimal &&
    showStatus &&
    status &&
    (browsePresentation || ["announced", "airing", "ongoing"].includes(status))
      ? status
      : undefined;
  const kind = unit
    ? unit.kind === "season"
      ? "موسم"
      : unit.kind === "movie"
        ? "فيلم"
        : "إصدار خاص"
    : mediaType === "movies"
      ? "فيلم"
      : mediaType === "series"
        ? "مسلسل"
        : parent?.format === "animated"
          ? "رسوم متحركة"
          : "تمثيل حي";
  const episodeCount =
    browsePresentation && unit?.kind === "season" && unit.episodeCount > 0
      ? `${unit.episodeCount} حلقة`
      : "";
  const detail = unit
    ? episodeCount && layout === "poster"
      ? ""
      : unit.runtimeMinutes
        ? episodeCount
          ? `${unit.runtimeMinutes} دقيقة للحلقة`
          : `${unit.runtimeMinutes} دقيقة`
        : !episodeCount && unit.episodeCount
          ? `${unit.episodeCount} حلقة`
          : ""
    : kind;
  const caption =
    unit?.kind === "season" && !withinWork
      ? parent?.titleAr || unit.workTitleAr || parent?.canonicalTitle || unit.workTitle || title
      : title;
  const displayCaption =
    titleLanguage === "english" ? parent?.canonicalTitle || unit?.workTitle || caption : caption;
  const logoFallbackTitle = browsePresentation ? displayCaption : title;
  const installmentLabel = unit && title !== caption && titleLanguage === "arabic" ? title : "";
  const originalCaption =
    showOriginalTitle && !withinWork && parent?.canonicalTitle !== caption
      ? parent?.canonicalTitle
      : undefined;
  const KindIcon = unit?.kind === "season" || mediaType === "series" ? Tv : Film;
  const showDetails = !minimal && (showTitle || (showMetadata && (year || episodeCount || detail)));
  const details = showDetails && (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        landscape ? "pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 sm:px-4" : "px-0.5",
        landscape && visibleStatus && "pb-5",
      )}
    >
      {showTitle && (
        <h3
          className={cn(
            "line-clamp-2 text-right text-sm leading-snug font-semibold sm:text-base",
            landscape && "sm:text-lg",
          )}
          dir="auto"
        >
          {displayCaption}
        </h3>
      )}
      {showTitle && originalCaption && (
        <p
          className="truncate text-right text-xs text-muted-foreground"
          dir="auto"
          title={originalCaption}
        >
          {originalCaption}
        </p>
      )}
      {showTitle && installmentLabel && (
        <p className="line-clamp-1 text-sm text-muted-foreground" dir="auto" title={title}>
          {installmentLabel}
        </p>
      )}
      {showMetadata && (year || episodeCount || detail) && (
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {year && <span className="shrink-0">{year}</span>}
          {year && (episodeCount || detail) && <span aria-hidden="true">·</span>}
          {episodeCount && (
            <>
              <KindIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="shrink-0">{episodeCount}</span>
              {detail && <span aria-hidden="true">·</span>}
            </>
          )}
          {detail && (
            <>
              {!episodeCount && <KindIcon className="size-3.5 shrink-0" aria-hidden="true" />}
              <span>{detail}</span>
            </>
          )}
        </span>
      )}
    </div>
  );
  return (
    <article
      className="group/media relative min-w-0 snap-start hover:z-10 focus-within:z-10"
      data-layout={layout}
      data-watched={watched}
      data-kind={unit ? "installment" : "work"}
    >
      <a
        {...navigation}
        href={workLink(workId, unit?.id)}
        aria-label={`تفاصيل ${caption}${unit && title !== caption ? ` · ${title}` : ""}`}
        className={cn(
          "group/card flex flex-col gap-3 rounded-2xl text-foreground focus-visible:outline-none",
          browsePresentation && visibleStatus && "pb-3",
        )}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" || event.pointerType === "pen") {
            chooseTilt();
          }
        }}
        onFocus={chooseTilt}
        onClick={
          onSelect
            ? (event) => {
                event.preventDefault();
                onSelect(workId, unit?.id);
              }
            : undefined
        }
      >
        <span
          className={cn(
            "relative block aspect-2/3 rounded-2xl motion-safe:transition motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover/card:scale-104 motion-safe:group-focus-visible/card:scale-102 motion-safe:group-active/card:scale-98 group-focus-visible/card:ring-4 group-focus-visible/card:ring-offset-2 group-focus-visible/card:ring-offset-background group-data-[layout=banner]/media:aspect-video group-data-[layout=logo]/media:aspect-video motion-reduce:transition-none",
            hoverTilt,
            bareLogo
              ? "rounded-none border-0 bg-transparent"
              : "border border-border bg-card group-hover/card:shadow-xl",
            watched
              ? "group-focus-visible/card:ring-success group-hover/card:border-success"
              : watching
                ? "group-focus-visible/card:ring-warning group-hover/card:border-warning"
                : "group-focus-visible/card:ring-foreground group-hover/card:border-foreground/60",
          )}
        >
          <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
            {bareLogo && (minimal || browsePresentation) && !image ? (
              <span
                className="flex size-full items-center justify-center text-center font-display text-lg font-semibold"
                dir="auto"
              >
                {logoFallbackTitle}
              </span>
            ) : (
              <Artwork
                id={image?.id}
                alt=""
                transparentFallback={bareLogo && (minimal || browsePresentation)}
                fallback={
                  bareLogo && (minimal || browsePresentation) ? (
                    <span className="font-display text-lg font-semibold" dir="auto">
                      {logoFallbackTitle}
                    </span>
                  ) : browsePresentation && !showTitle ? (
                    <span className="px-3 text-center font-display font-semibold" dir="auto">
                      {displayCaption}
                      {installmentLabel && ` · ${installmentLabel}`}
                    </span>
                  ) : undefined
                }
                className={cn(
                  "block size-full object-cover",
                  landscape && !banner && "object-contain",
                  layout === "logo" &&
                    parent?.logo &&
                    (bareLogo && (minimal || browsePresentation)
                      ? "object-contain"
                      : "object-contain p-6"),
                )}
              />
            )}
          </span>
          {landscape && details && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-linear-to-tl from-background via-background/45 to-transparent"
              />
              {details}
            </>
          )}
          {!minimal && showScore && score && <CardScore score={score} />}
          {!minimal && parent?.isPrivate && (
            <span className={cn("absolute inset-e-2 top-2", action && "top-12")}>
              <Badge variant="secondary">خاص</Badge>
            </span>
          )}
          {visibleStatus &&
            (browsePresentation ? (
              <span className="absolute inset-x-1 bottom-0 flex translate-y-1/2 justify-center">
                <CatalogStateBadge value={visibleStatus} />
              </span>
            ) : (
              <span className="absolute inset-x-2 bottom-2 flex justify-center">
                <Badge variant="secondary">
                  <CalendarDays data-icon="inline-start" />
                  {optionLabel(visibleStatus, visibleStatus)}
                </Badge>
              </span>
            ))}
        </span>
        {!landscape && details}
      </a>
      {action && <div className="absolute inset-e-2 top-2">{action}</div>}
    </article>
  );
}

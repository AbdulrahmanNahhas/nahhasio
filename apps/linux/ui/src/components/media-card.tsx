import type {
  CatalogEntry,
  ScoreSummary,
  UpcomingInstallment,
  WorkSummary,
} from "@nahhasio/api-contract";
import { cn } from "cn";
import { CalendarDays, Film, Star, Tv } from "lucide-react";
import { useState } from "react";

import { optionLabel } from "../features/catalog/filter-model";
import { workLink } from "../features/shell/navigation";
import { Artwork } from "./artwork";
import { useCardNavigation } from "./card-navigation";
import { LanguageBadges } from "./language-badges";
import { Badge } from "./ui/badge";

const hoverTilts = [
  "motion-safe:group-hover/card:-rotate-2 motion-safe:group-focus-visible/card:-rotate-2",
  "motion-safe:group-hover/card:-rotate-1 motion-safe:group-focus-visible/card:-rotate-1",
  "motion-safe:group-hover/card:-rotate-0.5 motion-safe:group-focus-visible/card:-rotate-0.5",
  "motion-safe:group-hover/card:rotate-0.5 motion-safe:group-focus-visible/card:rotate-0.5",
  "motion-safe:group-hover/card:rotate-1 motion-safe:group-focus-visible/card:rotate-1",
  "motion-safe:group-hover/card:rotate-2 motion-safe:group-focus-visible/card:rotate-2",
] as const;

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

export function MediaCard({
  work,
  installment,
  entry,
  onSelect,
  layout = "poster",
  mediaType,
  minimal = false,
  borderless = false,
  showScore = true,
  showStatus = true,
  showMetadata = true,
  showOriginalTitle = false,
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
  showScore?: boolean;
  showStatus?: boolean;
  showMetadata?: boolean;
  showOriginalTitle?: boolean;
  withinWork?: boolean;
}) {
  const navigation = useCardNavigation();
  const [hoverTilt, setHoverTilt] = useState<string>(hoverTilts[0]);
  const parent = entry?.work ?? work;
  const unit = entry?.installment ?? installment;
  if (!parent && !unit) return null;

  const workId = parent?.id ?? unit?.workId ?? "";
  const title = unit?.title ?? (parent?.titleAr || parent?.canonicalTitle || "");
  const poster = unit?.poster ?? parent?.poster;
  const bareLogo = borderless && layout === "logo";
  const image =
    layout === "banner"
      ? (parent?.banner ?? poster)
      : layout === "logo"
        ? bareLogo && minimal
          ? parent?.logo
          : (parent?.logo ?? poster)
        : poster;
  const score = unit?.score ?? parent?.score;
  const year = unit ? unit.releaseDate?.slice(0, 4) : parent?.releaseYear;

  const watched = entry?.watchState === "watched";
  const watching = entry?.watchState === "in-progress";
  const status = entry?.status ?? (installment ? "announced" : null);
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
  const detail = unit
    ? unit.runtimeMinutes
      ? `${unit.runtimeMinutes} دقيقة`
      : unit.episodeCount
        ? `${unit.episodeCount} حلقة`
        : ""
    : kind;
  const caption =
    unit?.kind === "season" && !withinWork
      ? parent?.titleAr || unit.workTitleAr || parent?.canonicalTitle || unit.workTitle || title
      : title;
  const installmentLabel = unit && title !== caption ? title : "";
  function chooseTilt() {
    // Randomize once per interaction, outside React's replayable state updater.
    const alternatives = hoverTilts.filter((tilt) => tilt !== hoverTilt);
    setHoverTilt(alternatives[Math.floor(Math.random() * alternatives.length)]);
  }
  const KindIcon = unit?.kind === "season" || mediaType === "series" ? Tv : Film;

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
        className="group/card flex flex-col gap-3 rounded-2xl text-foreground focus-visible:outline-none"
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
              : "border border-border bg-card group-hover/card:border-foreground/60 group-hover/card:shadow-xl",
            watched === true
              ? "group-focus-visible/card:ring-success"
              : "group-focus-visible/card:ring-foreground",
          )}
        >
          <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
            {bareLogo && minimal && !image ? (
              <span
                className="flex size-full items-center justify-center text-center font-display text-lg font-semibold"
                dir="auto"
              >
                {title}
              </span>
            ) : (
              <Artwork
                id={image?.id}
                alt=""
                transparentFallback={bareLogo && minimal}
                fallback={
                  bareLogo && minimal ? (
                    <span className="font-display text-lg font-semibold" dir="auto">
                      {title}
                    </span>
                  ) : undefined
                }
                className={cn(
                  "block size-full object-cover",
                  layout === "logo" &&
                    parent?.logo &&
                    (bareLogo && minimal ? "object-contain" : "object-contain p-6"),
                )}
              />
            )}
          </span>
          {!minimal && showScore && score?.rating != null && (
            <span
              className={cn(
                "absolute inset-s-0 top-0 flex items-center min-w-12 justify-items-center gap-0.5 rounded-ss-2xl rounded-ee-xl bg-muted px-2.5 py-2 text-primary-foreground shadow-sm",
                !minimal && watched && "bg-green-700!",
                !minimal && watching && "bg-blue-500!",
              )}
              title={`التقييم المحسوب · ${score.scored} من ${score.total} أجزاء مقيّمة`}
            >
              <Star className="size-4 fill-current" aria-hidden="true" />
              <span className="text-base leading-none font-bold" dir="ltr">
                {score.rating.toFixed(1)}
              </span>
            </span>
          )}
          {!minimal && parent?.isPrivate && (
            <span className="absolute inset-e-2.5 top-1">
              <Badge variant="secondary">خاص</Badge>
            </span>
          )}
          {!minimal &&
            showStatus &&
            (status === "announced" || status === "airing" || status === "ongoing") && ( // || status !== "completed"??
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-3">
                <Badge variant="outline" className="mb-1 rounded-full px-2 bg-accent">
                  {/*{status === "completed" ? (
                    <CheckIcon data-icon="inline-start" />
                  ) : (*/}
                  <CalendarDays data-icon="inline-start" />
                  {/*// )}*/}
                  {optionLabel(status, status)}
                </Badge>
              </span>
            )}
        </span>
        {!minimal && (
          <div className="flex min-w-0 flex-col gap-px px-0.5">
            <h3
              className="line-clamp-2 text-right text-sm leading-relaxed font-semibold transition-colors group-focus-visible/card:text-primary sm:text-base motion-reduce:transition-none"
              dir="auto"
            >
              {caption}
            </h3>
            {showOriginalTitle &&
              !withinWork &&
              parent?.canonicalTitle &&
              parent.canonicalTitle !== caption && (
                <p
                  className="truncate text-right text-xs leading-relaxed text-muted-foreground"
                  dir="auto"
                  title={parent.canonicalTitle}
                >
                  {parent.canonicalTitle}
                </p>
              )}
            {installmentLabel && (
              <p
                className="line-clamp-2 text-sm leading-relaxed text-muted-foreground"
                dir="auto"
                title={title}
              >
                {installmentLabel}
              </p>
            )}
            {showMetadata && (
              <LanguageBadges languages={unit?.languages ?? parent?.languages ?? []} />
            )}
            {showMetadata && (year || detail) && (
              <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {showMetadata && year && (
                  <>
                    <span className="shrink-0">{year}</span>
                    {detail && <span aria-hidden="true">·</span>}
                  </>
                )}
                {showMetadata && detail && (
                  <>
                    <KindIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="shrink-0">{detail}</span>
                  </>
                )}
              </span>
            )}
          </div>
        )}
      </a>
    </article>
  );
}

import { installmentRating } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Heart, Star } from "lucide-react";

import { Failure } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { workLink } from "@/features/shell/navigation";
import { episodeNumberLabel } from "@/features/work/format";
import { highestRisk, RiskBadge } from "@/features/work/risk-badge";
import type { WorkTracking } from "@/features/work/use-work-tracking";
import { WatchedControl } from "@/features/work/watched-control";

type Part = WorkDetail["installments"][number];

function catalogLinks(work: WorkDetail, part?: Part) {
  const links: { label: string; href: string }[] = [];
  const imdb = part?.externalIds.imdbId || work.externalIds.imdbId;
  if (imdb && /^tt\d+$/.test(imdb.trim()))
    links.push({ label: "IMDb", href: `https://www.imdb.com/title/${imdb.trim()}/` });
  const tmdb = part?.externalIds.tmdbId ?? work.externalIds.tmdbId;
  const series = part?.externalIds.tmdbId
    ? part.kind === "season"
    : work.installments.some((item) => item.kind === "season");
  if (tmdb && Number.isSafeInteger(tmdb) && tmdb > 0)
    links.push({
      label: "TMDB",
      href: `https://www.themoviedb.org/${series ? "tv" : "movie"}/${tmdb}`,
    });
  const anilist = part?.externalIds.anilistId ?? work.externalIds.anilistId;
  if (anilist && Number.isSafeInteger(anilist) && anilist > 0)
    links.push({ label: "AniList", href: `https://anilist.co/anime/${anilist}` });
  const mal = part?.externalIds.malId ?? work.externalIds.malId;
  if (mal && Number.isSafeInteger(mal) && mal > 0)
    links.push({ label: "MyAnimeList", href: `https://myanimelist.net/anime/${mal}` });
  return links;
}

export function WatchDetails({
  work,
  part,
  episode,
  title,
  onLeave,
}: {
  work?: WorkDetail;
  part?: Part;
  episode?: Part["episodes"][number];
  title: string;
  onLeave: () => void;
}) {
  const runtime = episode?.runtimeMinutes ?? part?.runtimeMinutes;
  const year = part?.releaseDate?.slice(0, 4) || work?.releaseYear;
  const partRating = part ? installmentRating(part.scores ?? {}) : null;
  const workRating = work?.score.rating;
  return (
    <section
      className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-3"
      aria-label="تفاصيل المشاهدة"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {episode && (
          <p className="text-sm text-muted-foreground">
            {part?.title} · الحلقة {episodeNumberLabel(episode.number)}
          </p>
        )}
        <h1 className="text-2xl leading-snug font-semibold wrap-anywhere sm:text-3xl" dir="auto">
          {title}
        </h1>
        {(year || runtime || work?.age) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {year && <span>{year}</span>}
            {runtime && <span>{runtime} دقيقة</span>}
            {work?.age && <Badge variant="outline">{work.age}</Badge>}
          </div>
        )}
      </div>
      {work && (partRating !== null || workRating != null) && (
        <a
          href={`${workLink(work.id)}?panel=score`}
          onClick={onLeave}
          aria-label="تفاصيل التقييم"
          className="flex shrink-0 items-center gap-2 self-center rounded-xl border border-border bg-card px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring sm:gap-3"
        >
          <Star className="hidden size-4 text-primary sm:block" aria-hidden="true" />
          {partRating !== null && (
            <span className="flex flex-col text-xs text-muted-foreground">
              {part?.kind === "season" ? "الموسم" : "الإصدار"}
              <bdi className="text-sm font-semibold text-foreground tabular-nums">{partRating}</bdi>
            </span>
          )}
          {workRating != null && (
            <span className="flex flex-col text-xs text-muted-foreground">
              العمل
              <bdi className="text-sm font-semibold text-foreground tabular-nums">{workRating}</bdi>
            </span>
          )}
        </a>
      )}
    </section>
  );
}

export function WatchEpisodeNavigation({
  onPrevious,
  onNext,
}: {
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  if (!onPrevious && !onNext) return null;
  return (
    <ButtonGroup aria-label="التنقّل بين الحلقات" className="ms-auto shrink-0">
      <Button
        variant="outline"
        size="icon"
        className="xl:w-auto xl:px-3"
        aria-label="السابقة"
        title="الحلقة السابقة"
        disabled={!onPrevious}
        onClick={onPrevious}
      >
        <ChevronRight data-icon="inline-start" />
        <span className="hidden xl:inline">السابقة</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="xl:w-auto xl:px-3"
        aria-label="التالية"
        title="الحلقة التالية"
        disabled={!onNext}
        onClick={onNext}
      >
        <span className="hidden xl:inline">التالية</span>
        <ChevronLeft data-icon="inline-end" />
      </Button>
    </ButtonGroup>
  );
}

export function WatchActions({
  work,
  part,
  episode,
  title,
  tracking,
  onLeave,
}: {
  work: WorkDetail;
  part?: Part;
  episode?: Part["episodes"][number];
  title: string;
  tracking: WorkTracking;
  onLeave: () => void;
}) {
  const favorite = tracking.state.data?.isFavorite ?? false;
  const workTitle = work.titleAr || work.canonicalTitle;
  const favoriteLabel = favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Button
          nativeButton={false}
          variant="ghost"
          size="default"
          className="min-w-0 shrink"
          title={workTitle}
          render={<a href={workLink(work.id)} />}
          onClick={onLeave}
        >
          <ArrowRight data-icon="inline-start" />
          <span className="truncate">{workTitle}</span>
        </Button>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant={favorite ? "secondary" : "outline"}
            size="icon"
            aria-label={favoriteLabel}
            title={favoriteLabel}
            aria-pressed={favorite}
            disabled={!tracking.state.data || tracking.favorite.isPending}
            onClick={() => tracking.favorite.mutate(!favorite)}
          >
            <Heart data-icon="inline-start" className={favorite ? "fill-current" : undefined} />
          </Button>
          {part && (
            <WatchedControl
              tracking={tracking}
              installmentId={part.id}
              episodeId={episode?.id}
              label={title}
              compact
            />
          )}
        </div>
      </div>
      {tracking.favorite.isError && <Failure error={tracking.favorite.error} />}
    </div>
  );
}

export function WatchAbout({
  work,
  part,
  episode,
}: {
  work: WorkDetail;
  part?: Part;
  episode?: Part["episodes"][number];
}) {
  const summary = episode?.summary || part?.summary || work.summary;
  const links = catalogLinks(work, part);
  return (
    <div className="flex min-w-0 flex-col gap-4 xl:col-start-1">
      {(summary || work?.contentWarnings || work?.analysisNotes) && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              <h2 className="opacity-50">
                {episode
                  ? "عن الحلقة"
                  : part?.kind === "movie"
                    ? "عن الفيلم"
                    : part?.kind === "special"
                      ? "عن العرض الخاص"
                      : "عن الجزء"}
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {summary && (
              <p dir="auto" className="text-base leading-relaxed whitespace-pre-line wrap-anywhere">
                {summary}
              </p>
            )}
            {(work?.contentWarnings || work?.analysisNotes) && (
              <div
                className={cn(
                  "grid gap-5",
                  summary && "border-t border-border pt-5",
                  work.contentWarnings && work.analysisNotes && "lg:grid-cols-2",
                )}
              >
                {work.contentWarnings && (
                  <section className="flex flex-col gap-3" aria-label="تنبيه المحتوى">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">تنبيه المحتوى</h3>
                      <RiskBadge risk={highestRisk([work.sexualityRisk, work.behavioralRisk])} />
                    </div>
                    <p
                      dir="auto"
                      className="text-sm leading-loose whitespace-pre-line text-muted-foreground"
                    >
                      {work.contentWarnings}
                    </p>
                  </section>
                )}
                {work.analysisNotes && (
                  <section className="flex flex-col gap-3" aria-label="ملاحظات التحليل">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">ملاحظات التحليل</h3>
                      <RiskBadge risk={work.theologyRisk} />
                    </div>
                    <p
                      dir="auto"
                      className="text-sm leading-loose whitespace-pre-line text-muted-foreground"
                    >
                      {work.analysisNotes}
                    </p>
                  </section>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {links.length > 0 && (
        <nav className="flex flex-wrap items-center gap-2" aria-label="مراجع العمل">
          {links.map((link) => (
            <a
              key={link.label}
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <bdi>{link.label}</bdi>
              <ExternalLink data-icon="inline-end" aria-hidden="true" />
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

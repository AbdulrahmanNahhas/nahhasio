import { installmentRating } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Heart, Star } from "lucide-react";

import { Failure } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { workLink } from "@/features/shell/navigation";
import { episodeNumberLabel } from "@/features/work/format";
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
  tracking,
  onLeave,
  onPrevious,
  onNext,
}: {
  work?: WorkDetail;
  part?: Part;
  episode?: Part["episodes"][number];
  title: string;
  tracking: WorkTracking;
  onLeave: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const rating = part ? installmentRating(part.scores ?? {}) : null;
  const summary = episode?.summary || part?.summary || work?.summary;
  const runtime = episode?.runtimeMinutes ?? part?.runtimeMinutes;
  const year = part?.releaseDate?.slice(0, 4) || work?.releaseYear;
  const links = work ? catalogLinks(work, part) : [];
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="تفاصيل المشاهدة">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {episode && (
            <p className="text-sm text-muted-foreground">
              {part?.title} · الحلقة {episodeNumberLabel(episode.number)}
            </p>
          )}
          <h1 className="text-xl leading-relaxed font-semibold sm:text-2xl" dir="auto">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {year && <span>{year}</span>}
            {runtime && <span>{runtime} دقيقة</span>}
            {work?.age && <Badge variant="outline">{work.age}</Badge>}
            {rating !== null && (
              <span className="flex items-center gap-1" title="تقييم نحّاسيو لهذا الجزء">
                <Star className="size-4 text-primary" aria-hidden="true" />
                {rating}/10 <span className="text-xs">تقييم الجزء</span>
              </span>
            )}
          </div>
        </div>
        {(onPrevious || onNext) && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!onPrevious} onClick={onPrevious}>
              <ChevronRight data-icon="inline-start" />
              السابقة
            </Button>
            <Button variant="outline" size="sm" disabled={!onNext} onClick={onNext}>
              التالية
              <ChevronLeft data-icon="inline-end" />
            </Button>
          </div>
        )}
      </div>
      {work && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
          <Button variant="link" render={<a href={workLink(work.id)} />} onClick={onLeave}>
            <ArrowRight data-icon="inline-start" />
            {work.titleAr || work.canonicalTitle}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={tracking.state.data?.isFavorite ? "secondary" : "outline"}
              aria-label={
                tracking.state.data?.isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"
              }
              aria-pressed={tracking.state.data?.isFavorite ?? false}
              disabled={!tracking.state.data || tracking.favorite.isPending}
              onClick={() => tracking.favorite.mutate(!tracking.state.data?.isFavorite)}
            >
              <Heart data-icon="inline-start" />
              المفضلة
            </Button>
            {part && (
              <WatchedControl
                tracking={tracking}
                installmentId={part.id}
                episodeId={episode?.id}
                label={title}
              />
            )}
          </div>
        </div>
      )}
      {tracking.favorite.isError && <Failure error={tracking.favorite.error} />}
      {(summary || links.length > 0 || work?.contentWarnings || work?.analysisNotes) && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>
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
              <p dir="auto" className="text-base leading-loose whitespace-pre-line wrap-anywhere">
                {summary}
              </p>
            )}
            {(work?.contentWarnings || work?.analysisNotes) && (
              <div
                className={cn(
                  "grid gap-6 border-t border-border pt-6",
                  work.contentWarnings && work.analysisNotes && "lg:grid-cols-2",
                )}
              >
                {work.contentWarnings && (
                  <section className="flex flex-col gap-3" aria-label="تنبيه المحتوى">
                    <h3 className="font-semibold">تنبيه المحتوى</h3>
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
                    <h3 className="font-semibold">ملاحظات التحليل</h3>
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
          {links.length > 0 && (
            <CardFooter className="flex-wrap gap-2">
              {links.map((link) => (
                <Button
                  key={link.label}
                  size="sm"
                  variant="outline"
                  render={<a href={link.href} target="_blank" rel="noopener noreferrer" />}
                >
                  {link.label}
                  <ExternalLink data-icon="inline-end" />
                </Button>
              ))}
            </CardFooter>
          )}
        </Card>
      )}
    </section>
  );
}

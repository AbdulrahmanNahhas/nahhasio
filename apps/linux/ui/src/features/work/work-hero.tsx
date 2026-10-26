import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, Film, FileVideo, Heart, Languages, Play, Tv } from "lucide-react";

import { languageName } from "@/lib/languages";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { ScoreBadge } from "../../components/media-card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { SaveWorkControl } from "../player/saved-works";
import { offlineStatusOptions } from "../player/saved-works-data";
import { requestDownload, requestWatch } from "../player/watch-request";
import { entityLink } from "../shell/navigation";
import { audienceLabels, statusLabels } from "./format";
import type { WorkTracking } from "./use-work-tracking";
import { WatchedControl } from "./watched-control";
import { WorkTrailers } from "./work-trailers";

export function releaseStatus(work: WorkDetail) {
  const statuses = work.installments.map((item) => item.status);
  if (statuses.length && statuses.every((status) => status === "completed")) return "completed";
  if (statuses.includes("airing")) return "airing";
  if (statuses.includes("announced")) return "announced";
  return "unknown";
}

export function WorkHero({
  work,
  tracking,
  onEpisodes,
}: {
  work: WorkDetail;
  tracking: WorkTracking;
  onEpisodes: () => void;
}) {
  const status = releaseStatus(work);
  const navigation = useCardNavigation();
  const Kind = work.installments.some((item) => item.kind === "season") ? Tv : Film;
  const state = tracking.state.data;
  const offline = useQuery(offlineStatusOptions());
  return (
    <header className="relative isolate overflow-hidden rounded-3xl m-2 border! border-border">
      {work && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <Artwork
            id={work.banner?.id ?? work.poster?.id}
            alt=""
            className="absolute top-0 h-dvh w-full scale-105 object-cover opacity-90"
            priority
          />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/50 to-background/20" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-l from-background via-background/30 to-background/20" />
      <div className="relative mx-auto grid min-h-160 max-w-screen-2xl items-end gap-10 px-6 pt-28 pb-12 md:px-10 lg:min-h-176 lg:grid-cols-[minmax(0,1fr)_18rem] lg:px-14 lg:pt-40 lg:pb-16">
        <div className="flex min-w-0 max-w-3xl flex-col items-start gap-5 md:gap-6">
          {work.planets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {work.planets.map((planet) => (
                <Badge
                  {...navigation}
                  key={planet.id}
                  variant="outline"
                  className="h-auto px-3 py-1.5 text-sm"
                  render={<a href={entityLink("planets", planet.slug)} />}
                >
                  {planet.icon} {planet.nameAr}
                </Badge>
              ))}
            </div>
          )}
          <h1
            className="w-full text-4xl leading-tight font-bold md:text-5xl lg:text-6xl"
            dir="auto"
          >
            {work.logo ? (
              <>
                <Artwork
                  id={work.logo.id}
                  alt={work.titleAr || work.canonicalTitle}
                  className="h-28 w-full max-w-lg object-contain object-right md:h-40 lg:h-48"
                  priority
                />
                <span className="sr-only">{work.titleAr || work.canonicalTitle}</span>
              </>
            ) : (
              work.titleAr || work.canonicalTitle
            )}
          </h1>
          {work.logo && (
            <p className="text-xl md:text-2xl" dir="auto">
              {work.titleAr || work.canonicalTitle}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-base text-muted-foreground md:gap-5">
            {!(status === "announced" && work.score.rating === null) && (
              <ScoreBadge score={work.score} />
            )}
            {work.releaseYear && (
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden="true" />
                {work.releaseYear}
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <Kind className="size-4" aria-hidden="true" />
              {work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
            </span>
            {work.age && (
              <Badge variant="secondary">
                <bdi>{work.age}</bdi>
              </Badge>
            )}
            {work.isPrivate && <Badge variant="outline">خاص</Badge>}
          </div>
          {(work.playbackPolicy === "files-only" || Boolean(work.dubLanguages?.length)) && (
            <div className="flex flex-wrap items-center gap-2" aria-label="الدبلجة ومصدر التشغيل">
              {work.playbackPolicy === "files-only" && (
                <Badge variant="outline" title="التشغيل من الملفات فقط">
                  <FileVideo data-icon="inline-start" />
                  ملفات فقط
                </Badge>
              )}
              {Boolean(work.dubLanguages?.length) && (
                <Badge
                  variant="secondary"
                  aria-label="لغات الدبلجة المسجّلة"
                  title="لغات الدبلجة المسجّلة للعمل"
                >
                  <Languages data-icon="inline-start" />
                  دبلجة: {work.dubLanguages?.map(languageName).join("، ")}
                </Badge>
              )}
            </div>
          )}
          {work.summary.trim() && (
            <p
              className="line-clamp-4 text-base leading-loose wrap-anywhere md:text-lg lg:text-xl"
              dir="auto"
            >
              {work.summary}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="h-12 px-6 text-base"
              size="lg"
              {...navigation}
              disabled={
                work.installments.length > 0 &&
                work.installments.every((item) => item.status === "announced")
              }
              onClick={() =>
                requestWatch({
                  workId: work.id,
                  title: work.titleAr || work.canonicalTitle,
                })
              }
            >
              <Play data-icon="inline-start" />
              تشغيل
            </Button>
            <Button
              {...navigation}
              size="icon-lg"
              className="size-12"
              aria-label="تنزيل الفيديو"
              title="تنزيل الفيديو"
              variant="outline"
              disabled={!work.installments.some((item) => item.status !== "announced")}
              onClick={() =>
                requestDownload({ workId: work.id, title: work.titleAr || work.canonicalTitle })
              }
            >
              <Download />
            </Button>
            {work.installments.length > 0 && (
              <Button
                {...navigation}
                className="h-12 px-6 text-base"
                size="lg"
                variant="outline"
                onClick={onEpisodes}
              >
                الأجزاء والحلقات
              </Button>
            )}
            <Button
              {...navigation}
              size="icon-lg"
              className="size-12"
              variant={state?.isFavorite ? "secondary" : "outline"}
              aria-label={state?.isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
              aria-pressed={state?.isFavorite ?? false}
              title={state?.isFavorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
              disabled={!state || tracking.pending || offline.data?.offline}
              onClick={() => tracking.favorite.mutate(!state?.isFavorite)}
            >
              <Heart data-icon="inline-start" />
            </Button>
            <WatchedControl tracking={tracking} label="العمل" compact large />
            <SaveWorkControl id={work.id} compact />
            <WorkTrailers trailers={work.trailers ?? []} />
          </div>
        </div>
        <div className="hidden lg:block">
          <HeroFacts work={work} status={status} />
        </div>
      </div>
    </header>
  );
}

function HeroFacts({ work, status }: { work: WorkDetail; status: string }) {
  const dates = work.installments
    .map((item) => item.releaseDate)
    .filter((date) => date !== null)
    .toSorted();
  const rows = [
    ["حالة الإصدار", statusLabels.get(status)],
    ["أول إصدار", dates[0]?.slice(0, 10)],
    ["الأجزاء", work.installmentCount],
    ["الحلقات", work.episodeCount || null],
    ["الجمهور", audienceLabels.get(work.audience)],
  ];
  return (
    <dl className="rounded-2xl border border-border bg-background/20 backdrop-blur-lg p-4">
      {rows
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <dt className="text-muted-foreground flex-1">{label}</dt>
            <dd className="text-start w-full flex-2 border-r pr-4 border-border">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

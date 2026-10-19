import { installmentRating } from "@arcadia/domain";
import type { WorkDetail, ViewerUnitState } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, ChevronDown, Download, Info, Play } from "lucide-react";
import { useRef, useState } from "react";

import { Progress } from "@/components/ui/progress";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { ScoreBadge } from "../../components/media-card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../../components/ui/popover";
import { savedDownloadOptions } from "../player/saved-downloads";
import { requestDownload, requestWatch } from "../player/watch-request";
import { replaceParams, useViewerRoute, workLink } from "../shell/navigation";
import { ArtworkGallery, MediaFiles, References } from "./data-panel";
import { RiskRows } from "./family-panel";
import { Disclosure, FieldList } from "./field-list";
import {
  dateLabel,
  episodeNumberLabel,
  externalIdLabels,
  pickArtwork,
  statusLabels,
} from "./format";
import type { WorkTracking } from "./use-work-tracking";
import { WatchedControl } from "./watched-control";

type Installment = WorkDetail["installments"][number];
type Episode = Installment["episodes"][number];

export function InstallmentsPanel({
  work,
  initial,
  tracking,
}: {
  work: WorkDetail;
  initial?: string;
  tracking: WorkTracking;
}) {
  const saved = useQuery({ ...savedDownloadOptions(), refetchInterval: 5000 });
  const route = useViewerRoute();
  const navigation = useCardNavigation();
  const [descending, setDescending] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const item = work.installments.find((unit) => unit.id === initial) ?? work.installments[0];
  if (!item) return null;
  const select = (id: string) => {
    const params = new URLSearchParams(route.params);
    params.delete("installment");
    params.delete("tab");
    params.delete("episode");
    params.set("installment", id);
    params.set("tab", "installments");
    replaceParams(`/titles/${work.id}`, params);
    setSelectorOpen(false);
  };
  const changeEpisode = (episodeId: string, open: boolean) => {
    const params = new URLSearchParams(route.params);
    if (open) {
      params.set("installment", item.id);
      params.set("tab", "installments");
      params.set("episode", episodeId);
    } else {
      params.delete("episode");
    }
    replaceParams(`/titles/${work.id}`, params);
  };
  const episodes = item.episodes.toSorted((a, b) =>
    descending ? b.position - a.position : a.position - b.position,
  );
  const rating = installmentRating(item.scores ?? {});
  const summary = tracking.state.data?.installments.find(
    (unit) => unit.installmentId === item.id,
  )?.summary;
  return (
    <div className="flex min-w-0 flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold md:text-3xl">
          {item.kind === "season" ? "الحلقات" : "الإصدار"}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
            <PopoverTrigger render={<Button {...navigation} variant="outline" size="lg" />}>
              <ChevronDown data-icon="inline-start" />
              {item.title}
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-96 w-80 max-w-full overflow-y-auto">
              <PopoverTitle>اختر الجزء</PopoverTitle>
              {work.installments.map((unit) => (
                <Button
                  key={unit.id}
                  variant={unit.id === item.id ? "secondary" : "ghost"}
                  onClick={() => select(unit.id)}
                  className="h-auto justify-start gap-4 py-3"
                  aria-pressed={unit.id === item.id}
                >
                  <Artwork
                    id={pickArtwork(unit.artwork, "poster")?.id ?? work.poster?.id}
                    alt=""
                    className="h-20 w-14 shrink-0 rounded-lg object-cover"
                  />
                  <span className="flex min-w-0 flex-col items-start gap-2 text-start">
                    <span className="text-base">{unit.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {unit.kind === "season"
                        ? `${unit.episodes.length} حلقة`
                        : unit.runtimeMinutes
                          ? `${unit.runtimeMinutes} دقيقة`
                          : "إصدار مستقل"}
                    </span>
                  </span>
                </Button>
              ))}
            </PopoverContent>
          </Popover>
          <WatchedControl tracking={tracking} installmentId={item.id} label={item.title} />
          {item.episodes.length > 1 && (
            <Button {...navigation} variant="outline" onClick={() => setDescending(!descending)}>
              <ArrowDownUp data-icon="inline-start" />
              {descending ? "الأحدث أولًا" : "الأقدم أولًا"}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-5 rounded-2xl border border-border/60 bg-card p-5 md:p-6">
        <Artwork
          id={pickArtwork(item.artwork, "poster")?.id ?? work.poster?.id}
          alt=""
          className="h-32 w-22 shrink-0 rounded-xl object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h3 className="text-xl font-semibold md:text-2xl">{item.title}</h3>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {!(item.status === "announced" && rating === null) && (
              <ScoreBadge score={{ rating, scored: rating === null ? 0 : 1, total: 1 }} />
            )}
            <Badge variant="outline">{statusLabels.get(item.status)}</Badge>
            <span>{dateLabel(item.releaseDate)}</span>
            {item.runtimeMinutes && <span>{item.runtimeMinutes} دقيقة</span>}
            {summary && summary.releasedUnits > 0 && (
              <span>
                {summary.watchedReleasedUnits} من {summary.releasedUnits} تمّت مشاهدته
              </span>
            )}
          </div>
          {item.summary.trim() && (
            <p className="line-clamp-3 text-base leading-loose" dir="auto">
              {item.summary}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {item.kind !== "season" && (
              <Button
                {...navigation}
                onClick={() =>
                  requestWatch({
                    workId: work.id,
                    installmentId: item.id,
                    title: `${work.titleAr || work.canonicalTitle} · ${item.title}`,
                  })
                }
              >
                <Play data-icon="inline-start" />
                تشغيل الإصدار
              </Button>
            )}
            <InstallmentDetails item={item} />
          </div>
        </div>
      </div>
      {item.episodes.length > 0 && (
        <div
          className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="حلقات الجزء"
        >
          {episodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              downloaded={
                saved.data?.some(
                  (file) =>
                    file.available &&
                    file.target.workId === work.id &&
                    file.target.episodeId === episode.id,
                ) ?? false
              }
              installment={item}
              work={work}
              tracking={tracking}
              open={route.params.get("episode") === episode.id}
              onOpenChange={(open) => changeEpisode(episode.id, open)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InstallmentDetails({ item }: { item: Installment }) {
  const navigation = useCardNavigation();
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog>
      <DialogTrigger render={<Button {...navigation} variant="ghost" size="sm" />}>
        <Info data-icon="inline-start" />
        تفاصيل الإصدار
      </DialogTrigger>
      <DialogContent initialFocus={heading} className="max-h-5/6 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle ref={heading} tabIndex={-1}>
            {item.title}
          </DialogTitle>
          <DialogDescription>بيانات الإصدار المسجّلة في المكتبة</DialogDescription>
        </DialogHeader>
        {item.summary.trim() && (
          <p className="text-base leading-loose whitespace-pre-line">{item.summary}</p>
        )}
        <FieldList
          rows={[
            ["الترتيب", item.position],
            ["المدة بالدقائق", item.runtimeMinutes],
            ["تاريخ الإصدار", dateLabel(item.releaseDate)],
            ["حالة الإصدار", statusLabels.get(item.status)],
            ["الحلقات", item.episodes.length],
          ]}
        />
        <RiskRows classification={item.classification} overrides={item.classificationOverrides} />
        <References items={item.externalReferences} />
        <FieldList
          rows={Object.entries(item.externalIds)
            .filter(([, value]) => value !== null)
            .map(([key, value]) => [externalIdLabels.get(key) ?? key, value])}
        />
        {item.mediaFiles.length > 0 && <MediaFiles files={item.mediaFiles} />}
        {item.artwork.length > 0 && <ArtworkGallery images={item.artwork} />}
        <Disclosure title="معرّف السجل">
          <p className="text-xs" dir="ltr">
            {item.id}
          </p>
        </Disclosure>
      </DialogContent>
    </Dialog>
  );
}

function EpisodeCard({
  episode,
  downloaded,
  installment,
  work,
  tracking,
  open,
  onOpenChange,
}: {
  episode: Episode;
  downloaded: boolean;
  installment: Installment;
  work: WorkDetail;
  tracking: WorkTracking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigation = useCardNavigation();
  const [triggerId, setTriggerId] = useState<string | null>(null);
  const number = episodeNumberLabel(episode.number);
  const state = tracking.unitByEpisode.get(episode.id);
  const image =
    episode.still ??
    pickArtwork(episode.artwork, "still") ??
    pickArtwork(episode.artwork, "banner") ??
    episode.artwork[0] ??
    pickArtwork(installment.artwork, "banner") ??
    work.banner;
  return (
    <Dialog
      open={open}
      triggerId={triggerId}
      onOpenChange={(nextOpen, details) => {
        if (
          nextOpen &&
          "ctrlKey" in details.event &&
          (details.event.ctrlKey ||
            details.event.metaKey ||
            details.event.shiftKey ||
            details.event.altKey)
        ) {
          details.cancel();
          return;
        }
        if (nextOpen) setTriggerId(details.trigger?.id ?? null);
        onOpenChange(nextOpen);
      }}
    >
      <article className="relative flex min-w-0 flex-col gap-4" aria-label={`الحلقة ${number}`}>
        <DialogTrigger
          nativeButton={false}
          role="link"
          render={
            <a
              {...navigation}
              href={`${workLink(work.id, installment.id)}&episode=${episode.id}`}
              onClick={(event) => {
                if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey)
                  event.preventDefault();
              }}
              className="group/episode flex min-w-0 flex-col gap-4 rounded-3xl text-start focus-visible:outline-none"
              aria-label={`فتح الحلقة ${number} · ${episode.title || "تفاصيل الحلقة"}`}
            />
          }
        >
          <span className="relative block aspect-video rounded-3xl border border-border bg-card transition-[box-shadow,border-color] duration-200 group-hover/episode:border-foreground/60 group-hover/episode:shadow-lg group-focus-visible/episode:ring-4 group-focus-visible/episode:ring-foreground group-focus-visible/episode:ring-offset-2 group-focus-visible/episode:ring-offset-background motion-reduce:transition-none">
            <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
              <Artwork id={image?.id} alt="" className="block size-full object-cover" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-background/85 to-transparent" />
            </span>
            <span className="absolute start-3 top-3">
              <Badge variant="secondary">{number}</Badge>
            </span>
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="grid size-14 place-items-center rounded-full border border-foreground/30 bg-background/75 text-foreground transition-transform group-hover/episode:scale-110 group-focus-visible/episode:scale-110 motion-reduce:transform-none">
                <Play className="size-6" aria-hidden="true" />
              </span>
            </span>
            <span className="absolute start-3 bottom-3 flex gap-2">
              {episode.runtimeMinutes && (
                <Badge variant="secondary">{episode.runtimeMinutes} د</Badge>
              )}
              {episode.releaseState === "upcoming" && <Badge variant="outline">قادم</Badge>}
              {downloaded && <Badge variant="secondary">محمّلة</Badge>}
            </span>
          </span>
          <h3 className="min-w-0 text-lg leading-relaxed font-semibold transition-colors group-hover/episode:text-primary group-focus-visible/episode:text-primary md:text-xl motion-reduce:transition-none">
            {episode.title || `الحلقة ${number}`}
          </h3>
          {episode.summary.trim() && (
            <p className="line-clamp-2 text-base leading-relaxed text-muted-foreground" dir="auto">
              {episode.summary}
            </p>
          )}
        </DialogTrigger>
        <div className="absolute end-3 top-3">
          <WatchedControl
            tracking={tracking}
            installmentId={installment.id}
            episodeId={episode.id}
            label={`الحلقة ${number}`}
            compact
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            {...navigation}
            variant="secondary"
            aria-label={`تشغيل الحلقة ${number}`}
            onClick={() =>
              requestWatch({
                workId: work.id,
                installmentId: installment.id,
                episodeId: episode.id,
                title: `${work.titleAr || work.canonicalTitle} · الحلقة ${number}`,
              })
            }
          >
            <Play data-icon="inline-start" />
            مشاهدة
          </Button>
          <Button
            variant="outline"
            {...navigation}
            disabled={
              downloaded ||
              episode.releaseState === "upcoming" ||
              installment.status === "announced"
            }
            aria-label={`تنزيل الحلقة ${number}`}
            onClick={() =>
              requestDownload({
                workId: work.id,
                installmentId: installment.id,
                episodeId: episode.id,
                title: `${work.titleAr || work.canonicalTitle} · الحلقة ${number}`,
              })
            }
          >
            <Download data-icon="inline-start" />
            {downloaded ? "محمّلة" : "تنزيل"}
          </Button>
          <DialogTrigger
            render={<Button {...navigation} variant="ghost" size="icon-sm" />}
            aria-label={`تفاصيل الحلقة ${number}`}
          >
            <Info />
          </DialogTrigger>
        </div>
        {state && state.positionSeconds > 0 && !state.isPlayed && state.durationSeconds && (
          <Progress
            className="h-1 w-full accent-primary"
            value={state.positionSeconds}
            max={state.durationSeconds}
            aria-label={`تقدم الحلقة ${number}`}
          />
        )}
        <EpisodeDetails episode={episode} number={number} state={state} />
      </article>
    </Dialog>
  );
}
function EpisodeDetails({
  episode,
  number,
  state,
}: {
  episode: Episode;
  number: string;
  state?: ViewerUnitState;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <DialogContent initialFocus={heading} className="max-h-5/6 overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle ref={heading} tabIndex={-1}>
          {number} · {episode.title || "حلقة بلا عنوان"}
        </DialogTitle>
        <DialogDescription>تفاصيل الحلقة في المكتبة</DialogDescription>
      </DialogHeader>
      {episode.summary.trim() && (
        <p className="text-base leading-loose whitespace-pre-line">{episode.summary}</p>
      )}
      <FieldList
        rows={[
          ["رقم الحلقة", number],
          ["الترتيب", episode.position],
          ["تاريخ الإصدار", dateLabel(episode.releaseDate)],
          ["المدة بالدقائق", episode.runtimeMinutes],
          ["حالة الإصدار", statusLabels.get(episode.releaseState)],
          ["المشاهدة", state ? (state.isPlayed ? "تمّت المشاهدة" : "لم تُشاهَد") : null],
          ["علامة يدوية", state ? (state.playedManually ? "نعم" : "لا") : null],
        ]}
      />
      {state?.positionSeconds ? (
        <FieldList
          rows={[
            ["تقدم التشغيل بالثواني", state.positionSeconds],
            ["المدة المسجّلة بالثواني", state.durationSeconds],
            ["تاريخ المشاهدة", dateLabel(state.playedAt)],
            ["إزاحة الترجمة بالمللي ثانية", state.subtitleOffsetMs],
          ]}
        />
      ) : null}
      <RiskRows classification={episode.classification} />
      {episode.mediaFiles.length > 0 && <MediaFiles files={episode.mediaFiles} />}
      {episode.artwork.length > 0 && <ArtworkGallery images={episode.artwork} />}
      <Disclosure title="معرّف السجل">
        <p className="text-xs" dir="ltr">
          {episode.id}
        </p>
      </Disclosure>
    </DialogContent>
  );
}

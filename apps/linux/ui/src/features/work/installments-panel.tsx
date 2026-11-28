import { installmentRating } from "@arcadia/domain";
import type { WorkDetail, ViewerUnitState } from "@nahhasio/api-contract";
import {
  Menu,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import { cn } from "cn";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  Clock,
  Download,
  Info,
  Layers3,
  Play,
  Check,
} from "lucide-react";
import { useRef, useState } from "react";

import { EpisodeThumbnail, episodeTiming } from "@/components/episode-thumbnail";
import { LanguageBadges } from "@/components/language-badges";
import { scoreTone } from "@/components/score-tone";
import { SdkMenuContent, SdkMenuIndicator, sdkMenuItemClassName } from "@/components/ui-sdk/menu";
import { MobileDrawer } from "@/components/ui-sdk/mobile-drawer";
import { Progress } from "@/components/ui-sdk/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { workLanguages } from "@/lib/languages";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { HomeBatchDownload } from "../player/home-batch-download";
import { isUpcomingTarget } from "../player/release-eligibility";
import { useDownloadedEpisodeIds } from "../player/saved-downloads";
import { requestDownload, requestWatch } from "../player/watch-request";
import { replaceParams, useViewerRoute } from "../shell/navigation";
import { ArtworkGallery, MediaFiles } from "./data-panel";
import { RiskRows } from "./family-panel";
import { Disclosure, FieldList, PanelEmpty } from "./field-list";
import { dateLabel, episodeNumberLabel, pickArtwork, statusLabels } from "./format";
import { InstallmentDetails } from "./installment-details";
import type { WorkTracking } from "./use-work-tracking";
import { WatchedControl } from "./watched-control";

type Installment = WorkDetail["installments"][number];
type Episode = Installment["episodes"][number];
const previewEpisodeCount = 9;

export function InstallmentsPanel({
  work,
  initial,
  tracking,
  fullEpisodes,
  onShowAllEpisodes,
}: {
  work: WorkDetail;
  initial?: string;
  tracking: WorkTracking;
  fullEpisodes: boolean;
  onShowAllEpisodes: () => void;
}) {
  const downloadedEpisodeIds = useDownloadedEpisodeIds(work.id);
  const route = useViewerRoute();
  const navigation = useCardNavigation();
  const mobile = useIsMobile();
  const [descending, setDescending] = useState(false);
  const [filter, setFilter] = useState("all");
  const installments = fullEpisodes
    ? work.installments.filter((unit) => unit.kind === "season")
    : work.installments;
  const item = installments.find((unit) => unit.id === initial) ?? installments[0];
  if (!item) return null;
  const select = (id: string) => {
    const params = new URLSearchParams(route.params);
    params.delete("tab");
    params.delete("episode");
    params.set("installment", id);
    replaceParams(`/titles/${work.id}`, params);
  };
  const changeEpisode = (episodeId: string, open: boolean) => {
    const params = new URLSearchParams(route.params);
    if (open) {
      params.set("installment", item.id);
      params.delete("tab");
      params.set("episode", episodeId);
    } else {
      params.delete("episode");
    }
    replaceParams(`/titles/${work.id}`, params);
  };
  const episodes = item.episodes.toSorted((a, b) =>
    descending ? b.position - a.position : a.position - b.position,
  );
  const openEpisodeId = route.params.get("episode");
  const matchesFilter = (episode: Episode) => {
    const unit = tracking.unitByEpisode.get(episode.id);
    return filter === "all" || (unit && unit.isPlayed === (filter === "watched"));
  };
  const filteredEpisodes =
    fullEpisodes && filter !== "all" ? episodes.filter(matchesFilter) : episodes;
  const visibleEpisodes = fullEpisodes
    ? openEpisodeId && filter !== "all"
      ? episodes.filter((episode) => episode.id === openEpisodeId || matchesFilter(episode))
      : filteredEpisodes
    : episodes.filter(
        (episode, index) => index < previewEpisodeCount || episode.id === openEpisodeId,
      );
  const rating = installmentRating(item.scores ?? {});
  const score = rating === null ? null : Math.round(rating * 10);
  const poster = pickArtwork(item.artwork, "poster")?.id ?? work.poster?.id;
  const summary = tracking.state.data?.installments.find(
    (unit) => unit.installmentId === item.id,
  )?.summary;
  const upcoming = isUpcomingTarget(item);
  const status = upcoming
    ? "upcoming"
    : item.status === "unknown"
      ? item.releaseState
      : item.status;
  const languages = item.languages ?? workLanguages(work);
  const isSeason = item.kind === "season";
  const isFilm = item.kind === "movie";
  const compactRelease = isSeason || isFilm;
  const filmUnit = isFilm
    ? tracking.unitsByInstallment.get(item.id)?.find((unit) => unit.episodeId === null)
    : undefined;
  const showFilmSynopsis =
    work.installments.length > 1 || item.summary.trim() !== work.summary.trim();
  const hasEpisodeCount = item.kind === "season" && item.episodes.length > 0;
  const seasonProgress =
    item.kind === "season" && summary && summary.releasedUnits > 0 ? summary : null;
  const showEpisodeTotal =
    hasEpisodeCount && item.episodes.length !== seasonProgress?.releasedUnits;
  const synopsis = item.summary.trim() && (
    <p
      className={cn(
        "line-clamp-3 max-w-4xl text-base leading-relaxed wrap-anywhere text-foreground/90",
        !compactRelease && "sm:text-lg",
      )}
      dir="auto"
    >
      {item.summary}
    </p>
  );
  const releaseActions = !isSeason && (
    <>
      {!upcoming && (
        <Button
          {...navigation}
          size={isFilm ? "default" : "lg"}
          onClick={() =>
            requestWatch({
              workId: work.id,
              installmentId: item.id,
              title: `${work.titleAr || work.canonicalTitle} · ${item.title}`,
            })
          }
        >
          <Play data-icon="inline-start" aria-hidden />
          {filmUnit?.isPlayed
            ? "إعادة المشاهدة"
            : filmUnit && filmUnit.positionSeconds > 0
              ? "تابع المشاهدة"
              : "تشغيل الإصدار"}
        </Button>
      )}
      {!isFilm && <InstallmentDetails item={item} work={work} />}
    </>
  );
  const sortLabel = descending ? "الأحدث أولًا" : "الأقدم أولًا";
  const controls = (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      aria-label="خيارات الإصدار"
      role="group"
    >
      {installments.length > 1 && (
        <InstallmentPicker work={work} items={installments} item={item} onSelect={select} />
      )}
      <WatchedControl
        tracking={tracking}
        installmentId={item.id}
        label={item.title}
        compact={compactRelease}
      />
      {episodes.length > 1 && (
        <Button
          {...navigation}
          variant="outline"
          size={mobile ? "icon-lg" : "lg"}
          aria-label={sortLabel}
          title={sortLabel}
          onClick={() => setDescending(!descending)}
        >
          <ArrowDownUp data-icon="inline-start" aria-hidden />
          {!mobile && sortLabel}
        </Button>
      )}
      <HomeBatchDownload workId={work.id} />
    </div>
  );
  return (
    <div className={cn("flex min-w-0 flex-col", mobile || fullEpisodes ? "gap-4" : "gap-7")}>
      {(!fullEpisodes || !mobile) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          {!fullEpisodes && (
            <h2 className="text-2xl font-semibold md:text-3xl">
              {isSeason ? "الحلقات" : "الإصدار"}
            </h2>
          )}
          {!mobile && controls}
        </div>
      )}
      {(!fullEpisodes || item.kind !== "season") && (
        <section
          aria-label={item.title}
          className={cn(
            "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/60 p-4",
            compactRelease ? "gap-3 sm:p-4" : "gap-5 sm:p-6",
            seasonProgress && "pb-5 sm:pb-5",
          )}
        >
          <div className="flex min-w-0 items-start gap-3 sm:gap-5">
            {poster && (
              <Artwork
                id={poster}
                alt=""
                className={cn(
                  "aspect-2/3 w-16 shrink-0 rounded-xl object-cover",
                  isSeason ? "sm:w-20 lg:w-22" : isFilm ? "sm:w-22" : "sm:w-24 lg:w-28",
                )}
              />
            )}
            <div className={cn("flex min-w-0 flex-1 flex-col", compactRelease ? "gap-2" : "gap-3")}>
              <div
                className={cn(
                  "flex min-w-0 flex-col items-start gap-2",
                  compactRelease
                    ? "sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3"
                    : "sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                )}
              >
                <div className="flex min-w-0 items-start gap-2 sm:items-center">
                  <h3
                    className={cn(
                      "min-w-0 text-xl leading-snug font-bold wrap-anywhere",
                      compactRelease ? "sm:text-2xl" : "sm:text-3xl",
                    )}
                  >
                    <bdi>{item.title}</bdi>
                  </h3>
                  {compactRelease && <InstallmentDetails item={item} work={work} />}
                </div>
                {(status !== "unknown" || score !== null) && (
                  <div className="flex shrink-0 items-center gap-2">
                    {status !== "unknown" && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-7 px-2.5 text-sm",
                          upcoming && "border-warning/35 bg-warning/10 text-warning",
                          status === "airing" && "border-success/35 bg-success/10 text-success",
                        )}
                      >
                        {statusLabels.get(status)}
                      </Badge>
                    )}
                    {score !== null && (
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full border border-score-ink/15 text-sm font-bold text-score-ink tabular-nums",
                          !compactRelease && "sm:size-11 sm:text-base",
                          scoreTone(score).background,
                        )}
                        aria-label={`التقييم ${score} من 100`}
                        role="img"
                      >
                        {score}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {(item.releaseDate ||
                hasEpisodeCount ||
                item.runtimeMinutes ||
                seasonProgress ||
                languages.length > 0) && (
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/85",
                    !compactRelease && "sm:text-base",
                  )}
                >
                  {item.releaseDate && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <time dateTime={item.releaseDate}>{dateLabel(item.releaseDate)}</time>
                    </span>
                  )}
                  {showEpisodeTotal && (
                    <span className="inline-flex items-center gap-1.5">
                      <Layers3 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {item.episodes.length} حلقة
                    </span>
                  )}
                  {item.runtimeMinutes && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {item.runtimeMinutes} دقيقة
                    </span>
                  )}
                  {seasonProgress && (
                    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
                      {seasonProgress.isFullyWatched ? (
                        <Check className="size-4 shrink-0 text-success" aria-hidden />
                      ) : null}
                      شوهد {seasonProgress.watchedReleasedUnits} من {seasonProgress.releasedUnits}{" "}
                      حلقة
                    </span>
                  )}
                  {languages.length > 0 && (
                    <div className="min-w-0 lg:ms-auto">
                      <LanguageBadges languages={languages} />
                    </div>
                  )}
                </div>
              )}
              {isSeason && synopsis}
              {isFilm && (
                <div className="flex min-w-0 flex-col gap-3">
                  {showFilmSynopsis && synopsis}
                  <div className="flex flex-wrap justify-end gap-2">{releaseActions}</div>
                </div>
              )}
            </div>
          </div>
          {seasonProgress && (
            <Progress
              className={cn(
                "absolute inset-x-0 bottom-0 **:data-[slot=progress-track]:h-1 **:data-[slot=progress-track]:rounded-none",
                seasonProgress.isFullyWatched && "**:data-[slot=progress-indicator]:bg-success",
              )}
              aria-label="تقدّم مشاهدة الموسم"
              value={(seasonProgress.watchedReleasedUnits / seasonProgress.releasedUnits) * 100}
            />
          )}
          {!compactRelease && (
            <>
              {synopsis}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {releaseActions}
              </div>
            </>
          )}
        </section>
      )}
      {mobile && controls}
      {fullEpisodes && episodes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <ToggleGroup
            aria-label="حالة مشاهدة الحلقات"
            variant="outline"
            size="sm"
            spacing={0}
            value={[filter]}
            onValueChange={(value) => setFilter(value[0] ?? "all")}
            disabled={!tracking.state.data}
          >
            <ToggleGroupItem value="all">الكل</ToggleGroupItem>
            <ToggleGroupItem value="watched">شُوهدت</ToggleGroupItem>
            <ToggleGroupItem value="unwatched">لم تُشاهَد</ToggleGroupItem>
          </ToggleGroup>
          <p role="status" className="text-sm text-muted-foreground tabular-nums">
            {filteredEpisodes.length} من {episodes.length} حلقة
          </p>
        </div>
      )}
      {fullEpisodes && isSeason && visibleEpisodes.length === 0 && (
        <PanelEmpty
          title={
            episodes.length > 0 ? "لا توجد حلقات تطابق هذا الفلتر" : "لا توجد حلقات لهذا الموسم بعد"
          }
        />
      )}
      {visibleEpisodes.length > 0 && (
        <div
          className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="حلقات الجزء"
          data-card-navigation-group
        >
          {visibleEpisodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              downloaded={downloadedEpisodeIds.has(episode.id)}
              installment={item}
              work={work}
              tracking={tracking}
              open={openEpisodeId === episode.id}
              onOpenChange={(open) => changeEpisode(episode.id, open)}
            />
          ))}
        </div>
      )}
      {!fullEpisodes && episodes.length > previewEpisodeCount && (
        <Button
          {...navigation}
          variant="outline"
          size="lg"
          className="mx-auto"
          onClick={onShowAllEpisodes}
        >
          عرض كل الحلقات
          <bdi className="text-xs text-muted-foreground tabular-nums">{episodes.length}</bdi>
        </Button>
      )}
    </div>
  );
}

function InstallmentPicker({
  work,
  items,
  item,
  onSelect,
}: {
  work: WorkDetail;
  items: Installment[];
  item: Installment;
  onSelect: (id: string) => void;
}) {
  const mobile = useIsMobile();
  const navigation = useCardNavigation();
  const [open, setOpen] = useState(false);
  const title = "المواسم والإصدارات";
  const triggerContent = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <Layers3 className="shrink-0" data-icon="inline-start" aria-hidden />
        <bdi className="min-w-0 truncate">{item.title}</bdi>
      </div>
      <ChevronDown data-icon="inline-end" aria-hidden />
    </>
  );
  if (mobile) {
    return (
      <MobileDrawer
        title={title}
        showTitle={false}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            {...navigation}
            variant="outline"
            size="lg"
            className="min-w-0 max-w-full flex-1 justify-between"
          >
            {triggerContent}
          </Button>
        }
      >
        <div className="flex flex-col gap-2 p-4">
          {items.map((unit) => (
            <Button
              key={unit.id}
              variant={unit.id === item.id ? "secondary" : "ghost"}
              className="h-auto w-full justify-start gap-3 p-2 text-start whitespace-normal rounded-2xl!"
              aria-current={unit.id === item.id ? "true" : undefined}
              onClick={() => {
                onSelect(unit.id);
                setOpen(false);
              }}
            >
              <InstallmentOption unit={unit} work={work} />
              {unit.id === item.id && <Check data-icon="inline-end" aria-hidden />}
            </Button>
          ))}
        </div>
      </MobileDrawer>
    );
  }
  return (
    <Menu>
      <MenuTrigger
        {...navigation}
        className={buttonVariants({
          variant: "outline",
          size: "lg",
          className: "min-w-0 max-w-full",
        })}
      >
        {triggerContent}
      </MenuTrigger>
      <SdkMenuContent align="start" className="w-80">
        <MenuRadioGroup value={item.id} onValueChange={onSelect}>
          <MenuGroupLabel className="px-3 py-2 text-xs font-medium text-muted-foreground">
            {title}
          </MenuGroupLabel>
          <MenuSeparator className="mx-2 my-1 h-px bg-border" />
          {items.map((unit) => (
            <MenuRadioItem
              key={unit.id}
              value={unit.id}
              label={unit.title}
              closeOnSelect
              className={cn(sdkMenuItemClassName, "gap-3")}
            >
              <InstallmentOption unit={unit} work={work} />
              <SdkMenuIndicator />
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </SdkMenuContent>
    </Menu>
  );
}

function InstallmentOption({ unit, work }: { unit: Installment; work: WorkDetail }) {
  return (
    <>
      <span className="w-10 shrink-0" aria-hidden>
        <Artwork
          id={pickArtwork(unit.artwork, "poster")?.id ?? work.poster?.id}
          alt=""
          className="aspect-2/3 w-full rounded-md object-cover"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <bdi className="max-w-full truncate font-semibold">{unit.title}</bdi>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {unit.kind === "season"
            ? `${unit.episodes.length} حلقة`
            : unit.runtimeMinutes
              ? `${unit.runtimeMinutes} دقيقة`
              : "إصدار مستقل"}
          {isUpcomingTarget(unit) && <Badge variant="outline">قادم</Badge>}
        </span>
      </span>
    </>
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
  const mobile = useIsMobile();
  const heading = useRef<HTMLHeadingElement>(null);
  const [triggerId, setTriggerId] = useState<string | null>(null);
  const number = episodeNumberLabel(episode.number);
  const state = tracking.unitByEpisode.get(episode.id);
  const duration =
    state?.durationSeconds ?? (episode.runtimeMinutes ? episode.runtimeMinutes * 60 : null);
  const timing = !state?.isPlayed ? episodeTiming(state?.positionSeconds ?? 0, duration) : null;
  const upcoming = isUpcomingTarget(installment, episode);
  const target = {
    workId: work.id,
    installmentId: installment.id,
    episodeId: episode.id,
    title: `${work.titleAr || work.canonicalTitle} · الحلقة ${number}`,
  };
  const play = () => requestWatch(target);
  const image =
    episode.still ??
    pickArtwork(episode.artwork, "still") ??
    pickArtwork(episode.artwork, "banner") ??
    episode.artwork.find((item) => item.isPrimary) ??
    pickArtwork(installment.artwork, "banner") ??
    work.banner;
  const title = `${number} · ${episode.title || "حلقة بلا عنوان"}`;
  const description = "تفاصيل الحلقة في المكتبة";
  const info = (
    <Button
      {...navigation}
      variant="secondary"
      size="icon-sm"
      className="absolute end-3 top-3"
      aria-label={`تفاصيل الحلقة ${number}`}
      title={`تفاصيل الحلقة ${number}`}
    >
      <Info aria-hidden />
    </Button>
  );
  const download = downloaded ? (
    <Button
      nativeButton={false}
      size="sm"
      variant="outline"
      render={<a href="#/downloads?view=library" />}
      aria-label={`إدارة الحلقة ${number} المحمّلة`}
    >
      <Check data-icon="inline-start" aria-hidden />
      محمّلة على الجهاز
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      disabled={upcoming}
      aria-label={`تنزيل الحلقة ${number}`}
      onClick={() => {
        onOpenChange(false);
        requestDownload(target);
      }}
    >
      <Download data-icon="inline-start" aria-hidden />
      تنزيل
    </Button>
  );
  const detailsBody = (
    <div className="flex flex-col items-start gap-4">
      {download}
      <EpisodeDetails episode={episode} number={number} state={state} />
    </div>
  );
  return (
    <article
      data-episode-card
      className="group/episode relative flex min-w-0 flex-col gap-3 hover:z-10 focus-within:z-10"
      aria-label={`الحلقة ${number}`}
    >
      <EpisodeThumbnail
        artworkId={image?.id}
        label={upcoming ? `الحلقة ${number} لم تصدر بعد` : `تشغيل الحلقة ${number}`}
        onPlay={play}
        disabled={upcoming}
        played={state?.isPlayed}
        position={state?.positionSeconds ?? 0}
        duration={duration}
        topStart={<Badge variant="secondary">الحلقة {number}</Badge>}
        bottomStart={
          upcoming ? (
            <Badge variant="secondary">قادم</Badge>
          ) : state?.isPlayed ? (
            <Badge variant="secondary">
              <Check className="text-success" data-icon="inline-start" aria-hidden /> شُوهدت
            </Badge>
          ) : timing ? (
            <Badge variant="secondary">{timing}</Badge>
          ) : null
        }
        bottomEnd={
          downloaded ? (
            <Badge variant="secondary">محمّلة على الجهاز</Badge>
          ) : episode.runtimeMinutes ? (
            <Badge variant="secondary">{episode.runtimeMinutes} د</Badge>
          ) : null
        }
      />
      {mobile ? (
        <MobileDrawer
          title={title}
          description={description}
          showTitle
          open={open}
          onOpenChange={onOpenChange}
          trigger={info}
        >
          <div className="p-4">{detailsBody}</div>
        </MobileDrawer>
      ) : (
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
          <DialogTrigger render={info} />
          <DialogContent initialFocus={heading} className="max-h-5/6 overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle ref={heading} tabIndex={-1}>
                {title}
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {detailsBody}
          </DialogContent>
        </Dialog>
      )}
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3 className="min-w-0">
          <Button
            {...navigation}
            variant="ghost"
            size="sm"
            className="h-auto max-w-full justify-start px-0 py-0 text-start text-lg whitespace-normal"
            disabled={upcoming}
            onClick={play}
          >
            {episode.title || `الحلقة ${number}`}
          </Button>
        </h3>
        <WatchedControl
          tracking={tracking}
          installmentId={installment.id}
          episodeId={episode.id}
          label={`الحلقة ${number}`}
          compact
        />
      </div>
      {episode.summary.trim() && (
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground" dir="auto">
          {episode.summary}
        </p>
      )}
    </article>
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
  return (
    <>
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
    </>
  );
}

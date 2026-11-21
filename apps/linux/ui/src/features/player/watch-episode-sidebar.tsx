import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import type { Episode, ViewerUnitState } from "@nahhasio/api-contract";
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Play,
  Search,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Artwork } from "@/components/artwork";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemGroup } from "@/components/ui/item";
import { ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { episodeNumberLabel } from "@/features/work/format";

type EpisodeRow = {
  episode: Episode;
  imageId?: string;
  state?: ViewerUnitState;
  downloaded: boolean;
  progress: number;
};

function searchable(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}|ـ/gu, "")
    .toLowerCase()
    .trim();
}

const filterClass = buttonVariants({
  variant: "ghost",
  size: "sm",
  className: "flex-1 data-checked:bg-secondary data-checked:text-secondary-foreground",
});

export function WatchEpisodeSidebar({
  rows,
  season,
  activeId,
  playing,
  pending,
  disabled,
  expanded,
  onExpand,
  onChoose,
}: {
  rows: EpisodeRow[];
  season: ReactNode;
  activeId?: string;
  playing: boolean;
  pending: boolean;
  disabled: boolean;
  expanded: boolean;
  onExpand: () => void;
  onChoose: (episode: Episode) => void;
}) {
  const [search, setSearch] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);
  const [unwatchedOnly, setUnwatchedOnly] = useState(false);
  const panelId = useId();
  const searchId = useId();
  const list = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const showSearch = searchExpanded || Boolean(search);
  const query = searchable(search);
  const visible = rows
    .filter(({ episode }) => searchable(`${episode.number} ${episode.title ?? ""}`).includes(query))
    .filter(({ state }) => !unwatchedOnly || !state?.isPlayed)
    .toSorted(({ episode: a }, { episode: b }) =>
      newestFirst ? b.position - a.position : a.position - b.position,
    );
  const SortIcon = newestFirst ? ArrowUpWideNarrow : ArrowDownWideNarrow;
  const orderLabel = newestFirst ? "الأحدث أولًا" : "الأقدم أولًا";

  useEffect(() => {
    if (searchExpanded) searchInput.current?.focus();
  }, [searchExpanded]);

  useEffect(() => {
    const container = list.current;
    if (!activeId || !container || (!expanded && !container.offsetParent)) return;
    const selected = container.querySelector('[aria-current="true"]');
    if (!selected) return;
    const bounds = container.getBoundingClientRect();
    const row = selected.getBoundingClientRect();
    if (container.scrollWidth > container.clientWidth) {
      if (row.left < bounds.left) container.scrollLeft += row.left - bounds.left;
      else if (row.right > bounds.right) container.scrollLeft += row.right - bounds.right;
      return;
    }
    if (row.top < bounds.top) container.scrollTop += row.top - bounds.top;
    else if (row.bottom > bounds.bottom) container.scrollTop += row.bottom - bounds.bottom;
  }, [activeId, expanded]);

  return (
    <aside
      className="flex min-w-0 flex-col gap-3 border-t border-border pt-4 xl:max-h-[calc(100dvh-4rem)] xl:rounded-2xl xl:border xl:bg-card xl:p-3"
      aria-label="حلقات العمل"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{season}</div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" role="status">
            {visible.length === rows.length
              ? `${rows.length} حلقة`
              : `${visible.length} من ${rows.length}`}
          </Badge>
          <Button
            className="xl:hidden"
            variant="ghost"
            size="icon-lg"
            aria-label={expanded ? "إخفاء الحلقات" : "إظهار الحلقات"}
            aria-controls={panelId}
            aria-expanded={expanded}
            onClick={onExpand}
          >
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </div>
      <div
        id={panelId}
        className={
          expanded ? "flex min-h-0 flex-col gap-3" : "hidden min-h-0 flex-col gap-3 xl:flex"
        }
      >
        <div className="flex flex-col gap-2 md:max-xl:grid md:max-xl:grid-cols-2">
          <div className="flex items-center gap-2">
            <SegmentedControl
              aria-label="تصفية الحلقات حسب المشاهدة"
              value={unwatchedOnly ? "unwatched" : "all"}
              onValueChange={(value) => setUnwatchedOnly(value === "unwatched")}
              className="flex min-w-0 flex-1 gap-1 rounded-full bg-muted/40 p-1"
            >
              <SegmentedControlItem value="all" className={filterClass}>
                الكل
              </SegmentedControlItem>
              <SegmentedControlItem value="unwatched" className={filterClass}>
                غير المُشاهَدة
              </SegmentedControlItem>
            </SegmentedControl>
            <Button
              className="md:hidden"
              variant={showSearch ? "secondary" : "outline"}
              size="icon"
              aria-label={showSearch ? "إخفاء بحث الحلقات" : "إظهار بحث الحلقات"}
              aria-controls={searchId}
              aria-expanded={showSearch}
              onClick={() => {
                if (showSearch) setSearch("");
                setSearchExpanded(!showSearch);
              }}
            >
              {showSearch ? <X /> : <Search />}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={orderLabel}
              title={orderLabel}
              onClick={() => setNewestFirst(!newestFirst)}
            >
              <SortIcon aria-hidden="true" />
            </Button>
          </div>
          <InputGroup
            id={searchId}
            className={showSearch ? "self-center" : "hidden self-center md:flex"}
          >
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchInput}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث في الحلقات…"
              aria-label="بحث في الحلقات"
            />
          </InputGroup>
        </div>
        <ItemGroup
          ref={list}
          className="relative min-h-0 min-w-0 gap-1 scrollbar-thin max-xl:scroll-fade-x max-xl:snap-x max-xl:snap-proximity max-xl:flex-row max-xl:overflow-x-auto max-xl:overflow-y-hidden max-xl:overscroll-x-contain max-xl:p-1 xl:scroll-fade-y xl:overflow-y-auto xl:overscroll-contain"
          aria-label="قائمة الحلقات"
        >
          {visible.map(({ episode, imageId, state, downloaded, progress }) => {
            const selected = episode.id === activeId;
            const nowPlaying = selected && playing;
            const upcoming = episode.releaseState === "upcoming";
            const number = episodeNumberLabel(episode.number);
            return (
              <div
                key={episode.id}
                role="listitem"
                className="max-xl:w-36 max-xl:shrink-0 max-xl:snap-start md:max-xl:w-48"
              >
                <Item
                  size="sm"
                  className="flex-nowrap gap-3 rounded-xl px-2 py-2 text-start hover:bg-muted/50 aria-[current=true]:border-primary/40 aria-[current=true]:bg-primary/10 max-xl:h-full max-xl:flex-col max-xl:items-stretch max-xl:gap-2"
                  render={
                    <button
                      type="button"
                      disabled={pending || upcoming || disabled}
                      aria-current={selected || undefined}
                      onClick={() => onChoose(episode)}
                    />
                  }
                >
                  <div className="relative w-24 shrink-0 overflow-hidden rounded-lg max-xl:w-full">
                    <Artwork id={imageId} alt="" className="aspect-video w-full object-cover" />
                    <Badge variant="secondary" className="absolute start-1 top-1 tabular-nums">
                      {number}
                    </Badge>
                    {nowPlaying && (
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Play className="size-4 fill-current" aria-hidden="true" />
                        </span>
                      </span>
                    )}
                    {progress > 0 && (
                      <ProgressPrimitive.Root
                        value={progress}
                        aria-label={`تقدم الحلقة ${number}`}
                        className="pointer-events-none absolute inset-x-1 bottom-1"
                      >
                        <ProgressTrack className="h-1">
                          <ProgressIndicator className="motion-reduce:transition-none" />
                        </ProgressTrack>
                      </ProgressPrimitive.Root>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <strong className="line-clamp-2 text-sm leading-snug font-medium" dir="auto">
                      {episode.title || `الحلقة ${number}`}
                    </strong>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {episode.runtimeMinutes ? <span>{episode.runtimeMinutes} د</span> : null}
                      {nowPlaying && <Badge variant="secondary">قيد التشغيل</Badge>}
                      {state?.isPlayed && (
                        <span
                          title="تمّت المشاهدة"
                          className="grid size-5 place-items-center rounded-full bg-success/20 text-foreground"
                        >
                          <Check className="size-3" aria-hidden="true" />
                          <span className="sr-only">تمّت المشاهدة</span>
                        </span>
                      )}
                      {downloaded && (
                        <span
                          title="محمّلة على الجهاز"
                          className="grid size-5 place-items-center rounded-full bg-secondary text-secondary-foreground"
                        >
                          <Download className="size-3" aria-hidden="true" />
                          <span className="sr-only">محمّلة على الجهاز</span>
                        </span>
                      )}
                      {upcoming && <Badge variant="outline">قادم</Badge>}
                    </span>
                  </div>
                </Item>
              </div>
            );
          })}
          {visible.length === 0 && (
            <div role="listitem" className="flex w-full shrink-0 flex-col items-center gap-2 py-6">
              <p className="text-sm text-muted-foreground">
                {search.trim() ? "لا توجد نتائج لهذا البحث." : "لا توجد حلقات غير مُشاهَدة."}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setUnwatchedOnly(false);
                }}
              >
                عرض كل الحلقات
              </Button>
            </div>
          )}
        </ItemGroup>
      </div>
    </aside>
  );
}

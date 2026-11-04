import type { ReleaseEntry } from "@nahhasio/api-contract";
import { useInfiniteQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { CalendarDays } from "lucide-react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation, useLoadMoreNavigation } from "../../components/card-navigation";
import { MediaCard } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { gateway, type ReleasesQuery } from "../../lib/bridge";
import { ViewingCard } from "../home/viewing-card";
import { dateLabel, months, releaseLink, releaseTitle } from "./release-model";

export type ReleaseLayout = "poster" | "logo";
export type ReleaseSize = "medium" | "small";
const grids = {
  medium: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
  small: "grid-cols-2 md:grid-cols-4 xl:grid-cols-5",
} satisfies Record<ReleaseSize, string>;

function ReleaseMedia({ item, layout }: { item: ReleaseEntry; layout: ReleaseLayout }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <MediaCard
        work={item.work}
        installment={item.installment}
        layout={layout}
        showStatus={false}
      />
      <time className="text-xs text-muted-foreground" dateTime={item.releaseDate ?? undefined}>
        {item.releaseDate
          ? `${item.installmentKind === "season" ? "يبدأ" : "يصدر"} ${dateLabel(item.releaseDate)}`
          : "لم يُعلن الموعد بعد"}
      </time>
    </div>
  );
}

// A date and installment identify one event. Related episodes remain individually navigable.
function timelineEvents(items: ReleaseEntry[]) {
  const events = new Map<string, ReleaseEntry[]>();
  for (const item of items) {
    const key = `${item.releaseDate}:${item.installmentId}`;
    const event = events.get(key) ?? [];
    event.push(item);
    events.set(key, event);
  }
  return [...events.values()];
}
const weekdayFormat = new Intl.DateTimeFormat("ar-u-nu-latn", {
  weekday: "short",
  timeZone: "UTC",
});
function TimelineEvent({
  entries,
  asOf,
  showDate = false,
}: {
  entries: ReleaseEntry[];
  asOf: string;
  showDate?: boolean;
}) {
  const navigation = useCardNavigation();
  const item = entries.find((entry) => entry.kind === "installment") ?? entries[0];
  if (!item) return null;
  const starts = entries.some((entry) => entry.kind === "installment");
  const episodes = entries.filter((entry) => entry.kind === "episode");
  const title = item.workTitleAr || item.workTitle;
  const today = item.releaseDate === asOf;
  return (
    <article className="group/release flex h-full min-h-32 min-w-0 overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40 motion-reduce:transition-none">
      <a
        {...navigation}
        href={releaseLink(item)}
        className="flex w-20 shrink-0 self-stretch outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:w-24"
        aria-label={`تفاصيل ${title}`}
      >
        <Artwork
          id={item.poster?.id}
          width={320}
          alt=""
          className="h-full min-h-32 w-full object-cover"
        />
      </a>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 px-3 py-3 sm:px-4">
        <h3 className="font-display text-base leading-relaxed font-semibold">
          <a
            {...navigation}
            href={releaseLink(item)}
            className="line-clamp-2 rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            dir="auto"
          >
            {title}
          </a>
        </h3>
        {item.installmentTitle !== title && (
          <p className="line-clamp-1 text-xs text-muted-foreground" dir="auto">
            {item.installmentTitle}
          </p>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-1">
          {starts && (
            <Badge variant="outline">
              {item.installmentKind === "season"
                ? "بداية الموسم"
                : item.installmentKind === "movie"
                  ? "فيلم"
                  : "إصدار جديد"}
            </Badge>
          )}
          {episodes.map((episode) => (
            <Badge
              key={episode.id}
              variant="secondary"
              className="max-w-full"
              render={<a {...navigation} href={releaseLink(episode)} />}
            >
              <span className="truncate">{releaseTitle(episode)}</span>
            </Badge>
          ))}
          {today && <Badge variant="secondary">اليوم</Badge>}
        </div>
      </div>
      {showDate && item.releaseDate && (
        <time
          dateTime={item.releaseDate}
          aria-label={dateLabel(item.releaseDate)}
          className="flex w-14 shrink-0 flex-col items-center justify-center gap-1 border-s border-border px-2 sm:w-16"
        >
          <span
            className={cn(
              "font-display text-2xl font-semibold tabular-nums",
              today && "text-primary",
            )}
          >
            {Number(item.releaseDate.slice(8))}
          </span>
          <span className="text-xs text-muted-foreground">
            {weekdayFormat.format(new Date(`${item.releaseDate}T12:00:00Z`))}
          </span>
        </time>
      )}
    </article>
  );
}

export function ReleaseFeed({
  query,
  empty = "لا توجد إصدارات مسجّلة في هذه الفترة.",
  grouped = true,
  groupBy = "day",
  cards = false,
  episodeCards = false,
  layout = "poster",
  size = "small",
  singleColumn = false,
}: {
  query: ReleasesQuery;
  empty?: string;
  grouped?: boolean;
  groupBy?: "day" | "month";
  cards?: boolean;
  episodeCards?: boolean;
  layout?: ReleaseLayout;
  size?: ReleaseSize;
  singleColumn?: boolean;
}) {
  const loadMore = useLoadMoreNavigation();
  const feed = useInfiniteQuery({
    queryKey: ["releases", "feed", query],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.releases({ ...query, page: pageParam, pageSize: 24 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    staleTime: 60000,
  });
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const first = feed.data?.pages[0];
  const groups = new Map<string, ReleaseEntry[]>();
  for (const item of items) {
    const key = grouped
      ? item.releaseDate
        ? groupBy === "month"
          ? item.releaseDate.slice(0, 7)
          : item.releaseDate
        : "undated"
      : "all";
    const entries = groups.get(key) ?? [];
    entries.push(item);
    groups.set(key, entries);
  }
  const fetchMore = async () => {
    await feed.fetchNextPage();
  };
  return (
    <div className="flex min-w-0 flex-col gap-6" aria-busy={feed.isFetching}>
      {feed.isLoading && (
        <div className="grid grid-cols-2 gap-4" role="status" aria-label="جارٍ تحميل الإصدارات">
          {[0, 1, 2, 3].map((id) => (
            <Skeleton key={id} className={cards ? "aspect-2/3" : "h-28"} />
          ))}
        </div>
      )}
      {feed.error && <Failure error={feed.error} retry={() => void feed.refetch()} />}
      {first && !items.length && <NoResults title="لا توجد إصدارات" description={empty} />}
      <div className="flex flex-col gap-6">
        {[...groups].map(([date, entries]) => (
          <section
            key={date}
            className={cn(
              "min-w-0",
              grouped && groupBy === "day" && "relative border-s border-border ps-5 sm:ps-7",
            )}
          >
            {grouped && (
              <header className="mb-4 flex flex-wrap items-center gap-3 border-b border-border pb-3">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">
                  {date === "undated"
                    ? "لم يُعلن الموعد"
                    : groupBy === "month"
                      ? `${months[Number(date.slice(5)) - 1]} ${date.slice(0, 4)}`
                      : dateLabel(date)}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {timelineEvents(entries).length} {cards ? "إصدار" : "موعد"}
                </span>
              </header>
            )}
            <div
              className={cn(
                "grid gap-x-4",
                cards || episodeCards ? "gap-y-6" : "items-stretch gap-y-3",
                cards
                  ? grids[size]
                  : episodeCards
                    ? "grid-cols-1"
                    : singleColumn
                      ? "grid-cols-1"
                      : "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
              )}
            >
              {cards
                ? entries.map((item) => <ReleaseMedia key={item.id} item={item} layout={layout} />)
                : episodeCards
                  ? entries.map((item) =>
                      item.viewing ? (
                        <ViewingCard key={item.id} item={item.viewing} />
                      ) : (
                        <TimelineEvent key={item.id} entries={[item]} asOf={first?.asOf ?? ""} />
                      ),
                    )
                  : timelineEvents(entries).map((event) => (
                      <TimelineEvent
                        key={`${event[0]?.releaseDate}:${event[0]?.installmentId}`}
                        entries={event}
                        showDate={groupBy === "month"}
                        asOf={first?.asOf ?? ""}
                      />
                    ))}
            </div>
          </section>
        ))}
      </div>
      {first && first.total > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span role="status">
            {items.length} من {first.total} إصدار
          </span>
          {feed.hasNextPage && (
            <Button
              variant="outline"
              disabled={feed.isFetchingNextPage}
              onClick={(event) => {
                if (loadMore) void loadMore(event.currentTarget, fetchMore);
                else void fetchMore();
              }}
            >
              {feed.isFetchingNextPage ? "جارٍ التحميل…" : "عرض المزيد"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

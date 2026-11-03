import type { TrailerEntry } from "@nahhasio/api-contract";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDown, ExternalLink, Film, Info, Play, Search, X } from "lucide-react";
import { useDeferredValue } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation, useLoadMoreNavigation } from "@/components/card-navigation";
import { Failure, NoResults } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { replaceParams, workLink } from "@/features/shell/navigation";
import { gateway, type TrailersQuery } from "@/lib/bridge";
import { languageName } from "@/lib/languages";

import { PublicPage, PublicPageHeader } from "../shell/public-page";

export function TrailersPage({ params }: { params: URLSearchParams }) {
  const search = params.get("q") ?? "";
  const q = useDeferredValue(search.trim());
  const format = params.get("format");
  const sort = params.get("sort") === "title" ? "title" : "newest";
  const query: TrailersQuery = { sort };
  if (q) query.q = q;
  if (format === "animated" || format === "live-action") query.format = format;
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    replaceParams("/trailers", next);
  };
  const result = useInfiniteQuery({
    queryKey: ["catalog", "trailers", query],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.trailers({ ...query, page: pageParam, pageSize: 24 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const total = result.data?.pages[0]?.total;
  const filtered = Boolean(q || query.format);
  const featured = !filtered ? items[0] : undefined;
  const remaining = featured ? items.slice(1) : items;
  const resetFilters = () => {
    const next = new URLSearchParams(params);
    next.delete("q");
    next.delete("format");
    replaceParams("/trailers", next);
  };
  const loadMore = useLoadMoreNavigation();
  const fetchMore = async () => {
    await result.fetchNextPage();
  };
  return (
    <PublicPage as="div" className="flex flex-col gap-6">
      <PublicPageHeader
        title="الإعلانات التشويقية"
        description="اكتشف ما يستحق المشاهدة، من إعلانات الأعمال في مكتبتك."
        actions={
          <Badge variant="outline">
            <ExternalLink data-icon="inline-start" />
            المشاهدة على YouTube
          </Badge>
        }
      />
      <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="البحث عن إعلان أو عمل بالعربية أو الإنجليزية"
            placeholder="ابحث باسم العمل أو الإعلان…"
            value={search}
            maxLength={200}
            onChange={(event) => update("q", event.target.value)}
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="مسح البحث"
                onClick={() => update("q", "")}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="نوع الأعمال"
            value={[query.format ?? "all"]}
            onValueChange={(value) => {
              if (value[0]) update("format", value[0] === "all" ? "" : value[0]);
            }}
          >
            <ToggleGroupItem value="all">الكل</ToggleGroupItem>
            <ToggleGroupItem value="animated">رسوم متحركة</ToggleGroupItem>
            <ToggleGroupItem value="live-action">تمثيل حي</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="ترتيب الإعلانات"
            value={[sort]}
            onValueChange={(value) => {
              if (value[0]) update("sort", value[0] === "newest" ? "" : value[0]);
            }}
          >
            <ToggleGroupItem value="newest">الأحدث إضافة</ToggleGroupItem>
            <ToggleGroupItem value="title">اسم العمل</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <section
        aria-label="إعلانات المكتبة"
        className="flex min-w-0 flex-col gap-4"
        aria-busy={result.isFetching}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">
              {search ? "نتائج البحث" : sort === "newest" ? "أضيف مؤخرًا" : "إعلانات المكتبة"}
            </h2>
            {total !== undefined && <Badge variant="secondary">{total} إعلان</Badge>}
          </div>
          {filtered && (
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              <X data-icon="inline-start" />
              مسح الفلاتر
            </Button>
          )}
        </div>
        {result.isPending && (
          <div
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            role="status"
            aria-label="جارٍ تحميل الإعلانات"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-video rounded-2xl" />
            ))}
          </div>
        )}
        {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
        {!result.isPending && !result.error && items.length === 0 && (
          <NoResults
            title={filtered ? "لا توجد إعلانات مطابقة" : "لم تُضف إعلانات بعد"}
            description={
              filtered
                ? "جرّب اسمًا آخر أو اختر كل أنواع الأعمال."
                : "ستظهر هنا إعلانات YouTube المضافة إلى الأعمال في المكتبة."
            }
          />
        )}
        {featured && <FeaturedTrailer entry={featured} />}
        {remaining.length > 0 && (
          <div
            role="list"
            aria-label="قائمة الإعلانات"
            className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {remaining.map((entry) => (
              <TrailerCard key={entry.trailer.id} entry={entry} />
            ))}
          </div>
        )}
        {result.hasNextPage && (
          <Button
            variant="outline"
            className="self-center"
            disabled={result.isFetchingNextPage}
            onClick={(event) => {
              if (loadMore) void loadMore(event.currentTarget, fetchMore);
              else void fetchMore();
            }}
          >
            {result.isFetchingNextPage ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ArrowDown data-icon="inline-start" />
            )}
            المزيد من الإعلانات
          </Button>
        )}
      </section>
    </PublicPage>
  );
}

function youtubeLink(entry: TrailerEntry) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(entry.trailer.youtubeVideoId)}`;
}
function TrailerMetadata({ entry: { work, trailer } }: { entry: TrailerEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {work.releaseYear && <span>{work.releaseYear}</span>}
      {trailer.language && <Badge variant="outline">{languageName(trailer.language)}</Badge>}
      {trailer.isPrimary && <Badge variant="secondary">الإعلان الرئيسي</Badge>}
    </div>
  );
}
function TrailerArtwork({ entry, featured = false }: { entry: TrailerEntry; featured?: boolean }) {
  const navigation = useCardNavigation();
  const title = entry.work.titleAr || entry.work.canonicalTitle;
  return (
    <a
      {...navigation}
      href={youtubeLink(entry)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`شاهد ${entry.trailer.title || "الإعلان التشويقي"} — ${title} على YouTube`}
      className="group/trailer relative block aspect-video overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <Artwork
        id={entry.work.banner?.id ?? entry.work.poster?.id}
        alt=""
        className="absolute inset-0 size-full object-cover"
      />
      <span className="absolute inset-0 bg-linear-to-t from-background/60 to-transparent" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-12 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-md transition-transform duration-200 group-hover/trailer:scale-110 motion-reduce:transition-none">
          <Play className="size-5" aria-hidden="true" />
        </span>
      </span>
      {featured && (
        <span className="absolute start-4 top-4">
          <Badge variant="secondary">
            <Film data-icon="inline-start" />
            {entry.work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
          </Badge>
        </span>
      )}
      <span className="absolute end-3 bottom-3">
        <Badge variant="secondary">
          <ExternalLink data-icon="inline-start" />
          YouTube
        </Badge>
      </span>
    </a>
  );
}
function FeaturedTrailer({ entry }: { entry: TrailerEntry }) {
  const { work, trailer } = entry;
  const title = work.titleAr || work.canonicalTitle;
  return (
    <section
      aria-label={`الإعلان البارز: ${title}`}
      className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-5"
    >
      <div className="min-w-0 lg:col-span-3">
        <TrailerArtwork entry={entry} featured />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-4 p-5 sm:p-6 lg:col-span-2">
        <TrailerMetadata entry={entry} />
        <div className="flex flex-col gap-2">
          <h2
            className="font-display text-2xl leading-relaxed font-semibold sm:text-3xl"
            dir="auto"
          >
            {title}
          </h2>
          {work.titleAr && work.titleAr !== work.canonicalTitle && (
            <p className="text-sm text-muted-foreground" dir="auto">
              {work.canonicalTitle}
            </p>
          )}
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed" dir="auto">
          {trailer.title || "الإعلان التشويقي"}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <a
            className={buttonVariants()}
            href={youtubeLink(entry)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Play data-icon="inline-start" />
            شاهد الإعلان
            <ExternalLink data-icon="inline-end" />
          </a>
          <a className={buttonVariants({ variant: "outline" })} href={workLink(work.id)}>
            <Info data-icon="inline-start" />
            تفاصيل العمل
          </a>
        </div>
      </div>
    </section>
  );
}
function TrailerCard({ entry }: { entry: TrailerEntry }) {
  const { work, trailer } = entry;
  const navigation = useCardNavigation();
  const title = work.titleAr || work.canonicalTitle;
  return (
    <article role="listitem" className="flex min-w-0 flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <TrailerArtwork entry={entry} />
      </div>
      <div className="flex min-w-0 flex-col gap-2 px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="font-semibold">
              <a
                {...navigation}
                href={workLink(work.id)}
                className="line-clamp-1 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                dir="auto"
              >
                {title}
              </a>
            </h3>
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground" dir="auto">
              {trailer.title || "الإعلان التشويقي"}
            </p>
          </div>
          <a
            {...navigation}
            href={workLink(work.id)}
            aria-label={`تفاصيل ${title}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <Info />
          </a>
        </div>
        <TrailerMetadata entry={entry} />
      </div>
    </article>
  );
}

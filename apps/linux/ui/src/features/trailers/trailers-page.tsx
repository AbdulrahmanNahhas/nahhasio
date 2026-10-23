import type { TrailerEntry } from "@nahhasio/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowDown, ExternalLink, Film, Info, Play, Search, X } from "lucide-react";
import { useDeferredValue } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation, useLoadMoreNavigation } from "@/components/card-navigation";
import { Failure, NoResults } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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
  const banner = useQuery({
    queryKey: ["catalog", "trailers", "banner"],
    queryFn: ({ signal }) => gateway.trailers({ page: 1, pageSize: 12 }, signal),
    staleTime: 300000,
  });
  const seen = new Set<string>();
  const covers = (banner.data?.items ?? [])
    .filter(({ work }) => {
      if (seen.has(work.id)) return false;
      seen.add(work.id);
      return true;
    })
    .slice(0, 7);
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const total = result.data?.pages[0]?.total;
  const loadMore = useLoadMoreNavigation();
  const fetchMore = async () => {
    await result.fetchNextPage();
  };
  return (
    <div className="mx-auto flex max-w-400 flex-col gap-7 px-4 py-8 sm:px-8 lg:px-10">
      <header className="relative isolate flex min-h-48 items-center overflow-hidden rounded-3xl border border-border bg-card sm:min-h-56">
        <div
          className="pointer-events-none absolute inset-y-0 end-0 flex w-2/3 items-center justify-end gap-3 overflow-hidden"
          aria-hidden="true"
        >
          {covers.map(({ work }) => (
            <Artwork
              key={work.id}
              id={work.poster?.id}
              alt=""
              className="h-72 w-32 shrink-0 rotate-12 rounded-xl object-cover sm:w-40"
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-linear-to-l from-card via-card/80 to-transparent" />
        <div className="relative flex max-w-xl flex-col gap-3 px-6 py-8 sm:px-9">
          <div className="flex items-center gap-3">
            <Film className="size-7 text-primary" aria-hidden="true" />
            <h1 className="text-3xl font-semibold sm:text-4xl">الإعلانات التشويقية</h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            لمحة عن الحكاية قبل أن تبدأ. اكتشف إعلانات مكتبتك وشاهدها هنا، مع مشغّل مصغّر يرافقك أثناء
            التصفح.
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-4">
        <InputGroup className="h-12">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="البحث عن إعلان أو عمل بالعربية أو الإنجليزية"
            placeholder="ابحث عن عمل أو إعلان بالعربية أو English…"
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
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="size-3.5" aria-hidden="true" />
            المشاهدة على YouTube
          </span>
        </div>
        {result.isPending && (
          <div
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            role="status"
            aria-label="جارٍ تحميل الإعلانات"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        )}
        {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
        {!result.isPending && !result.error && items.length === 0 && (
          <NoResults
            title={search || format ? "لا توجد إعلانات مطابقة" : "لم تُضف إعلانات بعد"}
            description={
              search || format
                ? "جرّب اسمًا آخر أو اختر كل أنواع الأعمال."
                : "ستظهر هنا إعلانات YouTube المضافة إلى الأعمال في المكتبة."
            }
          />
        )}
        <div role="list" className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((entry) => (
            <TrailerCard key={entry.trailer.id} entry={entry} />
          ))}
        </div>
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
    </div>
  );
}

function TrailerCard({ entry: { work, trailer } }: { entry: TrailerEntry }) {
  const navigation = useCardNavigation();
  const title = work.titleAr || work.canonicalTitle;
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.youtubeVideoId)}`;
  return (
    <Card size="sm" role="listitem" className="min-w-0 pt-0">
      <a
        {...navigation}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`شاهد ${trailer.title || "الإعلان التشويقي"} — ${title} على YouTube`}
        className="group/trailer relative block aspect-video overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Artwork
          id={work.banner?.id ?? work.poster?.id}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/trailer:scale-105 motion-reduce:transition-none"
        />
        <span className="absolute inset-0 bg-linear-to-t from-background/70 via-background/10 to-transparent" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-transform duration-200 group-hover/trailer:scale-110 motion-reduce:transition-none">
            <Play className="size-5" aria-hidden="true" />
          </span>
        </span>
        <span className="absolute start-3 top-3">
          <Badge variant="secondary">
            {trailer.language ? languageName(trailer.language) : "إعلان تشويقي"}
          </Badge>
        </span>
        {work.releaseYear && (
          <span className="absolute end-3 bottom-3">
            <Badge variant="secondary">{work.releaseYear}</Badge>
          </span>
        )}
      </a>
      <CardHeader>
        <CardTitle>
          <a
            {...navigation}
            href={workLink(work.id)}
            className="line-clamp-1 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            dir="auto"
          >
            {title}
          </a>
        </CardTitle>
        <CardDescription>
          <span className="line-clamp-1" dir="auto">
            {work.titleAr && work.titleAr !== work.canonicalTitle
              ? work.canonicalTitle
              : work.format === "animated"
                ? "رسوم متحركة"
                : "تمثيل حي"}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="line-clamp-2 min-h-10 text-sm leading-relaxed" dir="auto">
          {trailer.title || "الإعلان التشويقي الرسمي"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">YouTube</Badge>
          {trailer.isPrimary && <Badge variant="secondary">الإعلان الرئيسي</Badge>}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          {...navigation}
          variant="secondary"
          className="flex-1"
          render={<a href={url} target="_blank" rel="noopener noreferrer" />}
        >
          <Play data-icon="inline-start" />
          شاهد الإعلان
          <ExternalLink data-icon="inline-end" />
        </Button>
        <a
          {...navigation}
          href={workLink(work.id)}
          aria-label={`تفاصيل ${title}`}
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <Info />
        </a>
      </CardFooter>
    </Card>
  );
}

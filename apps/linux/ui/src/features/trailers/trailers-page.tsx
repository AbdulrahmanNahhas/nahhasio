import { useInfiniteQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowDown, ArrowDownAZ, Clapperboard, Clock, Grid2X2, Music2, Table2 } from "lucide-react";
import { useDeferredValue } from "react";

import { useLoadMoreNavigation } from "@/components/card-navigation";
import { Choice } from "@/components/choice";
import { Failure, NoResults } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { replaceParams } from "@/features/shell/navigation";
import type { TrailersQuery } from "@/lib/bridge";

import { CatalogPage, PublicPageHeader, PublicPageSearch } from "../shell/public-page";
import { fetchClips, firstClipPage } from "./clip-query";
import { ClipGrid, ClipTable, clipGridColumns, type ClipSize } from "./clip-results";

const trailersPageTitle = "الشارات والإعلانات التشويقية";

const mediaLabels = {
  music: "الشارات",
  trailer: "الإعلانات التشويقية",
  all: "الكل",
} as const;

const mediaOptions = [
  { value: "music", label: mediaLabels.music, icon: Music2 },
  { value: "trailer", label: mediaLabels.trailer, icon: Clapperboard },
  { value: "all", label: mediaLabels.all },
];
const formatOptions = [
  { value: "all", label: "كل الأعمال" },
  { value: "animated", label: "رسوم متحركة" },
  { value: "live-action", label: "تمثيل حي" },
];
const sortOptions = [
  { value: "newest", label: "الأحدث إضافة", icon: Clock },
  { value: "title", label: "اسم العمل", icon: ArrowDownAZ },
];

const sizeOptions = [
  { value: "small", label: "صغير" },
  { value: "medium", label: "متوسط" },
  { value: "large", label: "كبير" },
];

export function TrailersPage({ params }: { params: URLSearchParams }) {
  const search = params.get("q") ?? "";
  const q = useDeferredValue(search.trim());
  const format = params.get("format");
  const mediaParam = params.get("media");
  const media = mediaParam === "trailer" || mediaParam === "all" ? mediaParam : "music";
  const sort = params.get("sort") === "title" ? "title" : "newest";
  const layout = params.get("view") === "table" ? "table" : "grid";
  const requestedSize = params.get("size");
  const size: ClipSize =
    requestedSize === "small" || requestedSize === "large" ? requestedSize : "medium";
  const query: TrailersQuery = {
    sort,
    ...(q && { q }),
    ...(media !== "all" && { media }),
    ...((format === "animated" || format === "live-action") && { format }),
  };
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    replaceParams("/trailers", next);
  };
  const result = useInfiniteQuery({
    queryKey: ["catalog", "trailers", "clip-pages", query],
    initialPageParam: firstClipPage,
    queryFn: ({ pageParam, signal }) => fetchClips(query, pageParam, signal),
    getNextPageParam: (page) => page.next,
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const total =
    result.data?.pages[0]?.total ??
    (result.isSuccess && !result.hasNextPage ? items.length : undefined);
  const filtered = Boolean(search || query.format);
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
    <CatalogPage
      as="div"
      heading={
        <PublicPageHeader
          title={trailersPageTitle}
          count={total !== undefined && <Badge variant="secondary">{total} مقطع</Badge>}
          actions={
            <PublicPageSearch
              label="البحث عن مقطع أو عمل بالعربية أو الإنجليزية"
              placeholder="ابحث عن مقطع أو عمل…"
              value={search}
              maxLength={200}
              onChange={(value) => update("q", value)}
            />
          }
        />
      }
      toolbar={
        <div
          className="flex min-w-0 flex-wrap items-center gap-2"
          role="region"
          aria-label="تصفية المقاطع"
        >
          <ClipChoice
            label="نوع المقاطع"
            value={media}
            options={mediaOptions}
            onChange={(value) => update("media", value === "music" ? "" : value)}
          />
          <ClipChoice
            label="نوع الأعمال"
            value={query.format ?? "all"}
            options={formatOptions}
            onChange={(value) => update("format", value === "all" ? "" : value)}
          />
          <ToggleGroup
            variant="outline"
            spacing={0}
            aria-label="ترتيب المقاطع"
            value={[sort]}
            onValueChange={([value]) => {
              if (value) update("sort", value === "newest" ? "" : value);
            }}
          >
            {sortOptions.map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
                <Icon aria-hidden />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {filtered && (
            <Button variant="ghost" onClick={resetFilters}>
              مسح الفلاتر
            </Button>
          )}
          <div
            className="ms-auto flex items-center gap-2"
            role="group"
            aria-label="خيارات عرض المقاطع"
          >
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={[layout]}
              aria-label="تخطيط المقاطع"
              onValueChange={([value]) => {
                if (value) update("view", value === "grid" ? "" : value);
              }}
            >
              <ToggleGroupItem value="grid" aria-label="شبكة" title="شبكة">
                <Grid2X2 />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="جدول" title="جدول">
                <Table2 />
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              variant="outline"
              spacing={0}
              aria-label="حجم المقاطع"
              value={[size]}
              onValueChange={([value]) => {
                if (value) update("size", value === "medium" ? "" : value);
              }}
            >
              {sizeOptions.map(({ value, label }) => (
                <ToggleGroupItem key={value} value={value}>
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      }
    >
      <section
        aria-label={mediaLabels[media]}
        className="flex min-w-0 flex-col gap-5"
        aria-busy={result.isFetching}
      >
        {result.isPending && (
          <div
            className={cn("grid gap-4", layout === "grid" ? clipGridColumns(size) : "grid-cols-1")}
            role="status"
            aria-label="جارٍ تحميل المقاطع"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton
                key={index}
                className={layout === "grid" ? "aspect-square rounded-xl" : "h-16 rounded-lg"}
              />
            ))}
          </div>
        )}
        {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
        {result.isSuccess && !items.length && !result.hasNextPage && (
          <NoResults
            title={
              filtered
                ? "لا توجد مقاطع مطابقة"
                : media === "music"
                  ? "لا توجد شارات مسجّلة بعد"
                  : "لا توجد مقاطع بعد"
            }
            description={
              filtered
                ? "جرّب اسمًا آخر أو امسح الفلاتر."
                : "يمكنك تصفّح جميع المقاطع المسجّلة في المكتبة."
            }
          />
        )}
        {items.length > 0 &&
          (layout === "grid" ? (
            <ClipGrid items={items} size={size} />
          ) : (
            <ClipTable items={items} size={size} />
          ))}
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
            {items.length ? "المزيد من المقاطع" : "البحث في المزيد من المقاطع"}
          </Button>
        )}
      </section>
    </CatalogPage>
  );
}

function ClipChoice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string; icon?: typeof Music2 }>;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <div className="min-w-32.5 flex-1 basis-32.5 @3xl:hidden">
        <Choice label={label} value={value} options={options} onChange={onChange} />
      </div>
      <ToggleGroup
        className="hidden @3xl:inline-flex"
        variant="outline"
        spacing={0}
        aria-label={label}
        value={[value]}
        onValueChange={([next]) => {
          if (next) onChange(next);
        }}
      >
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
          <ToggleGroupItem key={optionValue} value={optionValue}>
            {Icon && <Icon data-icon="inline-start" />}
            {optionLabel}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </>
  );
}

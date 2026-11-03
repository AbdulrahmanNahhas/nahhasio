import { Radio } from "@base-ui/react/radio";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Eye,
  EyeOff,
  Film,
  Layers,
  LoaderCircle,
  ScanEye,
  Search,
  Tv,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDeferredValue } from "react";

import { useLoadMoreNavigation } from "../../components/card-navigation";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import { ButtonGroup } from "../../components/ui/button-group";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "../../components/ui/input-group";
import { RadioGroup } from "../../components/ui/radio-group";
import { Skeleton } from "../../components/ui/skeleton";
import type { EpisodesQuery } from "../../lib/bridge";
import { gateway } from "../../lib/bridge";
import { useIsAdmin } from "../account/use-is-admin";
import { ViewingCard } from "../home/viewing-card";
import { replaceParams } from "../shell/navigation";
import { PublicPage } from "../shell/public-page";

export function EpisodesPage({ params }: { params: URLSearchParams }) {
  const admin = useIsAdmin();
  const requestedWatchState = params.get("watchState");
  const watchState: "all" | "watched" | "unwatched" =
    requestedWatchState === "watched" || requestedWatchState === "unwatched"
      ? requestedWatchState
      : "all";
  const requestedKind = params.get("kind");
  const kind =
    requestedKind === "movies" || requestedKind === "all"
      ? requestedKind
      : params.get("includeMovies") === "true"
        ? "all"
        : "episodes";
  const requestedVisibility = params.get("visibility");
  const visibility =
    admin && (requestedVisibility === "private" || requestedVisibility === "all")
      ? requestedVisibility
      : admin && params.get("includePrivate") === "true"
        ? "all"
        : "public";
  const search = params.get("q") ?? "";
  const q = useDeferredValue(search.trim());
  const filters: EpisodesQuery = {};
  if (watchState !== "all") filters.watchState = watchState;
  if (visibility !== "public") filters.visibility = visibility;
  if (kind !== "episodes") filters.kind = kind;
  if (q) filters.q = q;
  const hasFilters =
    watchState !== "all" || visibility !== "public" || kind !== "episodes" || Boolean(search);
  const update = (key: "watchState" | "visibility" | "kind" | "q", value: string) => {
    const next = new URLSearchParams(params);
    if (key === "kind") next.delete("includeMovies");
    if (key === "visibility") next.delete("includePrivate");
    const defaultValue =
      key === "watchState"
        ? "all"
        : key === "kind"
          ? "episodes"
          : key === "visibility"
            ? "public"
            : "";
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    replaceParams("/episodes", next);
  };
  const loadMore = useLoadMoreNavigation();
  const result = useInfiniteQuery({
    queryKey: ["catalog", "episodes", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.episodes({ ...filters, page: pageParam, pageSize: 36 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const total = result.data?.pages[0]?.total;
  const fetchMore = async () => {
    await result.fetchNextPage();
  };

  return (
    <PublicPage as="div" className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">الحلقات</h1>
            {total !== undefined && (
              <Badge variant="secondary">
                {total} {kind === "episodes" ? "حلقة" : kind === "movies" ? "فيلم" : "إصدار"}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {kind === "all"
              ? "أحدث الحلقات والأفلام الصادرة في مكتبتك"
              : kind === "movies"
                ? "أحدث الأفلام الصادرة في مكتبتك"
                : "أحدث الحلقات الصادرة في مكتبتك"}
          </p>
        </div>
        <a className={buttonVariants({ variant: "outline", size: "sm" })} href="#/releases">
          <CalendarDays data-icon="inline-start" />
          تقويم الإصدارات
        </a>
      </header>
      <div className="flex flex-wrap items-center gap-3" aria-label="تصفية الحلقات والأفلام">
        <div className="min-w-48 flex-1">
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="البحث باسم العمل أو الحلقة أو الفيلم"
              placeholder="اسم العمل أو الحلقة أو الفيلم…"
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
        </div>
        <EpisodeFilterGroup
          label="حالة مشاهدة الحلقات والأفلام"
          value={watchState}
          onChange={(value) => update("watchState", value)}
          options={[
            { value: "all", label: "الكل" },
            { value: "unwatched", label: "غير مُشاهد" },
            { value: "watched", label: "مُشاهد" },
          ]}
        />
        <EpisodeFilterGroup
          label="نوع الإصدار"
          value={kind}
          onChange={(value) => update("kind", value)}
          options={[
            { value: "episodes", label: "الحلقات", icon: Tv },
            { value: "movies", label: "الأفلام", icon: Film },
            { value: "all", label: "الحلقات والأفلام", icon: Layers },
          ]}
        />
        {admin && (
          <EpisodeFilterGroup
            label="ظهور الأعمال"
            value={visibility}
            onChange={(value) => update("visibility", value)}
            options={[
              { value: "public", label: "الظاهرة", icon: Eye },
              { value: "private", label: "المخفية", icon: EyeOff },
              { value: "all", label: "الظاهرة والمخفية", icon: ScanEye },
            ]}
          />
        )}
      </div>
      {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
      <div
        className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        aria-label="الحلقات والأفلام"
      >
        {items.map((item) => (
          <ViewingCard
            key={item.episodeId ?? item.installmentId}
            item={item}
            poster={!item.episodeId}
          />
        ))}
        {(result.isLoading || result.isFetchingNextPage) &&
          Array.from({ length: result.isLoading ? 8 : 4 }, (_, index) => (
            <div key={index} className="space-y-3" role="status" aria-label="جارٍ تحميل الإصدارات">
              <Skeleton className="aspect-video rounded-2xl" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
      </div>
      {total === 0 && (
        <NoResults
          title={hasFilters ? "لا توجد إصدارات مطابقة" : "لا توجد حلقات أو أفلام صادرة بعد"}
          description={
            hasFilters
              ? "غيّر البحث أو حالة المشاهدة لتوسيع النتائج."
              : "تظهر هنا الحلقات والأفلام التي لها تاريخ إصدار مسجّل حتى اليوم."
          }
        />
      )}
      {result.hasNextPage && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {items.length} من {total} إصدار
          </p>
          <Button
            variant="outline"
            disabled={result.isFetchingNextPage}
            onClick={(event) => {
              if (loadMore) void loadMore(event.currentTarget, fetchMore);
              else void fetchMore();
            }}
          >
            {result.isFetchingNextPage && (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
              />
            )}
            {result.isFetchingNextPage ? "جارٍ تحميل الإصدارات…" : "عرض المزيد"}
          </Button>
        </div>
      )}
    </PublicPage>
  );
}

function EpisodeFilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: LucideIcon }[];
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        const option = options.find((item) => item.value === next);
        if (option) onChange(option.value);
      }}
      render={<ButtonGroup />}
      className="flex w-auto gap-0"
    >
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <Radio.Root
            key={option.value}
            value={option.value}
            nativeButton
            aria-label={option.label}
            title={option.label}
            render={
              <Button
                variant={value === option.value ? "secondary" : "outline"}
                size={Icon ? "icon-sm" : "sm"}
              />
            }
          >
            {Icon ? <Icon /> : option.label}
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}

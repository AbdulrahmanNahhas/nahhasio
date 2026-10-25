import type { CatalogEntry } from "@nahhasio/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCardNavigation, useLoadMoreNavigation } from "../../components/card-navigation";
import { MediaCard } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Drawer } from "../../components/ui/drawer";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { gateway } from "../../lib/bridge";
import { useIsAdmin } from "../account/use-is-admin";
import { replaceParams } from "../shell/navigation";
import { AppliedFilters } from "./applied-filters";
import {
  useBrowsePreferences,
  defaultPreferences,
  rememberedSearch,
  type BrowsePreferences,
} from "./browse-preferences";
import {
  groupKey,
  groupTitle,
  parseGroup,
  parseSort,
  refinementCount,
  refinementQuery,
  withPreset,
} from "./browse-refinements";
import type { BrowseRefinements } from "./browse-refinements";
import { browseGridClass, BrowseResultsSkeleton } from "./browse-results-skeleton";
import { BrowseTable } from "./browse-table";
import { BrowseToolbar } from "./browse-toolbar";
import { displayDefaults } from "./display-settings";
import { FilterDrawer } from "./filter-drawer";
import { parseFilters } from "./filter-model";
type BrowseProps = {
  params: URLSearchParams;
  path?: string;
  title?: string;
  preset?: { key: string; value: string };
};
export function BrowsePage(props: BrowseProps) {
  const preferences = useBrowsePreferences();
  if (preferences.loading)
    return (
      <div className="mx-auto max-w-400 px-10 py-8">
        <BrowseResultsSkeleton display={preferences.query.data?.display ?? displayDefaults} />
      </div>
    );
  const saved = preferences.query.data ?? defaultPreferences;
  // A direct/search link owns its query. Only a bare Browse entry restores the last view.
  const params =
    props.params.size || props.preset ? props.params : new URLSearchParams(saved.search);
  return (
    <BrowseContent
      {...props}
      key={preferences.scope}
      params={params}
      preferences={saved}
      onRemember={(value) => preferences.save.mutate(value)}
      preferenceError={preferences.query.error ?? preferences.save.error}
    />
  );
}
function BrowseContent({
  params,
  path = "/browse",
  title = "تصفّح المكتبة",
  preset,
  preferences,
  onRemember,
  preferenceError,
}: {
  preferences: BrowsePreferences;
  onRemember: (value: BrowsePreferences) => void;
  preferenceError?: Error | null;
  params: URLSearchParams;
  path?: string;
  title?: string;
  preset?: { key: string; value: string };
}) {
  const navigation = useCardNavigation();

  const loadMore = useLoadMoreNavigation();
  const filters = withPreset(parseFilters(params.get("filters")), preset);
  const view = params.get("view") === "installments" ? "installments" : "works";
  const isAdmin = useIsAdmin();
  const privacy = !isAdmin
    ? "public"
    : params.get("privacy") === "all"
      ? "all"
      : params.get("privacy") === "private"
        ? "private"
        : "public";
  const sort = parseSort(params.get("sort"));
  const q = params.get("q") || "";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersMounted, setFiltersMounted] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const display = preferences.display;
  const setDisplay = (value: typeof display) =>
    onRemember({ ...preferences, search: rememberedSearch(params), display: value });
  const { layout } = display;
  const group = parseGroup(params.get("group"));
  const refinements: BrowseRefinements = {
    filters,
    privacy,
    sort,
    group,
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
  const update = (values: Array<[string, string]>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of values) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    onRemember({ ...preferences, search: rememberedSearch(next) });
    replaceParams(path, next);
  };
  const apply = (value: BrowseRefinements) =>
    update([
      ["filters", JSON.stringify(withPreset(value.filters, preset))],
      ["privacy", value.privacy === "public" ? "" : value.privacy],
      ["from", value.from],
      ["to", value.to],
      ["sort", value.sort === "year-desc" ? "" : value.sort],
      ["group", value.group === "none" ? "" : value.group],
    ]);
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  const query = refinementQuery(refinements, view, debounced);
  const result = useInfiniteQuery({
    queryKey: ["catalog", "browse", query],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.browse({ ...query, page: pageParam, pageSize: 30 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  const options = useQuery({
    queryKey: ["catalog", "facets", view, privacy],
    queryFn: ({ signal }) => gateway.facets({ view, privacy }, signal),
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const groups = new Map<string, CatalogEntry[]>();
  for (const item of items) {
    const key = item.groupKey ?? groupKey(group, item);
    const entries = groups.get(key) ?? [];
    entries.push(item);
    groups.set(key, entries);
  }
  const totals = new Map(
    (result.data?.pages[0]?.groups ?? []).map((item) => [item.key, item.count]),
  );
  const groupOrder = result.data?.pages[0]?.groups?.map((item) => item.key) ?? [...groups.keys()];
  const groupedEntries = groupOrder.flatMap((key) => {
    const entries = groups.get(key);
    return entries ? [{ key, entries }] : [];
  });
  const lastGroup = groupedEntries.at(-1);
  const moreLabel =
    group !== "none" && lastGroup
      ? lastGroup.entries.length < (totals.get(lastGroup.key) ?? lastGroup.entries.length)
        ? `تحميل المزيد من ${groupTitle(group, lastGroup.key, options.data)}`
        : "تحميل المجموعة التالية"
      : "تحميل المزيد";

  return (
    <Drawer
      swipeDirection="down"
      open={filtersOpen}
      onOpenChange={(open) => {
        if (open) setFiltersMounted(true);
        setFiltersOpen(open);
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setFiltersMounted(false);
      }}
    >
      <section
        className="mx-auto flex w-full max-w-400 flex-col px-4 py-6 sm:px-6 lg:px-10"
        aria-label={title}
      >
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl leading-relaxed font-semibold">{title}</h1>
            <Badge variant="secondary" aria-live="polite">
              {result.data?.pages[0]?.total ?? "…"}{" "}
              {["planet", "genre", "country", "studio"].includes(group)
                ? "نتيجة في المجموعات"
                : view === "works"
                  ? "عمل"
                  : "موسم وإصدار"}
            </Badge>
          </div>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[view]}
            onValueChange={(values) => {
              if (values[0] === "works" || values[0] === "installments")
                update([["view", values[0]]]);
            }}
            aria-label="مستوى عرض الكتالوج"
          >
            <ToggleGroupItem value="works">الأعمال</ToggleGroupItem>
            <ToggleGroupItem value="installments">المواسم والإصدارات</ToggleGroupItem>
          </ToggleGroup>
        </header>
        <BrowseToolbar
          filters={filters}
          onFacet={(key, value) => {
            const facets = filters.facets.filter((facet) => facet.key !== key);
            if (value !== "all") facets.push({ key, include: [value], exclude: [] });
            apply({ ...refinements, filters: { ...filters, facets } });
          }}
          sort={sort}
          onSort={(nextSort) => apply({ ...refinements, sort: nextSort })}
          display={display}
          onDisplay={setDisplay}
          group={group}
          onGroup={(nextGroup) => apply({ ...refinements, group: nextGroup })}
          search={params.toString()}
          onTemplate={(search, nextDisplay) => {
            onRemember({ ...preferences, search, display: nextDisplay });
            replaceParams(path, new URLSearchParams(search));
          }}
          filterCount={refinementCount(refinements, preset)}
          filterTrigger={filterTrigger}
        />
        {preferenceError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              تعذّر حفظ أو استعادة تفضيلات التصفح: {preferenceError.message}
            </AlertDescription>
          </Alert>
        )}
        {q && (
          <div className="mb-3 flex">
            <Button
              variant="secondary"
              size="sm"
              aria-label={`مسح البحث: ${q}`}
              onClick={() => update([["q", ""]])}
            >
              <X data-icon="inline-start" /> بحث: {q}
            </Button>
          </div>
        )}
        <AppliedFilters
          value={refinements}
          options={options.data}
          locked={preset}
          onChange={apply}
        />
        {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
        {result.isLoading && <BrowseResultsSkeleton display={display} />}
        {items.length === 0 && !result.isLoading && !result.error && (
          <div className="flex flex-col items-center gap-4">
            <NoResults />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setFiltersMounted(true);
                  setFiltersOpen(true);
                }}
              >
                <SlidersHorizontal data-icon="inline-start" />
                تعديل المرشحات
              </Button>
              {q && (
                <Button variant="ghost" onClick={() => update([["q", ""]])}>
                  مسح البحث
                </Button>
              )}
            </div>
          </div>
        )}
        {groupedEntries.map(({ key, entries }) => (
          <section key={key}>
            {key !== "all" && (
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{groupTitle(group, key, options.data)}</h2>
                  <Badge variant="secondary">{totals.get(key) ?? entries.length}</Badge>
                </div>
                {totals.has(key) && entries.length < totals.get(key)! && (
                  <p className="text-xs text-muted-foreground">
                    {entries.length} من {totals.get(key)} محمّلة
                  </p>
                )}
              </header>
            )}
            {layout === "table" ? (
              <BrowseTable entries={entries} display={display} />
            ) : (
              <div className={browseGridClass(display)}>
                {entries.map((item) => (
                  <MediaCard
                    key={item.installment?.id ?? item.work.id}
                    entry={item}
                    layout={layout}
                    minimal={display.minimal}
                    borderless={display.borderless}
                    showScore={display.showScore}
                    showStatus={display.showStatus}
                    showMetadata={display.showMetadata ?? true}
                    showOriginalTitle={display.showOriginalTitle ?? false}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
        {result.isFetchingNextPage && <BrowseResultsSkeleton display={display} singleRow />}
        {result.hasNextPage && (
          <Button
            {...navigation}
            className="mx-auto mt-8 flex"
            variant="outline"
            aria-disabled={result.isFetchingNextPage}
            onClick={(event) => {
              if (result.isFetchingNextPage) return;
              if (loadMore)
                void loadMore(event.currentTarget, async () => {
                  await result.fetchNextPage();
                });
              else void result.fetchNextPage();
            }}
          >
            {result.isFetchingNextPage ? "جارٍ التحميل…" : moreLabel}
          </Button>
        )}
        {filtersMounted && (
          <FilterDrawer
            value={refinements}
            view={view}
            q={q}
            locked={preset}
            returnFocus={filterTrigger}
            onApply={(value) => {
              apply(value);
              setFiltersOpen(false);
            }}
          />
        )}
      </section>
    </Drawer>
  );
}

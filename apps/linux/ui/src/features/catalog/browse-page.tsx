import type { CatalogEntry } from "@nahhasio/api-contract";
import { hashKey, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCardNavigation, useLoadMoreNavigation } from "../../components/card-navigation";
import { MediaCard } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Drawer, DrawerTrigger } from "../../components/ui/drawer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group";
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
import { browseLibrary, libraryFilters, selectLibrary } from "./browse-templates";
import { BrowseToolbar } from "./browse-toolbar";
import { BrowseWatchButton } from "./browse-watch-button";
import { displayDefaults, normalizeBrowseDisplay } from "./display-preferences";
import { FilterDrawer } from "./filter-drawer";
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
        <BrowseResultsSkeleton
          display={normalizeBrowseDisplay(preferences.query.data?.display ?? displayDefaults)}
        />
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
      onRetryPreferences={preferences.retry}
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
  onRetryPreferences,
}: {
  preferences: BrowsePreferences;
  onRemember: (value: BrowsePreferences) => void;
  preferenceError?: Error | null;
  onRetryPreferences: () => void;
  params: URLSearchParams;
  path?: string;
  title?: string;
  preset?: { key: string; value: string };
}) {
  const navigation = useCardNavigation();

  const loadMore = useLoadMoreNavigation();
  const library = browseLibrary(params);
  const filters = withPreset(library.filters, preset);
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
  const searchInput = useRef<HTMLInputElement>(null);
  const changeSearch = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    replaceParams(path, next);
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersMounted, setFiltersMounted] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const filterOpener = useRef<HTMLElement>(null);
  const display = normalizeBrowseDisplay(preferences.display);
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
    if (library.template) {
      next.set("library", library.template.id);
      next.set("filters", JSON.stringify(filters));
    }
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
  const [debounced, setDebounced] = useState(q.trim());
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(timer);
  }, [q]);
  const query = refinementQuery(
    { ...refinements, filters: libraryFilters(filters, library.template?.id) },
    view,
    debounced,
  );
  const result = useInfiniteQuery({
    queryKey: ["catalog", "browse", query] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.browse({ ...query, page: pageParam, pageSize: 30 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    placeholderData: (previousData, previousQuery) =>
      layout === "table" &&
      previousQuery &&
      hashKey([{ ...previousQuery.queryKey[2], sort }]) === hashKey([query])
        ? previousData
        : undefined,
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
      swipeDirection="left"
      open={filtersOpen}
      onOpenChange={(open, { trigger }) => {
        if (open) {
          filterOpener.current = trigger instanceof HTMLElement ? trigger : null;
          setFiltersMounted(true);
        }
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
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl leading-relaxed font-semibold">
              {library.template?.title ?? title}
            </h1>
            <Badge variant="secondary" aria-live="polite">
              {result.data?.pages[0]?.total ?? "…"}{" "}
              {["planet", "genre", "country", "studio"].includes(group)
                ? "نتيجة في المجموعات"
                : view === "works"
                  ? "عمل"
                  : "موسم وإصدار"}
            </Badge>
          </div>
          <InputGroup className="h-11 w-full sm:max-w-md">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchInput}
              aria-label="ابحث في النتائج"
              placeholder="ابحث في النتائج…"
              value={q}
              onChange={(event) => changeSearch(event.target.value)}
            />
            {q && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  aria-label="مسح البحث"
                  onClick={() => {
                    changeSearch("");
                    searchInput.current?.focus();
                  }}
                >
                  <X aria-hidden="true" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </header>
        <BrowseToolbar
          library={library.template?.id ?? "all"}
          onLibrary={(value) => {
            const next = selectLibrary(params, value);
            onRemember({ ...preferences, search: rememberedSearch(next) });
            replaceParams(path, next);
          }}
          view={view}
          onView={(value) => update([["view", value]])}
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
          filterCount={refinementCount(refinements, preset)}
          filterTrigger={filterTrigger}
        />
        {preferenceError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              <p>تعذّر حفظ أو استعادة تفضيلات التصفح. {preferenceError.message}</p>
              <Button variant="outline" size="sm" onClick={onRetryPreferences}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <AppliedFilters
          compact
          value={refinements}
          options={options.data}
          locked={preset}
          onChange={apply}
        />
        {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
        {result.isLoading && <BrowseResultsSkeleton display={display} />}
        {items.length === 0 && q.trim() === debounced && !result.isLoading && !result.error && (
          <div className="flex flex-col items-center gap-4">
            <NoResults
              description={
                debounced
                  ? "جرّب اسمًا آخر أو أزل نص البحث مع إبقاء التصفية."
                  : "غيّر فئة المكتبة أو التصفية لتوسيع النتائج."
              }
            />
            <div className="flex flex-wrap gap-2">
              {debounced && (
                <Button
                  onClick={() => {
                    changeSearch("");
                    searchInput.current?.focus();
                  }}
                >
                  إزالة نص البحث
                </Button>
              )}
              <DrawerTrigger render={<Button variant="outline" />}>
                <SlidersHorizontal data-icon="inline-start" />
                تعديل التصفية
              </DrawerTrigger>
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
              <BrowseTable
                entries={entries}
                display={display}
                sort={sort}
                sorting={result.isPlaceholderData}
                onSort={(nextSort) => apply({ ...refinements, sort: nextSort })}
              />
            ) : (
              <div className={browseGridClass(display)}>
                {entries.map((item) => (
                  <MediaCard
                    key={item.installment?.id ?? item.work.id}
                    entry={item}
                    layout={layout}
                    borderless={display.borderless}
                    showTitle={display.showTitle ?? true}
                    showScore={display.showScore}
                    showStatus={display.showStatus}
                    showMetadata={display.showMetadata ?? true}
                    titleLanguage={display.cardTitle}
                    browsePresentation
                    action={
                      display.showWatchStatus !== false ? (
                        <BrowseWatchButton entry={item} />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        ))}
        {result.isFetchingNextPage && <BrowseResultsSkeleton display={display} singleRow />}
        {result.hasNextPage && !result.isPlaceholderData && (
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
            library={library.template?.id}
            view={view}
            q={q.trim()}
            locked={preset}
            returnFocus={() =>
              (filterOpener.current?.isConnected ? filterOpener.current : filterTrigger.current) ??
              true
            }
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

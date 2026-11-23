import { infiniteQueryOptions } from "@tanstack/react-query";
import { Building2, Film, Library, Orbit, PanelTop, Tv, Users } from "lucide-react";

import { gateway } from "../../lib/bridge";
import { emptyFilters } from "../catalog/filter-model";

export const searchTypes = [
  { value: "all", label: "الكل", icon: Library },
  { value: "works", label: "الأعمال", icon: Library },
  { value: "movies", label: "الأفلام", icon: Film },
  { value: "series", label: "المسلسلات", icon: Tv },
  { value: "people", label: "الصنّاع", icon: Users },
  { value: "studios", label: "الاستوديوهات", icon: Building2 },
  { value: "planets", label: "الكواكب", icon: Orbit },
  { value: "pages", label: "الصفحات", icon: PanelTop },
] as const;
export type SearchType = (typeof searchTypes)[number]["value"];
export function parseSearchType(value: string | null): SearchType {
  return searchTypes.find((type) => type.value === value)?.value ?? "all";
}
export function searchCatalogFilters(type: SearchType, releasedOnly = false) {
  const filters = emptyFilters();
  if (type === "movies" || type === "series") {
    filters.facets.push({
      key: "kinds",
      include:
        type === "movies"
          ? ["animated-movie", "live-action-movie"]
          : ["animated-series", "live-action-series"],
      exclude: [],
    });
  }
  if (releasedOnly)
    filters.facets.push({ key: "releaseStates", include: ["released"], exclude: [] });
  return filters;
}

export function searchCatalogOptions(
  q: string,
  type: SearchType,
  includePrivate: boolean,
  enabled: boolean,
) {
  const query: Parameters<typeof gateway.browse>[0] = {
    q,
    view: "works",
    privacy: includePrivate ? "all" : "public",
    sort: "title",
    filters: JSON.stringify(searchCatalogFilters(type)),
    pageSize: 24,
  };
  return infiniteQueryOptions({
    queryKey: ["catalog", "search", query],
    enabled: q.length > 0 && enabled,
    staleTime: 30_000,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => gateway.browse({ ...query, page: pageParam }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
}

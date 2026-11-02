import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { gateway } from "@/lib/bridge";

import { matchingEntities } from "./search-entities";
import { searchCatalogOptions, type SearchType } from "./search-model";

export function useLibrarySearch(text: string, type: SearchType, includePrivate: boolean) {
  const [q, setQ] = useState(text.trim());
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);
  const works = useInfiniteQuery(searchCatalogOptions(q, type, includePrivate));
  const showWorks = ["all", "movies", "series", "installments"].includes(type);
  const showEntities = ["all", "people", "studios", "planets"].includes(type);
  const facets = useQuery({
    queryKey: ["catalog", "search-entities", includePrivate ? "all" : "public"],
    enabled: q.length > 0 && showEntities,
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      gateway.facets({ view: "works", privacy: includePrivate ? "all" : "public" }, signal),
  });
  const entities = matchingEntities(facets.data, q, type);
  const entries = works.data?.pages.flatMap((page) => page.items) ?? [];
  const total =
    (showWorks ? (works.data?.pages[0]?.total ?? 0) : 0) + (showEntities ? entities.length : 0);
  const waiting =
    text.trim() !== q || (showWorks && works.isLoading) || (showEntities && facets.isLoading);
  const error =
    (showWorks && !works.isFetchNextPageError ? works.error : null) ??
    (showEntities ? facets.error : null);
  return { q, works, facets, showWorks, showEntities, entities, entries, total, waiting, error };
}

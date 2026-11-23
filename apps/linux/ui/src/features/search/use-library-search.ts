import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { gateway } from "@/lib/bridge";

import { matchingEntities } from "./search-entities";
import { searchCatalogOptions, type SearchType } from "./search-model";

export function useLibrarySearch(text: string, type: SearchType, includePrivate: boolean) {
  const [q, setQ] = useState(text.trim());
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 220);
    return () => clearTimeout(timer);
  }, [text]);

  const settled = text.trim() === q;
  const showWorks = ["all", "works", "movies", "series"].includes(type);
  const showEntities = ["all", "people", "studios", "planets"].includes(type);
  const works = useInfiniteQuery(
    searchCatalogOptions(q, type === "all" ? "works" : type, includePrivate, settled && showWorks),
  );
  const privacy = includePrivate ? "all" : "public";
  const facets = useQuery({
    queryKey: ["catalog", "facets", "works", privacy],
    enabled: text.trim().length > 0 && showEntities,
    staleTime: 30_000,
    queryFn: ({ signal }) => gateway.facets({ view: "works", privacy }, signal),
  });
  const workEntries = settled && showWorks ? works.data?.pages.flatMap((page) => page.items) : [];
  const entities = settled && showEntities ? matchingEntities(facets.data, q, type) : [];
  const waiting = !settled || (showWorks && works.isLoading) || (showEntities && facets.isLoading);
  const error =
    (showWorks && !works.isFetchNextPageError ? works.error : null) ??
    (showEntities ? facets.error : null);
  return {
    q,
    works,
    facets,
    workEntries: workEntries ?? [],
    entities,
    workTotal: showWorks ? (works.data?.pages[0]?.total ?? 0) : 0,
    waiting,
    error,
    retry: () => {
      if (showWorks && works.isError) void works.refetch();
      if (showEntities && facets.isError) void facets.refetch();
    },
  };
}

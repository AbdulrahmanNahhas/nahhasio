import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { Failure, NoResults } from "../../components/status";
import { gateway } from "../../lib/bridge";
import { EntityWorksPage } from "../catalog/entity-works-page";
import { normalizeFacetSearch } from "../catalog/filter-model";
import { CatalogPage, PublicPageHeader, PublicPageSearch } from "../shell/public-page";
import { CatalogPlanetTile } from "./planet-tile";

const grid = "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4";

const placeholders = Array.from({ length: 10 }, (_, index) => `planet-placeholder-${index}`);

function PlanetsSkeleton() {
  return (
    <div role="status" aria-label="جارٍ تحميل الكواكب…">
      <span className="sr-only">جارٍ تحميل الكواكب…</span>
      <div className={grid}>
        {placeholders.map((id) => (
          <Skeleton key={id} className="aspect-video min-h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function PlanetsPage({ id, params }: { id?: string; params: URLSearchParams }) {
  const result = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const [search, setSearch] = useState("");
  const planets = result.data?.planets ?? [];

  if (id) return <EntityWorksPage type="planets" id={id} params={params} />;

  const matches = planets.filter((planet) =>
    normalizeFacetSearch(`${planet.nameAr} ${planet.nameEn} ${planet.slug}`).includes(
      normalizeFacetSearch(search),
    ),
  );
  return (
    <CatalogPage
      aria-label="صفحة الكواكب"
      heading={
        <PublicPageHeader
          title="الكواكب"
          count={
            !result.isLoading &&
            !result.error && <Badge variant="secondary">{planets.length} كوكب</Badge>
          }
          actions={
            <PublicPageSearch
              label="ابحث في الكواكب"
              placeholder="اسم العالم…"
              value={search}
              onChange={setSearch}
            />
          }
        />
      }
    >
      {result.error ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : result.isLoading ? (
        <PlanetsSkeleton />
      ) : matches.length ? (
        <div className={grid}>
          {matches
            .toSorted((a, b) => b.count - a.count)
            .map((planet) => (
              <CatalogPlanetTile key={planet.id} planet={planet} variant="directory" />
            ))}
        </div>
      ) : (
        <NoResults
          title={search ? "لا توجد كواكب مطابقة" : "لم تُضف كواكب بعد"}
          description={
            search ? "جرّب اسمًا آخر أو امسح البحث." : "ستظهر هنا العوالم المضافة إلى مكتبتك."
          }
        />
      )}
    </CatalogPage>
  );
}

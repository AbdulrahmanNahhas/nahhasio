import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";

import { Failure, NoResults } from "../../components/status";
import { gateway } from "../../lib/bridge";
import { EntityWorksPage } from "../catalog/entity-works-page";
import { normalizeFacetSearch } from "../catalog/filter-model";
import { PublicPage, PublicPageHeader } from "../shell/public-page";
import { PlanetCards } from "./planet-cards";

const placeholders = Array.from({ length: 10 }, (_, index) => `planet-placeholder-${index}`);

function PlanetsSkeleton() {
  return (
    <div role="status" aria-label="جارٍ تحميل الكواكب…">
      <span className="sr-only">جارٍ تحميل الكواكب…</span>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {placeholders.map((id) => (
          <Skeleton key={id} className="aspect-4/5" />
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
    <PublicPage className="flex flex-col gap-6" aria-label="صفحة الكواكب">
      <PublicPageHeader
        title="الكواكب"
        description="عوالم مكتبتنا، لكل عالم طابعه وحكاياته."
        count={
          !result.isLoading && !result.error && <Badge variant="secondary">{planets.length}</Badge>
        }
        actions={
          <Field className="w-full sm:w-80">
            <FieldLabel htmlFor="planet-search" className="sr-only">
              ابحث في الكواكب
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                id="planet-search"
                aria-label="ابحث في الكواكب"
                placeholder="اسم العالم…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label="مسح البحث"
                    size="icon-xs"
                    onClick={() => setSearch("")}
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </Field>
        }
      />
      {result.error ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : result.isLoading ? (
        <PlanetsSkeleton />
      ) : matches.length ? (
        <PlanetCards planets={matches} />
      ) : (
        <NoResults
          title={search ? "لا توجد كواكب مطابقة" : "لم تُضف كواكب بعد"}
          description={
            search ? "جرّب اسمًا آخر أو امسح البحث." : "ستظهر هنا العوالم المضافة إلى مكتبتك."
          }
        />
      )}
    </PublicPage>
  );
}

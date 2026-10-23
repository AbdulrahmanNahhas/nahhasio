import type { CatalogPlanet } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { MediaCard } from "@/components/media-card";
import { Failure, NoResults } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { emptyFilters } from "@/features/catalog/filter-model";
import { gateway } from "@/lib/bridge";

import { HomeSectionHeading } from "./home-section";

export function PlanetShelves({ planets }: { planets: CatalogPlanet[] }) {
  const [planet, setPlanet] = useState("");
  const [day] = useState(() => Math.floor(Date.now() / 86400000));
  const choices = planets;
  const selected = choices.find((item) => item.slug === planet) ?? choices[day % choices.length];
  const filters = {
    ...emptyFilters(),
    facets: [{ key: "planets", include: selected ? [selected.slug] : [], exclude: [] }],
  };
  const preview = useQuery({
    queryKey: ["home", "planet-installments", selected?.slug],
    queryFn: ({ signal }) =>
      gateway.browse(
        {
          view: "installments",
          privacy: "public",
          sort: "year-desc",
          filters: JSON.stringify(filters),
          page: 1,
          pageSize: 10,
        },
        signal,
      ),
    enabled: Boolean(selected),
  });
  if (!selected) return null;
  return (
    <section aria-label="استكشف الكواكب">
      <HomeSectionHeading
        title="عوالم تستحق الاكتشاف"
        description="اختر كوكبًا، واكتشف أحدث مواسمه وأفلامه وإصداراته."
        href="#/planets"
        linkLabel="كل الكواكب"
      />
      <div className="grid items-start gap-6 rounded-2xl border border-border bg-card p-4 sm:p-6 lg:grid-cols-4">
        <div className="flex flex-col gap-3 lg:col-span-1">
          <p className="text-xs text-muted-foreground">إلى أين نذهب؟</p>
          <ToggleGroup
            orientation="vertical"
            variant="outline"
            spacing={2}
            className="flex max-h-80 w-full scroll-fade-y flex-col scrollbar-thin gap-2 overflow-y-auto overscroll-y-contain px-1 py-2 lg:max-h-144"
            aria-label="اختر كوكبًا"
            value={[selected.slug]}
            onValueChange={(next) => {
              if (next[0]) setPlanet(next[0]);
            }}
          >
            {choices.map((item) => (
              <ToggleGroupItem
                key={item.id}
                value={item.slug}
                className="h-auto w-full min-w-0 shrink-0 justify-start gap-3 px-3 py-3"
              >
                <span className="font-emoji text-2xl" aria-hidden="true">
                  {item.icon || "🪐"}
                </span>
                <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <span className="truncate">{item.nameAr}</span>
                  <span className="text-xs text-muted-foreground">{item.count} عمل</span>
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold">{selected.nameAr}</h3>
              <Badge variant="secondary">{selected.count} عمل</Badge>
            </div>
            <a
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              href={`#/planets/${encodeURIComponent(selected.slug)}`}
            >
              ادخل الكوكب
              <ArrowLeft data-icon="inline-end" />
            </a>
          </div>
          {preview.isPending && (
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="aspect-2/3" />
              <Skeleton className="aspect-2/3" />
              <Skeleton className="aspect-2/3" />
            </div>
          )}
          {preview.error && <Failure error={preview.error} retry={() => void preview.refetch()} />}
          {preview.data?.items.length === 0 && (
            <NoResults title="لا توجد إصدارات في هذا الكوكب بعد" />
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {(preview.data?.items ?? []).map((entry, index) => (
              <div
                key={entry.installment?.id ?? entry.work.id}
                className={cn(
                  "min-w-0",
                  index >= 4 && index < 6 && "hidden md:block",
                  index >= 6 && "hidden xl:block",
                )}
              >
                <MediaCard entry={entry} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

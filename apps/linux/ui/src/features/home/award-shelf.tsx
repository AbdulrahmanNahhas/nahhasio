import { useQuery } from "@tanstack/react-query";
import { Award, ChevronLeft } from "lucide-react";

import { useCardNavigation } from "@/components/card-navigation";
import { emptyFilters } from "@/features/catalog/filter-model";
import { gateway } from "@/lib/bridge";

import { HomeSectionHeading } from "./home-section";
import { ScrollShelf } from "./scroll-shelf";

function awardsLink(programs: string[]) {
  const search = new URLSearchParams({
    view: "works",
    privacy: "public",
    filters: JSON.stringify({
      ...emptyFilters(),
      facets: [{ key: "awardPrograms", include: programs, exclude: [] }],
    }),
  });
  return `#/browse?${search}`;
}

export function AwardShelf() {
  const navigation = useCardNavigation();
  const { data } = useQuery({
    queryKey: ["catalog", "facets", "works", "public"],
    queryFn: ({ signal }) => gateway.facets({ view: "works", privacy: "public" }, signal),
  });
  const programs = data?.groups.find(({ key }) => key === "awardPrograms")?.options ?? [];
  if (!programs.length) return null;
  return (
    <section aria-label="الجوائز">
      <HomeSectionHeading
        title="الجوائز"
        href={awardsLink(programs.slice(0, 32).map(({ value }) => value))}
      />
      <ScrollShelf
        items={programs.slice(0, 12)}
        layout="logo"
        render={({ value, label, count }) => (
          <a
            {...navigation}
            key={value}
            href={awardsLink([value])}
            className="group/award relative flex min-h-36 flex-col justify-between gap-4 rounded-2xl border border-border bg-linear-to-br from-warning/15 to-card p-4 outline-none hover:border-warning/60 focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Award className="size-6 text-warning" aria-hidden />
            <div className="flex min-w-0 items-end justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-display text-base font-semibold wrap-anywhere" dir="auto">
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">{count} عمل</span>
              </div>
              <ChevronLeft
                className="size-4 shrink-0 text-muted-foreground group-hover/award:text-foreground group-focus-visible/award:text-foreground"
                aria-hidden
              />
            </div>
          </a>
        )}
      />
    </section>
  );
}

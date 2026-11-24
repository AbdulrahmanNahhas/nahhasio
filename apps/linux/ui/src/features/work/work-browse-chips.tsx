import { cn } from "cn";
import type { ReactNode } from "react";

import { useCardNavigation } from "@/components/card-navigation";
import { buttonVariants } from "@/components/ui/button";
import { emptyFilters, setFacetSelection } from "@/features/catalog/filter-model";

type WorkFacet = "genres" | "tones" | "tags" | "countries" | "languages" | "dubLanguages";
type BrowseChip = { value: string; label: string; icon?: ReactNode };

export function WorkBrowseChips({
  facet,
  options,
  label,
  hero = false,
}: {
  facet: WorkFacet;
  options: BrowseChip[];
  label: string;
  hero?: boolean;
}) {
  const navigation = useCardNavigation();
  if (!options.length) return null;

  return (
    <ul
      className={cn("flex flex-wrap gap-2", hero && "justify-center sm:justify-start")}
      aria-label={label}
    >
      {options.map(({ value, label: optionLabel, icon }) => {
        const filters = setFacetSelection(emptyFilters(), facet, value, "include");
        const search = new URLSearchParams({ filters: JSON.stringify(filters) });
        return (
          <li key={value} className="min-w-0 max-w-full">
            <a
              {...navigation}
              href={`#/browse?${search}`}
              data-slot="button"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: cn(
                  "h-auto min-h-8 max-w-full gap-1.5 py-1.5 text-sm whitespace-normal",
                  hero && "min-h-9 px-3 sm:min-h-10",
                ),
              })}
              title={`تصفّح أعمال ${optionLabel}`}
            >
              {icon}
              <bdi className="wrap-anywhere">{optionLabel}</bdi>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

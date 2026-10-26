import type { BrowseFilters } from "@nahhasio/api-contract";
import { Search, SlidersHorizontal } from "lucide-react";
import type { RefObject } from "react";

import { Choice } from "@/components/choice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DrawerTrigger } from "@/components/ui/drawer";
import { openSearch } from "@/features/shell/navigation";

import { parseSort, sortChoices, type BrowseGroup, type SortOrder } from "./browse-refinements";
import type { DisplayPreferences } from "./display-preferences";
import { DisplaySettings } from "./display-settings";

const watchStates = [
  { value: "all", label: "كل حالات المشاهدة" },
  { value: "unwatched", label: "لم يُشاهَد" },
  { value: "in-progress", label: "قيد المشاهدة" },
  { value: "watched", label: "تمّت مشاهدته" },
];

export function BrowseToolbar({
  filters,
  onFacet,
  sort,
  onSort,
  display,
  onDisplay,
  group,
  onGroup,
  filterCount,
  filterTrigger,
}: {
  filters: BrowseFilters;
  onFacet: (key: string, value: string) => void;
  sort: SortOrder;
  onSort: (value: SortOrder) => void;
  display: DisplayPreferences;
  onDisplay: (value: DisplayPreferences) => void;
  group: BrowseGroup;
  onGroup: (value: BrowseGroup) => void;
  filterCount: number;
  filterTrigger: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div
      className="mb-4 flex min-w-0 flex-wrap items-center gap-2"
      role="region"
      aria-label="أدوات التصفح"
    >
      <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
        <Choice
          label="حالة المشاهدة"
          options={[
            ...watchStates,
            ...(selectedFacet(filters, "watchStates") === "custom"
              ? [{ value: "custom", label: "حالات مخصصة" }]
              : []),
          ]}
          value={selectedFacet(filters, "watchStates")}
          onChange={(value) => {
            if (value !== "custom") onFacet("watchStates", value);
          }}
        />
      </div>
      <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
        <Choice
          label="ترتيب النتائج"
          value={sort}
          options={sortChoices.map((item) => ({ value: item.value, label: item.label }))}
          onChange={(next) => onSort(parseSort(next))}
        />
      </div>
      <div className="flex w-full items-center justify-end gap-2 sm:ms-auto sm:w-auto">
        <DrawerTrigger render={<Button ref={filterTrigger} variant="outline" />}>
          <SlidersHorizontal data-icon="inline-start" /> المرشحات
          {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
        </DrawerTrigger>
        <DisplaySettings value={display} onChange={onDisplay} group={group} onGroup={onGroup} />
        <Button
          variant="ghost"
          size="icon"
          aria-label="البحث في المكتبة"
          title="فتح صفحة البحث"
          onClick={() => openSearch(true)}
        >
          <Search data-icon="inline-start" />
        </Button>
      </div>
    </div>
  );
}

function selectedFacet(filters: BrowseFilters, key: string) {
  const facet = filters.facets.find((item) => item.key === key);
  if (!facet || (!facet.include.length && !facet.exclude.length)) return "all";
  return facet.include.length === 1 && !facet.exclude.length ? facet.include[0] : "custom";
}

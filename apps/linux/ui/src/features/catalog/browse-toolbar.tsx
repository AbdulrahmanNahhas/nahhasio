import type { BrowseFilters } from "@nahhasio/api-contract";
import { Clapperboard, Layers, SlidersHorizontal } from "lucide-react";
import type { RefObject } from "react";

import { Choice } from "@/components/choice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DrawerTrigger } from "@/components/ui/drawer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  groupChoices,
  parseGroup,
  parseSort,
  sortChoices,
  type BrowseGroup,
  type SortOrder,
} from "./browse-refinements";
import { BrowseTemplatePicker } from "./browse-template-picker";
import type { DisplayPreferences } from "./display-preferences";
import { DisplaySettings } from "./display-settings";

const watchStates = [
  { value: "all", label: "كل حالات المشاهدة" },
  { value: "unwatched", label: "لم يُشاهَد" },
  { value: "in-progress", label: "قيد المشاهدة" },
  { value: "watched", label: "تمّت مشاهدته" },
];

export function BrowseToolbar({
  library,
  onLibrary,
  view,
  onView,
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
  library: string;
  onLibrary: (value: string) => void;
  view: "works" | "installments";
  onView: (value: "works" | "installments") => void;
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
      className="flex min-w-0 flex-wrap items-center gap-2"
      role="region"
      aria-label="أدوات التصفح"
    >
      <div className="min-w-32.5 flex-1 sm:w-48 sm:flex-none">
        <BrowseTemplatePicker value={library} onChange={onLibrary} />
      </div>
      <div className="min-w-32.5 flex-1 sm:w-40 sm:flex-none">
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
      <div className="min-w-32.5 flex-1 sm:w-44 sm:flex-none">
        <Choice
          label="ترتيب النتائج"
          value={sort}
          options={sortChoices.map((item) => ({ value: item.value, label: item.label }))}
          onChange={(next) => onSort(parseSort(next))}
        />
      </div>
      <div className="min-w-32.5 flex-1 sm:w-40 sm:flex-none">
        <Choice
          label="تجميع النتائج"
          value={group}
          options={groupChoices}
          onChange={(next) => onGroup(parseGroup(next))}
        />
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 lg:ms-auto lg:w-auto">
        <DrawerTrigger render={<Button ref={filterTrigger} variant="outline" />}>
          <SlidersHorizontal data-icon="inline-start" /> تصفية النتائج
          {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
        </DrawerTrigger>
        <DisplaySettings value={display} onChange={onDisplay} />
        <ToggleGroup
          className="ms-auto"
          variant="outline"
          spacing={0}
          value={[view]}
          onValueChange={([next]) => {
            if (next === "works" || next === "installments") onView(next);
          }}
          aria-label="مستوى عرض الكتالوج"
        >
          <ToggleGroupItem value="works" aria-label="الأعمال" title="الأعمال">
            <Clapperboard aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="installments"
            aria-label="المواسم والإصدارات"
            title="المواسم والإصدارات"
          >
            <Layers aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}

function selectedFacet(filters: BrowseFilters, key: string) {
  const facet = filters.facets.find((item) => item.key === key);
  if (!facet || (!facet.include.length && !facet.exclude.length)) return "all";
  return facet.include.length === 1 && !facet.exclude.length ? facet.include[0] : "custom";
}

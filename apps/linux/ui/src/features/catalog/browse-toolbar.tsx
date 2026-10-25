import type { BrowseFilters } from "@nahhasio/api-contract";
import { Search, SlidersHorizontal } from "lucide-react";
import type { RefObject } from "react";

import { Choice } from "@/components/choice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DrawerTrigger } from "@/components/ui/drawer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { openSearch } from "@/features/shell/navigation";

import { parseSort, sortChoices, type BrowseGroup, type SortOrder } from "./browse-refinements";
import { BrowseTemplatePicker } from "./browse-template-picker";
import type { DisplayPreferences } from "./display-preferences";
import { DisplaySettings } from "./display-settings";

const formats = [
  { value: "all", label: "الكل" },
  { value: "animated", label: "رسوم متحركة" },
  { value: "live-action", label: "تمثيل حي" },
];
const watchStates = [
  { value: "all", label: "الكل" },
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
  search,
  onTemplate,
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
  search: string;
  onTemplate: (search: string, display: DisplayPreferences) => void;
  filterCount: number;
  filterTrigger: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <>
      <BrowseTemplatePicker search={search} onApply={onTemplate} />
      <div
        className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-4"
        role="region"
        aria-label="أدوات التصفح"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <QuickSelection
            label="نوع العمل"
            options={formats}
            value={selectedFacet(filters, "formats")}
            onChange={(value) => onFacet("formats", value)}
          />
          <QuickSelection
            label="حالة المشاهدة"
            options={watchStates}
            value={selectedFacet(filters, "watchStates")}
            onChange={(value) => onFacet("watchStates", value)}
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-44">
            <Choice
              label="ترتيب النتائج"
              value={sort}
              options={sortChoices.map((item) => ({ value: item.value, label: item.label }))}
              onChange={(next) => onSort(parseSort(next))}
            />
          </div>
          <DrawerTrigger render={<Button ref={filterTrigger} variant="outline" />}>
            <SlidersHorizontal data-icon="inline-start" /> المرشحات
            {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
          </DrawerTrigger>
          <DisplaySettings value={display} onChange={onDisplay} group={group} onGroup={onGroup} />
          <Button
            variant="outline"
            size="icon"
            aria-label="البحث في المكتبة"
            title="فتح صفحة البحث"
            onClick={() => openSearch(true)}
          >
            <Search />
          </Button>
        </div>
      </div>
    </>
  );
}

function QuickSelection({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <ToggleGroup
        variant="outline"
        spacing={0}
        className="max-w-full"
        aria-label={label}
        value={value === "custom" ? [] : [value]}
        onValueChange={(next) => {
          if (next[0]) onChange(next[0]);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function selectedFacet(filters: BrowseFilters, key: string) {
  const facet = filters.facets.find((item) => item.key === key);
  if (!facet || (!facet.include.length && !facet.exclude.length)) return "all";
  return facet.include.length === 1 && !facet.exclude.length ? facet.include[0] : "custom";
}

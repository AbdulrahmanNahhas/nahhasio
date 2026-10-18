import type { BrowseFilters, FacetCatalog } from "@nahhasio/api-contract";
import { Check, ChevronDown, LockKeyhole, Minus, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/button";
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "../../components/ui/field";
import { withPreset } from "./browse-refinements";
import { optionLabel } from "./filter-model";

type FilterFacetsProps = {
  groups: FacetCatalog["groups"];
  filters: BrowseFilters;
  onChange: (filters: BrowseFilters) => void;
  search: string;
  locked?: { key: string; value: string };
};

export function FilterFacets({ groups, filters, onChange, search, locked }: FilterFacetsProps) {
  const query = search.trim().toLocaleLowerCase();
  const matchingGroups = groups
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          group.label.toLocaleLowerCase().includes(query) ||
          optionLabel(option.value, option.label).toLocaleLowerCase().includes(query),
      ),
    }))
    .filter((group) => group.options.length > 0);

  function cycleOption(key: string, value: string) {
    if (locked?.key === key && locked.value === value) return;
    const previous = filters.facets.find((facet) => facet.key === key) ?? {
      key,
      include: [],
      exclude: [],
    };
    const included = previous.include.includes(value);
    const excluded = previous.exclude.includes(value);
    const next = {
      key,
      include: [
        ...previous.include.filter((item) => item !== value),
        ...(!included && !excluded ? [value] : []),
      ],
      exclude: [...previous.exclude.filter((item) => item !== value), ...(included ? [value] : [])],
    };
    const facets = [...filters.facets.filter((facet) => facet.key !== key), next].filter(
      (facet) => facet.include.length || facet.exclude.length,
    );
    onChange(withPreset({ ...filters, facets }, locked));
  }

  return (
    <FieldGroup className="gap-7">
      {!matchingGroups.length ? (
        <FieldDescription role="status">لا توجد خيارات مطابقة. جرّب اسمًا آخر.</FieldDescription>
      ) : (
        matchingGroups.map((group) => (
          <FacetOptions
            key={JSON.stringify([group.key, query])}
            group={group}
            filters={filters}
            locked={locked}
            onSelect={cycleOption}
            onReset={() =>
              onChange(
                withPreset(
                  { ...filters, facets: filters.facets.filter((facet) => facet.key !== group.key) },
                  locked,
                ),
              )
            }
          />
        ))
      )}
    </FieldGroup>
  );
}

function FacetOptions({
  group,
  filters,
  locked,
  onSelect,
  onReset,
}: {
  group: FacetCatalog["groups"][number];
  filters: BrowseFilters;
  locked: FilterFacetsProps["locked"];
  onSelect: (key: string, value: string) => void;
  onReset: () => void;
}) {
  const [limit, setLimit] = useState(30);
  const selection = filters.facets.find((facet) => facet.key === group.key);
  const chosen = (value: string) =>
    Number(Boolean(selection?.include.includes(value) || selection?.exclude.includes(value)));
  const ordered = group.options.toSorted((a, b) => chosen(b.value) - chosen(a.value));
  const visible = ordered.slice(0, limit);
  const remaining = group.options.length - visible.length;
  const selected = (selection?.include.length ?? 0) + (selection?.exclude.length ?? 0);
  const removable =
    selected -
    Number(locked?.key === group.key && Boolean(selection?.include.includes(locked.value)));
  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label">{group.label}</FieldLegend>
      {selected > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            {selection?.include.length ?? 0} مضمّن، {selection?.exclude.length ?? 0} مستبعد
          </p>
          {removable > 0 && (
            <Button size="xs" variant="ghost" onClick={onReset} aria-label={`مسح ${group.label}`}>
              <RotateCcw data-icon="inline-start" />
              مسح
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label={group.label}>
        {visible.map((option) => {
          const isLocked = locked?.key === group.key && locked.value === option.value;
          const included = isLocked || Boolean(selection?.include.includes(option.value));
          const excluded = !isLocked && Boolean(selection?.exclude.includes(option.value));
          const label = optionLabel(option.value, option.label);
          const state = included ? "مضمّن" : excluded ? "مستبعد" : "غير محدد";
          const action = isLocked
            ? "مقفل"
            : included
              ? "اضغط للاستبعاد"
              : excluded
                ? "اضغط لإزالة المرشح"
                : "اضغط للتضمين";
          const Icon = isLocked ? LockKeyhole : included ? Check : excluded ? Minus : Plus;
          return (
            <Button
              key={option.value}
              type="button"
              variant={excluded ? "destructive" : included ? "secondary" : "outline"}
              className="h-auto min-h-9 max-w-full gap-2 py-2"
              disabled={isLocked}
              aria-pressed={included ? true : excluded ? "mixed" : false}
              aria-label={`${label}، ${state}، ${option.count} في المكتبة، ${action}`}
              title={action}
              onClick={() => onSelect(group.key, option.value)}
            >
              <Icon data-icon="inline-start" aria-hidden="true" />
              <span className="min-w-0 whitespace-normal text-start">{label}</span>
              <span className="shrink-0 text-xs opacity-70">{option.count}</span>
            </Button>
          );
        })}
      </div>
      {remaining > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          aria-label={`عرض المزيد من ${group.label}، ${remaining} خيارًا متبقيًا`}
          onClick={() => setLimit((current) => current + 30)}
        >
          <ChevronDown data-icon="inline-start" />
          عرض المزيد ({remaining})
        </Button>
      )}
    </FieldSet>
  );
}

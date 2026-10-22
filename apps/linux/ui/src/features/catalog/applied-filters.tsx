import type { FacetCatalog } from "@nahhasio/api-contract";
import { LockKeyhole, X } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { removeFacet, resetRefinements, scoreLabel } from "./browse-refinements";
import type { BrowseRefinements, LockedFacet } from "./browse-refinements";
import { optionLabel } from "./filter-model";

export function AppliedFilters({
  value,
  options,
  locked,
  onChange,
}: {
  value: BrowseRefinements;
  options?: FacetCatalog;
  locked?: LockedFacet;
  onChange: (value: BrowseRefinements) => void;
}) {
  const chips: {
    key: string;
    label: string;
    excluded?: boolean;
    locked?: boolean;
    remove: () => void;
  }[] = value.filters.facets.flatMap((facet) => {
    const vocabulary = options?.groups.find((group) => group.key === facet.key);
    return [
      ...facet.include.map((item) => ({ item, excluded: false })),
      ...facet.exclude.map((item) => ({ item, excluded: true })),
    ].map(({ item, excluded }) => ({
      key: `${facet.key}-${item}`,
      label: `${excluded ? "استبعاد: " : ""}${vocabulary?.label ? `${vocabulary.label}: ` : ""}${optionLabel(item, vocabulary?.options.find((option) => option.value === item)?.label ?? item)}`,
      excluded,
      locked: locked?.key === facet.key && locked.value === item,
      remove: () => onChange({ ...value, filters: removeFacet(value.filters, facet.key, item) }),
    }));
  });
  if (value.privacy !== "public")
    chips.push({
      key: "privacy",
      label: value.privacy === "all" ? "العامة والخاصة" : "الخاصة فقط",
      remove: () => onChange({ ...value, privacy: "public" }),
    });
  for (const key of ["from", "to"] as const)
    if (value[key])
      chips.push({
        key,
        label: `${key === "from" ? "من سنة" : "إلى سنة"}: ${value[key]}`,
        remove: () => onChange({ ...value, [key]: "" }),
      });
  if (value.filters.minimumRating > 0 || (value.filters.maximumRating ?? 10) < 10)
    chips.push({
      key: "rating",
      label: `التقييم: ${value.filters.minimumRating} – ${value.filters.maximumRating ?? 10}`,
      remove: () =>
        onChange({ ...value, filters: { ...value.filters, minimumRating: 0, maximumRating: 10 } }),
    });
  for (const [key, score] of Object.entries(value.filters.minimumScores))
    if (score > 0)
      chips.push({
        key: `score-${key}`,
        label: `${scoreLabel(key)} ≥ ${score}`,
        remove: () =>
          onChange({
            ...value,
            filters: {
              ...value.filters,
              minimumScores: { ...value.filters.minimumScores, [key]: 0 },
            },
          }),
      });
  if (!chips.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="المرشحات المطبّقة">
      {chips.map((chip) =>
        chip.locked ? (
          <Badge key={chip.key} variant="outline">
            <LockKeyhole data-icon="inline-start" />
            {chip.label}
          </Badge>
        ) : (
          <Button
            key={chip.key}
            variant={chip.excluded ? "destructive" : "secondary"}
            size="sm"
            onClick={chip.remove}
            aria-label={`إزالة ${chip.label}`}
          >
            {chip.label}
            <X data-icon="inline-end" />
          </Button>
        ),
      )}
      {chips.some((chip) => !chip.locked) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({ ...resetRefinements(locked), sort: value.sort, group: value.group })
          }
        >
          مسح المرشحات
        </Button>
      )}
    </div>
  );
}

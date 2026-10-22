import type { BrowseFilters, FacetCatalog } from "@nahhasio/api-contract";
import { cn } from "cn";
import {
  Check,
  ChevronDown,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  OctagonAlert,
} from "lucide-react";
import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";

import { withPreset } from "./browse-refinements";
import { facetMatches, normalizeFacetSearch, optionLabel, setFacetSelection } from "./filter-model";

type Props = {
  groups: FacetCatalog["groups"];
  filters: BrowseFilters;
  onChange: (filters: BrowseFilters) => void;
  search: string;
  compact?: boolean;
  family?: boolean;
  locked?: { key: string; value: string };
};
export function FilterFacets({
  groups,
  filters,
  onChange,
  search,
  locked,
  compact,
  family,
}: Props) {
  const query = normalizeFacetSearch(search);
  const matching = groups
    .map((group) => ({
      ...group,
      options: group.options.filter(
        (option) =>
          normalizeFacetSearch(group.label).includes(query) || facetMatches(option, query),
      ),
    }))
    .filter((group) => group.options.length);
  return (
    <FieldGroup
      className={cn(
        "gap-5",
        compact && "grid md:grid-cols-2",
        family && "grid gap-y-8 md:grid-cols-6",
      )}
    >
      {!matching.length ? (
        <FieldDescription role="status">لا توجد خيارات مطابقة.</FieldDescription>
      ) : (
        matching.map((group) => (
          <FacetOptions
            key={`${group.key}:${query}`}
            group={group}
            family={family}
            filters={filters}
            locked={locked}
            onChange={onChange}
          />
        ))
      )}
    </FieldGroup>
  );
}
function FacetOptions({
  group,
  family,
  filters,
  locked,
  onChange,
}: {
  group: FacetCatalog["groups"][number];
  family?: boolean;
  filters: BrowseFilters;
  locked: Props["locked"];
  onChange: Props["onChange"];
}) {
  const [limit, setLimit] = useState(30);
  const selection = filters.facets.find((facet) => facet.key === group.key);
  const selected = (selection?.include.length ?? 0) + (selection?.exclude.length ?? 0);
  const risk = ["sexualityRisks", "behavioralRisks", "theologyRisks"].includes(group.key);
  const entities = group.key === "contributors" || group.key === "studios";
  return (
    <FieldSet
      className={cn(
        "min-w-0 gap-3",
        family && "gap-2 pt-6",
        family && (risk ? "md:col-span-2" : "md:col-span-3"),
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <FieldLegend variant="label">
          {group.label} <Badge variant="outline">{group.options.length}</Badge>
        </FieldLegend>
        {selected > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              onChange(
                withPreset(
                  { ...filters, facets: filters.facets.filter((facet) => facet.key !== group.key) },
                  locked,
                ),
              )
            }
            aria-label={`مسح ${group.label}`}
          >
            <RotateCcw data-icon="inline-start" />
            مسح
          </Button>
        )}
      </div>
      <div
        className={cn("flex flex-wrap gap-2", family && "gap-y-4")}
        role="group"
        aria-label={group.label}
      >
        {(risk
          ? group.options.toSorted(
              (a, b) =>
                ["none", "low", "medium", "high"].indexOf(a.value) -
                ["none", "low", "medium", "high"].indexOf(b.value),
            )
          : group.options
        )
          .slice(0, limit)
          .map((option) => {
            const fixed = locked?.key === group.key && locked.value === option.value;
            const included = fixed || !!selection?.include.includes(option.value);
            const excluded = !fixed && !!selection?.exclude.includes(option.value);
            const label = optionLabel(option.value, option.label);
            const Icon = fixed ? LockKeyhole : included ? Check : excluded ? Minus : Plus;
            return (
              <Button
                key={option.value}
                variant={
                  excluded ? "destructive" : included ? "secondary" : risk ? "ghost" : "outline"
                }
                size="sm"
                className="h-auto min-h-9 max-w-full gap-2 py-2"
                disabled={fixed}
                aria-pressed={included ? true : excluded ? "mixed" : false}
                aria-label={`${label}، ${fixed ? "ثابت" : included ? "مضمّن" : excluded ? "مستبعد" : "غير محدد"}، ${option.count} في المكتبة`}
                title={
                  included ? "نقرة أخرى للاستبعاد" : excluded ? "نقرة أخرى للإزالة" : "نقرة للتضمين"
                }
                onClick={() =>
                  onChange(
                    withPreset(
                      setFacetSelection(
                        filters,
                        group.key,
                        option.value,
                        included ? "exclude" : excluded ? null : "include",
                      ),
                      locked,
                    ),
                  )
                }
              >
                {entities && option.artworkId ? (
                  <Artwork
                    id={option.artworkId}
                    alt=""
                    studioLogo={group.key === "studios"}
                    className="size-6 rounded-full object-cover"
                  />
                ) : (
                  <Icon data-icon="inline-start" />
                )}
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 whitespace-normal text-start",
                    risk && option.value === "medium" && "text-warning",
                    risk && option.value === "high" && "text-destructive",
                    risk && option.value === "low" && "text-success",
                    risk && option.value === "none" && "text-muted-foreground",
                  )}
                >
                  {risk &&
                    (option.value === "high" ? (
                      <OctagonAlert className="size-4" aria-hidden="true" />
                    ) : option.value === "medium" ? (
                      <TriangleAlert className="size-4" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="size-4" aria-hidden="true" />
                    ))}
                  {label}
                </span>
                <span className="text-xs opacity-70">{option.count}</span>
              </Button>
            );
          })}
      </div>
      {group.options.length > limit && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setLimit(limit + 30)}
        >
          <ChevronDown data-icon="inline-start" />
          المزيد ({group.options.length - limit})
        </Button>
      )}
    </FieldSet>
  );
}

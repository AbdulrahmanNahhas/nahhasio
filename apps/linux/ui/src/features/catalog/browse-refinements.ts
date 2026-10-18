import type { BrowseFilters, CatalogEntry, FacetCatalog } from "@nahhasio/api-contract";

import type { CatalogQuery } from "../../lib/bridge";
import { criteria, emptyFilters, filterCount, optionLabel } from "./filter-model";

export const sortChoices = [
  {
    value: "latest-released-desc",
    label: "أحدث إصدار متاح",
    description: "حسب أحدث موسم أو إصدار صدر لكل عمل",
  },
  { value: "year-desc", label: "الأحدث إصدارًا", description: "الإصدارات الأحدث أولًا" },
  { value: "year-asc", label: "الأقدم إصدارًا", description: "من البداية إلى اليوم" },
  { value: "score-desc", label: "الأعلى تقييمًا", description: "حسب تقييم المكتبة المحسوب" },
  { value: "title", label: "الاسم", description: "ترتيب أبجدي للعناوين" },
  { value: "updated-desc", label: "آخر تحديث", description: "الأعمال التي تغيّرت مؤخرًا" },
  { value: "added-desc", label: "آخر إضافة", description: "الأعمال الأحدث في المكتبة" },
] as const;
export const groupChoices = [
  { value: "none", label: "بلا تجميع" },
  { value: "planet", label: "الكوكب" },
  { value: "genre", label: "النوع الفني" },
  { value: "country", label: "البلد" },
  { value: "studio", label: "الاستوديو" },
  { value: "year", label: "سنة الإصدار" },
  { value: "format", label: "الصيغة" },
  { value: "audience", label: "الجمهور" },
  { value: "status", label: "حالة الإصدار" },
  { value: "watchState", label: "حالة المشاهدة" },
] as const;
export type SortOrder = (typeof sortChoices)[number]["value"];
export type BrowseGroup = (typeof groupChoices)[number]["value"];
export type BrowseRefinements = {
  filters: BrowseFilters;
  privacy: "public" | "all" | "private";
  from: string;
  to: string;
  sort: SortOrder;
  group: BrowseGroup;
};
export type LockedFacet = { key: string; value: string };

export function parseSort(value: string | null): SortOrder {
  return sortChoices.find((item) => item.value === value)?.value ?? "year-desc";
}
export function parseGroup(value: string | null): BrowseGroup {
  return groupChoices.find((item) => item.value === value)?.value ?? "none";
}
export function withPreset(filters: BrowseFilters, locked?: LockedFacet): BrowseFilters {
  if (!locked) return filters;
  const previous = filters.facets.find((facet) => facet.key === locked.key) ?? {
    key: locked.key,
    include: [],
    exclude: [],
  };
  return {
    ...filters,
    facets: [
      ...filters.facets.filter((facet) => facet.key !== locked.key),
      {
        ...previous,
        include: [...previous.include.filter((value) => value !== locked.value), locked.value],
        exclude: previous.exclude.filter((value) => value !== locked.value),
      },
    ],
  };
}
export function resetRefinements(locked?: LockedFacet): BrowseRefinements {
  return {
    filters: withPreset(emptyFilters(), locked),
    privacy: "public",
    from: "",
    to: "",
    sort: "year-desc",
    group: "none",
  };
}
export function yearError(from: string, to: string) {
  if ([from, to].some((value) => value !== "" && (!/^\d{1,4}$/.test(value) || Number(value) < 1)))
    return "أدخل سنة صحيحة بين 1 و9999.";
  if (from && to && Number(from) > Number(to)) return "سنة البداية يجب ألا تكون بعد سنة النهاية.";
  return null;
}
export function refinementCount(value: BrowseRefinements, locked?: LockedFacet) {
  return (
    filterCount(value.filters) -
    Number(Boolean(locked)) +
    Number(value.privacy !== "public") +
    Number(Boolean(value.from)) +
    Number(Boolean(value.to))
  );
}
export function refinementQuery(
  value: BrowseRefinements,
  view: "works" | "installments",
  q: string,
): CatalogQuery {
  return {
    view,
    q: q || undefined,
    privacy: value.privacy,
    sort: value.sort,
    group: value.group === "none" ? undefined : value.group,
    filters: JSON.stringify(value.filters),
    yearFrom: value.from ? Number(value.from) : undefined,
    yearTo: value.to ? Number(value.to) : undefined,
  };
}
export function removeFacet(filters: BrowseFilters, key: string, value: string) {
  return {
    ...filters,
    facets: filters.facets
      .map((facet) =>
        facet.key === key
          ? {
              ...facet,
              include: facet.include.filter((item) => item !== value),
              exclude: facet.exclude.filter((item) => item !== value),
            }
          : facet,
      )
      .filter((facet) => facet.include.length || facet.exclude.length),
  };
}
export function groupKey(value: BrowseGroup, item: CatalogEntry) {
  if (value === "year")
    return String(item.installment?.releaseDate?.slice(0, 4) ?? item.work.releaseYear ?? "unknown");
  if (value === "format") return item.work.format;
  if (value === "audience") return item.classification.audience;
  if (value === "status") return item.status;
  if (value === "watchState") return item.watchState;
  return "all";
}

export function groupTitle(group: BrowseGroup, key: string, options?: FacetCatalog) {
  const facets = { planet: "planets", genre: "genres", country: "countries", studio: "studios" };
  if (group === "planet" || group === "genre" || group === "country" || group === "studio") {
    if (key === "__none__")
      return {
        planet: "دون كوكب",
        genre: "دون نوع فني",
        country: "دون بلد",
        studio: "دون استوديو",
      }[group];
    return (
      options?.groups
        .find((facet) => facet.key === facets[group])
        ?.options.find((option) => option.value === key)?.label ?? "جارٍ تحميل اسم المجموعة…"
    );
  }
  if (group === "format") return key === "animated" ? "رسوم متحركة" : "تمثيل حي";
  return optionLabel(key, key === "unknown" ? "غير معروف" : key);
}

export function groupLabel(value: BrowseGroup, item: CatalogEntry) {
  return groupTitle(value, groupKey(value, item));
}

export function scoreLabel(key: string) {
  return criteria.find((criterion) => criterion.key === key)?.label ?? key;
}

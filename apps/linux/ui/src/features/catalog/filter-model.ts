import { taxonomy } from "@arcadia/domain";
import { BrowseFiltersSchema } from "@nahhasio/api-contract";
import type { BrowseFilters, FacetCatalog } from "@nahhasio/api-contract";

export const criteria = [
  { key: "story", label: "القصة والحبكة", weight: 25 },
  { key: "characters", label: "الشخصيات", weight: 20 },
  { key: "depth", label: "العمق", weight: 20 },
  { key: "worldBuilding", label: "بناء العالم", weight: 10 },
  { key: "originality", label: "الأصالة", weight: 10 },
  { key: "craft", label: "الإبداع والتنفيذ", weight: 15 },
] as const;

export function emptyFilters(): BrowseFilters {
  return {
    facets: [],
    minimumRating: 0,
    minimumScores: {
      story: 0,
      characters: 0,
      depth: 0,
      worldBuilding: 0,
      originality: 0,
      craft: 0,
    },
  };
}

export function parseFilters(value: string | null): BrowseFilters {
  try {
    return BrowseFiltersSchema.parse(value ? JSON.parse(value) : emptyFilters());
  } catch {
    return emptyFilters();
  }
}

export function filterCount(filters: BrowseFilters) {
  return (
    filters.facets.reduce((n, s) => n + s.include.length + s.exclude.length, 0) +
    Number(filters.minimumRating > 0 || (filters.maximumRating ?? 10) < 10) +
    Object.values(filters.minimumScores).filter((v) => v > 0).length
  );
}

const labels = new Map<string, string>([
  ["animated", "رسوم متحركة"],
  ["live-action", "تمثيل حي"],
  ["ar", "العربية"],
  ["en", "الإنجليزية"],
  ["es", "الإسبانية"],
  ["dubbing_studio", "استوديو الدبلجة"],
  ["animated-series", "مسلسل رسوم متحركة"],
  ["animated-movie", "فيلم رسوم متحركة"],
  ["live-action-series", "مسلسل واقعي"],
  ["live-action-movie", "فيلم واقعي"],
  ["released", "لديه إصدارات صادرة"],
  ["unreleased", "لم يصدر بعد"],
  ["announced", "قادم"],
  ["airing", "يعرض الآن"],
  ["ongoing", "مستمر"],
  ["completed", "مكتمل"],
  ["unknown", "غير معروف"],
  ["general", "عام"],
  ["teen", "مراهقون"],
  ["young-adult", "شباب بالغون"],
  ["adult", "بالغون"],
  ["none", "لا يوجد"],
  ["low", "منخفض"],
  ["medium", "متوسط"],
  ["high", "مرتفع"],
  ["all", "للجميع"],
  ["title", "عنوان كامل"],
  ["season", "موسم"],
  ["standalone", "فيلم أو إصدار مستقل"],
  ["rated", "مقيّم"],
  ["unrated", "غير مقيّم"],
  ["warnings", "به تنبيهات"],
  ["watched", "تمّت مشاهدته"],
  ["in-progress", "قيد المشاهدة"],
  ["unwatched", "لم يُشاهَد"],
  ["favorite", "في المفضلة"],
  ["other", "خارج المفضلة"],
  ["winner", "فائز"],
  ["nominee", "مرشّح"],
]);
const playbackOptionLabels = new Map([
  ["files-only", "ملفات الخادم فقط"],
  ["torrents-allowed", "يسمح بالتورنت"],
  ["available", "يوجد ملف فيديو"],
  ["missing", "لا يوجد ملف فيديو"],
]);

export function optionLabel(value: string, fallback: string) {
  return labels.get(value) ?? playbackOptionLabels.get(value) ?? fallback;
}

const facetLabels = new Map([
  ["releaseStates", "هل صدر؟"],
  ["playableStates", "ملفات الفيديو على الخادم"],
  ["playbackPolicies", "طريقة التشغيل المسموح بها"],
  ["structureStates", "نوع الإصدار"],
]);

export function facetLabel(key: string, fallback: string) {
  return facetLabels.get(key) ?? fallback;
}

export function normalizeFacetSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .toLocaleLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/[\s_-]+/g, " ")
    .trim();
}
const taxonomyLabels = new Map<string, string>(
  [...taxonomy.genres, ...taxonomy.tones, ...taxonomy.tags].map(([key, , arabic]) => [key, arabic]),
);

export function facetOptionLabel(value: string, label: string) {
  return (
    playbackOptionLabels.get(value) ??
    (/[ء-ي]/u.test(label) ? label : optionLabel(value, taxonomyLabels.get(value) ?? label))
  );
}

export function facetMatches(
  option: FacetCatalog["groups"][number]["options"][number],
  query: string,
) {
  const terms = normalizeFacetSearch(
    [
      facetOptionLabel(option.value, option.label),
      option.label,
      option.value,
      ...(option.searchTerms ?? []),
    ].join(" "),
  );
  return normalizeFacetSearch(query)
    .split(" ")
    .every((token) => terms.includes(token));
}
export function setFacetSelection(
  filters: BrowseFilters,
  key: string,
  value: string,
  mode: "include" | "exclude" | null,
): BrowseFilters {
  const current = filters.facets.find((facet) => facet.key === key) ?? {
    key,
    include: [],
    exclude: [],
  };
  const next = {
    key,
    include: current.include.filter((item) => item !== value),
    exclude: current.exclude.filter((item) => item !== value),
  };
  if (mode) next[mode].push(value);
  return {
    ...filters,
    facets: [...filters.facets.filter((facet) => facet.key !== key), next].filter(
      (facet) => facet.include.length || facet.exclude.length,
    ),
  };
}

// Fixed choices remain discoverable even when the visible library has no matches.
export function completeFacetGroups(
  groups: FacetCatalog["groups"],
  view: "works" | "installments",
): FacetCatalog["groups"] {
  const fixed = [
    { key: "formats", label: "نوع العمل", values: ["animated", "live-action"] },
    {
      key: "kinds",
      label: "النوع",
      values: ["animated-series", "animated-movie", "live-action-series", "live-action-movie"],
    },
    {
      key: "releaseStatuses",
      label: "حالة الإصدار",
      values:
        view === "works"
          ? ["completed", "ongoing", "announced", "unknown"]
          : ["announced", "airing", "completed", "unknown"],
    },
    { key: "releaseStates", label: "هل صدر؟", values: ["released", "unreleased"] },
    { key: "watchStates", label: "حالة المشاهدة", values: ["unwatched", "in-progress", "watched"] },
    { key: "favoriteStates", label: "المفضلة", values: ["favorite", "other"] },
    { key: "playableStates", label: "ملفات الفيديو على الخادم", values: ["available", "missing"] },
    {
      key: "playbackPolicies",
      label: "طريقة التشغيل المسموح بها",
      values: ["files-only", "torrents-allowed"],
    },
    { key: "behavioralRisks", label: "العنف والسلوك", values: ["none", "low", "medium", "high"] },
    { key: "sexualityRisks", label: "المحتوى الجنسي", values: ["none", "low", "medium", "high"] },
    { key: "theologyRisks", label: "الموضوعات العقدية", values: ["none", "low", "medium", "high"] },
    { key: "ratingStates", label: "حالة التقييم", values: ["rated", "unrated"] },
    { key: "warningStates", label: "تنبيهات المحتوى", values: ["warnings", "none"] },
    { key: "awardResults", label: "نتائج الجوائز", values: ["winner", "nominee"] },
  ];
  const completed = groups.map((group) => ({ ...group, options: [...group.options] }));
  // An untagged library should explain the absence rather than hide the feature.
  if (!completed.some((group) => group.key === "tags"))
    completed.push({ key: "tags", label: "الوسوم", options: [] });
  for (const definition of fixed) {
    let group = completed.find((item) => item.key === definition.key);
    if (!group) {
      group = { key: definition.key, label: definition.label, options: [] };
      completed.push(group);
    }
    if (definition.key === "releaseStatuses") {
      group.options = definition.values.map(
        (value) =>
          group.options.find((option) => option.value === value) ?? {
            value,
            label: optionLabel(value, value),
            count: 0,
          },
      );
    }
    for (const value of definition.values) {
      if (!group.options.some((option) => option.value === value))
        group.options.push({ value, label: optionLabel(value, value), count: 0 });
    }
  }
  return completed.map((group) => ({ ...group, label: facetLabel(group.key, group.label) }));
}

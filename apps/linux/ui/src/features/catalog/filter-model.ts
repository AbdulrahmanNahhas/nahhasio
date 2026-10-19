import { BrowseFiltersSchema } from "@nahhasio/api-contract";
import type { BrowseFilters } from "@nahhasio/api-contract";

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
    Number(filters.minimumRating > 0) +
    Object.values(filters.minimumScores).filter((v) => v > 0).length
  );
}

const labels = new Map<string, string>([
  ["ar", "العربية"],
  ["en", "الإنجليزية"],
  ["es", "الإسبانية"],
  ["files-only", "ملفات فقط"],
  ["torrents-allowed", "التورنت متاح"],
  ["dubbing_studio", "استوديو الدبلجة"],
  ["animated-series", "مسلسل رسوم متحركة"],
  ["animated-movie", "فيلم رسوم متحركة"],
  ["live-action-series", "مسلسل واقعي"],
  ["live-action-movie", "فيلم واقعي"],
  ["released", "لديه إصدارات صادرة"],
  ["unreleased", "لم يصدر بعد"],
  ["announced", "قادم"],
  ["airing", "يعرض الآن"],
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
  ["available", "فيديو مسجّل"],
  ["missing", "لا يوجد فيديو مسجّل"],
  ["watched", "تمّت مشاهدته"],
  ["in-progress", "قيد المشاهدة"],
  ["unwatched", "لم يُشاهَد"],
  ["favorite", "في المفضلة"],
  ["other", "خارج المفضلة"],
  ["winner", "فائز"],
  ["nominee", "مرشّح"],
]);
export function optionLabel(value: string, fallback: string) {
  return labels.get(value) ?? fallback;
}

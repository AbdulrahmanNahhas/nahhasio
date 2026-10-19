import type { ArtworkAssignment, Classification } from "@nahhasio/api-contract";
export function episodeNumberLabel(value: string) {
  if (!/^[+-]?\d+\.\d+$/.test(value)) return value;
  return value.replace(/0+$/, "").replace(/\.$/, "");
}
export function dateLabel(date: string | null | undefined) {
  if (!date) return "غير معروف";
  const value = new Date(date.length === 10 ? `${date}T00:00:00Z` : date);
  return Number.isNaN(value.getTime())
    ? date
    : new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeZone: "UTC" }).format(value);
}
export function pickArtwork(images: ArtworkAssignment[], role: string) {
  return images.find((a) => a.role === role && a.isPrimary) ?? images.find((a) => a.role === role);
}
export const riskLabels = new Map([
  ["none", "لا يوجد"],
  ["low", "منخفض"],
  ["medium", "متوسط"],
  ["high", "مرتفع"],
]);
export const audienceLabels = new Map([
  ["general", "عام"],
  ["teen", "مراهقون"],
  ["young-adult", "شباب بالغون"],
  ["adult", "بالغون"],
]);
export const classificationLabels = new Map<keyof Classification, string>([
  ["audience", "الجمهور"],
  ["age", "الفئة العمرية"],
  ["sexualityRisk", "المحتوى الجنسي"],
  ["behavioralRisk", "العنف والسلوك"],
  ["theologyRisk", "الموضوعات العقدية"],
]);
export const artworkRoleLabels = new Map([
  ["poster", "ملصق"],
  ["banner", "خلفية"],
  ["logo", "شعار"],
  ["profile", "صورة شخصية"],
  ["still", "صورة حلقة"],
]);
export const externalIdLabels = new Map([
  ["tmdbId", "TMDB"],
  ["imdbId", "IMDb"],
  ["anilistId", "AniList"],
  ["malId", "MyAnimeList"],
]);
export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export const statusLabels = new Map([
  ["announced", "قادم"],
  ["airing", "يعرض الآن"],
  ["completed", "مكتمل"],
  ["unknown", "غير معروف"],
  ["released", "صدر"],
  ["upcoming", "قادم"],
]);

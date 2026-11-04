import type { ReleaseEntry } from "@nahhasio/api-contract";

import { workLink } from "../shell/navigation";
import { episodeNumberLabel } from "../work/format";

export const months = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
export const seasons = ["الشتاء", "الربيع", "الصيف", "الخريف"];
const dateFormat = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "long", timeZone: "UTC" });
export function dateLabel(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00Z`));
}
export function dayDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function numberParam(params: URLSearchParams, key: string, fallback: number, max: number) {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value >= 1 && value <= max ? value : fallback;
}
export function releaseTitle(item: ReleaseEntry) {
  if (item.kind !== "episode")
    return item.title || (item.installmentKind === "movie" ? "فيلم" : "جزء جديد");
  const label = `الحلقة ${episodeNumberLabel(item.episodeNumber ?? "")}`;
  return item.title && item.title.trim() !== label ? `${label}: ${item.title}` : label;
}
export function releaseLink(item: ReleaseEntry) {
  return (
    workLink(item.workId, item.installmentId) +
    (item.kind === "episode" ? `&episode=${encodeURIComponent(item.id)}` : "")
  );
}

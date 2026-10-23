import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway, type AdminWorksQuery } from "@/lib/bridge";

export const worksSearchSchema = z.object({
  q: z.string().max(200).catch("").default(""),
  page: z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/)
    .refine((value) => Number(value) <= 100_000)
    .catch("1")
    .default("1"),
  format: z.enum(["all", "animated", "live-action"]).catch("all").default("all"),
  structure: z.enum(["all", "movie", "series"]).catch("all").default("all"),
  workflow: z
    .enum(["all", "draft", "in_review", "approved", "published", "archived"])
    .catch("all")
    .default("all"),
  visibility: z.enum(["all", "public", "private"]).catch("all").default("all"),
  gap: z
    .enum([
      "all",
      "poster",
      "summary",
      "arabic-name",
      "structure",
      "banner",
      "logo",
      "trailers",
      "scores",
      "genres",
      "planet",
      "credits",
      "episode-images",
    ])
    .catch("all")
    .default("all"),
  sort: z
    .enum([
      "updated",
      "added",
      "title",
      "year-desc",
      "year-asc",
      "installments-desc",
      "episodes-desc",
    ])
    .catch("updated")
    .default("updated"),
});
export type WorksSearch = z.infer<typeof worksSearchSchema>;
export const workflowLabels = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف",
};
export const worksFilterChoices = [
  {
    key: "format",
    label: "نوع الإنتاج",
    items: [
      { value: "all", label: "كل الأنواع" },
      { value: "animated", label: "رسوم متحركة" },
      { value: "live-action", label: "تمثيل حي" },
    ],
  },
  {
    key: "structure",
    label: "بنية العمل",
    items: [
      { value: "all", label: "كل الأعمال" },
      { value: "movie", label: "أفلام" },
      { value: "series", label: "مسلسلات" },
    ],
  },
  {
    key: "workflow",
    label: "حالة التحرير",
    items: [
      { value: "all", label: "كل الحالات" },
      ...Object.entries(workflowLabels).map(([value, label]) => ({ value, label })),
    ],
  },
  {
    key: "visibility",
    label: "الظهور",
    items: [
      { value: "all", label: "عام وخاص" },
      { value: "public", label: "عام" },
      { value: "private", label: "خاص" },
    ],
  },
  {
    key: "gap",
    label: "بيانات ناقصة",
    items: [
      { value: "all", label: "اكتمال البيانات: الكل" },
      { value: "poster", label: "بلا ملصق" },
      { value: "summary", label: "بلا ملخص" },
      { value: "arabic-name", label: "بلا اسم عربي" },
      { value: "structure", label: "بلا أجزاء" },
      { value: "banner", label: "بلا صورة عريضة" },
      { value: "logo", label: "بلا شعار للعمل" },
      { value: "trailers", label: "بلا إعلان تشويقي" },
      { value: "scores", label: "أجزاء بتقييمات ناقصة" },
      { value: "genres", label: "بلا أنواع قصصية" },
      { value: "planet", label: "بلا كوكب" },
      { value: "credits", label: "بلا مساهمات" },
      { value: "episode-images", label: "حلقات بلا صور" },
    ],
  },
] as const;
export const worksSortChoices = [
  { value: "updated", label: "آخر تعديل" },
  { value: "added", label: "الأحدث إضافة" },
  { value: "title", label: "الاسم" },
  { value: "year-desc", label: "الأحدث إصدارًا" },
  { value: "year-asc", label: "الأقدم إصدارًا" },
  { value: "installments-desc", label: "الأكثر أجزاء" },
  { value: "episodes-desc", label: "الأكثر حلقات" },
] as const;
export const workGapChoices =
  worksFilterChoices.find((filter) => filter.key === "gap")?.items ?? [];

export function adminWorksQuery(search: WorksSearch): AdminWorksQuery {
  return {
    page: Number(search.page),
    pageSize: 30,
    q: search.q || undefined,
    format: search.format === "all" ? undefined : search.format,
    structure: search.structure === "all" ? undefined : search.structure,
    workflow: search.workflow === "all" ? undefined : search.workflow,
    visibility: search.visibility === "all" ? undefined : search.visibility,
    gap: search.gap === "all" ? undefined : search.gap,
    sort: search.sort,
  };
}
export function adminWorksOptions(userId: string, search: WorksSearch) {
  const query = adminWorksQuery(search);
  return queryOptions({
    queryKey: ["admin", "works", userId, query],
    queryFn: ({ signal }) => gateway.adminWorks(query, signal),
    staleTime: 30_000,
    retry: false,
  });
}

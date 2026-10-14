import {
  imageSchema,
  imageAssignmentSchema,
  imageOwnerSchema,
  rpcInputs,
} from "@arcadia/contracts/editor-rpc";
import { z } from "zod";

export type ImageAsset = z.infer<typeof imageSchema>;
export type ImageAssignment = z.infer<typeof imageAssignmentSchema>;
export type ImageOwner = z.infer<typeof imageOwnerSchema>;
export type ImageFilters = z.infer<typeof rpcInputs.assets>;
export const imageSearchSchema = z.object({
  q: z.string().max(300).catch("").default(""),
  health: z.enum(["all", "problems", "missing", "healthy"]).catch("all").default("all"),
  usage: z.enum(["all", "assigned", "unassigned"]).catch("all").default("all"),
  role: z.enum(["all", "poster", "banner", "logo", "profile"]).catch("all").default("all"),
  sort: z.enum(["newest", "oldest", "name", "size"]).catch("newest").default("newest"),
  page: z
    .string()
    .regex(/^[1-9][0-9]{0,5}$/)
    .refine((value) => Number(value) <= 100000)
    .catch("1")
    .default("1"),
  view: z.enum(["grid", "table"]).catch("grid").default("grid"),
  image: z.string().uuid().catch("").default(""),
});
export type ImageSearch = z.infer<typeof imageSearchSchema>;
export const imageRoles = [
  { value: "poster", label: "ملصق" },
  { value: "banner", label: "خلفية" },
  { value: "logo", label: "شعار" },
  { value: "profile", label: "صورة شخصية" },
] as const;
export const ownerKinds = [
  { value: "title", label: "عمل" },
  { value: "installment", label: "جزء" },
  { value: "episode", label: "حلقة" },
  { value: "entity", label: "شخص / استوديو" },
] as const;
export function roleLabel(role: string) {
  return imageRoles.find((item) => item.value === role)?.label ?? role;
}
export function fileSize(size: number) {
  return (
    new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(
      size >= 1048576 ? size / 1048576 : size / 1024,
    ) + (size >= 1048576 ? " ميغابايت" : " كيلوبايت")
  );
}
export function ownerLink(item: ImageAssignment) {
  return item.workId
    ? `#/admin/works/${item.workId}?section=${item.ownerKind === "title" ? "images" : "structure"}`
    : item.entityKind
      ? `#/${item.entityKind === "person" ? "people" : "studios"}/${item.ownerId}`
      : null;
}

export function healthLabel(health: ImageAsset["health"]) {
  return {
    healthy: "الملف متاح",
    missing: "ملف مفقود",
    unreadable: "تعذّر قراءة الملف",
    "size-mismatch": "الحجم غير مطابق",
    "deletion-error": "خطأ حذف سابق",
  }[health];
}

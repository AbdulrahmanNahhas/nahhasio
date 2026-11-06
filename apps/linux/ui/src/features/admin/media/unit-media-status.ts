import type { MediaUnitStatus } from "@nahhasio/api-contract";

export function unitMediaLabel(status: MediaUnitStatus): string {
  if (status.availableFiles > 1) return `${status.availableFiles} نسخ متاحة`;
  if (status.availableFiles === 1) return "ملف متاح";
  if (status.activeImports) return "جارٍ الاستيراد";
  if (status.missingFiles) return "ملف مفقود من القرص";
  if (status.reviewFiles) return "ملف يحتاج تحققًا";
  if (status.trashedFiles) return "في المحذوفات";
  return "بلا ملف على الخادم";
}

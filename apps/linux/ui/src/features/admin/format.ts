export function formatAdminDate(value: string | null | undefined) {
  if (!value) return "غير مسجّل";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "تاريخ غير متاح"
    : new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
export function formatAdminBytes(value: number) {
  const scale =
    value >= 1073741824
      ? ([1073741824, "غ.ب"] as const)
      : value >= 1048576
        ? ([1048576, "م.ب"] as const)
        : value >= 1024
          ? ([1024, "ك.ب"] as const)
          : ([1, "بايت"] as const);
  return `${new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(value / scale[0])} ${scale[1]}`;
}

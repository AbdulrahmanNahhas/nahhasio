export const tableColumns = [
  { key: "release", label: "الإصدار والسنة" },
  { key: "status", label: "حالة الإصدار" },
  { key: "score", label: "التقييم" },
  { key: "audience", label: "الجمهور" },
  { key: "age", label: "الفئة العمرية" },
  { key: "watchState", label: "حالة المشاهدة" },
  { key: "format", label: "نوع العمل" },
] as const;
export type TableColumn = (typeof tableColumns)[number]["key"];
export const defaultTableColumns: TableColumn[] = [
  "release",
  "status",
  "score",
  "audience",
  "watchState",
];

export type DisplayPreferences = {
  layout: "poster" | "banner" | "logo" | "table";
  size: "compact" | "normal" | "comfortable";
  minimal: boolean;
  borderless: boolean;
  showScore: boolean;
  showStatus: boolean;
  showMetadata?: boolean;
  showOriginalTitle?: boolean;
  tableColumns?: TableColumn[];
  tablePosters?: boolean;
  tableTitle?: "arabic" | "english" | "both";
  tableDensity?: "compact" | "normal";
};
export const displayDefaults: DisplayPreferences = {
  layout: "poster",
  size: "normal",
  minimal: false,
  borderless: false,
  showScore: true,
  showStatus: true,
};

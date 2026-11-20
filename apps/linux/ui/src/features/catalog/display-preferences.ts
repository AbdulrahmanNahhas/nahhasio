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

type CardLayout = "poster" | "banner" | "logo";

type CardViewSettings = {
  size: "compact" | "normal" | "comfortable";
  minimal: boolean;
  borderless: boolean;
  showTitle?: boolean;
  cardTitle?: "arabic" | "english";
  showScore: boolean;
  showStatus: boolean;
  showWatchStatus?: boolean;
  showMetadata?: boolean;
};

export type DisplayPreferences = CardViewSettings & {
  layout: CardLayout | "table";
  cardViews?: Partial<Record<CardLayout, CardViewSettings>>;
  showOriginalTitle?: boolean;
  tableColumns?: TableColumn[];
  tablePosters?: boolean;
  tableTitle?: "arabic" | "english" | "both";
  tableDensity?: "compact" | "normal";
};
const posterDefaults = {
  size: "normal",
  minimal: false,
  borderless: false,
  showTitle: false,
  cardTitle: "arabic",
  showScore: false,
  showStatus: false,
  showWatchStatus: false,
  showMetadata: false,
} as const;

const cardLayoutDefaults = {
  poster: posterDefaults,
  banner: {
    ...posterDefaults,
    size: "compact",
    showTitle: true,
    showScore: true,
    showStatus: true,
    showWatchStatus: true,
    showMetadata: true,
  },
  logo: { ...posterDefaults, size: "comfortable", borderless: true },
} as const;

export const displayDefaults: DisplayPreferences = { layout: "poster", ...posterDefaults };

export function selectBrowseLayout(
  current: DisplayPreferences,
  layout: DisplayPreferences["layout"],
): DisplayPreferences {
  if (layout === current.layout) return current;
  const cardViews = { ...current.cardViews };
  if (current.layout !== "table") {
    const {
      size,
      minimal,
      borderless,
      showTitle,
      cardTitle,
      showScore,
      showStatus,
      showWatchStatus,
      showMetadata,
    } = normalizeBrowseDisplay(current);
    cardViews[current.layout] = {
      size,
      minimal,
      borderless,
      showTitle,
      cardTitle,
      showScore,
      showStatus,
      showWatchStatus,
      showMetadata,
    };
  }
  const settings = layout === "table" ? {} : (cardViews[layout] ?? cardLayoutDefaults[layout]);
  return { ...current, ...settings, layout, cardViews };
}

// Older image-only and bilingual settings resolve to the equivalent single-language controls.
export function normalizeBrowseDisplay(value: DisplayPreferences): DisplayPreferences {
  const originalOnly =
    value.cardTitle === undefined && value.showOriginalTitle && value.showTitle === false;
  return {
    ...value,
    minimal: false,
    cardTitle: value.cardTitle ?? (originalOnly ? "english" : "arabic"),
    showTitle: !value.minimal && (originalOnly || (value.showTitle ?? true)),
    showScore: !value.minimal && value.showScore,
    showStatus: !value.minimal && value.showStatus,
    showMetadata: !value.minimal && (value.showMetadata ?? true),
    tableTitle: value.tableTitle === "english" ? "english" : "arabic",
  };
}

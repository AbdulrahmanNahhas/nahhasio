export type DisplayPreferences = {
  layout: "poster" | "banner" | "logo" | "table";
  size: "compact" | "normal" | "comfortable";
  minimal: boolean;
  borderless: boolean;
  showScore: boolean;
  showStatus: boolean;
};
export const displayDefaults: DisplayPreferences = {
  layout: "poster",
  size: "normal",
  minimal: false,
  borderless: false,
  showScore: true,
  showStatus: true,
};

// JSON targets are registered explicitly. New domains supply typed reads/reviews/saves before
// becoming selectable; the client never sends arbitrary table names or SQL mutations.
export const jsonEntityAdapters = {
  people: { kind: "person", title: "الأشخاص", recordLabel: "شخص" },
  studios: { kind: "organization", title: "الاستوديوهات", recordLabel: "استوديو" },
} as const;
export type JsonEntityTarget = keyof typeof jsonEntityAdapters;

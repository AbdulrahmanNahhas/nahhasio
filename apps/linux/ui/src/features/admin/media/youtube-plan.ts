import type { YoutubePreviewEntry } from "@nahhasio/api-contract";

export type YoutubeEdit = {
  include?: boolean;
  episodeId?: string;
  number?: number;
  title?: string;
  thumbnail?: boolean;
  order?: number;
};
export function playlistRows(entries: YoutubePreviewEntry[], edits: Record<string, YoutubeEdit>) {
  const seen = new Set<string>();
  return entries
    .map((entry, index) => {
      const key = `${index}-${entry.videoId ?? "unavailable"}`;
      const duplicate = Boolean(entry.videoId && seen.has(entry.videoId));
      if (entry.videoId) seen.add(entry.videoId);
      const edit = edits[key] ?? {};
      return {
        entry,
        key,
        index,
        edit,
        duplicate,
        included: entry.available && Boolean(entry.videoId) && (edit.include ?? !duplicate),
      };
    })
    .toSorted((a, b) => (a.edit.order ?? a.index) - (b.edit.order ?? b.index) || a.index - b.index);
}
export function renumberPlaylist(
  entries: YoutubePreviewEntry[],
  edits: Record<string, YoutubeEdit>,
  start: number,
) {
  if (!Number.isSafeInteger(start) || start < 1 || start > 100000)
    throw new Error("أدخل رقم بداية صحيحًا وموجبًا.");
  const result = { ...edits };
  let next = start;
  for (const row of playlistRows(entries, edits)) {
    if (row.included) result[row.key] = { ...row.edit, number: next++, episodeId: undefined };
  }
  return result;
}

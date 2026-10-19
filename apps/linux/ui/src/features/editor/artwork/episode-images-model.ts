import type { Episode } from "@/features/editor/structure/episode-editor";

export type EpisodeImageRow = { key: string; value: Episode };
export type ImageTarget = { key: string; number: number; before: string | null; path: string };
export function episodeImage(episode: Episode) {
  return episode.media?.still ?? episode.media?.poster ?? episode.media?.banner ?? null;
}
export function mergeEpisodeImages(rows: EpisodeImageRow[], images: ImageTarget[]): Episode[] {
  for (const image of images) {
    const target = rows.find((row) => row.key === image.key);
    if (
      !target ||
      target.value.number !== image.number ||
      episodeImage(target.value) !== image.before
    )
      throw new Error(
        "تغيّر رقم حلقة أو صورتها أثناء الاستيراد. أعد فتح مراجعة الصور؛ الملفات المستوردة محفوظة في المكتبة.",
      );
  }
  const paths = new Map(images.map((image) => [image.key, image.path]));
  return rows.map((row) =>
    paths.has(row.key)
      ? { ...row.value, media: { ...row.value.media, still: paths.get(row.key) } }
      : row.value,
  );
}

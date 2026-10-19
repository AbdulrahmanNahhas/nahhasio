import { describe, expect, it } from "vitest";

import { episodeImage, mergeEpisodeImages } from "./episode-images-model";

const row = {
  key: "local-a",
  value: {
    id: "00000000-0000-4000-8000-000000000001",
    number: 2,
    title: "Updated title",
    summary: "Keep this edit",
    media: { poster: "/media/old.jpg", banner: "/media/banner.jpg" },
  },
};
const selection = { key: row.key, number: 2, before: "/media/old.jpg", path: "/media/new.jpg" };
describe("episode image application", () => {
  it("updates only selected stills and preserves identities, recent metadata and other artwork", () => {
    const untouched = { key: "local-b", value: { number: 2.5, title: "Special" } };
    const result = mergeEpisodeImages([row, untouched], [selection]);
    expect(result[0]).toEqual({
      ...row.value,
      media: { ...row.value.media, still: "/media/new.jpg" },
    });
    expect(result[1]).toBe(untouched.value);
    expect(row.value.media).not.toHaveProperty("still");
  });
  it.each([
    { ...selection, key: "deleted" },
    { ...selection, number: 3 },
    { ...selection, before: "/media/outdated.jpg" },
  ])("rejects stale selection %j before applying a batch", (stale) => {
    expect(() => mergeEpisodeImages([row], [selection, stale])).toThrow(
      "تغيّر رقم حلقة أو صورتها أثناء الاستيراد.",
    );
    expect(row.value.media).not.toHaveProperty("still");
  });
  it("prefers stills and retains legacy artwork fallback", () => {
    expect(episodeImage(row.value)).toBe("/media/old.jpg");
    expect(
      episodeImage({ number: 1, media: { ...row.value.media, still: "/media/still.jpg" } }),
    ).toBe("/media/still.jpg");
    expect(episodeImage({ number: 1 })).toBeNull();
  });
});

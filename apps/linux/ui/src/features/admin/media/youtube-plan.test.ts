import { describe, expect, it } from "vitest";

import { playlistRows, renumberPlaylist } from "./youtube-plan";

const entries = [
  { videoId: "abcdefghij1", title: "One", durationSeconds: 60, available: true },
  { videoId: "abcdefghij1", title: "Duplicate", durationSeconds: 60, available: true },
  { videoId: null, title: "Private", durationSeconds: null, available: false },
  { videoId: "abcdefghij2", title: "Two", durationSeconds: 60, available: true },
];
describe("reviewed playlist selection", () => {
  it("retains source positions but excludes unavailable and duplicate entries by default", () => {
    const rows = playlistRows(entries, {});
    expect(rows.filter((row) => row.included).map((row) => row.index)).toEqual([0, 3]);
    expect(rows[1]?.duplicate).toBe(true);
  });
  it("numbers only selected entries in the reviewed order without losing title choices", () => {
    const edits = renumberPlaylist(
      entries,
      { "3-abcdefghij2": { order: -1, title: "Edited", episodeId: "previous" } },
      7,
    );
    expect(edits["3-abcdefghij2"]).toEqual({
      order: -1,
      title: "Edited",
      episodeId: undefined,
      number: 7,
    });
    expect(edits["0-abcdefghij1"]?.number).toBe(8);
    expect(edits["2-unavailable"]).toBeUndefined();
    expect(entries[3]?.title).toBe("Two");
  });
  it("keeps duplicate choices independent and rejects invalid bulk numbering", () => {
    const selected = playlistRows(entries, {
      "0-abcdefghij1": { include: false },
      "1-abcdefghij1": { include: true },
    }).filter((row) => row.included);
    expect(selected.map((row) => row.index)).toEqual([1, 3]);
    for (const number of [0, -1, 1.5, Number.NaN, 100001])
      expect(() => renumberPlaylist(entries, {}, number)).toThrow("أدخل رقم بداية صحيحًا وموجبًا.");
  });
});

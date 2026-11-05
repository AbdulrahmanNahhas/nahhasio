import { describe, it, expect } from "vitest";

import { episodeNumber } from "./filename";
describe("import episode suggestions", () => {
  it("recognizes explicit episode patterns without interpreting years", () => {
    expect(episodeNumber("Show S02E03.mkv")).toBe(3);
    expect(episodeNumber("Show - 012.mp4")).toBe(12);
    expect(episodeNumber("الحلقة 15.mp4")).toBe(15);
    expect(episodeNumber("2022 movie.mp4")).toBeNull();
    expect(episodeNumber("Show.mkv")).toBeNull();
  });
});

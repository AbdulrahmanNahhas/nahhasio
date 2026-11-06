import { describe, expect, it } from "vitest";

import { matchesVideoTarget } from "./download-target";

describe("device video identity", () => {
  const target = { workId: "work", installmentId: "season", episodeId: "episode" };
  it("requires the same work, installment and episode", () => {
    expect(matchesVideoTarget({ target }, target)).toBe(true);
    for (const changed of ["workId", "installmentId", "episodeId"] as const)
      expect(matchesVideoTarget({ target: { ...target, [changed]: "other" } }, target)).toBe(false);
    expect(matchesVideoTarget({ target: null }, target)).toBe(false);
  });
  it("normalizes absent movie episode identity without matching another installment", () => {
    expect(
      matchesVideoTarget(
        { target: { workId: "work", installmentId: "movie", episodeId: null } },
        { workId: "work", installmentId: "movie" },
      ),
    ).toBe(true);
    expect(matchesVideoTarget({ target }, { workId: "work", installmentId: "movie" })).toBe(false);
  });
});

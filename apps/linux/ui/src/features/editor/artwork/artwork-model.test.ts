import type { WorkDocument } from "@arcadia/contracts/work";
import { describe, expect, it } from "vitest";

import { artworkContext, suggestedTmdbSeason } from "./artwork-model";

describe("shared TMDB season inference", () => {
  it("uses editorial order, excluding movies and specials", () => {
    const second = { kind: "season", title: "الثاني", position: 8 } as const;
    const first = { kind: "season", title: "الأول", position: 2 } as const;
    const movie = { kind: "movie", title: "فيلم", position: 1 } as const;
    const special = { kind: "special", title: "خاص", position: 4 } as const;
    const work: WorkDocument = {
      canonicalTitle: "عمل",
      installments: [second, movie, special, first],
    };
    expect(suggestedTmdbSeason(work.installments ?? [], second)).toBe(2);
    expect(artworkContext(work, second).season).toBe(2);
    expect(suggestedTmdbSeason(work.installments ?? [], special)).toBe(0);
    expect(artworkContext(work, special).season).toBe(0);
    expect(suggestedTmdbSeason(work.installments ?? [], movie)).toBeUndefined();
  });
  it("keeps an existing installment identifiable across draft copies", () => {
    const part = {
      id: "ac626929-6125-44b4-9eab-76fec63c38ec",
      kind: "season",
      title: "موسم",
      position: 0,
    } as const;
    expect(suggestedTmdbSeason([part], { ...part })).toBe(1);
  });
});

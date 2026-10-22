import { describe, expect, it } from "vitest";

import {
  emptyFilters,
  facetMatches,
  normalizeFacetSearch,
  setFacetSelection,
} from "./filter-model";
describe("multilingual filter search and explicit selection", () => {
  const option = {
    value: "science-fiction",
    label: "خيال علمي",
    count: 12,
    searchTerms: ["Science Fiction", "Sci-fi"],
  };
  it("finds Arabic, English, slugs and aliases without case/separator/diacritic sensitivity", () => {
    for (const q of ["SCIENCE", "science_fiction", "sci-fi", "خيَال علمي", "fiction science"])
      expect(facetMatches(option, q)).toBe(true);
    expect(facetMatches(option, "western")).toBe(false);
    expect(normalizeFacetSearch("أَكْشَن")).toBe("اكشن");
  });
  it("works with older facet replies without search terms", () =>
    expect(facetMatches({ value: "live-action", label: "تمثيل حي", count: 3 }, "LIVE_action")).toBe(
      true,
    ));
  it("switches directly from include to exclude and removes without changing unrelated values", () => {
    const included = setFacetSelection(emptyFilters(), "genres", "action", "include");
    const second = setFacetSelection(included, "genres", "drama", "include");
    const excluded = setFacetSelection(second, "genres", "action", "exclude");
    expect(excluded.facets[0]).toEqual({ key: "genres", include: ["drama"], exclude: ["action"] });
    expect(setFacetSelection(excluded, "genres", "action", null).facets[0]).toEqual({
      key: "genres",
      include: ["drama"],
      exclude: [],
    });
    expect(included.facets[0].exclude).toEqual([]);
  });
});

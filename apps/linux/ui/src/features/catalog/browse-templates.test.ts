import { describe, expect, it } from "vitest";

import { libraryFilters } from "./browse-templates";
import { emptyFilters, setFacetSelection } from "./filter-model";

describe("tags within product libraries", () => {
  it("retains category exclusions alongside extra tag choices", () => {
    const filters = setFacetSelection(emptyFilters(), "tags", "friendship", "include");
    const tags = libraryFilters(filters, "anime").facets.find((facet) => facet.key === "tags");
    expect(tags).toEqual({
      key: "tags",
      required: [],
      include: ["friendship"],
      exclude: ["childhood-classic"],
    });
    expect(filters.facets[0].exclude).toEqual([]);
  });
  it("requires the category tag independently of any additional tag choices", () => {
    const filters = setFacetSelection(emptyFilters(), "tags", "friendship", "include");
    expect(
      libraryFilters(filters, "eastern-animation-movies").facets.find(
        (facet) => facet.key === "tags",
      ),
    ).toEqual({ key: "tags", required: ["anime-movie"], include: ["friendship"], exclude: [] });
  });
  it("keeps all-library choices unchanged", () => {
    const filters = setFacetSelection(emptyFilters(), "tags", "friendship", "exclude");
    expect(libraryFilters(filters, "all")).toBe(filters);
  });
});

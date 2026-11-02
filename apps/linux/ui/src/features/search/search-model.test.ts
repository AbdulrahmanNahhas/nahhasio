import { describe, expect, it } from "vitest";

import { pageDirectory } from "../shell/page-directory";
import { matchingEntities } from "./search-entities";

describe("shared search boundary", () => {
  const facets = {
    groups: [
      {
        key: "contributors",
        label: "الصنّاع",
        options: [
          { value: "director-id", label: "أحمد", count: 2, searchTerms: ["Ahmed", "Ahmed Ali"] },
        ],
      },
      {
        key: "studios",
        label: "الاستوديوهات",
        options: [{ value: "studio-id", label: "أفق", count: 1, searchTerms: ["Horizon"] }],
      },
    ],
    yearMin: null,
    yearMax: null,
  };
  it("finds entity aliases in Arabic and English with the same rules in both search views", () => {
    expect(matchingEntities(facets, "اَحمد", "all").map((item) => item.value)).toEqual([
      "director-id",
    ]);
    expect(matchingEntities(facets, "ALI ahmed", "people").map((item) => item.value)).toEqual([
      "director-id",
    ]);
    expect(matchingEntities(facets, "HORIZON", "all").map((item) => item.value)).toEqual([
      "studio-id",
    ]);
    expect(matchingEntities(facets, "Ahmed", "studios")).toEqual([]);
    expect(matchingEntities(facets, "", "all")).toEqual([]);
  });
  it("excludes admin destinations for regular users and preserves all supported viewer pages", () => {
    const viewer = pageDirectory(false);
    expect(viewer.some((page) => page.href.startsWith("#/admin"))).toBe(false);
    for (const path of ["search", "people", "studios", "downloads", "settings", "profile"])
      expect(viewer.some((page) => page.href === `#/${path}`)).toBe(true);
    const admin = pageDirectory(true);
    expect(admin.some((page) => page.href === "#/admin/maintenance")).toBe(true);
    expect(new Set(admin.map((page) => page.href)).size).toBe(admin.length);
  });
});

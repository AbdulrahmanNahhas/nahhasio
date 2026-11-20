import { describe, expect, it } from "vitest";

import {
  defaultPreferences,
  preferencesSchema,
  rememberedSearch,
} from "./browse-preferences-model";
import { displayDefaults, selectBrowseLayout } from "./display-preferences";

describe("Browse preference boundary", () => {
  it("remembers refinements and display without retaining a transient search or unknown URL fields", () => {
    const params = new URLSearchParams({
      q: "temporary search",
      group: "planet",
      sort: "title",
      filters: '{"facets":[]}',
      view: "installments",
      from: "2000",
      token: "never-store",
    });
    const saved = new URLSearchParams(rememberedSearch(params));
    expect(saved.get("group")).toBe("planet");
    expect(saved.get("filters")).toBe('{"facets":[]}');
    expect(saved.get("view")).toBe("installments");
    expect(saved.get("from")).toBe("2000");
    expect(saved.has("q")).toBe(false);
    expect(saved.has("token")).toBe(false);
  });
  it("round-trips named views and rejects incompatible or malformed persisted display values", () => {
    const saved = {
      ...defaultPreferences,
      search: "group=planet",
      presets: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "الكواكب",
          search: "group=planet",
          display: { ...defaultPreferences.display, layout: "banner" },
        },
      ],
    };
    expect(preferencesSchema.parse(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(preferencesSchema.safeParse({ ...saved, version: 2 }).success).toBe(false);
    expect(
      preferencesSchema.safeParse({ ...saved, display: { ...saved.display, layout: "broken" } })
        .success,
    ).toBe(false);
    expect(
      preferencesSchema.safeParse({
        ...saved,
        presets: Array.from({ length: 9 }, () => saved.presets[0]),
      }).success,
    ).toBe(false);
  });
  it("restores each customized display after switching and reloading", () => {
    const poster = { ...displayDefaults, size: "comfortable" as const, showTitle: true };
    const banner = selectBrowseLayout(poster, "banner");
    expect(banner).toMatchObject({ size: "compact", showTitle: true, showStatus: true });
    const customBanner = { ...banner, showStatus: false };
    const table = {
      ...selectBrowseLayout(customBanner, "table"),
      tableColumns: ["score" as const],
    };
    const saved = { ...defaultPreferences, display: selectBrowseLayout(table, "poster") };
    const reloaded = preferencesSchema.parse(JSON.parse(JSON.stringify(saved)));
    expect(reloaded.display).toMatchObject({
      size: "comfortable",
      showTitle: true,
      showStatus: false,
    });
    expect(selectBrowseLayout(reloaded.display, "banner")).toMatchObject({
      size: "compact",
      showTitle: true,
      showStatus: false,
    });
    expect(selectBrowseLayout(reloaded.display, "table").tableColumns).toEqual(["score"]);
    expect(displayDefaults.cardViews).toBeUndefined();
    expect(displayDefaults.size).toBe("normal");
  });
});

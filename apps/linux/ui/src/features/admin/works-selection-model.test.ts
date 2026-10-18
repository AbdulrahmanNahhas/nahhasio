import { rpcInputs } from "@arcadia/contracts/editor-rpc";
import { CatalogEditorCallSchema } from "@nahhasio/api-contract";
import { describe, expect, it } from "vitest";

import { changeSelection } from "./catalog-selection-model";

describe("cross-page Works selection", () => {
  const first = { id: "first", name: "الأول" };
  const second = { id: "second", name: "الثاني" };
  it("adds another page and clears only that page without losing hidden selections", () => {
    const selected = changeSelection([first], [second], true);
    expect(selected).toEqual([first, second]);
    expect(changeSelection(selected, [second], false)).toEqual([first]);
  });
  it("deduplicates and updates selected work labels", () => {
    expect(changeSelection([first], [{ ...first, name: "اسم محدث" }], true)).toEqual([
      { ...first, name: "اسم محدث" },
    ]);
  });
  it("supports more than thirty selected works without dropping any IDs", () => {
    const many = Array.from({ length: 250 }, (_, index) => ({
      id: String(index),
      name: String(index),
    }));
    const next = changeSelection(many, [second], true);
    expect(next).toHaveLength(251);
    expect(next[250]).toEqual(second);
    expect(changeSelection(next, [many[0]], false)).toHaveLength(250);
  });
});

it("forwards selections larger than thirty through the generated and worker editor contracts", () => {
  const ids = Array.from(
    { length: 75 },
    (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  );
  expect(rpcInputs.read.parse({ ids }).ids).toHaveLength(75);
  expect(CatalogEditorCallSchema.parse({ operation: "read", data: { ids } }).operation).toBe(
    "read",
  );
  expect(
    rpcInputs.review.parse({
      json: "{}",
      originals: ids.map((id) => ({ id, revision: "a".repeat(64) })),
    }).originals,
  ).toHaveLength(75);
});

it("allows large People and Organizations JSON selections while preserving the deletion batch limit", () => {
  const ids = Array.from(
    { length: 75 },
    (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  );
  const originals = ids.map((id) => ({ id, revision: "a".repeat(64) }));
  expect(rpcInputs.entityJsonRead.parse({ kind: "person", ids }).ids).toHaveLength(75);
  expect(rpcInputs.entityJsonReview.parse({ json: "{}", originals }).originals).toHaveLength(75);
  expect(
    rpcInputs.entityBulkDelete.safeParse({
      kind: "person",
      records: originals,
      removeCredits: false,
    }).success,
  ).toBe(false);
  expect(
    CatalogEditorCallSchema.parse({
      operation: "entitySelection",
      data: { kind: "organization", q: "", image: "all", usage: "all" },
    }).operation,
  ).toBe("entitySelection");
});

import { describe, expect, it } from "vitest";

import { analyzeWorkDraft, checkRecordIdentities, serializeWorkReview } from "./work-draft";

const first = { id: "first", canonicalTitle: "First", summary: "Original summary" };
const second = { id: "second", canonicalTitle: "Second" };
const originals = [first, second];

function draft(records: object[]) {
  return JSON.stringify({ schemaVersion: 1, fields: ["canonicalTitle"], records });
}

describe("work JSON drafts", () => {
  it("merges by ID and preserves edits to hidden fields and omitted works", () => {
    const buffers = [{ ...first, summary: "Edited while visible" }, second];
    const result = analyzeWorkDraft(
      draft([{ id: first.id, canonicalTitle: "Renamed" }]),
      originals,
      buffers,
    );
    expect(result.identityIssues).toEqual([]);
    expect(result.mergedRows).toEqual([{ ...buffers[0], canonicalTitle: "Renamed" }, second]);
    expect(serializeWorkReview(result.mergedRows)).toContain("Edited while visible");
  });

  it("keeps the original buffers when the JSON cannot be parsed", () => {
    const result = analyzeWorkDraft("{", originals, originals);
    expect(result.input).toHaveProperty("error");
    expect(result.mergedRows).toBe(originals);
  });

  it("reports duplicated IDs once and suggests the original ID for a matching title", () => {
    const issues = checkRecordIdentities(originals, [
      first,
      { ...first, canonicalTitle: "Duplicate" },
      { ...second, id: "changed" },
      { id: 42 },
      { id: "unselected" },
    ]);
    expect(issues.map(({ id, title, expectedId }) => ({ id, title, expectedId }))).toEqual([
      { id: first.id, title: "First", expectedId: null },
      { id: "changed", title: "Second", expectedId: second.id },
      { id: null, title: "السجل 4", expectedId: null },
      { id: "unselected", title: "السجل 5", expectedId: null },
    ]);
  });
});

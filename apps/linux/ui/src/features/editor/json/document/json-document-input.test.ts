import { describe, expect, it } from "vitest";

import { readEditorDocument } from "./json-document-input";

const record = {
  id: "23c8155d-f84c-45e6-970f-378125daf031",
  canonicalTitle: "Emily, Girl of the Wind",
};

describe("trailer JSON input", () => {
  it("reports the record and trailer path for URL strings in a projection", () => {
    const input = readEditorDocument(
      JSON.stringify({
        schemaVersion: 1,
        fields: ["canonicalTitle", "trailers"],
        records: [{ ...record, trailers: ["https://www.youtube.com/watch?v=_McjTc1Qp9s"] }],
      }),
    );
    if (!("projection" in input)) throw new Error("Expected a projection");
    expect(input.projection.success).toBe(false);
    if (input.projection.success) throw new Error("Expected invalid trailers");
    expect(input.projection.error.issues[0]?.path).toEqual(["records", 0, "trailers", 0]);
    expect(input.projection.error.issues[0]?.message).toContain("youtubeVideoId");
  });

  it("rejects a full URL used as a video ID in a plain work document", () => {
    const input = readEditorDocument(
      JSON.stringify({
        ...record,
        trailers: [{ youtubeVideoId: "https://www.youtube.com/watch?v=_McjTc1Qp9s" }],
      }),
    );
    if (!("projection" in input)) throw new Error("Expected a projection");
    expect(input.projection.success).toBe(false);
  });

  it.each([
    { trailers: [] },
    { trailers: [{ youtubeVideoId: "_McjTc1Qp9s", language: "ar", isPrimary: true }] },
  ])("accepts valid trailer objects and intentional empty lists: %j", ({ trailers }) => {
    const input = readEditorDocument(JSON.stringify([{ ...record, trailers }]));
    if (!("projection" in input)) throw new Error("Expected a projection");
    expect(input.projection.success).toBe(true);
    expect(input.raw).toEqual([{ ...record, trailers }]);
  });
});

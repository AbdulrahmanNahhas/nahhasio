import { describe, expect, it } from "vitest";

import { legacyArtworkPath } from "./legacy-source";

describe("recovery artwork paths", () => {
  it("preserves the stored media path under an explicit recovery root", () => {
    expect(legacyArtworkPath("/media/uploads/poster.jpg", "/recovery/artwork")).toBe(
      "/recovery/artwork/media/uploads/poster.jpg",
    );
  });

  it("requires an absolute recovery root", () => {
    expect(() => legacyArtworkPath("/media/poster.jpg", "")).toThrow(
      "absolute recovery artwork root",
    );
    expect(() => legacyArtworkPath("/media/poster.jpg", "relative")).toThrow(
      "absolute recovery artwork root",
    );
  });

  it("rejects traversal and ambiguous stored paths", () => {
    for (const path of ["../poster.jpg", "/media/../poster.jpg", "//etc/passwd", "a\\b", "a\0b"])
      expect(() => legacyArtworkPath(path, "/recovery/artwork")).toThrow(
        "Invalid recovery artwork path",
      );
  });
});

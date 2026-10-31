import { describe, expect, it } from "vitest";

import { clientInfoSchema, diagnosticReport } from "./settings-model";

describe("diagnostic export privacy", () => {
  it("exports only the approved fields, excluding paths and future private fields", () => {
    const info = clientInfoSchema.parse({
      version: "0.1.2",
      platform: "linux",
      serverVersion: "0.1.2",
      apiVersion: 1,
      videoRoot: "/private/family/videos",
      token: "never-export-this",
      capabilities: {
        nativePlayback: true,
        offlineLibrary: true,
        artworkVariants: true,
        rememberedAccounts: true,
        subtitleSearch: false,
        debrid: false,
      },
    });
    const report = diagnosticReport(info);
    expect(report).not.toContain("/private");
    expect(report).not.toContain("never-export-this");
    expect(JSON.parse(report)).toMatchObject({
      app: "Nahhasio",
      platform: "linux",
      version: "0.1.2",
    });
  });
});

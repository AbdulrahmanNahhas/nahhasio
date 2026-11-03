import { describe, expect, it } from "vitest";

import { developmentServer } from "../development-server";

describe("development browser upstream", () => {
  it("defaults to the pinned synthetic catalog", () => {
    expect(developmentServer({})).toMatchObject({
      origin: "http://127.0.0.1:23103/",
      serverId: "97900000-0000-4000-8000-000000000001",
      remote: false,
    });
  });
  it("requires HTTPS and an explicit verified identity for other targets", () => {
    expect(() =>
      developmentServer({ NAHHASIO_BROWSER_SERVER_URL: "http://192.168.1.53:8443" }),
    ).toThrow("HTTPS");
    expect(() =>
      developmentServer({ NAHHASIO_BROWSER_SERVER_URL: "https://192.168.1.53:8443" }),
    ).toThrow("identity");
    expect(
      developmentServer({
        NAHHASIO_BROWSER_SERVER_URL: "https://192.168.1.53:8443",
        NAHHASIO_BROWSER_SERVER_ID: "2cd022f1-85b7-4f3d-a4ae-2ab2d8e55114",
      }),
    ).toMatchObject({ origin: "https://192.168.1.53:8443/", remote: true });
  });
  it.each([
    "https://user:password@example.test",
    "https://example.test/api",
    "https://example.test/?token=private",
    "https://example.test/#fragment",
  ])("rejects credentials and non-origin targets: %s", (url) => {
    expect(() => developmentServer({ NAHHASIO_BROWSER_SERVER_URL: url })).toThrow("origin");
  });
});

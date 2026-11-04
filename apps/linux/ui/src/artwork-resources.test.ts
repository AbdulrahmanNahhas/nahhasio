import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { retryArtwork } from "./lib/artwork-query";
import { ArtworkQueue, DevelopmentArtwork } from "./lib/development-artwork";

afterEach(() => vi.restoreAllMocks());

describe("artwork resource ownership", () => {
  it("evicts inactive URL owners under pressure while preserving mounted image queries", () => {
    const client = new QueryClient();
    const images = new DevelopmentArtwork(client.getQueryCache(), 3);
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const blob = new Blob(["abc"]);
    const active = images.url(blob);
    client.setQueryData(["artwork", "active"], active);
    const observer = new QueryObserver(client, { queryKey: ["artwork", "active"], enabled: false });
    const unsubscribe = observer.subscribe(() => {});
    const idle = images.url(blob);
    client.setQueryData(["artwork", "idle"], idle);
    expect(client.getQueryData(["artwork", "active"])).toBe(active);
    expect(client.getQueryData(["artwork", "idle"])).toBeUndefined();
    expect(revoke).toHaveBeenCalledWith(idle);
    expect(revoke).not.toHaveBeenCalledWith(active);
    unsubscribe();
    images.dispose();
    client.clear();
  });
  it("evicts retained bytes without breaking live URLs, then releases URLs with their queries", () => {
    const client = new QueryClient();
    const images = new DevelopmentArtwork(client.getQueryCache(), 5);
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const first = new Blob(["abc"]);
    images.store("a", first);
    const url = images.url(first);
    client.setQueryData(["artwork", "a", 640], url);
    images.store("b", new Blob(["def"]));
    expect(images.get("a")).toBeUndefined();
    expect(images.get("b")?.size).toBe(3);
    expect(revoke).not.toHaveBeenCalled();
    client.removeQueries({ queryKey: ["artwork", "a"] });
    expect(revoke).toHaveBeenCalledWith(url);
    images.dispose();
    client.clear();
  });

  it("keeps recently used bytes, replaces old URLs and clears all account resources", () => {
    const client = new QueryClient();
    const images = new DevelopmentArtwork(client.getQueryCache(), 6);
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const blob = new Blob(["abc"]);
    images.store("a", blob);
    images.store("b", blob);
    images.get("a");
    images.store("c", blob);
    expect(images.get("b")).toBeUndefined();
    const old = images.url(blob);
    client.setQueryData(["artwork", "a"], old);
    const replacement = images.url(blob);
    client.setQueryData(["artwork", "a"], replacement);
    expect(revoke).toHaveBeenCalledWith(old);
    images.clear();
    expect(revoke).toHaveBeenCalledWith(replacement);
    expect(images.get("a")).toBeUndefined();
    images.dispose();
    client.clear();
  });

  it("does not refuse artwork after 1024 requests", () => {
    const client = new QueryClient();
    const images = new DevelopmentArtwork(client.getQueryCache(), 5);
    for (let index = 0; index < 1030; index++) images.store(String(index), new Blob(["abc"]));
    expect(images.get("1029")?.size).toBe(3);
    expect(images.get("0")).toBeUndefined();
    images.dispose();
    client.clear();
  });
});

describe("artwork request scheduling", () => {
  it("bounds concurrency and cancels queued work without starting it", async () => {
    const queue = new ArtworkQueue(1);
    let finish!: () => void;
    const first = queue.run(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      new AbortController().signal,
    );
    await Promise.resolve();
    const controller = new AbortController();
    const cancelledTask = vi.fn<() => Promise<string>>(async () => "unexpected");
    const second = queue.run(cancelledTask, controller.signal);
    controller.abort();
    await expect(second).rejects.toMatchObject({ name: "AbortError" });
    const next = vi.fn<() => Promise<string>>(async () => "next");
    const third = queue.run(next, new AbortController().signal);
    expect(next).not.toHaveBeenCalled();
    finish();
    await first;
    expect(await third).toBe("next");
    expect(cancelledTask).not.toHaveBeenCalled();
  });
});

describe("artwork retry policy", () => {
  it("retries bounded transient failures but never authorization, missing files or cancellation", () => {
    expect(retryArtwork(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(retryArtwork(2, new TypeError("Failed to fetch"))).toBe(false);
    for (const status of [400, 401, 403, 404, 422])
      expect(retryArtwork(0, new Error("request", { cause: { status } }))).toBe(false);
    for (const status of [408, 429, 500, 503])
      expect(retryArtwork(0, new Error("request", { cause: { status } }))).toBe(true);
    expect(retryArtwork(0, new DOMException("Cancelled", "AbortError"))).toBe(false);
    expect(retryArtwork(0, new Error("request", { cause: { code: "not_found" } }))).toBe(false);
  });
});

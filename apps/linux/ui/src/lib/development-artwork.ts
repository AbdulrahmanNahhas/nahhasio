import type { Query, QueryCache } from "@tanstack/react-query";
import { z } from "zod";

/** Retained bytes are bounded; live image URLs belong to their Query cache entries. */
export class DevelopmentArtwork {
  private blobs = new Map<string, Blob>();
  private bytes = 0;
  private urls = new Map<string, number>();
  private urlBytes = 0;
  private owners = new Map<string, { url: string; query: Query }>();
  private trimming = false;
  private unsubscribe: () => void;

  constructor(
    private cache: QueryCache,
    private budget = 64 * 1024 * 1024,
  ) {
    this.unsubscribe = cache.subscribe((event) => {
      if (event.type === "removed") {
        const owner = this.owners.get(event.query.queryHash);
        if (owner) this.release(owner.url);
        this.owners.delete(event.query.queryHash);
      } else if (event.type === "updated" && event.action.type === "success") {
        const data = z.string().safeParse(event.query.state.data).data;
        const previous = this.owners.get(event.query.queryHash);
        if (previous && previous.url !== data) this.release(previous.url);
        this.owners.delete(event.query.queryHash);
        if (data && this.urls.has(data))
          this.owners.set(event.query.queryHash, { url: data, query: event.query });
      } else if (event.type === "observerAdded") {
        const owner = this.owners.get(event.query.queryHash);
        if (owner) {
          this.owners.delete(event.query.queryHash);
          this.owners.set(event.query.queryHash, owner);
        }
      }
      this.trimInactive();
    });
  }

  get(key: string) {
    const blob = this.blobs.get(key);
    if (blob) {
      this.blobs.delete(key);
      this.blobs.set(key, blob);
    }
    return blob;
  }

  store(key: string, blob: Blob) {
    const previous = this.blobs.get(key);
    if (previous) this.bytes -= previous.size;
    this.blobs.delete(key);
    if (blob.size <= this.budget) {
      this.blobs.set(key, blob);
      this.bytes += blob.size;
    }
    while (this.bytes > this.budget) {
      const oldest = this.blobs.entries().next().value;
      if (!oldest) break;
      this.blobs.delete(oldest[0]);
      this.bytes -= oldest[1].size;
    }
  }

  url(blob: Blob) {
    const url = URL.createObjectURL(blob);
    this.urls.set(url, blob.size);
    this.urlBytes += blob.size;
    return url;
  }

  private release(url: string) {
    const bytes = this.urls.get(url);
    if (bytes !== undefined) {
      this.urls.delete(url);
      this.urlBytes -= bytes;
      URL.revokeObjectURL(url);
    }
  }

  private trimInactive() {
    if (this.trimming || this.urlBytes <= this.budget) return;
    this.trimming = true;
    try {
      for (const { query } of this.owners.values()) {
        if (this.urlBytes <= this.budget) break;
        // Preserve mounted images, even when their bytes exceed the idle-cache budget.
        if (!query.getObserversCount() && query.state.fetchStatus === "idle")
          this.cache.remove(query);
      }
    } finally {
      this.trimming = false;
    }
  }

  clear() {
    for (const url of this.urls.keys()) URL.revokeObjectURL(url);
    this.urls.clear();
    this.owners.clear();
    this.blobs.clear();
    this.bytes = 0;
    this.urlBytes = 0;
  }

  dispose() {
    this.unsubscribe();
    this.clear();
  }
}

/** Leave browser connection slots available for catalog/auth requests. */
export class ArtworkQueue {
  private active = 0;
  private waiting: Array<() => void> = [];

  constructor(private limit = 4) {}

  async run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const start = () => {
        signal.removeEventListener("abort", abort);
        this.active++;
        resolve();
      };
      const abort = () => {
        this.waiting = this.waiting.filter((entry) => entry !== start);
        reject(signal.reason);
      };
      if (this.active < this.limit) start();
      else {
        this.waiting.push(start);
        signal.addEventListener("abort", abort, { once: true });
      }
    });
    try {
      signal.throwIfAborted();
      return await task();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

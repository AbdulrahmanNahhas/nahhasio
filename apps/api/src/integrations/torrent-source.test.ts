import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildStreamUrl,
  clearStreamCache,
  detectLanguages,
  encodeConfigSegment,
  fetchStreamCandidates,
  looksEnglish,
  parseQuality,
  parseSeeders,
  parseSize,
  parseStreams,
  parseTrackers,
  rankCandidates,
  readEnvValue,
  streamEnvelopeSchema,
  streamSourceConfigured,
  tmdbStreamIdsAllowed,
} from "./torrent-source";

// Parsed the same way the live response is, so the fixture exercises the real boundary schema
// rather than a hand-shaped stand-in.
const fixture = streamEnvelopeSchema.parse(
  JSON.parse(readFileSync(join(import.meta.dirname, "torrent-source.fixture.json"), "utf8")),
);

function byId(candidates: ReturnType<typeof parseStreams>, prefix: string) {
  const match = candidates.find((candidate) => candidate.id.startsWith(prefix));
  if (!match) throw new Error(`expected a candidate starting with ${prefix}`);
  return match;
}

// A developer's own `.env` may legitimately set a real NAHHASIO_STREAM_ADDON_URL — cleared before
// every test too, not just after, so "no addon configured" stays deterministic regardless of
// what's loaded into the process outside this suite's control.
function resetStreamEnv() {
  clearStreamCache();
  for (const key of [
    "NAHHASIO_STREAM_ADDON_URL",
    "NAHHASIO_STREAM_ADDON_CONFIG",
    "NAHHASIO_STREAM_PREFERRED_HEIGHT",
    "NAHHASIO_STREAM_ALLOW_TMDB_IDS",
  ]) {
    delete process.env[key];
  }
}
beforeEach(resetStreamEnv);
afterEach(resetStreamEnv);

describe("environment handling", () => {
  it("strips the quotes devenv's dotenv leaves on a quoted .env value", () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = '"https://addon.test"';
    expect(readEnvValue("NAHHASIO_STREAM_ADDON_URL")).toBe("https://addon.test");
    process.env.NAHHASIO_STREAM_ADDON_URL = "'https://addon.test'";
    expect(readEnvValue("NAHHASIO_STREAM_ADDON_URL")).toBe("https://addon.test");
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    expect(readEnvValue("NAHHASIO_STREAM_ADDON_URL")).toBe("https://addon.test");
  });

  it("accepts a quoted addon URL as configured rather than treating it as malformed", () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = '"https://addon.test"';
    expect(streamSourceConfigured()).toBe(true);
  });

  it("reads the tmdb flag through the same quote handling", () => {
    process.env.NAHHASIO_STREAM_ALLOW_TMDB_IDS = '"true"';
    expect(tmdbStreamIdsAllowed()).toBe(true);
    process.env.NAHHASIO_STREAM_ALLOW_TMDB_IDS = '"false"';
    expect(tmdbStreamIdsAllowed()).toBe(false);
  });

  it("treats a malformed addon URL as not configured instead of throwing", () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "not-a-url";
    expect(streamSourceConfigured()).toBe(false);
  });
});

describe("addon URL construction", () => {
  it("percent-encodes only the pipes between config options", () => {
    expect(encodeConfigSegment("providers=yts,1337x|sort=qualitysize|qualityfilter=cam,480p")).toBe(
      "providers=yts,1337x%7Csort=qualitysize%7Cqualityfilter=cam,480p",
    );
  });

  it("drops empty config options rather than emitting a dangling separator", () => {
    expect(encodeConfigSegment(" |qualityfilter=cam,480p| ")).toBe("qualityfilter=cam,480p");
    expect(encodeConfigSegment("")).toBe("");
  });

  it("omits the config path segment entirely when nothing is configured", () => {
    expect(
      buildStreamUrl({
        baseUrl: "https://addon.example.com",
        configSegment: "",
        type: "movie",
        id: "tt0133093",
      }),
    ).toBe("https://addon.example.com/stream/movie/tt0133093.json");
  });

  it("builds the documented path shape for a configured addon", () => {
    expect(
      buildStreamUrl({
        baseUrl: "https://addon.example.com",
        configSegment: encodeConfigSegment("qualityfilter=cam,480p"),
        type: "movie",
        id: "tmdb:603",
      }),
    ).toBe("https://addon.example.com/qualityfilter=cam,480p/stream/movie/tmdb:603.json");
  });
});

describe("free-text field parsing", () => {
  it("reads the emoji-annotated seeders, size and indexer", () => {
    const text = "The.Matrix.1999.1080p.BluRay.x264-YTS\n👤 1,523 💾 2.1 GB ⚙️ YTS";
    expect(parseSeeders(text)).toBe(1523);
    expect(parseSize(text)).toBe(Math.round(2.1 * 1024 ** 3));
  });

  it("returns null for a malformed size instead of throwing", () => {
    expect(parseSize("The.Matrix.1999.1080p.HDTV\n👤 300 💾 ?? GB")).toBeNull();
    expect(parseSize("no size here at all")).toBeNull();
  });

  it("does not mistake resolution or bit depth for a byte size", () => {
    expect(parseSize("The.Matrix.1999.2160p.HDR10.BluRay.x265.10bit")).toBeNull();
  });

  it("classifies a cam release as a cam even when it also claims a resolution", () => {
    expect(parseQuality("Some.Movie.2024.HDCAM.720p")).toEqual({ quality: "cam", height: null });
    expect(parseQuality("Some.Movie.2024.1080p.BluRay")).toEqual({
      quality: "1080p",
      height: 1080,
    });
    expect(parseQuality("Some.Movie.2024.WEBRip")).toEqual({ quality: "unknown", height: null });
  });

  it("treats a flagged non-English release as non-English and an unannotated one as English", () => {
    expect(looksEnglish("Matritsa.1999.1080p.BDRip\n🇷🇺 👤 8000")).toBe(false);
    expect(looksEnglish("The.Matrix.1999.1080p\n🇬🇧 👤 8000")).toBe(true);
    expect(looksEnglish("The.Matrix.1999.1080p.BluRay.x264-YTS")).toBe(true);
    expect(looksEnglish("The.Matrix.1999.1080p.MULTi.VFF")).toBe(true);
  });

  it("detects every language a release's flags/words name, not just English-or-not", () => {
    expect(detectLanguages("The.Matrix.1999.1080p.BluRay.x264-YTS")).toEqual(["en"]);
    expect(detectLanguages("Matritsa.1999.1080p.BDRip\n🇷🇺 👤 8000")).toEqual(["ru"]);
    expect(detectLanguages("The.Matrix.1999.1080p Arabic Dubbed\n🇸🇦")).toEqual(["ar"]);
    // Named alongside English, or "multi"/"dual audio" alone: both keep English in the list.
    expect(detectLanguages("The.Matrix.1999.English.Arabic.Dual.Audio")).toEqual(
      expect.arrayContaining(["en", "ar"]),
    );
    expect(detectLanguages("The.Matrix.1999.1080p.MULTi.VFF")).toEqual(["en"]);
  });

  it("keeps only usable tracker URLs and drops dht entries", () => {
    expect(
      parseTrackers([
        "tracker:udp://tracker.opentrackr.org:1337/announce",
        "tracker:udp://tracker.opentrackr.org:1337/announce",
        "tracker:not-a-url",
        "dht:aaaa",
        // A non-string entry in `sources` is collapsed to "" by the boundary schema.
        "",
      ]),
    ).toEqual(["udp://tracker.opentrackr.org:1337/announce"]);
    expect(parseTrackers([])).toEqual([]);
  });
});

describe("stream parsing", () => {
  const candidates = parseStreams(fixture.streams);

  it("drops a stream that carries neither an infoHash nor a url", () => {
    expect(candidates).toHaveLength(fixture.streams.length - 1);
  });

  it("maps a well-formed torrent stream onto every typed field", () => {
    const matrix = byId(candidates, "aaaa");
    expect(matrix).toMatchObject({
      kind: "torrent",
      label: "NahhasArcadia · 1080p",
      infoHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      fileIdx: 0,
      url: null,
      filename: "The.Matrix.1999.1080p.BluRay.x264-YTS.mkv",
      bingeGroup: "nahhasarcadia|1080p|BluRay",
      videoSize: 2254857830,
      videoHash: "8e245d9679d31e12",
      quality: "1080p",
      height: 1080,
      seeders: 1523,
      provider: "YTS",
      isEnglish: true,
    });
    expect(matrix.trackers).toEqual([
      "udp://tracker.opentrackr.org:1337/announce",
      "http://tracker.openbittorrent.com:80/announce",
    ]);
  });

  it("lowercases a mixed-case infoHash so ids stay comparable", () => {
    expect(byId(candidates, "1111").infoHash).toBe("11111111111111111111aaaaaaaaaaaaaaaaaaaa");
  });

  it("reads description when the deprecated title field is absent", () => {
    const webdl = byId(candidates, "ffff");
    expect(webdl.description).toBe("The.Matrix.1999.1080p.WEB-DL.DDP5.1\n👤 12 💾 3.4 GB ⚙️ EZTV");
    expect(webdl.seeders).toBe(12);
  });

  it("marks a missing fileIdx as unresolved rather than guessing zero", () => {
    const webdl = byId(candidates, "ffff");
    expect(webdl.fileIdx).toBeNull();
    expect(webdl.id).toBe(`${"f".repeat(40)}:auto`);
    expect(webdl.trackers).toEqual([]);
  });

  it("degrades a malformed size to null while keeping the rest of the candidate", () => {
    const hdtv = byId(candidates, "1111");
    expect(hdtv.sizeBytes).toBeNull();
    expect(hdtv.seeders).toBe(300);
    expect(hdtv.quality).toBe("1080p");
  });

  it("keeps a debrid-style direct url as a playable candidate", () => {
    const direct = byId(candidates, "direct:");
    expect(direct.kind).toBe("direct");
    expect(direct.infoHash).toBeNull();
    expect(direct.url).toBe("https://debrid.example.com/dl/token/The.Matrix.1999.1080p.mkv");
  });
});

describe("ranking", () => {
  const ranked = rankCandidates(parseStreams(fixture.streams));
  const order = ranked.map((candidate) => candidate.id.slice(0, 4));

  it("puts a direct debrid source first — it needs no peers at all", () => {
    expect(ranked[0]?.kind).toBe("direct");
  });

  it("prefers the preferred-height release over a larger 4K one", () => {
    expect(order.indexOf("aaaa")).toBeLessThan(order.indexOf("bbbb"));
  });

  it("ranks resolution above raw seeder count", () => {
    expect(order.indexOf("aaaa")).toBeLessThan(order.indexOf("cccc"));
  });

  it("ranks an English source above a better-seeded non-English one", () => {
    expect(order.indexOf("aaaa")).toBeLessThan(order.indexOf("dddd"));
  });

  it("sinks a zero-seeder source below everything that can actually be fetched", () => {
    expect(order.at(-1)).toBe("eeee");
  });

  it("produces the full documented ordering", () => {
    expect(order).toEqual(["dire", "aaaa", "1111", "ffff", "cccc", "bbbb", "dddd", "eeee"]);
  });

  it("follows NAHHASIO_STREAM_PREFERRED_HEIGHT when the family wants 4K first", () => {
    process.env.NAHHASIO_STREAM_PREFERRED_HEIGHT = "2160";
    const forFourK = rankCandidates(parseStreams(fixture.streams)).map((candidate) =>
      candidate.id.slice(0, 4),
    );
    expect(forFourK.indexOf("bbbb")).toBeLessThan(forFourK.indexOf("aaaa"));
  });

  it("moves a candidate in the account's preferred language ahead of a plain English one", () => {
    // "dddd" is the 🇷🇺 Russian-flagged candidate — ranked last among the healthy sources by
    // default (English-first), but should jump ahead of the others once Russian is preferred.
    const forRussian = rankCandidates(parseStreams(fixture.streams), ["ru"]).map((candidate) =>
      candidate.id.slice(0, 4),
    );
    expect(forRussian.indexOf("dddd")).toBeLessThan(forRussian.indexOf("aaaa"));
    // A direct/debrid source still needs no peers at all, so it still wins outright.
    expect(forRussian[0]).toBe("dire");
    // Zero seeders still sinks below everything fetchable, language preference or not.
    expect(forRussian.at(-1)).toBe("eeee");
  });

  it("falls back to today's English-first default when no preference is configured", () => {
    const withEmptyPreference = rankCandidates(parseStreams(fixture.streams), []).map((candidate) =>
      candidate.id.slice(0, 4),
    );
    expect(withEmptyPreference).toEqual(order);
  });
});

describe("fetching", () => {
  it("returns null when no addon is configured, without calling out", async () => {
    expect(await fetchStreamCandidates({ type: "movie", id: "tt0133093" })).toBeNull();
  });

  it("builds a usable request from a quoted addon URL", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = '"https://addon.test"';
    process.env.NAHHASIO_STREAM_ADDON_CONFIG = '"qualityfilter=cam,480p"';
    const requested: string[] = [];
    const original = globalThis.fetch;
    // SAFETY: the stub implements the one overload these tests exercise (a single URL argument
    // returning a Response), which is all the code under test calls.
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return new Response(JSON.stringify({ streams: [] }), { status: 200 });
    }) as typeof globalThis.fetch;
    try {
      await fetchStreamCandidates({ type: "movie", id: "tt0133093" });
      expect(requested).toEqual([
        "https://addon.test/qualityfilter=cam,480p/stream/movie/tt0133093.json",
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("serves a second request for the same id from cache", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    process.env.NAHHASIO_STREAM_ADDON_CONFIG = "qualityfilter=cam,480p";
    const requested: string[] = [];
    const original = globalThis.fetch;
    // SAFETY: the stub implements the one overload these tests exercise (a single URL argument
    // returning a Response), which is all the code under test calls.
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      const first = await fetchStreamCandidates({ type: "movie", id: "tt0133093" });
      const second = await fetchStreamCandidates({ type: "movie", id: "tt0133093" });
      expect(first?.length).toBe(fixture.streams.length - 1);
      expect(second).toEqual(first);
      expect(requested).toEqual([
        "https://addon.test/qualityfilter=cam,480p/stream/movie/tt0133093.json",
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("returns null — not an empty list — when the addon errors", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const original = globalThis.fetch;
    // SAFETY: the stub implements the one overload these tests exercise.
    globalThis.fetch = (async () =>
      new Response("nope", { status: 502 })) as typeof globalThis.fetch;
    try {
      expect(await fetchStreamCandidates({ type: "movie", id: "tt0133093" })).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("returns null when the addon is unreachable", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const original = globalThis.fetch;
    // SAFETY: the stub implements the one overload these tests exercise (a single URL argument),
    // which is all the code under test calls.
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof globalThis.fetch;
    try {
      expect(await fetchStreamCandidates({ type: "movie", id: "tt0133093" })).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("returns an empty list when the addon answers with no streams", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const original = globalThis.fetch;
    // SAFETY: the stub implements the one overload these tests exercise.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ streams: [] }), { status: 200 })) as typeof globalThis.fetch;
    try {
      expect(await fetchStreamCandidates({ type: "movie", id: "tt0133093" })).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

/**
 * The synthetic fixture above is hand-shaped; this one is a faithful subset of a real Torrentio
 * response for Hotel Transylvania, captured from the family's deployment. It carries shapes the
 * synthetic one does not: `4k`/`DVDRip` quality words instead of `2160p`, sizes in MB as well as
 * GB, multi-flag language lists, `fileIdx` values well past zero, and entries with no `sources`.
 */
describe("a real Torrentio response", () => {
  const real = streamEnvelopeSchema.parse(
    JSON.parse(readFileSync(join(import.meta.dirname, "torrent-source.real.fixture.json"), "utf8")),
  );
  const ranked = rankCandidates(parseStreams(real.streams));

  it("parses every stream the addon sent", () => {
    expect(ranked).toHaveLength(real.streams.length);
  });

  it("reads `4k` in the name as 2160p, and an unlabelled release as unknown", () => {
    expect(ranked.find((c) => c.id.startsWith("f8bf"))?.quality).toBe("2160p");
    expect(ranked.find((c) => c.id.startsWith("cca5"))?.quality).toBe("unknown");
  });

  it("reads megabyte sizes as well as gigabyte ones", () => {
    expect(ranked.find((c) => c.id.startsWith("ab42"))?.sizeBytes).toBe(
      Math.round(133.41 * 1024 ** 2),
    );
    expect(ranked.find((c) => c.id.startsWith("29cf"))?.sizeBytes).toBe(
      Math.round(48.97 * 1024 ** 3),
    );
  });

  it("treats a flag list containing 🇬🇧 as English and a French-only release as not", () => {
    expect(ranked.find((c) => c.id.startsWith("ac8f"))?.isEnglish).toBe(true);
    expect(ranked.find((c) => c.id.startsWith("c22a"))?.isEnglish).toBe(false);
  });

  it("keeps a non-zero fileIdx so the right file inside a pack is played", () => {
    expect(ranked.find((c) => c.id.startsWith("ab42"))?.fileIdx).toBe(25);
    expect(ranked.find((c) => c.id.startsWith("cca5"))?.fileIdx).toBe(48);
  });

  it("picks the best-seeded English 1080p release, not the 49 GB 4K one", () => {
    const winner = ranked[0];
    expect(winner?.quality).toBe("1080p");
    expect(winner?.seeders).toBe(100);
    expect(winner?.infoHash).toBe("cd16f300b060e3c01c9e643f6d15526526b37648");
  });
});

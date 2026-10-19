import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../app";
import { database } from "../../database";
import { clearStreamCache } from "../../integrations/torrent-source";

/**
 * Route-level coverage for `GET /api/v1/installments/:id/streams` (roadmap Phase 1.5). The addon
 * itself is stubbed — what is under test here is id resolution, the visibility guard, and the
 * promise that every failure mode gets its own code instead of a spinner that never resolves.
 */

const fixture = readFileSync(
  join(import.meta.dirname, "../../integrations/torrent-source.fixture.json"),
  "utf8",
);

const suffix = randomUUID().slice(0, 8);
const titleIds: string[] = [];
const installments: Record<string, string> = {};
const episodes: Record<string, string> = {};

async function makeTitle(input: {
  key: string;
  imdbId?: string;
  isPrivate?: boolean;
  films: Array<{ kind: "movie" | "special" | "season"; imdbId?: string; tmdbId?: number }>;
}) {
  const sql = database().client;
  const name = `Stream Route Test ${input.key} ${suffix}`;
  const [title] = await sql`
    insert into titles (canonical_title, sort_title, imdb_id, is_private)
    values (${name}, ${name}, ${input.imdbId ?? null}, ${input.isPrivate ?? false})
    returning id`;
  const titleId = String(title?.id);
  titleIds.push(titleId);

  let position = 0;
  for (const film of input.films) {
    const [row] = await sql`
      insert into installments (title_id, kind, position, title, imdb_id, tmdb_id)
      values (${titleId}, ${film.kind}, ${position}, ${`${name} #${position}`},
        ${film.imdbId ?? null}, ${film.tmdbId ?? null})
      returning id`;
    installments[`${input.key}:${position}`] = String(row?.id);
    position += 1;
  }
  return titleId;
}

function stubAddon(body = fixture) {
  const original = globalThis.fetch;
  // SAFETY: the stub implements the one overload these tests exercise (a single URL argument
  // returning a Response), which is all the route under test calls.
  globalThis.fetch = (async () =>
    new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = original;
  };
}

beforeAll(async () => {
  // Its own IMDb id on the installment — the path Phase 0.5 backfilled the catalog for.
  await makeTitle({ key: "own-id", films: [{ kind: "movie", imdbId: "tt0133093" }] });
  // No id on the single film, but the parent title carries one.
  await makeTitle({ key: "title-id", imdbId: "tt0111161", films: [{ kind: "movie" }] });
  // Two films under one title: the title's id names a different work, so it must not be borrowed.
  await makeTitle({
    key: "collection",
    imdbId: "tt0088763",
    films: [{ kind: "movie" }, { kind: "movie" }],
  });
  // TMDB only — gated behind the flag until the family addon is confirmed to accept `tmdb:` ids.
  await makeTitle({ key: "tmdb-only", films: [{ kind: "movie", tmdbId: 603 }] });
  await makeTitle({ key: "season", films: [{ kind: "season" }] });
  await makeTitle({
    key: "private",
    isPrivate: true,
    films: [{ kind: "movie", imdbId: "tt0109830" }],
  });

  // A season resolves through the title's IMDb id (seasons never carry their own) plus an
  // episode's number — one integer-numbered episode, one fractional (a half-numbered special).
  await makeTitle({ key: "series", imdbId: "tt0903747", films: [{ kind: "season" }] });
  const sql = database().client;
  const [wholeEpisode] = await sql`
    insert into episodes (installment_id, number, position, title)
    values (${installments["series:0"] ?? ""}, 1, 0, 'Pilot')
    returning id`;
  episodes.whole = String(wholeEpisode?.id);
  const [halfEpisode] = await sql`
    insert into episodes (installment_id, number, position, title)
    values (${installments["series:0"] ?? ""}, 1.5, 1, 'Special')
    returning id`;
  episodes.half = String(halfEpisode?.id);

  // Regression fixture for the real-catalog bug: a second season's Stremio season number is its
  // rank among season-kind siblings, never its raw `position`. Two interspersed movies (position
  // 3 vs. rank 2) make that distinction unambiguous — one interspersed movie would leave the two
  // schemes numerically equal by coincidence.
  await makeTitle({
    key: "multi-season",
    imdbId: "tt0475784",
    films: [{ kind: "movie" }, { kind: "season" }, { kind: "movie" }, { kind: "season" }],
  });
  const [secondSeasonEpisode] = await sql`
    insert into episodes (installment_id, number, position, title)
    values (${installments["multi-season:3"] ?? ""}, 6, 5, 'Episode 6')
    returning id`;
  episodes.secondSeason = String(secondSeasonEpisode?.id);
});

afterAll(async () => {
  const sql = database().client;
  if (titleIds.length) await sql`delete from titles where id in ${sql(titleIds)}`;
  await sql.end();
});

// A developer's own `.env` may legitimately set a real NAHHASIO_STREAM_ADDON_URL — cleared before
// every test too, not just after, so "no source configured" stays deterministic regardless of
// what's loaded into the process outside this suite's control.
beforeEach(() => {
  clearStreamCache();
  delete process.env.NAHHASIO_STREAM_ADDON_URL;
  delete process.env.NAHHASIO_STREAM_ALLOW_TMDB_IDS;
});
afterEach(() => {
  clearStreamCache();
  delete process.env.NAHHASIO_STREAM_ADDON_URL;
  delete process.env.NAHHASIO_STREAM_ALLOW_TMDB_IDS;
});

async function getStreams(installmentId: string, episodeId?: string) {
  const query = episodeId ? `?episodeId=${episodeId}` : "";
  const response = await app.request(`/api/v1/installments/${installmentId}/streams${query}`);
  return { status: response.status, body: await response.json() };
}

describe("installment stream discovery", () => {
  it("returns ranked candidates for an installment carrying its own IMDb id", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const { status, body } = await getStreams(installments["own-id:0"] ?? "");
      expect(status).toBe(200);
      expect(body.streamId).toBe("tt0133093");
      expect(body.idSource).toBe("installment.imdb");
      expect(body.candidates.length).toBeGreaterThan(0);
      expect(body.candidates[0].kind).toBe("direct");
    } finally {
      restore();
    }
  });

  it("falls back to the title's id only when the title holds exactly one film", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const single = await getStreams(installments["title-id:0"] ?? "");
      expect(single.status).toBe(200);
      expect(single.body.streamId).toBe("tt0111161");
      expect(single.body.idSource).toBe("title.imdb");

      // Two films under the collection: borrowing the title's id would play the wrong movie.
      const collection = await getStreams(installments["collection:0"] ?? "");
      expect(collection.status).toBe(409);
      expect(collection.body.code).toBe("no_identifier");
    } finally {
      restore();
    }
  });

  it("keeps tmdb: ids behind the flag until the addon is known to accept them", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const gated = await getStreams(installments["tmdb-only:0"] ?? "");
      expect(gated.status).toBe(409);
      expect(gated.body.code).toBe("no_identifier");

      process.env.NAHHASIO_STREAM_ALLOW_TMDB_IDS = "true";
      const allowed = await getStreams(installments["tmdb-only:0"] ?? "");
      expect(allowed.status).toBe(200);
      expect(allowed.body.streamId).toBe("tmdb:603");
      expect(allowed.body.idSource).toBe("installment.tmdb");
    } finally {
      restore();
    }
  });

  it("refuses a season with no episode selected", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const { status, body } = await getStreams(installments["season:0"] ?? "");
    expect(status).toBe(400);
    expect(body.code).toBe("unsupported_kind");
  });

  it("resolves an episode through the title's IMDb id, season number, and episode number", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const { status, body } = await getStreams(installments["series:0"] ?? "", episodes.whole);
      expect(status).toBe(200);
      // The only season under this title, so its rank among season-kind siblings is 1 — not its
      // raw `position` (0).
      expect(body.streamId).toBe("tt0903747:1:1");
      expect(body.idSource).toBe("title.imdb");
      expect(body.candidates.length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it("refuses a fractional episode number — Stremio series ids need a plain integer", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const { status, body } = await getStreams(installments["series:0"] ?? "", episodes.half);
    expect(status).toBe(409);
    expect(body.code).toBe("no_identifier");
  });

  it("numbers a season by its rank among season-kind siblings, not its raw position", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      // Movie, season, movie, season: the second season sits at position 3, but is only the 2nd
      // season.
      const { status, body } = await getStreams(
        installments["multi-season:3"] ?? "",
        episodes.secondSeason,
      );
      expect(status).toBe(200);
      expect(body.streamId).toBe("tt0475784:2:6");
    } finally {
      restore();
    }
  });

  it("404s an episode id that does not belong to the installment", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const { status, body } = await getStreams(installments["series:0"] ?? "", randomUUID());
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
  });

  it("says the title has no identifier yet when a season's title carries none", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    await makeTitle({ key: "series-no-id", films: [{ kind: "season" }] });
    const sql = database().client;
    const [episode] = await sql`
      insert into episodes (installment_id, number, position, title)
      values (${installments["series-no-id:0"] ?? ""}, 1, 0, 'Pilot')
      returning id`;
    const { status, body } = await getStreams(
      installments["series-no-id:0"] ?? "",
      String(episode?.id),
    );
    expect(status).toBe(409);
    expect(body.code).toBe("no_identifier");
  });

  it("says so when no stream source is configured at all", async () => {
    const { status, body } = await getStreams(installments["own-id:0"] ?? "");
    expect(status).toBe(503);
    expect(body.code).toBe("source_not_configured");
  });

  it("reports an unreachable addon as a source failure, not as an empty result", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const original = globalThis.fetch;
    // SAFETY: the stub implements the one overload these tests exercise (a single URL argument),
    // which is all the code under test calls.
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof globalThis.fetch;
    try {
      const { status, body } = await getStreams(installments["own-id:0"] ?? "");
      expect(status).toBe(502);
      expect(body.code).toBe("source_unavailable");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("distinguishes an addon with nothing to offer from an addon that failed", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon(JSON.stringify({ streams: [] }));
    try {
      const { status, body } = await getStreams(installments["own-id:0"] ?? "");
      expect(status).toBe(200);
      expect(body.candidates).toEqual([]);
    } finally {
      restore();
    }
  });

  it("does not resolve a stream for a private title", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const restore = stubAddon();
    try {
      const { status, body } = await getStreams(installments["private:0"] ?? "");
      expect(status).toBe(404);
      expect(body.code).toBe("not_found");
    } finally {
      restore();
    }
  });

  it("404s an installment that does not exist", async () => {
    process.env.NAHHASIO_STREAM_ADDON_URL = "https://addon.test";
    const { status, body } = await getStreams(randomUUID());
    expect(status).toBe(404);
    expect(body.code).toBe("not_found");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTmdbEpisodeImages, fetchTmdbSeason } from "./tmdb";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("TMDB episode image gallery", () => {
  it("requests the exact season/episode, keeps language-neutral images, and ranks candidates", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture-token");
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          stills: [
            { file_path: "/small.jpg", width: 640, height: 360, vote_count: 1, iso_639_1: null },
            { file_path: "/best.jpg", width: 1920, height: 1080, vote_count: 5, iso_639_1: null },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const images = await fetchTmdbEpisodeImages({ tmdbId: 42, season: 0, episode: 3 });
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      "https://api.themoviedb.org/3/tv/42/season/0/episode/3/images",
    );
    expect(images.map((image) => image.url)).toEqual([
      "https://image.tmdb.org/t/p/original/best.jpg",
      "https://image.tmdb.org/t/p/original/small.jpg",
    ]);
    expect(images[0]?.previewUrl).toContain("/w300/");
  });
  it("returns an empty gallery for missing episodes", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture-token");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 404 })),
    );
    expect(await fetchTmdbEpisodeImages({ tmdbId: 42, season: 1, episode: 1 })).toEqual([]);
  });
  it("rejects invalid provider paths at the boundary", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture-token");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            stills: [{ file_path: "https://untrusted.test/file", width: 100, height: 100 }],
          }),
        ),
      ),
    );
    await expect(fetchTmdbEpisodeImages({ tmdbId: 42, season: 1, episode: 1 })).rejects.toThrow(
      /file_path/,
    );
  });
});

const groupListing = { results: [{ id: "seasons-group", name: "Seasons", type: 6 }] };
const groupDetails = {
  groups: [
    {
      id: "part-two",
      name: "Season2",
      order: 2,
      episodes: [
        {
          episode_number: 12,
          season_number: 1,
          order: 0,
          name: "Tokyo Blade",
          still_path: "/episode12.jpg",
        },
        {
          episode_number: 13,
          season_number: 1,
          order: 1,
          name: "Telephone",
          still_path: "/episode13.jpg",
        },
      ],
    },
  ],
};
describe("TMDB grouped season mapping", () => {
  it("keeps local episode numbering and resolves the provider coordinates for grouped seasons", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture-token");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/season/2")) return new Response(null, { status: 404 });
        return new Response(
          JSON.stringify(path.endsWith("/episode_groups") ? groupListing : groupDetails),
        );
      }),
    );
    const episodes = await fetchTmdbSeason({ tmdbId: 203737, season: 2 });
    expect(
      episodes?.map((episode) => [episode.number, episode.sourceSeason, episode.sourceEpisode]),
    ).toEqual([
      [1, 1, 12],
      [2, 1, 13],
    ]);
    expect(episodes?.[0]?.stillUrl).toBe("https://image.tmdb.org/t/p/original/episode12.jpg");
    expect(episodes?.[0]?.sourceLabel).toContain("Season2");
  });
  it("looks up gallery alternatives using the mapped standard episode", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture-token");
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path.includes("/season/2")) return new Response(null, { status: 404 });
      if (path.endsWith("/episode_groups")) return new Response(JSON.stringify(groupListing));
      if (path.includes("/episode_group/")) return new Response(JSON.stringify(groupDetails));
      return new Response(
        JSON.stringify({ stills: [{ file_path: "/alternative.jpg", width: 1920, height: 1080 }] }),
      );
    });
    vi.stubGlobal("fetch", fetch);
    const images = await fetchTmdbEpisodeImages({ tmdbId: 203737, season: 2, episode: 1 });
    expect(
      fetch.mock.calls.some(([url]) => String(url).endsWith("/season/1/episode/12/images")),
    ).toBe(true);
    expect(images[0]?.url).toContain("/original/alternative.jpg");
  });
  it("requires explicit choice when multiple season groups are ambiguous", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture-token");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) =>
        String(url).includes("/season/")
          ? new Response(null, { status: 404 })
          : new Response(
              JSON.stringify({
                results: [...groupListing.results, { id: "other", name: "Other Seasons", type: 6 }],
              }),
            ),
      ),
    );
    await expect(fetchTmdbSeason({ tmdbId: 42, season: 2 })).rejects.toThrow(
      "مجموعات حلقات متعددة",
    );
  });
  it("does not accept a group belonging to a different series", async () => {
    vi.stubEnv("TMDB_API_READ_ACCESS_KEY", "fixture-token");
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(new Response(JSON.stringify(groupListing))),
    );
    await expect(fetchTmdbSeason({ tmdbId: 42, season: 2, groupId: "foreign" })).rejects.toThrow(
      "لا تنتمي",
    );
  });
});

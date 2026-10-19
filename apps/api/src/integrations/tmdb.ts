import type { artworkCandidateSchema } from "@arcadia/contracts";
import { z } from "zod";

type ArtworkCandidate = z.infer<typeof artworkCandidateSchema>;

const apiBase = "https://api.themoviedb.org/3";
const imageBase = "https://image.tmdb.org/t/p";

function readAccessToken() {
  return process.env.TMDB_API_READ_ACCESS_KEY ?? null;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | undefined>) {
  const token = readAccessToken();
  if (!token) return null;
  const url = new URL(`${apiBase}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("تعذّر الاتصال بـ TMDB. راجع مفتاح المصدر.");
  // SAFETY: callers pass T matching the exact TMDB endpoint they request (SearchResponse for
  // /search/*, ImagesResponse for /*/images below); a non-ok response already returned above.
  return (await response.json()) as T;
}

type SearchResult = { id: number; title?: string; name?: string };
type SearchResponse = { results: SearchResult[] };
type ImagesResponse = {
  posters: TmdbImage[];
  backdrops: TmdbImage[];
  logos: TmdbImage[];
};
type TmdbImage = {
  file_path: string;
  width: number;
  height: number;
  iso_639_1: string | null;
};

/**
 * Finds the best-matching movie or TV title on TMDB and returns its poster/backdrop/logo
 * candidates for the requested role. Movies use TMDB movie IDs; seasons use the series ID
 * and a separate season number for poster lookup. Fanart lookups are coordinated separately.
 *
 * When `tmdbId` is given (the title/installment already has a confirmed match — see the
 * player/torrent roadmap's Phase 0), this skips `/search/{mediaType}` and its "blindly take
 * `results[0]`" risk entirely, going straight to `/{mediaType}/{tmdbId}/images`. The search path
 * only runs for a row with no id yet.
 */
export async function searchTmdbArtwork(input: {
  title: string;
  year?: number;
  role: "poster" | "banner" | "logo";
  mediaType: "movie" | "tv";
  tmdbId?: number;
  season?: number;
}): Promise<{ candidates: ArtworkCandidate[]; matchedId: number | null }> {
  let matchId: number;
  let label: string;
  if (input.tmdbId) {
    matchId = input.tmdbId;
    label = input.title;
  } else {
    const searchPath = input.mediaType === "movie" ? "/search/movie" : "/search/tv";
    const yearParam =
      input.mediaType === "movie" ? { year: input.year } : { first_air_date_year: input.year };
    const search = await tmdbFetch<SearchResponse>(searchPath, {
      query: input.title,
      ...yearParam,
    });
    const match = search?.results[0];
    if (!match) return { candidates: [], matchedId: null };
    matchId = match.id;
    label = match.title ?? match.name ?? input.title;
  }

  const imagePath =
    input.mediaType === "tv" && input.season !== undefined && input.role === "poster"
      ? `/tv/${matchId}/season/${input.season}/images`
      : `/${input.mediaType}/${matchId}/images`;
  let images = await tmdbFetch<ImagesResponse>(imagePath, {});
  if (
    input.mediaType === "tv" &&
    input.season !== undefined &&
    input.role === "poster" &&
    !images?.posters?.length
  ) {
    images = await tmdbFetch<ImagesResponse>(`/tv/${matchId}/images`, {});
    label = `${input.title} · صور المسلسل (لا تتوفر ملصقات الموسم ${input.season})`;
  }
  if (!images) return { candidates: [], matchedId: matchId };

  const byRole = {
    poster: images.posters ?? [],
    banner: images.backdrops ?? [],
    logo: images.logos ?? [],
  } satisfies Record<typeof input.role, TmdbImage[]>;
  const candidates: ArtworkCandidate[] = byRole[input.role].slice(0, 100).map((image) => ({
    provider: "tmdb",
    externalId: String(matchId),
    role: input.role,
    previewUrl: `${imageBase}/w500${image.file_path}`,
    downloadUrl: `${imageBase}/original${image.file_path}`,
    width: image.width,
    height: image.height,
    language: image.iso_639_1,
    matchLabel: label,
  }));
  return { candidates, matchedId: matchId };
}

type SeasonEpisode = {
  episode_number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
};
type SeasonResponse = { episodes: SeasonEpisode[] };

export type TmdbSeasonEpisode = {
  number: number;
  title: string | null;
  summary: string;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  /** Full `https://image.tmdb.org/...` URL of the episode still, or `null`. */
  stillUrl: string | null;
  sourceSeason?: number;
  sourceEpisode?: number;
  sourceLabel?: string;
};

/**
 * `/tv/{id}/season/{n}` — per-episode names, overviews, air dates, runtimes and stills, for the
 * admin episode editor's "جلب من TMDB". `language` picks the localisation TMDB returns; the
 * editor asks for Arabic first and falls back to English per field.
 */
export async function fetchTmdbSeason(input: {
  tmdbId: number;
  season: number;
  language?: string;
  groupId?: string;
}): Promise<TmdbSeasonEpisode[] | null> {
  if (input.groupId) return fetchTmdbGroupedSeason(input);
  const response = await tmdbFetch<SeasonResponse>(`/tv/${input.tmdbId}/season/${input.season}`, {
    language: input.language ?? "en-US",
  });
  if (!response) return fetchTmdbGroupedSeason(input);
  return response.episodes.map((episode) => ({
    number: episode.episode_number,
    title: episode.name?.trim() || null,
    summary: episode.overview?.trim() ?? "",
    releaseDate: episode.air_date || null,
    runtimeMinutes: episode.runtime ?? null,
    stillUrl: episode.still_path ? `${imageBase}/original${episode.still_path}` : null,
    sourceSeason: input.season,
    sourceEpisode: episode.episode_number,
    sourceLabel: `TMDB · الموسم ${input.season}`,
  }));
}

export function tmdbConfigured() {
  return readAccessToken() !== null;
}

/** Episode gallery, without a language filter: stills commonly have no language. */
export async function fetchTmdbEpisodeImages(input: {
  tmdbId: number;
  season: number;
  episode: number;
}): Promise<{ url: string; previewUrl: string; width: number; height: number }[]> {
  const response = await tmdbFetch<unknown>(
    `/tv/${input.tmdbId}/season/${input.season}/episode/${input.episode}/images`,
    {},
  );
  if (response === null) {
    const mapped = (await fetchTmdbSeason({ tmdbId: input.tmdbId, season: input.season }))?.find(
      (episode) => episode.number === input.episode,
    );
    if (
      mapped?.sourceSeason !== undefined &&
      mapped.sourceEpisode !== undefined &&
      (mapped.sourceSeason !== input.season || mapped.sourceEpisode !== input.episode)
    )
      return fetchTmdbEpisodeImages({
        tmdbId: input.tmdbId,
        season: mapped.sourceSeason,
        episode: mapped.sourceEpisode,
      });
    return [];
  }
  const result = z
    .object({
      stills: z.array(
        z.object({
          file_path: z.string().regex(/^\/[A-Za-z0-9_.-]+$/),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          vote_average: z.number().optional().default(0),
          vote_count: z.number().int().optional().default(0),
        }),
      ),
    })
    .parse(response);
  return result.stills
    .toSorted((a, b) => b.vote_count - a.vote_count || b.width * b.height - a.width * a.height)
    .slice(0, 60)
    .map((image) => ({
      url: `${imageBase}/original${image.file_path}`,
      previewUrl: `${imageBase}/w300${image.file_path}`,
      width: image.width,
      height: image.height,
    }));
}

const groupedEpisode = z.object({
  episode_number: z.number().int().nonnegative(),
  season_number: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
  name: z.string().nullable().optional(),
  overview: z.string().nullable().optional(),
  air_date: z.string().nullable().optional(),
  runtime: z.number().nullable().optional(),
  still_path: z
    .string()
    .regex(/^\/[A-Za-z0-9_.-]+$/)
    .nullable()
    .optional(),
});
async function fetchTmdbGroupedSeason(input: {
  tmdbId: number;
  season: number;
  groupId?: string;
}): Promise<TmdbSeasonEpisode[] | null> {
  const listing = await tmdbFetch<unknown>(`/tv/${input.tmdbId}/episode_groups`, {});
  if (!listing) return null;
  const groups = z
    .object({ results: z.array(z.object({ id: z.string(), name: z.string(), type: z.number() })) })
    .parse(listing).results;
  const named = groups.filter((group) => /seasons|مواسم/i.test(group.name));
  const candidates = named.length ? named : groups.filter((group) => [6, 7].includes(group.type));
  const selected = input.groupId
    ? groups.find((group) => group.id === input.groupId)
    : candidates.length === 1
      ? candidates[0]
      : null;
  if (!selected) {
    if (input.groupId) throw new Error("مجموعة الحلقات لا تنتمي إلى مسلسل TMDB المحدّد.");
    if (candidates.length > 1)
      throw new Error("توجد مجموعات حلقات متعددة. الصق رابط مجموعة TMDB المطلوبة لتأكيد المطابقة.");
    return null;
  }
  const response = await tmdbFetch<unknown>(
    `/tv/episode_group/${encodeURIComponent(selected.id)}`,
    {},
  );
  if (!response) return null;
  const data = z
    .object({
      groups: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          order: z.number().int(),
          episodes: z.array(groupedEpisode),
        }),
      ),
    })
    .parse(response);
  const matches = data.groups.filter((group) => group.order === input.season);
  if (matches.length !== 1) return null;
  const group = matches[0];
  if (!group) return null;
  return group.episodes
    .toSorted((a, b) => a.order - b.order)
    .map((episode) => ({
      number: episode.order + 1,
      title: episode.name ?? null,
      summary: episode.overview ?? "",
      releaseDate: episode.air_date || null,
      runtimeMinutes: episode.runtime ?? null,
      stillUrl: episode.still_path ? `${imageBase}/original${episode.still_path}` : null,
      sourceSeason: episode.season_number,
      sourceEpisode: episode.episode_number,
      sourceLabel: `${selected.name} · ${group.name}`,
    }));
}

import type { WorkDetail } from "@nahhasio/api-contract";

import type { ProviderOffer } from "./stream-providers";
import type { WatchTarget } from "./watch-request";

export type BrowserEpisodeIdentity = {
  tmdb: number | null;
  anilist: number | null;
  mal: number | null;
  season: number;
  episode: number;
};

export type BrowserSource = { offer: ProviderOffer; url: string | null };

function catalogId(id?: number | null) {
  return id && id > 0 && id <= 2147483647 ? id : null;
}

export function browserSources(work: WorkDetail, target: WatchTarget) {
  const part = target.installmentId
    ? work.installments.find((item) => item.id === target.installmentId)
    : work.installments.find(
        (item) => item.releaseState !== "upcoming" && item.status !== "announced",
      );
  if (
    !part ||
    part.releaseState === "upcoming" ||
    part.status === "announced" ||
    work.playbackPolicy === "files-only"
  )
    return { anime: false, sources: [], identity: null };

  const series = part.kind === "season";
  const season =
    work.installments.filter((item) => item.kind === "season" && item.position < part.position)
      .length + 1;
  const episode = target.episodeId
    ? part.episodes.find((item) => item.id === target.episodeId)
    : part.episodes.find((item) => item.releaseState !== "upcoming");
  const number = Number(episode?.number);
  const validEpisode =
    !series ||
    (episode &&
      episode.releaseState !== "upcoming" &&
      /^\d+(?:\.0+)?$/.test(episode.number) &&
      number > 0 &&
      number <= 100000 &&
      season <= 10000);
  const soleFilm = work.installments.filter((item) => item.kind !== "season").length === 1;
  const workIds = work.externalIds;
  const filmFallback = soleFilm ? workIds : null;
  const tmdb = catalogId(
    series ? workIds.tmdbId : (part.externalIds.tmdbId ?? filmFallback?.tmdbId),
  );
  const animeFallback = (series ? season === 1 : soleFilm) ? workIds : null;
  const mal = catalogId(part.externalIds.malId) ?? catalogId(animeFallback?.malId);
  const anilist = catalogId(part.externalIds.anilistId) ?? catalogId(animeFallback?.anilistId);
  const candidate = series ? workIds.imdbId : (part.externalIds.imdbId ?? filmFallback?.imdbId);
  const imdb = candidate && /^tt\d{7,12}$/.test(candidate) ? candidate : null;
  const anime = Boolean(
    catalogId(workIds.malId) ||
    catalogId(workIds.anilistId) ||
    work.installments.some(
      (item) => catalogId(item.externalIds.malId) || catalogId(item.externalIds.anilistId),
    ) ||
    [...work.tags, ...work.planets].some(
      ({ slug }) => slug === "anime" || slug.startsWith("anime-"),
    ),
  );
  const episodeNumber = series ? number : 1;
  const type = series ? "tv" : "movie";
  const suffix = series ? `/${season}/${number}` : "";
  const path = tmdb ? `${type}/${tmdb}${suffix}` : null;
  const videoId = tmdb ?? imdb;
  const vidSrc = videoId ? `https://vidsrc.sh/embed/${type}/${videoId}${suffix}?ds_lang=ar` : null;

  const sources: BrowserSource[] = [];
  function add(
    provider: ProviderOffer["provider"],
    name: string,
    url: string | null,
    audio: ProviderOffer["audio"] = "original",
  ) {
    const available = Boolean(url && validEpisode);
    sources.push({
      offer: {
        provider,
        name,
        audio,
        available,
        reason: available ? null : "معرّف الإصدار أو رقم الحلقة غير متاح.",
        tier: "trial",
        notes: [],
        preferred: false,
      },
      url: validEpisode ? url : null,
    });
  }
  const vidRift =
    anime && anilist
      ? `https://embed.vidrift.net/embed/anilist/${anilist}${series ? `/${episodeNumber}` : ""}`
      : path && `https://embed.vidrift.net/embed/${path}`;

  if (anime) {
    for (const audio of ["dub", "sub"] as const) {
      add(
        "vidora",
        "Vidora",
        mal
          ? `https://vidora.ac/anime/${mal}/${episodeNumber}/${audio}?autoplay=false&nextbutton=false`
          : null,
        audio,
      );
      if (audio === "dub") {
        const url = vidRift && `${vidRift}?autoplay=0&hide=next,episodes${anilist ? "&dub=1" : ""}`;
        add("vidrift", "VidRift", url, anilist ? "dub" : "original");
        add("vidsrc", "VidSrc", vidSrc);
      }
      add(
        "vidnest",
        "VidNest",
        anilist ? `https://vidnest.fun/anime/${anilist}/${episodeNumber}/${audio}` : null,
        audio,
      );
      const cinextream = anilist ? `${audio}/${anilist}` : mal ? `mal/${audio}/${mal}` : null;
      add(
        "cinextream",
        "Cinextream",
        cinextream &&
          `https://cinextream.cc/api/embed/anime/${cinextream}/${episodeNumber}?autoplay=false`,
        audio,
      );
      add(
        "vidlink",
        "VidLink",
        mal ? `https://vidlink.pro/anime/${mal}/${episodeNumber}/${audio}?autoplay=false` : null,
        audio,
      );
    }
  } else {
    add("vidora", "Vidora", path && `https://vidora.ac/${path}?autoplay=false&nextbutton=false`);
    add("vidrift", "VidRift", vidRift && `${vidRift}?autoplay=0&hide=next,episodes`);
    add("vidsrc", "VidSrc", vidSrc);
    add("vidnest", "VidNest", path && `https://vidnest.fun/${path}`);
    add(
      "cinextream",
      "Cinextream",
      path && `https://cinextream.cc/api/embed/${path}?autoplay=false`,
    );
    add("vidlink", "VidLink", path && `https://vidlink.pro/${path}?autoplay=false`);
  }
  // VidZee has no dedicated dub route. For anime it follows the explicit sub routes.
  add("vidzee", "VidZee", path && `https://player.vidzee.wtf/embed/${path}`);
  const priority = [
    "vidora",
    "vidrift",
    "cinextream",
    "vidsrc",
    "vidnest",
    "vidlink",
    "vidzee",
  ] satisfies ProviderOffer["provider"][];
  const ordered = priority.flatMap((provider) =>
    sources.filter((source) => source.offer.provider === provider),
  );
  const fallbacks = ordered.filter(
    ({ offer }) => offer.audio === "sub" || offer.provider === "vidzee",
  );
  const identity = series && validEpisode ? { tmdb, anilist, mal, season, episode: number } : null;
  return {
    anime,
    sources: anime
      ? [...ordered.filter((source) => !fallbacks.includes(source)), ...fallbacks]
      : ordered,
    identity,
  };
}

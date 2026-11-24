import type { ExternalIds, WorkDetail } from "@nahhasio/api-contract";
import {
  MenuGroup,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "@ui-sdk/react/menu";
import { cn } from "cn";
import { ChevronLeft, ExternalLink, Link2 } from "lucide-react";

import { sdkMenuContentClassName, sdkMenuItemClassName } from "@/components/ui-sdk/menu";

import { safeExternalUrl } from "./format";
import { sourceIconPaths } from "./work-source-icons";

type Provider = keyof typeof sourceIconPaths;
type Source = { label: string; url: string; provider?: Provider };

const iconTone = {
  IMDb: "text-warning",
  TMDB: "text-success",
  AniList: "text-score-high",
  MyAnimeList: "text-score-high",
} satisfies Record<Provider, string>;

const providerByHost = new Map<string, Provider>([
  ["imdb.com", "IMDb"],
  ["themoviedb.org", "TMDB"],
  ["anilist.co", "AniList"],
  ["myanimelist.net", "MyAnimeList"],
]);

function externalSources(work: WorkDetail) {
  const sources = new Map<string, Source>();
  function add(url: string, label: string, provider?: Provider) {
    if (!sources.has(url)) sources.set(url, { url, label, provider });
  }

  function addIds({ imdbId, tmdbId, anilistId, malId }: ExternalIds, series: boolean) {
    if (imdbId && /^tt\d+$/.test(imdbId.trim()))
      add(`https://www.imdb.com/title/${imdbId.trim()}/`, "IMDb", "IMDb");
    if (tmdbId !== null && Number.isSafeInteger(tmdbId) && tmdbId > 0)
      add(`https://www.themoviedb.org/${series ? "tv" : "movie"}/${tmdbId}`, "TMDB", "TMDB");
    if (anilistId !== null && Number.isSafeInteger(anilistId) && anilistId > 0)
      add(`https://anilist.co/anime/${anilistId}`, "AniList", "AniList");
    if (malId !== null && Number.isSafeInteger(malId) && malId > 0)
      add(`https://myanimelist.net/anime/${malId}`, "MyAnimeList", "MyAnimeList");
  }

  addIds(
    work.externalIds,
    work.installments.some((item) => item.kind === "season"),
  );
  const first = work.installments[0];
  const includeRelease =
    first && (sources.size === 0 || (work.installments.length === 1 && first.kind === "movie"));
  if (includeRelease) addIds(first.externalIds, first.kind === "season");
  const references = includeRelease
    ? [...work.externalReferences, ...first.externalReferences]
    : work.externalReferences;
  for (const reference of references) {
    const url = safeExternalUrl(reference.url);
    if (url) {
      const provider = providerByHost.get(new URL(url).hostname.replace(/^www\./, ""));
      add(url, reference.provider.trim() || provider || "مصدر مسجّل", provider);
    }
  }
  return [...sources.values()];
}

export function WorkSourcesMenu({ work }: { work: WorkDetail }) {
  const sources = externalSources(work);
  if (!sources.length) return null;
  return (
    <>
      <MenuSeparator className="my-1 h-px bg-border" />
      <MenuSub>
        <MenuSubTrigger className={sdkMenuItemClassName}>
          <Link2 className="size-4 shrink-0" aria-hidden />
          المصادر الخارجية
          <ChevronLeft className="ms-auto size-4 shrink-0" aria-hidden />
        </MenuSubTrigger>
        <MenuSubContent aria-label="المصادر الخارجية" className={sdkMenuContentClassName}>
          <MenuGroup>
            {sources.map(({ url, label, provider }) => (
              <MenuItem
                key={url}
                render={<a href={url} target="_blank" rel="noopener noreferrer" />}
                className={sdkMenuItemClassName}
              >
                {provider ? (
                  <svg
                    viewBox="0 0 24 24"
                    className={cn("size-4 shrink-0 fill-current", iconTone[provider])}
                    aria-hidden
                  >
                    <path d={sourceIconPaths[provider]} />
                  </svg>
                ) : (
                  <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <bdi className="min-w-0 wrap-anywhere">{label}</bdi>
                <ExternalLink
                  className="ms-auto size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </MenuItem>
            ))}
          </MenuGroup>
        </MenuSubContent>
      </MenuSub>
    </>
  );
}

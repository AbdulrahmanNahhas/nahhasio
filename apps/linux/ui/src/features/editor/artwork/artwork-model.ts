import type { artworkSearchQuerySchema } from "@arcadia/contracts";
import type { WorkDocument } from "@arcadia/contracts/work";
import type { z } from "zod";

type Installment = NonNullable<WorkDocument["installments"]>[number];
export const seriesIdentityKeys = ["tmdbId", "imdbId"] as const;
export const animeIdentityKeys = ["anilistId", "malId"] as const;
export const identityKeys = [...seriesIdentityKeys, ...animeIdentityKeys] as const;
export function hasSeries(work: WorkDocument) {
  return work.installments?.some((part) => part.kind === "season") === true;
}
export function installmentIdentityKeys(work: WorkDocument, part: Installment) {
  if (part.kind === "movie") return work.format === "animated" ? identityKeys : seriesIdentityKeys;
  return work.format === "animated" ? animeIdentityKeys : [];
}
export function suggestedTmdbSeason(installments: Installment[], installment: Installment) {
  if (installment.kind === "special") return 0;
  const seasons = installments
    .filter((part) => part.kind === "season")
    .toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const index = seasons.findIndex(
    (part) => part === installment || Boolean(part.id && part.id === installment.id),
  );
  return index < 0 ? undefined : index + 1;
}
export function artworkContext(work: WorkDocument, installment?: Installment) {
  const seasons =
    work.installments
      ?.filter((part) => part.kind === "season")
      .toSorted((left, right) => (left.position ?? 0) - (right.position ?? 0)) ?? [];
  const first = hasSeries(work)
    ? seasons[0]
    : work.installments
        ?.filter((part) => part.kind === "movie")
        .toSorted((left, right) => (left.position ?? 0) - (right.position ?? 0))[0];
  const series = installment ? installment.kind !== "movie" && hasSeries(work) : hasSeries(work);
  const animated = work.format !== "live-action";
  const kind: z.infer<typeof artworkSearchQuerySchema>["kind"] = animated
    ? series
      ? "animated-series"
      : "animated-movie"
    : series
      ? "live-action-series"
      : "live-action-movie";
  const ids = (["tmdbId", "anilistId"] as const).map((key) => {
    let value: number | undefined;
    let source = "بحث بالاسم";
    if (key === "anilistId") {
      value = animated
        ? ((installment ? installment.anilistId : first?.anilistId) ?? undefined)
        : undefined;
      if (value) source = installment?.title ?? first?.title ?? "الجزء";
    } else if (installment?.kind === "movie") {
      // A movie ID and a series ID belong to different provider namespaces.
      value = installment[key] ?? (!hasSeries(work) ? work[key] : undefined) ?? undefined;
      if (value) source = installment[key] ? installment.title : "العمل";
    } else if (series) {
      value = work[key] ?? undefined;
      if (value) source = "العمل";
    } else {
      value = installment?.[key] ?? work[key] ?? first?.[key] ?? undefined;
      if (value)
        source = installment?.[key]
          ? installment.title
          : work[key]
            ? "العمل"
            : (first?.title ?? "الجزء الأول");
    }
    return { key, value, source };
  });
  return {
    title:
      installment &&
      series &&
      !installment.title.toLowerCase().includes(work.canonicalTitle.toLowerCase())
        ? `${work.canonicalTitle} ${installment.title}`
        : installment?.title || work.canonicalTitle,
    seriesTitle: series ? work.canonicalTitle : undefined,
    year: installment?.releaseDate
      ? Number(installment.releaseDate.slice(0, 4))
      : (work.releaseYear ?? undefined),
    kind,
    tmdbId: ids.find((value) => value.key === "tmdbId")?.value,
    anilistId: ids.find((value) => value.key === "anilistId")?.value,
    season: installment ? suggestedTmdbSeason(work.installments ?? [], installment) : undefined,
    sources: ids,
  };
}
export function identityLink(
  key: "tmdbId" | "imdbId" | "anilistId" | "malId",
  value: string | number | null | undefined,
  series: boolean,
) {
  if (value == null || value === "") return null;
  const id = encodeURIComponent(String(value).trim());
  switch (key) {
    case "tmdbId":
      return `https://www.themoviedb.org/${series ? "tv" : "movie"}/${id}`;
    case "imdbId":
      return `https://www.imdb.com/title/${id}/`;
    case "anilistId":
      return `https://anilist.co/anime/${id}`;
    case "malId":
      return `https://myanimelist.net/anime/${id}`;
  }
}

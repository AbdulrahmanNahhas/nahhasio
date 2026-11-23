import type { CatalogPlanet, WorkSummary } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ArrowUpLeft, Film, Layers } from "lucide-react";

import { Artwork } from "@/components/artwork";
import { ScoreBadge } from "@/components/media-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { planetPalette } from "@/lib/catalog-colors";

import { optionLabel } from "../catalog/filter-model";
import { PlanetEmblem } from "../planets/planet-cards";
import { entityLink, workLink } from "../shell/navigation";
import type { pageDirectory } from "../shell/page-directory";
import type { matchingEntities } from "./search-entities";

type EntityMatch = ReturnType<typeof matchingEntities>[number];
type PageMatch = ReturnType<typeof pageDirectory>[number];

export type SearchMatch =
  | { kind: "work"; href: string; work: WorkSummary }
  | { kind: "entity"; href: string; entity: EntityMatch; planet?: CatalogPlanet }
  | { kind: "page"; href: string; page: PageMatch };

export const workMatch = (work: WorkSummary): SearchMatch => ({
  kind: "work",
  href: workLink(work.id),
  work,
});

export const entityMatch = (entity: EntityMatch, planet?: CatalogPlanet): SearchMatch => ({
  kind: "entity",
  href: entityLink(entity.group.key, entity.value),
  entity,
  planet,
});

export function matchTitle(match: SearchMatch) {
  if (match.kind === "entity") {
    if (match.entity.group.type === "planets")
      return match.planet?.nameAr ?? match.entity.label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    return match.entity.label;
  }
  if (match.kind === "page") return match.page.label;
  return match.work.titleAr || match.work.canonicalTitle;
}

export function matchDescription(match: SearchMatch) {
  if (match.kind === "entity") return `${match.entity.group.label} · ${match.entity.count} عمل`;
  if (match.kind === "page") return match.page.description;
  const { work } = match;
  return [work.format === "animated" ? "رسوم متحركة" : "تمثيل حي", work.releaseYear]
    .filter(Boolean)
    .join(" · ");
}

export function MatchThumbnail({ match }: { match: SearchMatch }) {
  if (match.kind === "page") {
    return (
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <match.page.icon className="size-5" aria-hidden />
      </span>
    );
  }
  if (match.kind === "entity") {
    const { entity } = match;
    if (entity.group.type === "planets")
      return <PlanetEmblem planet={match.planet} className="size-11 bg-(--planet)/20 text-xl" />;
    return (
      <Artwork
        id={entity.artworkId}
        alt=""
        width={320}
        studioLogo={entity.group.type === "studios" ? "compact" : false}
        className={cn(
          "size-11 shrink-0 bg-secondary object-cover",
          entity.group.type === "people" ? "rounded-full" : "rounded-xl",
        )}
        fallback={<entity.group.icon className="size-5 text-primary" aria-hidden />}
      />
    );
  }
  return (
    <Artwork
      id={match.work.poster?.id}
      alt=""
      width={320}
      className="h-15 w-10 shrink-0 rounded-md object-cover"
      fallback={<Film className="size-4" aria-hidden />}
    />
  );
}

export function SearchPreview({
  match,
  exact,
  open,
}: {
  match: SearchMatch;
  exact: boolean;
  open: (href: string) => void;
}) {
  const title = matchTitle(match);
  const label =
    match.kind === "work" ? "فتح العمل" : match.kind === "entity" ? "عرض الأعمال" : "فتح الصفحة";
  const action = (
    <a
      className={cn(buttonVariants(), "shrink-0")}
      href={match.href}
      onClick={(event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        open(match.href);
      }}
    >
      {label}
      <ArrowUpLeft data-icon="inline-end" />
    </a>
  );
  return (
    <div className="flex flex-col">
      {match.kind === "work" && <WorkPreviewArtwork work={match.work} />}
      {match.kind === "entity" && (
        <EntityPreviewArtwork entity={match.entity} planet={match.planet} />
      )}
      <div className="flex min-w-0 flex-col items-start gap-3 p-4 lg:p-5">
        {match.kind === "page" && <MatchThumbnail match={match} />}
        {exact && <Badge variant="secondary">مطابقة تامة</Badge>}
        <div className="flex w-full items-center justify-between gap-3">
          <h3
            className="min-w-0 font-display text-2xl leading-tight font-semibold wrap-break-word"
            dir="auto"
          >
            {title}
          </h3>
          {match.kind === "work" && action}
        </div>
        <p className="text-sm text-muted-foreground" dir="auto">
          {matchDescription(match)}
        </p>
        {match.kind === "work" && <WorkPreviewDetails work={match.work} />}
        {match.kind === "entity" && <EntityPreviewDetails entity={match.entity} />}
        {match.kind !== "work" && action}
      </div>
    </div>
  );
}

function WorkPreviewArtwork({ work }: { work: WorkSummary }) {
  return (
    <div className="relative isolate flex aspect-4/3 items-end overflow-hidden bg-secondary px-5 pb-4">
      <Artwork
        id={work.banner?.id}
        alt=""
        width={640}
        className="absolute inset-0 -z-10 size-full object-cover"
        fallback={<Film className="size-12 text-muted-foreground" aria-hidden />}
      />
      {work.logo && (
        <>
          <div className="absolute inset-0 -z-10 bg-linear-to-t from-background/90 via-background/25 to-transparent" />
          <Artwork
            id={work.logo.id}
            alt=""
            width={320}
            transparentFallback
            className="h-16 w-3/5 object-contain object-right lg:h-20"
          />
        </>
      )}
    </div>
  );
}

function WorkPreviewDetails({ work }: { work: WorkSummary }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {work.score.rating !== null && <ScoreBadge score={work.score} />}
        {work.age && (
          <Badge variant="outline">
            <bdi>{work.age}</bdi>
          </Badge>
        )}
        <Badge variant="secondary">{optionLabel(work.audience, work.audience)}</Badge>
        {work.isPrivate && <Badge variant="outline">خاص</Badge>}
        {work.installmentCount > 1 && (
          <Badge variant="secondary">
            <Layers data-icon="inline-start" />
            {work.installmentCount} أجزاء
          </Badge>
        )}
        {work.episodeCount > 0 && <Badge variant="secondary">{work.episodeCount} حلقة</Badge>}
      </div>
      {work.summary && (
        <p className="text-sm leading-relaxed text-muted-foreground" dir="auto">
          {work.summary}
        </p>
      )}
    </>
  );
}

function EntityPreviewArtwork({ entity, planet }: { entity: EntityMatch; planet?: CatalogPlanet }) {
  if (entity.group.type === "planets") {
    return (
      <div
        className="grid aspect-video place-items-center border-b bg-card bg-linear-to-br from-(--planet-secondary) to-card"
        style={planet && planetPalette(planet.primaryColor, planet.secondaryColor)}
      >
        <PlanetEmblem planet={planet} className="size-24 bg-(--planet)/25 text-5xl" />
      </div>
    );
  }

  if (entity.group.type === "people") {
    return (
      <div className="mx-4 mt-4 flex h-64 items-center justify-center lg:mx-5">
        <Artwork
          id={entity.artworkId}
          alt=""
          width={640}
          className="h-auto max-h-full w-auto max-w-full rounded-2xl object-contain data-artwork-state:aspect-4/5 data-artwork-state:h-full"
          fallback={<entity.group.icon className="size-12 text-muted-foreground" aria-hidden />}
        />
      </div>
    );
  }

  return (
    <Artwork
      id={entity.artworkId}
      alt=""
      studioLogo="flush"
      width={640}
      className="block aspect-video w-full bg-secondary object-contain"
      fallback={<entity.group.icon className="size-12 text-muted-foreground" aria-hidden />}
    />
  );
}

function EntityPreviewDetails({ entity }: { entity: EntityMatch }) {
  return (
    <div className="flex flex-wrap gap-2">
      {entity.roles?.slice(0, 5).map(({ value, label }) => (
        <Badge variant="outline" key={value}>
          {label}
        </Badge>
      ))}
    </div>
  );
}

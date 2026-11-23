import type { CatalogPlanet } from "@nahhasio/api-contract";
import { useQuery, skipToken } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { emptyFilters } from "@/features/catalog/filter-model";
import { PlanetEmblem } from "@/features/planets/planet-cards";
import { entityLink } from "@/features/shell/navigation";
import { gateway } from "@/lib/bridge";
import { planetPalette } from "@/lib/catalog-colors";

import { HomeSectionHeading } from "./home-section";

export function PlanetShelves({ planets }: { planets: CatalogPlanet[] }) {
  const section = useRef<HTMLElement>(null);
  const [loadArtwork, setLoadArtwork] = useState(false);
  const hasPlanets = planets.length > 0;
  useEffect(() => {
    const element = section.current;
    if (!hasPlanets || !element || loadArtwork) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setLoadArtwork(true);
      },
      { root: element.closest("#main-content"), rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPlanets, loadArtwork]);
  if (!hasPlanets) return null;
  return (
    <section ref={section} aria-label="استكشف الكواكب" onFocusCapture={() => setLoadArtwork(true)}>
      <HomeSectionHeading title="الكواكب" href="#/planets" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {planets.slice(0, 8).map((planet) => (
          <PlanetTile key={planet.id} planet={planet} loadArtwork={loadArtwork} />
        ))}
      </div>
    </section>
  );
}

function PlanetTile({ planet, loadArtwork }: { planet: CatalogPlanet; loadArtwork: boolean }) {
  const navigation = useCardNavigation();
  const latest = useQuery({
    queryKey: ["home", "planet-latest-release", planet.slug],
    queryFn: async ({ signal }) => {
      const page = await gateway.browse(
        {
          view: "installments",
          privacy: "public",
          sort: "latest-released-desc",
          filters: JSON.stringify({
            ...emptyFilters(),
            facets: [
              { key: "planets", include: [planet.slug], exclude: [] },
              { key: "releaseStates", include: ["released"], exclude: [] },
            ],
          }),
          page: 1,
          pageSize: 1,
        },
        signal,
      );
      return page.items[0] ?? null;
    },
    enabled: loadArtwork && planet.count > 0,
    staleTime: 30000,
  });
  const entry = latest.data;
  const workId = entry?.work.id;
  const installmentId = entry?.installment?.id;
  const artwork = useQuery({
    queryKey: ["work", workId],
    queryFn: workId && installmentId ? ({ signal }) => gateway.work(workId, signal) : skipToken,
    staleTime: 30000,
    select: (work) => {
      const images = work.installments.find(({ id }) => id === installmentId)?.artwork ?? [];
      const banners = images.filter(({ role }) => role === "banner");
      return banners.find(({ isPrimary }) => isPrimary) ?? banners[0];
    },
  });
  const banner = artwork.data ?? entry?.work.banner;
  return (
    <a
      {...navigation}
      href={entityLink("planets", planet.slug)}
      style={planetPalette(planet.primaryColor, planet.secondaryColor)}
      className="group/planet relative isolate flex aspect-video min-h-28 min-w-0 items-end overflow-hidden rounded-2xl border border-foreground/15 bg-linear-to-br from-(--planet) to-(--planet-secondary) p-3 text-primary-foreground outline-none hover:border-foreground/60 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-4"
    >
      {banner && (
        <Artwork
          id={banner.id}
          alt=""
          width={640}
          transparentFallback
          fallback={<span />}
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-80 mix-blend-luminosity motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover/planet:scale-105"
        />
      )}
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-player-chrome via-player-chrome/35 to-transparent" />
      <span className="relative flex min-w-0 items-center gap-2">
        <PlanetEmblem
          planet={planet}
          className="size-8 bg-(--planet-secondary)/70 text-base sm:size-9"
        />
        <span className="font-display text-sm leading-tight font-semibold wrap-anywhere sm:text-lg">
          {planet.nameAr}
        </span>
      </span>
    </a>
  );
}

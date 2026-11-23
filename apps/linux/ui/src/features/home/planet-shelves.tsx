import type { CatalogPlanet } from "@nahhasio/api-contract";

import { CatalogPlanetTile } from "@/features/planets/planet-tile";

import { HomeSectionHeading } from "./home-section";

export function PlanetShelves({ planets }: { planets: CatalogPlanet[] }) {
  if (!planets.length) return null;
  return (
    <section aria-label="استكشف الكواكب">
      <HomeSectionHeading title="الكواكب" href="#/planets" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {planets.slice(0, 8).map((planet) => (
          <CatalogPlanetTile key={planet.id} planet={planet} />
        ))}
      </div>
    </section>
  );
}

import type { CatalogPlanet } from "@nahhasio/api-contract";
import { ArrowUpLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { planetPalette } from "@/lib/catalog-colors";

import { useCardNavigation } from "../../components/card-navigation";

function PlanetCard({ planet }: { planet: CatalogPlanet }) {
  const navigation = useCardNavigation();

  return (
    <a
      {...navigation}
      href={`#/planets/${planet.slug}`}
      className="bg-[linear-gradient(165deg,var(--planet-secondary)_0%,var(--rail)_85%)] group relative isolate flex min-h-52 sm:min-h-60 min-w-0 flex-col items-center justify-center gap-5 overflow-hidden rounded-[28px] border border-foreground/10 p-4 text-center sm:p-6 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-(--planet)/60 hover:shadow-[0_24px_60px_-24px_var(--planet)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transform-none"
      style={planetPalette(planet.primaryColor, planet.secondaryColor)}
    >
      {/* ambient glow, top corner like the Nuvio background */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 transition-opacity duration-500 group-hover:opacity-60 bg-[radial-gradient(70%_60%_at_15%_0%,color-mix(in_oklab,var(--planet)_55%,transparent),transparent_70%)]"
      />

      {/* count pill */}
      <Badge variant="secondary" className="absolute end-4 top-4">
        {planet.count} عمل
      </Badge>

      {/* hover arrow */}
      <span className="absolute start-4 top-4 flex size-8 items-center justify-center rounded-full border border-foreground/10 bg-primary-foreground/30 text-(--planet) opacity-0 transition-all duration-300 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 motion-reduce:transform-none">
        <ArrowUpLeft aria-hidden="true" className="size-4" />
      </span>

      {/* avatar-style circle */}
      <span className="bg-(--planet) relative grid size-24 place-items-center rounded-full border-4 border-primary-foreground/40 shadow-[0_0_0_2px_color-mix(in_oklab,var(--planet)_45%,transparent),0_0_50px_-8px_var(--planet)] transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none">
        <span aria-hidden="true" className="font-emoji text-5xl leading-none drop-shadow-sm">
          {planet.icon || "🪐"}
        </span>
      </span>

      <div className="min-w-0 max-w-full">
        <h2 className="truncate text-xl font-extrabold tracking-tight text-foreground" dir="auto">
          {planet.nameAr}
        </h2>
        <p className="mt-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground/80">
          استكشف هذا العالم
        </p>
      </div>
    </a>
  );
}

export function PlanetCards({ planets }: { planets: CatalogPlanet[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {planets
        .toSorted((a, b) => b.count - a.count)
        .map((planet) => (
          <PlanetCard key={planet.id} planet={planet} />
        ))}
    </div>
  );
}

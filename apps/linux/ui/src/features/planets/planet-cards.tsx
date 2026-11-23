import type { CatalogPlanet } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ArrowUpLeft } from "lucide-react";
import type { MouseEventHandler } from "react";

import { Badge } from "@/components/ui/badge";
import { planetPalette } from "@/lib/catalog-colors";

import { useCardNavigation } from "../../components/card-navigation";
import { useCardTilt } from "../../components/use-card-tilt";
import { entityLink } from "../shell/navigation";

export function PlanetEmblem({
  planet,
  className,
}: {
  planet?: Pick<CatalogPlanet, "icon" | "primaryColor" | "secondaryColor">;
  className: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-foreground/15 bg-secondary font-emoji leading-none",
        className,
      )}
      style={planet && planetPalette(planet.primaryColor, planet.secondaryColor)}
    >
      {planet?.icon || "🪐"}
    </span>
  );
}

function PlanetCard({
  planet,
  onSelect,
}: {
  planet: CatalogPlanet;
  onSelect?: (href: string) => void;
}) {
  const navigation = useCardNavigation();
  const { hoverTilt, chooseTilt } = useCardTilt();
  const href = entityLink("planets", planet.slug);
  const click: MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (!onSelect || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    onSelect(href);
  };
  return (
    <a
      {...navigation}
      href={href}
      onClick={click}
      onFocus={chooseTilt}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") chooseTilt();
      }}
      className="group/card relative min-w-0 rounded-2xl outline-none hover:z-10 focus-visible:z-10"
    >
      <div
        className={cn(
          "relative isolate flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-foreground/10 bg-card bg-linear-to-br from-(--planet-secondary) to-card p-4 text-center group-hover/card:border-(--planet) group-focus-visible/card:ring-2 group-focus-visible/card:ring-ring group-focus-visible/card:ring-offset-2 group-focus-visible/card:ring-offset-background motion-safe:transition motion-safe:duration-200 motion-safe:group-hover/card:scale-102 motion-safe:group-focus-visible/card:scale-102",
          "min-h-37",
          hoverTilt,
        )}
        style={planetPalette(planet.primaryColor, planet.secondaryColor)}
      >
        <Badge variant="secondary" className="absolute end-2 top-2">
          {planet.count} عمل
        </Badge>
        <ArrowUpLeft
          className="absolute start-3 top-3 size-4 text-muted-foreground group-hover/card:text-foreground"
          aria-hidden
        />
        <PlanetEmblem planet={planet} className="mt-3 size-14 bg-(--planet)/25 text-3xl" />
        <h2
          className="font-display text-base leading-snug font-semibold wrap-anywhere sm:text-lg"
          dir="auto"
        >
          {planet.nameAr}
        </h2>
      </div>
    </a>
  );
}

export function PlanetCards({
  planets,
  onSelect,
}: {
  planets: CatalogPlanet[];
  onSelect?: (href: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {planets
        .toSorted((a, b) => b.count - a.count)
        .map((planet) => (
          <PlanetCard key={planet.id} planet={planet} onSelect={onSelect} />
        ))}
    </div>
  );
}

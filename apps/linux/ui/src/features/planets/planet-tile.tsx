import type { CatalogPlanet, Planet } from "@nahhasio/api-contract";
import { useQuery, skipToken } from "@tanstack/react-query";
import { cn } from "cn";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { useCardTilt } from "@/components/use-card-tilt";
import { emptyFilters } from "@/features/catalog/filter-model";
import { entityLink } from "@/features/shell/navigation";
import { gateway } from "@/lib/bridge";
import { planetPalette } from "@/lib/catalog-colors";

type TileVariant = "home" | "directory" | "work" | "emblem";
type TilePlanet = Pick<Planet, "slug" | "nameAr" | "icon" | "primaryColor" | "secondaryColor">;

export function CatalogPlanetTile({
  planet,
  variant = "home",
}: {
  planet: CatalogPlanet;
  variant?: Exclude<TileVariant, "work">;
}) {
  const tile = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = tile.current;
    if (!element || near || planet.count === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { root: element.closest("#main-content"), rootMargin: "240px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, planet.count]);
  const latest = useQuery({
    queryKey: ["catalog", "planet-latest-release", planet.slug],
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
    enabled: near && planet.count > 0,
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
  return (
    <div ref={tile} className={variant === "emblem" ? "shrink-0" : "min-w-0"}>
      <PlanetTile
        planet={planet}
        variant={variant}
        bannerId={artwork.data?.id ?? entry?.work.banner?.id}
        workCount={planet.count}
        onFocus={() => setNear(true)}
      />
    </div>
  );
}

export function PlanetTile({
  planet,
  variant = "home",
  bannerId,
  workCount,
  onFocus,
}: {
  planet: TilePlanet;
  variant?: TileVariant;
  bannerId?: string;
  workCount?: number;
  onFocus?: () => void;
}) {
  const navigation = useCardNavigation();
  const { hoverTilt, chooseTilt } = useCardTilt();
  const palette = planetPalette(planet.primaryColor, planet.secondaryColor);
  const banner = bannerId && (
    <Artwork
      id={bannerId}
      alt=""
      width={640}
      transparentFallback
      fallback={<span />}
      className={cn(
        "pointer-events-none absolute inset-0 size-full object-cover mix-blend-luminosity",
        variant === "emblem"
          ? "scale-110 opacity-60 blur-sm"
          : "opacity-80 motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover/card:scale-105",
      )}
    />
  );
  const surface =
    "relative isolate overflow-hidden rounded-2xl border border-(--planet-border) bg-linear-to-br from-(--planet) to-(--planet-secondary)";
  if (variant === "emblem") {
    return (
      <div
        role="img"
        aria-label={`رمز ${planet.nameAr}`}
        className={cn(surface, "grid size-24 place-items-center sm:size-36")}
        style={palette}
      >
        {banner}
        <span className="absolute inset-0 bg-player-chrome/25" aria-hidden />
        <span className="relative font-emoji text-5xl leading-none sm:text-7xl" aria-hidden>
          {planet.icon || "🪐"}
        </span>
      </div>
    );
  }
  return (
    <a
      {...navigation}
      href={entityLink("planets", planet.slug)}
      className="group/card relative block min-w-0 rounded-2xl outline-none hover:z-10 focus-visible:z-10"
      style={palette}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") chooseTilt();
      }}
      onFocus={() => {
        chooseTilt();
        onFocus?.();
      }}
    >
      <span
        className={cn(
          surface,
          "flex aspect-video min-h-28 items-end p-3 text-primary-foreground group-focus-visible/card:ring-2 group-focus-visible/card:ring-(--planet-border) group-focus-visible/card:ring-offset-2 group-focus-visible/card:ring-offset-background motion-safe:transition motion-safe:duration-200 motion-safe:ease-out sm:p-4",
          variant === "directory" && "min-h-32 sm:p-5",
          hoverTilt,
        )}
      >
        {banner}
        <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-player-chrome via-player-chrome/35 to-transparent" />
        <span
          className={cn(
            "relative flex min-w-0 items-center gap-2.5",
            variant === "work" && "w-full",
          )}
        >
          <span className="shrink-0 font-emoji text-3xl leading-none sm:text-4xl" aria-hidden>
            {planet.icon || "🪐"}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                "font-display text-base leading-tight font-semibold wrap-anywhere sm:text-lg",
                variant === "directory" && "sm:text-xl",
              )}
            >
              {planet.nameAr}
            </span>
            {variant === "directory" && <span className="text-xs">{workCount} عمل</span>}
          </span>
          {variant === "work" && (
            <ChevronLeft className="ms-auto size-4 shrink-0 opacity-80" aria-hidden />
          )}
        </span>
      </span>
    </a>
  );
}

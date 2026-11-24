import type { FacetOption } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ArrowLeft, Building2 } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { useCardTilt } from "@/components/use-card-tilt";

export function EntityCard({
  entity,
  kind,
  href,
  artworkLayout,
  compact = false,
  includePrivate = false,
  metadata,
  accessibleLabel,
  onClick,
}: {
  entity: Pick<FacetOption, "label" | "artworkId"> & Partial<Pick<FacetOption, "count">>;
  kind: "person" | "studio";
  href: string;
  artworkLayout: "portrait" | "square" | "banner";
  compact?: boolean;
  includePrivate?: boolean;
  metadata?: ReactNode;
  accessibleLabel?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const person = kind === "person";
  const navigation = useCardNavigation();
  const { hoverTilt, chooseTilt } = useCardTilt();

  return (
    <a
      {...navigation}
      href={href}
      aria-label={accessibleLabel}
      className="group/card relative flex min-w-0 flex-col gap-3 rounded-2xl outline-none hover:z-10 focus-visible:z-10"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") chooseTilt();
      }}
      onFocus={chooseTilt}
      onClick={onClick}
    >
      <div
        data-slot={person ? "person-artwork" : "studio-artwork"}
        className={cn(
          "overflow-hidden rounded-2xl border bg-card group-hover/card:border-foreground/60 group-focus-visible/card:ring-4 group-focus-visible/card:ring-foreground group-focus-visible/card:ring-offset-2 group-focus-visible/card:ring-offset-background motion-safe:transition motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover/card:scale-104 motion-safe:group-focus-visible/card:scale-102 motion-safe:group-active/card:scale-98 motion-reduce:transition-none",
          hoverTilt,
        )}
      >
        <Artwork
          id={entity.artworkId}
          studioLogo={!person}
          alt=""
          className={cn(
            "block w-full",
            person && "object-cover object-top",
            artworkLayout === "square"
              ? "aspect-square"
              : artworkLayout === "portrait"
                ? "aspect-4/5"
                : "aspect-video",
          )}
          fallback={
            person ? (
              <span
                className={cn(
                  "font-display font-semibold text-muted-foreground",
                  compact ? "text-3xl" : "text-6xl",
                )}
                aria-hidden
              >
                {entity.label.charAt(0)}
              </span>
            ) : (
              <Building2 className="size-10 text-muted-foreground" aria-hidden />
            )
          }
        />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 px-1 pb-2">
        <div className="min-w-0">
          <h2
            className={cn(
              "text-sm leading-snug font-semibold wrap-anywhere",
              !compact && "sm:text-base",
            )}
            dir="auto"
          >
            {entity.label}
          </h2>
          {metadata ??
            (entity.count !== undefined && (
              <p className="mt-1 text-xs text-muted-foreground">
                {entity.count}{" "}
                {compact ? "عمل" : includePrivate ? "عمل في المكتبة" : "عمل عام في المكتبة"}
              </p>
            ))}
        </div>
        {!compact && (
          <ArrowLeft
            className="size-4 shrink-0 text-muted-foreground group-hover/card:text-primary motion-safe:transition-transform motion-safe:group-hover/card:-translate-x-1"
            aria-hidden
          />
        )}
      </div>
    </a>
  );
}

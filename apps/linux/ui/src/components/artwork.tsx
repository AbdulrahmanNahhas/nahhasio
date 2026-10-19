import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Film } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { gateway } from "../lib/bridge";

function cornerBackground(image: HTMLImageElement): string | null {
  if (!image.naturalWidth || !image.naturalHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    const corners = [
      [0, 0],
      [image.naturalWidth - 1, 0],
      [0, image.naturalHeight - 1],
      [image.naturalWidth - 1, image.naturalHeight - 1],
    ];
    corners.forEach(([x, y], index) => {
      context.drawImage(image, x, y, 1, 1, index % 2, Math.floor(index / 2), 1, 1);
    });
    const pixels = context.getImageData(0, 0, 2, 2).data;
    const channels = [0, 1, 2].map((channel) =>
      [0, 1, 2, 3].map((corner) => pixels[corner * 4 + channel]),
    );
    if (
      [0, 1, 2, 3].some((corner) => pixels[corner * 4 + 3] < 250) ||
      channels.some((values) => Math.max(...values) - Math.min(...values) > 18)
    )
      return null;
    const average = channels.map((values) =>
      Math.round(values.reduce((sum, value) => sum + value, 0) / 4),
    );
    return `rgb(${average.join(" ")})`;
  } catch {
    return null;
  }
}

export function Artwork({
  id,
  alt,
  className = "",
  priority = false,
  fallback,
  studioLogo = false,
  transparentFallback = false,
}: {
  id?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  fallback?: ReactNode;
  studioLogo?: boolean;
  transparentFallback?: boolean;
}) {
  const [background, setBackground] = useState<{ source: string; color: string | null } | null>(
    null,
  );
  const [element, setElement] = useState<Element | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  const query = useQuery({
    queryKey: ["artwork", id],
    networkMode: "always",
    queryFn: ({ signal }) => gateway.artwork(id ?? "", signal),
    enabled: Boolean(id) && (priority || near),
    staleTime: Infinity,
    gcTime: 600000,
  });

  const sampled = background !== null && background.source === query.data;
  const color = sampled ? background.color : null;
  const imageClass = cn(
    className,
    studioLogo &&
      "duration-100 transition-[padding,background-color] motion-reduce:transition-none",
    studioLogo && "bg-(--studio-logo-background) object-contain object-center",
    studioLogo && (sampled && !color ? "p-7.5 max-[720px]:p-4" : "p-0"),
  );
  const imageStyle: (CSSProperties & { "--studio-logo-background": string }) | undefined =
    studioLogo ? { "--studio-logo-background": color ?? "var(--color-studio-logo)" } : undefined;
  return query.data ? (
    <img
      ref={setElement}
      className={imageClass}
      style={imageStyle}
      src={query.data}
      alt={alt}
      // The visibility observer already defers offscreen artwork before fetching its bytes.
      loading="eager"
      decoding="async"
      onLoad={
        studioLogo
          ? (event) =>
              setBackground({
                source: event.currentTarget.getAttribute("src") ?? "",
                color: cornerBackground(event.currentTarget),
              })
          : undefined
      }
    />
  ) : (
    <span
      ref={setElement}
      className={cn(
        className,
        "flex flex-col items-center justify-center gap-2.5 text-center text-xs text-muted-foreground",
        transparentFallback ? "bg-transparent" : "bg-secondary",
      )}
      role="img"
      aria-label={alt}
    >
      {fallback ?? (
        <>
          <Film className="size-7 opacity-50" aria-hidden="true" />
          <span>{query.isLoading ? "جارٍ تحميل الصورة" : "لا توجد صورة"}</span>
        </>
      )}
    </span>
  );
}

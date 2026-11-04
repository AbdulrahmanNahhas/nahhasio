import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Film } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { artworkImageFailures } from "../lib/artwork-image-failures";
import { retryArtwork } from "../lib/artwork-query";
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
  width = 640,
}: {
  id?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  fallback?: ReactNode;
  studioLogo?: boolean | "compact";
  transparentFallback?: boolean;
  width?: 320 | 640 | 1280 | 1920;
}) {
  const [background, setBackground] = useState<{ source: string; color: string | null } | null>(
    null,
  );
  const instance = useId();
  const identity = `${id}:${width}`;
  const [imageFailure, setImageFailure] = useState<{
    identity: string;
    source: string | null;
    count: number;
  } | null>(null);
  const failedSource = imageFailure?.identity === identity ? imageFailure.source : null;
  const [attempt, setAttempt] = useState(0);
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
    queryKey: ["artwork", id, width],
    networkMode: "always",
    queryFn: ({ signal }) => gateway.artwork(id ?? "", signal, width),
    enabled: Boolean(id) && (priority || near),
    staleTime: Infinity,
    gcTime: 600000,
    retry: retryArtwork,
    retryDelay: (retryIndex) => Math.min(1000 * 2 ** retryIndex, 5000),
  });
  const { isError, refetch, data } = query;
  useEffect(() => {
    const retry = () => {
      if (!isError && (!data || failedSource !== data)) return;
      setImageFailure(null);
      setAttempt((value) => value + 1);
      void refetch({ cancelRefetch: false });
    };
    window.addEventListener("nahhasio:retry-artwork", retry);
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("nahhasio:retry-artwork", retry);
      window.removeEventListener("online", retry);
    };
  }, [isError, refetch, data, failedSource]);
  useEffect(() => {
    if (
      !imageFailure ||
      imageFailure.identity !== identity ||
      imageFailure.count !== 1 ||
      !imageFailure.source
    )
      return;
    // A native URL may resolve successfully before its actual image request fails.
    const timer = setTimeout(() => {
      setImageFailure((previous) => (previous ? { ...previous, source: null } : null));
      setAttempt((value) => value + 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [imageFailure, identity]);
  const imageFailed = Boolean(
    data && failedSource === data && imageFailure && imageFailure.count > 1,
  );
  useEffect(() => {
    artworkImageFailures.set(instance, imageFailed);
    return () => artworkImageFailures.set(instance, false);
  }, [instance, imageFailed]);

  const sampled = background !== null && background.source === query.data;
  const color = sampled ? background.color : null;
  const imageClass = cn(
    className,
    studioLogo &&
      "duration-100 transition-[padding,background-color] motion-reduce:transition-none",
    studioLogo && "bg-(--studio-logo-background) object-contain object-center",
    studioLogo &&
      (sampled && !color ? (studioLogo === "compact" ? "p-2" : "p-7.5 max-[720px]:p-4") : "p-0"),
  );
  const imageStyle: (CSSProperties & { "--studio-logo-background": string }) | undefined =
    studioLogo ? { "--studio-logo-background": color ?? "var(--color-studio-logo)" } : undefined;
  const failed = query.isError || imageFailed;
  const retryingImage = Boolean(data && failedSource === data && imageFailure?.count === 1);
  return query.data && !failed && !retryingImage ? (
    <img
      key={attempt}
      onError={() =>
        setImageFailure((previous) => ({
          identity,
          source: data ?? null,
          count: previous?.identity === identity ? previous.count + 1 : 1,
        }))
      }
      ref={setElement}
      className={imageClass}
      style={imageStyle}
      src={query.data}
      alt={alt}
      // The visibility observer already defers offscreen artwork before fetching its bytes.
      loading="eager"
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onLoad={(event) => {
        setImageFailure(null);
        if (studioLogo)
          setBackground({
            source: event.currentTarget.getAttribute("src") ?? "",
            color: cornerBackground(event.currentTarget),
          });
      }}
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
      data-artwork-state={
        failed ? "error" : retryingImage || (id && query.isPending) ? "loading" : "unavailable"
      }
      aria-label={alt}
    >
      {fallback ?? (
        <>
          <Film className="size-7 opacity-50" aria-hidden="true" />
          <span>{failed ? "تعذّر تحميل الصورة" : id ? "جارٍ تحميل الصورة" : "لا توجد صورة"}</span>
        </>
      )}
    </span>
  );
}

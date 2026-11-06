import { CatalogMediaResultSchema, CatalogPreviewResultSchema } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ImageIcon } from "lucide-react";
import { useEffect, useState, type ImgHTMLAttributes } from "react";

import { Button } from "@/components/ui/button";
import { gateway } from "@/lib/bridge";
export function RegisteredImage({
  src,
  alt,
  className,
  fit = "contain",
  assetId,
  width = 640,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  fit?: "contain" | "cover";
  assetId?: string;
  width?: number;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
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
  const result = useQuery({
    queryKey: ["admin", "editor-image", assetId ?? src, width],
    enabled: (near || props.loading === "eager") && Boolean(assetId || src),
    retry: false,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      if (assetId) return gateway.artwork(assetId, signal, width);
      if (!src) throw new Error("لا توجد صورة");
      if (src.startsWith("/media/")) {
        const media = CatalogMediaResultSchema.parse(
          await gateway.editorCall({ operation: "media", data: { path: src } }, signal),
        );
        return gateway.artwork(media.id, signal, width);
      }
      return CatalogPreviewResultSchema.parse(
        await gateway.editorCall({ operation: "preview", data: { url: src } }, signal),
      ).dataUrl;
    },
  });
  return (
    <div ref={setElement} className={cn("overflow-hidden", className)}>
      {result.data ? (
        <img
          {...props}
          src={result.data}
          alt={alt ?? ""}
          className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain")}
        />
      ) : (
        <span className="grid size-full min-h-12 place-content-center justify-items-center gap-2 bg-muted text-muted-foreground">
          <ImageIcon className="size-6" aria-label={alt || "الصورة غير متاحة"} />
          {props.loading === "eager" && result.isError && (
            <>
              <span>تعذّر تحميل الصورة</span>
              <Button variant="ghost" size="sm" onClick={() => void result.refetch()}>
                إعادة المحاولة
              </Button>
            </>
          )}
        </span>
      )}
    </div>
  );
}

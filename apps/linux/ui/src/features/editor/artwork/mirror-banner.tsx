import { CatalogMediaResultSchema } from "@nahhasio/api-contract";
import { useMutation } from "@tanstack/react-query";
import { FlipHorizontal2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uploadArtwork } from "@/features/artwork/library/artwork.functions";
import { gateway } from "@/lib/bridge";

export function MirrorBanner({
  path,
  ownerName,
  onPick,
}: {
  path: string;
  ownerName: string;
  onPick: (path: string) => void;
}) {
  const mirror = useMutation({
    mutationFn: async () => {
      const media = CatalogMediaResultSchema.parse(
        await gateway.editorCall({ operation: "media", data: { path } }),
      );
      const source = await gateway.artwork(media.id, undefined, 0);
      const image = new Image();
      image.src = source;
      await image.decode();
      if (
        !image.naturalWidth ||
        !image.naturalHeight ||
        image.naturalWidth * image.naturalHeight > 32000000
      )
        throw new Error("الصورة أكبر من الحد المسموح للتحرير.");
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("تعذّر تجهيز الصورة.");
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(image, 0, 0);
      // Create registered artwork; the original remains available and assignment stays a draft.
      return uploadArtwork({
        data: {
          dataUrl: canvas.toDataURL("image/webp", 0.95),
          fileName: "mirrored-banner.webp",
          role: "banner",
          ownerName,
        },
      });
    },
    onSuccess: (image) => onPick(image.path),
  });
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mirror.isPending}
        onClick={() => mirror.mutate()}
      >
        <FlipHorizontal2 data-icon="inline-start" />
        {mirror.isPending ? "جارٍ عكس الخلفية…" : "عكس الخلفية أفقيًا"}
      </Button>
      {mirror.error && (
        <p role="alert" className="text-sm text-destructive">
          {mirror.error.message}
        </p>
      )}
    </div>
  );
}

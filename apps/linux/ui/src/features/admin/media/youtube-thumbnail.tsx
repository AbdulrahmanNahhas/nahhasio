import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { gateway } from "@/lib/bridge";

export function YoutubeThumbnail({ videoId, title }: { videoId: string; title: string }) {
  const [enabled, setEnabled] = useState(false);
  const preview = useQuery({
    queryKey: ["admin", "youtube-thumbnail", videoId],
    queryFn: async ({ signal }) =>
      rpcResults.preview.parse(
        await gateway.editorCall(
          {
            operation: "preview",
            data: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` },
          },
          signal,
        ),
      ),
    enabled,
    staleTime: 300000,
    retry: false,
  });
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={preview.isFetching}
        onClick={() => {
          setEnabled(true);
          if (enabled) void preview.refetch();
        }}
      >
        {preview.isFetching
          ? "جارٍ جلب الصورة…"
          : preview.error
            ? "إعادة محاولة الصورة"
            : "معاينة صورة الفيديو"}
      </Button>
      {preview.data && (
        <img
          src={preview.data.dataUrl}
          alt={`صورة الفيديو: ${title}`}
          className="max-h-40 max-w-full rounded-md object-contain"
        />
      )}
      {preview.error && <p role="alert">{preview.error.message}</p>}
    </div>
  );
}

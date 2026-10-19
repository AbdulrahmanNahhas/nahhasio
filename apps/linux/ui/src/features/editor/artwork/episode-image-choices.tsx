import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { useQuery } from "@tanstack/react-query";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { RegisteredImage } from "@/features/editor/registered-image";
import { gateway } from "@/lib/bridge";

export function EpisodeImageChoices({
  tmdbId,
  season,
  episode,
  selected,
  disabled = false,
  onPick,
}: {
  tmdbId: number;
  season: number;
  episode: number;
  selected?: string | null;
  disabled?: boolean;
  onPick: (url: string) => void;
}) {
  const query = useQuery({
    queryKey: ["admin", "episode-images", tmdbId, season, episode],
    queryFn: async ({ signal }) =>
      rpcResults.episodeImages.parse(
        await gateway.editorCall(
          { operation: "episodeImages", data: { tmdbId, season, episode } },
          signal,
        ),
      ),
    staleTime: 300000,
    retry: false,
  });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {query.isPending && <Skeleton className="h-40" />}
      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>{query.error.message}</AlertTitle>
          <Button variant="outline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </Button>
        </Alert>
      )}
      {query.data?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد صور لهذه الحلقة في TMDB</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      <div className="grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">
        {query.data?.map((image) => (
          <div key={image.url} className="flex min-w-0 flex-col gap-2">
            <RegisteredImage
              src={image.previewUrl}
              alt={`خيار صورة الحلقة ${episode}`}
              className="aspect-video w-full rounded-lg"
              fit="cover"
            />
            <Button
              variant={selected === image.url ? "secondary" : "outline"}
              size="sm"
              disabled={disabled}
              aria-pressed={selected === image.url}
              onClick={() => onPick(image.url)}
            >
              {selected === image.url ? "الصورة المختارة" : "اختيار الصورة"} · {image.width} ×{" "}
              {image.height}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

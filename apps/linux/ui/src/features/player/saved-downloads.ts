import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { z } from "zod";

import { nativeCall } from "@/lib/bridge";

const SavedSchema = z
  .array(
    z.object({
      target: z.object({
        workId: z.string().uuid(),
        installmentId: z.string().uuid().nullable(),
        episodeId: z.string().uuid().nullable(),
      }),
      available: z.boolean(),
    }),
  )
  .max(4096);

export function useDownloadedEpisodeIds(workId: string | undefined, enabled = true) {
  const { data } = useQuery({
    queryKey: ["native", "downloads"] as const,
    queryFn: async () => SavedSchema.parse(await nativeCall("media.saved", {})),
    enabled: enabled && Boolean(workId),
    refetchInterval: 5000,
    staleTime: 5000,
    retry: false,
    networkMode: "always",
  });
  return useMemo(() => {
    const ids = new Set<string>();
    for (const file of data ?? []) {
      const { episodeId } = file.target;
      if (file.available && file.target.workId === workId && episodeId) ids.add(episodeId);
    }
    return ids;
  }, [data, workId]);
}

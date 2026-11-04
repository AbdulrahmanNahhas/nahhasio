/** Retry transport failures, not rejected authorization, missing files or invalid content. */
export function retryArtwork(failures: number, error: Error) {
  if (failures >= 2 || error.name === "AbortError" || error.name === "ZodError") return false;
  const cause = failureCause.safeParse(error.cause).data;
  if (cause) {
    if (cause.status !== undefined)
      return cause.status === 408 || cause.status === 429 || cause.status >= 500;
    if (cause.code !== undefined) return cause.code === "network" || cause.code === "server";
  }
  return true;
}
import { z } from "zod";

const failureCause = z.object({
  status: z.number().int().min(100).max(599).optional(),
  code: z.string().optional(),
});

/** Ordinary cards need at most 640 px; large heroes explicitly request a larger variant. */
export function artworkWidth(cssWidth: number, pixelRatio: number): 320 | 640 {
  const pixels = Math.max(1, cssWidth) * Math.min(2, Math.max(1, pixelRatio || 1));
  return pixels <= 320 ? 320 : 640;
}

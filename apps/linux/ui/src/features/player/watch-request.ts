import { z } from "zod";

export const WatchTargetSchema = z.strictObject({
  workId: z.string().uuid(),
  title: z.string().trim().min(1).max(1024),
  installmentId: z.string().uuid().optional(),
  episodeId: z.string().uuid().optional(),
  homeFileId: z.string().uuid().optional(),
  intent: z.enum(["watch", "download"]).optional(),
});
export type WatchTarget = z.infer<typeof WatchTargetSchema>;
export const watchRequestEvent = "nahhasio:watch-request";

/** Explicit viewing intent, not watched state or proof that a source is available. */
export function requestDownload(target: WatchTarget) {
  requestWatch({ ...target, intent: "download" });
}

export function requestWatch(target: WatchTarget) {
  const detail = WatchTargetSchema.parse(target);
  window.dispatchEvent(new CustomEvent(watchRequestEvent, { detail }));
}

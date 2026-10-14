import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { nativeCall } from "@/lib/bridge";

const quantity = z.number().finite().nonnegative();
export const ExportSchema = z.object({
  id: z.string().optional().default(""),
  file: z.number().int().nonnegative(),
  path: z.string(),
  size: quantity.optional().default(0),
  available: z.boolean(),
  published: z.boolean(),
  error: z.string().nullable(),
  target: z
    .object({
      workId: z.string().uuid(),
      installmentId: z.string().uuid().nullable(),
      episodeId: z.string().uuid().nullable(),
    })
    .nullable()
    .optional()
    .default(null),
  title: z.string().nullable().optional().default(null),
  workTitle: z.string().nullable().optional().default(null),
  posterId: z.string().uuid().nullable().optional().default(null),
});
export const JobsSchema = z
  .array(
    z.object({
      id: z.string(),
      selected: z.array(z.number().int().nonnegative()),
      files: z.array(
        z.object({ index: z.number().int().nonnegative(), path: z.string(), size: quantity }),
      ),
      status: z.object({
        verified: quantity,
        total: quantity,
        complete: z.boolean(),
        paused: z.boolean(),
        error: z.string().nullable(),
        state: z.enum([
          "metadata_pending",
          "checking",
          "paused",
          "downloading",
          "complete",
          "missing",
          "blocked",
          "failed",
        ]),
        download_rate: quantity,
        peers: quantity,
      }),
      exports: z.array(ExportSchema),
    }),
  )
  .max(4096);
export type DownloadJob = z.infer<typeof JobsSchema>[number];
export type SavedVideo = z.infer<typeof ExportSchema>;
export const librarySchema = z.object({
  files: z.array(ExportSchema.extend({ id: z.string().min(1) })).max(4096),
  root: z.string(),
  usedBytes: quantity,
  freeBytes: quantity.nullable(),
});
export const downloadKeys = ["native", "downloads"] as const;
export const stateLabels = {
  metadata_pending: "جارٍ جلب معلومات التورنت",
  checking: "جارٍ التحقق",
  paused: "متوقف مؤقتاً",
  downloading: "جارٍ التنزيل",
  complete: "جارٍ حفظ الفيديو",
  missing: "ملفات التورنت مفقودة",
  blocked: "المصدر محظور",
  failed: "تعذّر التنزيل",
} as const;
export function downloadQueueOptions() {
  return queryOptions({
    queryKey: [...downloadKeys, "queue"],
    queryFn: async ({ signal }) => JobsSchema.parse(await nativeCall("media.jobs", {}, signal)),
    networkMode: "always",
    retry: false,
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });
}
export function downloadLibraryOptions() {
  return queryOptions({
    queryKey: [...downloadKeys, "library"],
    queryFn: async ({ signal }) =>
      librarySchema.parse(await nativeCall("media.library", {}, signal)),
    networkMode: "always",
    retry: false,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}
export function videoTitle(file: SavedVideo) {
  return file.title || file.path.split("/").at(-1) || "فيديو محفوظ";
}
export function workTitle(file: SavedVideo) {
  return file.workTitle || file.path.split("/").at(-2) || "عمل محفوظ";
}
export function jobCategory(job: DownloadJob) {
  if (job.exports.length > 0 && job.exports.every((file) => file.available)) return "completed";
  if (
    job.status.error ||
    job.exports.some((file) => file.error || (file.published && !file.available)) ||
    ["failed", "blocked", "missing"].includes(job.status.state)
  )
    return "failed";
  return "active";
}
export function jobLabel(job: DownloadJob) {
  if (jobCategory(job) === "completed") return "محفوظ وجاهز للمشاهدة";
  if (job.exports.some((file) => file.published && !file.available))
    return "الفيديو المحفوظ مفقود أو تغيّر";
  if (job.exports.some((file) => file.error)) return "تعذّر حفظ الفيديو";
  if (job.status.state === "downloading" && job.status.download_rate === 0)
    return job.status.peers === 0 ? "بانتظار المشاركين" : "بانتظار البيانات";
  return stateLabels[job.status.state];
}
export const okReply = z.object({ ok: z.literal(true) });

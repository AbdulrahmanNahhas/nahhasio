import type { ServerMediaFile } from "@nahhasio/api-contract";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatSourceSize } from "@/features/player/source-format";

const metadata = z.object({
  source: z.string().optional(),
  youtubeVideoId: z.string().nullable().optional(),
  probe: z
    .object({
      streams: z
        .array(
          z.object({
            index: z.number().int(),
            codec_type: z.string(),
            codec_name: z.string().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            tags: z
              .object({ language: z.string().optional(), title: z.string().optional() })
              .optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export function MediaFileDetails({ file }: { file: ServerMediaFile }) {
  const parsed = metadata.safeParse(file.probeMetadata);
  const data = parsed.success ? parsed.data : null;
  const streams = data?.probe?.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>تفاصيل الملف</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تفاصيل الفيديو والتحقق</DialogTitle>
          <DialogDescription>
            {file.workTitle} / {file.episodeTitle ?? file.installmentTitle}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt>الحجم</dt>
            <dd>{file.byteSize === null ? "غير معروف" : formatSourceSize(file.byteSize)}</dd>
          </div>
          <div>
            <dt>المدة</dt>
            <dd>
              {file.durationSeconds === null
                ? "غير معروفة"
                : `${Math.floor(file.durationSeconds / 60)} دقيقة`}
            </dd>
          </div>
          <div>
            <dt>الفيديو</dt>
            <dd>
              {video
                ? `${video.width ?? "؟"} × ${video.height ?? "؟"} · ${video.codec_name ?? "؟"}`
                : "لم يُفحص"}
            </dd>
          </div>
          <div>
            <dt>المصدر</dt>
            <dd>
              {data?.source === "youtube"
                ? "YouTube"
                : data?.source === "upload"
                  ? "رفع من جهاز"
                  : data?.source === "server-folder"
                    ? "مجلد الخادم"
                    : "غير مسجّل"}
            </dd>
          </div>
          <div>
            <dt>آخر تحقق</dt>
            <dd>
              {file.lastVerifiedAt
                ? new Date(file.lastVerifiedAt).toLocaleString("ar")
                : "لم يُتحقّق منه"}
            </dd>
          </div>
          <div>
            <dt>الحالة</dt>
            <dd>
              {file.isTrashed
                ? "في المحذوفات"
                : file.availability === "present"
                  ? "متاح"
                  : "يحتاج مراجعة"}
            </dd>
          </div>
        </dl>
        {file.trashExpiresAt && (
          <p>موعد الحذف النهائي: {new Date(file.trashExpiresAt).toLocaleString("ar")}</p>
        )}
        <p className="break-all" dir="ltr">
          {file.relativePath}
        </p>
        <p className="break-all text-xs text-muted-foreground" dir="ltr">
          SHA-256: {file.sha256 ?? "—"}
        </p>
        <ul className="flex flex-col gap-2">
          {streams
            .filter((stream) => ["audio", "subtitle"].includes(stream.codec_type))
            .map((stream) => (
              <li key={stream.index}>
                {stream.codec_type === "audio" ? "صوت" : "ترجمة"} ·{" "}
                {stream.tags?.language ?? "لغة غير محدّدة"} ·{" "}
                {stream.tags?.title ?? stream.codec_name ?? "؟"}
              </li>
            ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

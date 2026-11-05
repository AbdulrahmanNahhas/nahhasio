import { ServerMediaFilesSchema } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nativeCall } from "@/lib/bridge";

import { PlayerSnapshotSchema } from "./bridge";
import { formatSourceSize } from "./source-format";
import { playerSnapshotKey, type PlayerController } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";
export function HomeSources({
  target,
  player,
  onPlaybackStarted,
}: {
  target: WatchTarget | null;
  player: PlayerController;
  onPlaybackStarted?: () => void;
}) {
  const client = useQueryClient();
  const sessionId = player.snapshot?.sessionId ?? "";
  const files = useQuery({
    queryKey: ["viewer", "home-media", target?.workId],
    queryFn: async ({ signal }) =>
      ServerMediaFilesSchema.parse(await nativeCall("homeMedia", { id: target!.workId }, signal)),
    enabled: Boolean(target),
    retry: false,
  });
  const matches =
    files.data?.filter(
      (file) =>
        file.installmentId === target?.installmentId &&
        file.episodeId === (target?.episodeId ?? null) &&
        file.availability === "present",
    ) ?? [];
  const play = useMutation({
    mutationKey: ["native", "home-play", sessionId],
    mutationFn: async (fileId: string) => {
      if (!target) throw new Error("اختر حلقة أولًا.");
      const reply = PlayerSnapshotSchema.parse(
        await nativeCall("media.homePlay", {
          sessionId,
          fileId,
          target: {
            workId: target.workId,
            installmentId: target.installmentId ?? null,
            episodeId: target.episodeId ?? null,
          },
        }),
      );
      if (reply.sessionId !== sessionId) throw new Error("وصل تحديث قديم للمشغّل.");
      return reply;
    },
    onSuccess: (snapshot) => {
      client.setQueryData(playerSnapshotKey, snapshot);
      onPlaybackStarted?.();
    },
    networkMode: "always",
    retry: false,
  });
  return (
    <section className="flex flex-col gap-3" aria-label="مكتبة المنزل">
      <div className="flex items-center gap-2">
        <h3>مكتبة المنزل</h3>
        <Badge variant="outline">ملفات الخادم</Badge>
      </div>
      {files.isPending && <p role="status">جارٍ التحقق من ملفات الحلقة…</p>}
      {files.error && (
        <p>تعذّر الوصول إلى مكتبة المنزل. تحتاج ملفات الخادم إلى اتصال بالشبكة المنزلية.</p>
      )}
      {files.isSuccess && !matches.length && <p>لم يُستورد فيديو لهذه الحلقة إلى مكتبة المنزل.</p>}
      {matches.map((file) => (
        <Button
          key={file.id}
          variant="outline"
          disabled={play.isPending || player.pending || !sessionId}
          onClick={() => play.mutate(file.id)}
        >
          <Play data-icon="inline-start" />
          تشغيل من المنزل {file.byteSize !== null && `· ${formatSourceSize(file.byteSize)}`}
        </Button>
      ))}
      {play.error && (
        <Alert variant="destructive">
          <AlertDescription>{play.error.message}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

export function HomeDownloadSources({
  target,
  onQueued,
}: {
  target: WatchTarget;
  onQueued: () => void;
}) {
  const client = useQueryClient();
  const files = useQuery({
    queryKey: ["viewer", "home-media", target.workId],
    queryFn: async ({ signal }) =>
      ServerMediaFilesSchema.parse(await nativeCall("homeMedia", { id: target.workId }, signal)),
    retry: false,
  });
  const matches =
    files.data?.filter(
      (file) =>
        file.installmentId === target.installmentId &&
        file.episodeId === (target.episodeId ?? null) &&
        file.availability === "present",
    ) ?? [];
  const action = useMutation({
    mutationFn: async (fileId: string) => {
      const reply = await nativeCall("media.homeDownload", {
        fileId,
        target: {
          workId: target.workId,
          installmentId: target.installmentId ?? null,
          episodeId: target.episodeId ?? null,
        },
      });
      return z.object({ ok: z.literal(true) }).parse(reply);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["native", "downloads"] });
      onQueued();
    },
    networkMode: "always",
    retry: false,
  });
  return (
    <section className="flex flex-col gap-3" aria-label="تنزيل من مكتبة المنزل">
      <h3>نسخة مكتبة المنزل</h3>
      {files.isPending && <p role="status">جارٍ التحقق من الملف…</p>}
      {files.error && <p>مكتبة المنزل غير متاحة؛ يلزم الاتصال بالشبكة المنزلية لتنزيل ملفاتها.</p>}
      {matches.map((file) => (
        <Button
          key={file.id}
          variant="outline"
          disabled={action.isPending || !file.sha256}
          onClick={() => action.mutate(file.id)}
        >
          تنزيل إلى هذا الجهاز {file.byteSize !== null && `· ${formatSourceSize(file.byteSize)}`}
        </Button>
      ))}
      {action.error && (
        <Alert variant="destructive">
          <AlertDescription>{action.error.message}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

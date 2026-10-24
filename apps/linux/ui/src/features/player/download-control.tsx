import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Download, LoaderCircle } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nativeCall } from "@/lib/bridge";

import type { PlayerSnapshot } from "./bridge";
import { DownloadQueue } from "./download-queue";

const KeepReplySchema = z.object({ ok: z.literal(true) });

export function DownloadPanel({ snapshot }: { snapshot: PlayerSnapshot }) {
  const client = useQueryClient();
  const sessionId = snapshot.sessionId;
  const keep = useMutation({
    mutationKey: ["native", "keep", sessionId],
    mutationFn: async () => {
      if (!sessionId || snapshot.sourceKind !== "torrent")
        throw new Error("لا يوجد تورنت جارٍ للاحتفاظ به.");
      return KeepReplySchema.parse(await nativeCall("media.keep", { sessionId }));
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["native", "downloads"] }),
    retry: false,
    networkMode: "always",
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="line-clamp-2 text-sm font-medium" dir="auto">
          {snapshot.title}
        </p>
        {snapshot.sourceKind && (
          <Badge variant="outline">
            {snapshot.sourceKind === "torrent"
              ? "تورنت"
              : snapshot.sourceKind === "local"
                ? "على الجهاز"
                : "بث مباشر"}
          </Badge>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {snapshot.sourceKind === "torrent"
          ? "احتفظ بالفيديو على جهازك من التورنت الجاري."
          : snapshot.sourceKind === "local"
            ? "هذا الفيديو موجود على جهازك بالفعل؛ لا يحتاج إلى تنزيل."
            : "التنزيل متاح لمصادر التورنت."}
      </p>
      {snapshot.sourceKind === "torrent" && (
        <Button disabled={keep.isPending || keep.isSuccess} onClick={() => keep.mutate()}>
          {keep.isPending ? (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : keep.isSuccess ? (
            <Check data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          {keep.isPending
            ? "جارٍ تثبيت التنزيل…"
            : keep.isSuccess
              ? "أُضيف إلى قائمة التنزيل"
              : "الاحتفاظ بتنزيل الفيديو"}
        </Button>
      )}
      {keep.isSuccess && (
        <p role="status" className="text-sm">
          يتابع التطبيق تنزيل الفيديو على هذا الجهاز.
        </p>
      )}
      {keep.isSuccess && <DownloadQueue />}
      {keep.error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر الاحتفاظ بالتنزيل</AlertTitle>
          <AlertDescription>{keep.error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

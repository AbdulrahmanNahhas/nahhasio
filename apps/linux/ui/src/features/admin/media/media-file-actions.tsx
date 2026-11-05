import { MediaQueuedSchema, type ServerMediaFile } from "@nahhasio/api-contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { requestWatch } from "@/features/player/watch-request";
import { nativeCall } from "@/lib/bridge";

import { MediaFileDetails } from "./media-file-details";
import { ReassignMedia } from "./reassign-dialog";
export function MediaFileActions({ file }: { file: ServerMediaFile }) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState<"trash" | "purge" | null>(null);
  const retired = file.isTrashed;
  const action = useMutation({
    mutationFn: async (operation: "trash" | "restore" | "purge" | "verify") =>
      MediaQueuedSchema.parse(
        await nativeCall("adminMediaFile", {
          id: file.id,
          action: operation,
          expectedRevision: file.revision,
        }),
      ),
    onSuccess: async () => {
      setConfirm(null);
      await client.invalidateQueries({ queryKey: ["admin", "media"] });
    },
  });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <MediaFileDetails file={file} />
        <ReassignMedia file={file} />
        {file.availability === "present" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              requestWatch({
                workId: file.workId,
                installmentId: file.installmentId,
                episodeId: file.episodeId ?? undefined,
                homeFileId: file.id,
                title: file.workTitle,
              })
            }
          >
            معاينة
          </Button>
        )}
        {retired ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={action.isPending}
              onClick={() => action.mutate("restore")}
            >
              استعادة
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={action.isPending}
              onClick={() => setConfirm("purge")}
            >
              حذف نهائي
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={action.isPending}
              onClick={() => action.mutate("verify")}
            >
              تحقق من الملف
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={action.isPending}
              onClick={() => setConfirm("trash")}
            >
              نقل إلى المحذوفات
            </Button>
          </>
        )}
      </div>
      {action.isSuccess && (
        <p role="status">أُضيف الإجراء إلى مهام الوسائط. حدّث المكتبة بعد اكتماله.</p>
      )}
      {action.error && (
        <Alert variant="destructive">
          <AlertDescription>{action.error.message}</AlertDescription>
        </Alert>
      )}
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "purge" ? "حذف الفيديو نهائيًا" : "نقل الفيديو إلى المحذوفات"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "purge"
                ? "ستُحذف بايتات الفيديو دون إمكانية الاستعادة من التطبيق."
                : "يتوقف إتاحة الفيديو فور معالجة المهمة، ويبقى قابلًا للاستعادة لمدة سبعة أيام."}{" "}
              تبقى بيانات العمل والحلقة وسجل المشاهدة.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={action.isPending}
              onClick={() => {
                if (confirm) action.mutate(confirm);
              }}
            >
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

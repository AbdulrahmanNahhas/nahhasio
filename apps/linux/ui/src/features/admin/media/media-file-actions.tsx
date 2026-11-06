import { MediaQueuedSchema, type ServerMediaFile } from "@nahhasio/api-contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Play, ShieldCheck, Trash2, Undo2, Replace, Link2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { requestWatch } from "@/features/player/watch-request";
import { nativeCall } from "@/lib/bridge";

import { MediaFileDetails } from "./media-file-details";
import { ReassignMedia } from "./reassign-dialog";
import { ReplaceMedia } from "./replace-media";
export function MediaFileActions({ file }: { file: ServerMediaFile }) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState<"trash" | "purge" | null>(null);
  const [dialog, setDialog] = useState<"reassign" | "replace" | null>(null);
  const retired = file.isTrashed;
  const missing = !retired && file.availability === "missing";
  const receipt = z
    .object({ trash: z.object({ missingVideo: z.boolean().optional() }).optional() })
    .safeParse(file.probeMetadata);
  const missingOriginal = receipt.success && receipt.data.trash?.missingVideo;
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
      await client.invalidateQueries({ queryKey: ["viewer", "home-media", file.workId] });
    },
  });
  return (
    <div className="flex flex-col gap-2">
      <ButtonGroup aria-label="إجراءات الفيديو">
        <MediaFileDetails file={file} />
        {!retired && file.availability === "present" && (
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
            <Play data-icon="inline-start" />
            معاينة
          </Button>
        )}
        {retired ? (
          <Button
            variant="outline"
            size="sm"
            disabled={action.isPending}
            onClick={() => action.mutate("restore")}
          >
            <Undo2 data-icon="inline-start" />
            استعادة
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="المزيد من إجراءات الفيديو"
                disabled={action.isPending}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {!retired && (
                <DropdownMenuItem onClick={() => action.mutate("verify")}>
                  <ShieldCheck /> تحقق من الملف
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={!file.revision} onClick={() => setDialog("reassign")}>
                <Link2 /> تغيير الربط
              </DropdownMenuItem>
              {!retired && (
                <DropdownMenuItem onClick={() => setDialog("replace")}>
                  <Replace /> استبدال بنسخة أخرى
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirm(retired ? "purge" : "trash")}
              >
                <Trash2 />{" "}
                {retired
                  ? "حذف نهائي"
                  : missing
                    ? "إزالة تسجيل الملف المفقود"
                    : "نقل إلى المحذوفات"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      {missingOriginal && (
        <p className="text-sm text-muted-foreground">
          كان الفيديو مفقودًا عند الحذف. الاستعادة تعيد التسجيل والترجمات المتبقية، ولا تسترجع فيديو
          غير موجود.
        </p>
      )}
      <ReassignMedia
        file={file}
        control={{
          open: dialog === "reassign",
          onOpenChange: (open) => setDialog(open ? "reassign" : null),
        }}
      />
      {!retired && (
        <ReplaceMedia
          file={file}
          control={{
            open: dialog === "replace",
            onOpenChange: (open) => setDialog(open ? "replace" : null),
          }}
        />
      )}
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
              {confirm === "purge"
                ? "حذف الفيديو نهائيًا"
                : missing
                  ? "إزالة تسجيل الملف المفقود"
                  : "نقل الفيديو إلى المحذوفات"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "purge"
                ? "سيُحذف ما بقي في المحذوفات من الفيديو وترجماته دون إمكانية الاستعادة من التطبيق."
                : missing
                  ? "يُفحص المسار مجددًا. إذا بقي الفيديو مفقودًا، يُنقل تسجيله وأي ترجمات متبقية إلى المحذوفات لمدة سبعة أيام. الاستعادة لا تُنشئ فيديو مفقودًا."
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Play, RefreshCw, Trash2, X, MoreHorizontal } from "lucide-react";
import { useState, useId } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { nativeCall } from "@/lib/bridge";

import { PlayerSnapshotSchema } from "./bridge";
import { downloadKeys, okReply, videoTitle, type SavedVideo } from "./download-data";
import { runPlayerAction } from "./use-player-snapshot";
import { requestDownload } from "./watch-request";

export function SavedVideoActions({ file }: { file: SavedVideo }) {
  const client = useQueryClient();
  const [removal, setRemoval] = useState<"remove_record" | "delete_video" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const target = file.target;
  const confirmationId = useId();
  const action = useMutation({
    scope: { id: "native-downloads" },
    mutationFn: async (command: "play" | "folder" | "retry" | "remove_record" | "delete_video") => {
      if (command === "play") {
        await runPlayerAction(client, async () =>
          PlayerSnapshotSchema.parse(
            await nativeCall("media.openSaved", { id: file.id, file: file.file }),
          ),
        );
        return;
      }
      if (command === "folder") {
        okReply.parse(await nativeCall("media.revealSaved", { id: file.id, file: file.file }));
      } else {
        okReply.parse(
          await nativeCall("media.savedAction", { id: file.id, file: file.file, action: command }),
        );
      }
    },
    onSuccess: async (_, command) => {
      setRemoval(null);
      await client.invalidateQueries({ queryKey: downloadKeys });
      if (command === "delete_video" || command === "remove_record")
        toast.add({
          type: "success",
          title:
            command === "delete_video"
              ? "حُذف الفيديو من هذا الجهاز"
              : "أُزيل السجل؛ ملف الفيديو باقٍ",
        });
    },
    networkMode: "always",
    retry: false,
  });
  function ask(mode: "remove_record" | "delete_video") {
    action.reset();
    setConfirmation("");
    setRemoval(mode);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {file.available ? (
        <>
          <Button size="sm" disabled={action.isPending} onClick={() => action.mutate("play")}>
            <Play data-icon="inline-start" />
            تشغيل
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="فتح مجلد الفيديو"
            disabled={action.isPending}
            onClick={() => action.mutate("folder")}
          >
            <FolderOpen data-icon="inline-start" />
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={action.isPending}
          onClick={() => action.mutate("retry")}
        >
          <RefreshCw data-icon="inline-start" />
          إعادة التنزيل
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={action.isPending}
              aria-label={`إجراءات ${videoTitle(file)}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={action.isPending} onClick={() => ask("remove_record")}>
              <X data-icon="inline-start" />
              إزالة السجل مع الاحتفاظ بالفيديو
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              disabled={action.isPending}
              onClick={() => ask("delete_video")}
            >
              <Trash2 data-icon="inline-start" />
              حذف ملف الفيديو من الجهاز
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {action.isError && !removal && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تنفيذ الإجراء</AlertTitle>
          <AlertDescription>{action.error.message}</AlertDescription>
          {!file.available && target && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                requestDownload({
                  workId: target.workId,
                  installmentId: target.installmentId ?? undefined,
                  episodeId: target.episodeId ?? undefined,
                  title: videoTitle(file),
                })
              }
            >
              اختيار مصدر آخر
            </Button>
          )}
        </Alert>
      )}
      <AlertDialog
        open={removal !== null}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removal === "delete_video" ? "حذف الفيديو من الجهاز" : "إزالة سجل الفيديو"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {videoTitle(file)} —{" "}
              {removal === "delete_video"
                ? "سيُحذف ملف الفيديو المسجّل وسجله المحلي. بيانات العمل وملفات الخادم تبقى محفوظة."
                : "يُزال السجل المحلي فقط. ملف الفيديو يبقى في مكانه، ولن يظهر بعدها في مكتبة التنزيلات."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="break-all text-xs text-muted-foreground" dir="ltr">
            {file.path}
          </p>
          {removal === "delete_video" && (
            <Field>
              <FieldLabel htmlFor={confirmationId}>اكتب حذف للتأكيد</FieldLabel>
              <Input
                id={confirmationId}
                value={confirmation}
                disabled={action.isPending}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
          )}
          {action.isError && (
            <Alert variant="destructive">
              <AlertTitle>لم يكتمل الإجراء</AlertTitle>
              <AlertDescription>{action.error.message}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                action.isPending || (removal === "delete_video" && confirmation.trim() !== "حذف")
              }
              onClick={() => {
                if (removal) action.mutate(removal);
              }}
            >
              {action.isPending && <Spinner data-icon="inline-start" />}تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

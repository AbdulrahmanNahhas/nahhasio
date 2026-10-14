import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RegisteredImage } from "@/features/editor/registered-image";

import type { ImageAsset } from "./images-model";
import { deleteImage, imageOptions } from "./images.queries";

export function ImageDelete({
  asset,
  onDeleted,
}: {
  asset: ImageAsset;
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const detail = useQuery({ ...imageOptions(asset.id), enabled: open });
  const deletion = useMutation({
    mutationFn: () => deleteImage({ id: asset.id, expectedSha256: asset.sha256 }),
    onSuccess: async () => {
      setOpen(false);
      await onDeleted();
    },
  });
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`حذف ${asset.fileName}`}
        disabled={asset.assignmentCount > 0}
        title={asset.assignmentCount > 0 ? "أزل الروابط قبل الحذف" : "حذف من المكتبة"}
        onClick={() => {
          deletion.reset();
          setOpen(true);
          void detail.refetch();
        }}
      >
        <Trash2 data-icon="inline-start" />
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!deletion.isPending) setOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصورة من المكتبة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيحذف سجل «{asset.fileName}» من قاعدة البيانات. يبقى الملف على الخادم للاستعادة؛ لن
              تُحذف أي ملفات نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RegisteredImage
            assetId={asset.id}
            alt={asset.fileName}
            className="h-40 w-full rounded-xl bg-muted"
          />
          {(detail.isError || detail.data?.deleteBlockedReason || deletion.isError) && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر حذف الصورة</AlertTitle>
              <AlertDescription>
                {deletion.error?.message ??
                  detail.error?.message ??
                  detail.data?.deleteBlockedReason}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                detail.isFetching ||
                !detail.data ||
                detail.isError ||
                Boolean(detail.data.deleteBlockedReason) ||
                deletion.isPending
              }
              onClick={() => deletion.mutate()}
            >
              {deletion.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              حذف من المكتبة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

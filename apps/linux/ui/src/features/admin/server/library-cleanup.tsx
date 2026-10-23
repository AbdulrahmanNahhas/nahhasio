import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";

import type { ImageAsset } from "../images/images-model";
import { deleteImage, imageOptions, imagesOptions } from "../images/images.queries";

export function LibraryCleanup({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const [candidates, setCandidates] = useState<ImageAsset[]>([]);
  const [protectedCount, setProtectedCount] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ removed: number; errors: string[] } | null>(null);
  const stop = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);
  const preview = useMutation({
    mutationFn: async () => {
      const snapshot: ImageAsset[] = [];
      let total: number | undefined;
      for (let page = 1; page <= 209; page++) {
        if (stop.current) throw new Error("أُلغيت المعاينة.");
        const data = await client.fetchQuery({
          ...imagesOptions({
            q: "",
            page,
            pageSize: 48,
            usage: "unassigned",
            health: "all",
            role: "all",
            sort: "oldest",
          }),
          staleTime: 0,
        });
        total ??= data.total;
        if (total > 10000)
          throw new Error("أكثر من 10000 صورة؛ استخدم مكتبة الصور لتنظيف دفعات أصغر.");
        if (total !== data.total) throw new Error("تغيّرت المكتبة أثناء المعاينة؛ أعد المعاينة.");
        snapshot.push(...data.items);
        if (snapshot.length >= total) break;
      }
      if (new Set(snapshot.map((asset) => asset.id)).size !== snapshot.length)
        throw new Error("تغيّرت قائمة الصور؛ أعد المعاينة.");
      const eligible: ImageAsset[] = [];
      let protectedImages = 0;
      for (const asset of snapshot) {
        if (stop.current) throw new Error("أُلغيت المعاينة.");
        const detail = await client.fetchQuery({ ...imageOptions(asset.id), staleTime: 0 });
        if (detail.deleteBlockedReason) protectedImages++;
        else eligible.push(asset);
      }
      return { eligible, protectedImages };
    },
    onSuccess: (data) => {
      setCandidates(data.eligible);
      setProtectedCount(data.protectedImages);
      setResult(null);
    },
  });
  const deletion = useMutation({
    mutationFn: async () => {
      const errors: string[] = [];
      let removed = 0;
      for (let index = 0; index < candidates.length; index++) {
        if (stop.current) break;
        const asset = candidates[index];
        try {
          await deleteImage({ id: asset.id, expectedSha256: asset.sha256 });
          removed++;
        } catch (error) {
          errors.push(
            `${asset.fileName}: ${error instanceof Error ? error.message : "تعذّر الحذف"}`,
          );
        }
        if (alive.current) setProgress(index + 1);
      }
      return { removed, errors };
    },
    onSuccess: async (data) => {
      if (alive.current) setResult(data);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin", "images"] }),
        client.invalidateQueries({ queryKey: ["admin", "server"] }),
        client.invalidateQueries({ queryKey: ["admin", "database"] }),
      ]);
    },
  });
  const busy = preview.isPending || deletion.isPending;
  useBlocker({ shouldBlockFn: () => busy, enableBeforeUnload: busy });
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !busy) onClose();
        }}
      >
        <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>تنظيف الصور غير المرتبطة</DialogTitle>
            <DialogDescription>
              معاينة كل الصور غير المرتبطة، واستبعاد الصور المحمية بالمراجعات أو النسخ المشتقة. تُحذف
              السجلات فقط وتبقى الملفات على الخادم للاستعادة.
            </DialogDescription>
          </DialogHeader>
          {!preview.isSuccess ? (
            <Button
              disabled={busy}
              onClick={() => {
                stop.current = false;
                preview.mutate();
              }}
            >
              {preview.isPending && <Spinner data-icon="inline-start" />}معاينة الصور
            </Button>
          ) : (
            <>
              <p>
                {candidates.length} صورة قابلة للحذف · {protectedCount} صورة محمية
              </p>
              <ul className="flex max-h-56 scroll-fade-y flex-col gap-2 overflow-y-auto text-sm">
                {candidates.map((asset) => (
                  <li key={asset.id}>
                    <bdi>{asset.fileName}</bdi>
                  </li>
                ))}
              </ul>
              {deletion.isPending && (
                <Progress
                  value={candidates.length ? (progress / candidates.length) * 100 : 0}
                  aria-label="تقدم حذف الصور"
                />
              )}
              {result && (
                <Alert>
                  <AlertTitle>انتهت العملية</AlertTitle>
                  <AlertDescription>
                    {result.removed} حُذفت · {result.errors.length} تعذّرت ·{" "}
                    {candidates.length - progress} لم تُعالج
                    {result.errors.length > 0 && (
                      <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
                        {[...new Set(result.errors)].map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
          {preview.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّرت المعاينة</AlertTitle>
              <AlertDescription>{preview.error.message}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            {busy ? (
              <Button
                variant="outline"
                onClick={() => {
                  stop.current = true;
                }}
              >
                إيقاف بعد الصورة الحالية
              </Button>
            ) : (
              <Button variant="outline" disabled={busy} onClick={onClose}>
                إغلاق
              </Button>
            )}
            {preview.isSuccess && !result && (
              <Button
                variant="destructive"
                disabled={busy || !candidates.length}
                onClick={() => setConfirm(true)}
              >
                <Trash2 data-icon="inline-start" />
                حذف {candidates.length} صورة
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف {candidates.length} صورة من المكتبة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف فقط ما راجعته في المعاينة. تُراجع الروابط والحماية مجددًا عند الحذف، وتبقى الملفات
              الفعلية للاستعادة. قد تنجح بعض الصور وتتعذّر أخرى؛ ستظهر النتيجة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirm(false);
                stop.current = false;
                setProgress(0);
                deletion.mutate();
              }}
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WandSparkles } from "lucide-react";
import { useState } from "react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { gateway } from "@/lib/bridge";

export function ImageRename({ ids, onRenamed }: { ids: string[]; onRenamed: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const preview = useQuery({
    queryKey: ["admin", "images", "rename-preview", ids],
    enabled: open && ids.length > 0,
    staleTime: 0,
    queryFn: async ({ signal }) =>
      rpcResults.assetRenamePreview.parse(
        await gateway.editorCall({ operation: "assetRenamePreview", data: { ids } }, signal),
      ),
  });
  const selected =
    preview.data?.filter((item) => !item.reason && !excluded.includes(item.id)) ?? [];
  const rename = useMutation({
    mutationFn: async () =>
      rpcResults.assetRename.parse(
        await gateway.editorCall({
          operation: "assetRename",
          data: {
            items: selected.map(({ id, oldPath, newFileName, sha256 }) => ({
              id,
              oldPath,
              newFileName,
              sha256,
            })),
          },
        }),
      ),
    onSuccess: async (result) => {
      setOpen(false);
      await onRenamed();
      toast.add({
        type: "success",
        title: "تم تنظيم أسماء الصور",
        description: `عدد الصور: ${new Intl.NumberFormat("ar").format(result.renamed)}`,
      });
    },
  });
  return (
    <>
      <Button
        variant="outline"
        disabled={!ids.length}
        onClick={() => {
          setExcluded([]);
          rename.reset();
          setOpen(true);
        }}
      >
        <WandSparkles data-icon="inline-start" />
        تنظيم الأسماء
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!rename.isPending) setOpen(next);
        }}
      >
        <DialogContent
          className="max-h-11/12 overflow-y-auto sm:max-w-4xl"
          showCloseButton={!rename.isPending}
        >
          <DialogHeader>
            <DialogTitle>مراجعة أسماء الصور</DialogTitle>
            <DialogDescription>
              صور الصفحة الحالية، حتى ٥٠ صورة في الدفعة. الاسم يتبع العمل والجزء والحلقة والدور، مع
              معرّف قصير لتجنب التكرار. الملفات ذات الروابط الغامضة أو المشاكل تُستثنى.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            يتغير اسم الملف المسجّل على الخادم. يبقى المسار القديم رابطاً صلباً إلى نفس البيانات لحماية
            المراجعات والمسارات المحفوظة، دون نسخ الصورة.
          </p>
          {preview.isPending ? (
            <Skeleton className="h-64" />
          ) : preview.isError ? (
            <Alert variant="destructive">
              <AlertTitle>تعذّرت معاينة الأسماء</AlertTitle>
              <AlertDescription>{preview.error.message}</AlertDescription>
              <Button variant="outline" onClick={() => void preview.refetch()}>
                إعادة المحاولة
              </Button>
            </Alert>
          ) : (
            <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>
                      <span className="sr-only">الاختيار</span>
                    </TableHead>
                    <TableHead>الاسم الحالي</TableHead>
                    <TableHead>الاسم المقترح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`تنظيم ${item.oldFileName}`}
                          disabled={Boolean(item.reason) || rename.isPending}
                          checked={!item.reason && !excluded.includes(item.id)}
                          onCheckedChange={(checked) =>
                            setExcluded((previous) =>
                              checked
                                ? previous.filter((id) => id !== item.id)
                                : [...previous, item.id],
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-64 truncate" title={item.oldPath} dir="auto">
                          {item.oldFileName}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.reason ? (
                          <span className="text-xs text-muted-foreground">{item.reason}</span>
                        ) : (
                          <span className="block max-w-96 break-all" dir="auto">
                            {item.newFileName}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {rename.isError && (
            <Alert variant="destructive">
              <AlertTitle>لم تتغيّر سجلات الصور</AlertTitle>
              <AlertDescription>
                {rename.error.message} أعد المعاينة إذا تغيّر الربط أو الملف.
              </AlertDescription>
              <Button
                variant="outline"
                disabled={rename.isPending}
                onClick={() => void preview.refetch()}
              >
                تحديث المعاينة
              </Button>
            </Alert>
          )}
          <DialogFooter>
            <Badge variant="secondary">{selected.length} صور مختارة</Badge>
            <Button variant="outline" disabled={rename.isPending} onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button
              disabled={
                !selected.length || preview.isFetching || preview.isError || rename.isPending
              }
              onClick={() => rename.mutate()}
            >
              {rename.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <WandSparkles data-icon="inline-start" />
              )}
              تأكيد إعادة التسمية
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

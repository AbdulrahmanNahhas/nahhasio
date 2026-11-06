import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

import type { ImageFilters } from "./images-model";

export function ImageRename({
  ids,
  filters,
  onRenamed,
}: {
  ids: string[];
  filters: ImageFilters;
  onRenamed: () => Promise<void>;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [scanned, setScanned] = useState(0);
  const preview = useQuery({
    queryKey: ["admin", "images", "rename-preview", filters],
    enabled: open && ids.length > 0,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const proposals: Array<ReturnType<typeof rpcResults.assetRenamePreview.parse>[number]> = [];
      setScanned(0);
      for (let page = 1; ; page++) {
        signal.throwIfAborted();
        const assets = rpcResults.assets.parse(
          await gateway.editorCall(
            { operation: "assets", data: { ...filters, page, pageSize: 48 } },
            signal,
          ),
        );
        if (assets.total > 5000)
          throw new Error("أكثر من 5000 صورة مطابقة؛ ضيّق المرشحات قبل تنظيم الأسماء.");
        if (assets.items.length)
          proposals.push(
            ...rpcResults.assetRenamePreview.parse(
              await gateway.editorCall(
                {
                  operation: "assetRenamePreview",
                  data: { ids: assets.items.map((item) => item.id) },
                },
                signal,
              ),
            ),
          );
        setScanned(proposals.length);
        if (page * 48 >= assets.total || !assets.items.length) break;
      }
      return proposals.filter((item) => item.reason !== "الاسم منظم بالفعل");
    },
  });
  const selected =
    preview.data?.filter(
      (item) => !item.reason && !excluded.includes(item.id) && !completed.includes(item.id),
    ) ?? [];
  const rename = useMutation({
    mutationFn: async () => {
      let renamed = 0;
      for (let offset = 0; offset < selected.length; offset += 50) {
        const batch = selected.slice(offset, offset + 50);
        const result = rpcResults.assetRename.parse(
          await gateway.editorCall({
            operation: "assetRename",
            data: {
              items: batch.map(({ id, oldPath, newFileName, sha256 }) => ({
                id,
                oldPath,
                newFileName,
                sha256,
              })),
            },
          }),
        );
        renamed += result.renamed;
        setCompleted((previous) => [...previous, ...batch.map((item) => item.id)]);
      }
      return { renamed };
    },
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
          setCompleted([]);
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
          if (!rename.isPending) {
            if (!next)
              void client.cancelQueries({
                queryKey: ["admin", "images", "rename-preview", filters],
              });
            setOpen(next);
          }
        }}
      >
        <DialogContent
          className="max-h-11/12 overflow-y-auto sm:max-w-4xl"
          showCloseButton={!rename.isPending}
        >
          <DialogHeader>
            <DialogTitle>مراجعة أسماء الصور</DialogTitle>
            <DialogDescription>
              جميع الصور المطابقة للمرشحات، وليس الصفحة الحالية فقط، حتى 5000 صورة. تُخفى الأسماء
              المنظمة بالفعل. الصور المشتركة ضمن العمل نفسه تستخدم اسم العمل؛ الروابط بين أعمال
              مختلفة تحتاج مراجعة.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            يتغير اسم الملف المسجّل على الخادم. يبقى المسار القديم رابطاً صلباً إلى نفس البيانات لحماية
            المراجعات والمسارات المحفوظة، دون نسخ الصورة.
          </p>
          {preview.isPending ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">جارٍ فحص الصور: {scanned}</p>
              <Skeleton className="h-64" />
            </div>
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
                          disabled={
                            Boolean(item.reason) || completed.includes(item.id) || rename.isPending
                          }
                          checked={
                            !item.reason &&
                            !excluded.includes(item.id) &&
                            !completed.includes(item.id)
                          }
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
              <AlertTitle>
                {completed.length ? "اكتملت بعض الدفعات؛ تعذّر إكمال الباقي" : "تعذّر تنظيم الأسماء"}
              </AlertTitle>
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
          {preview.isSuccess && !preview.data.length && (
            <p role="status" className="text-sm text-muted-foreground">
              فُحصت {scanned} صورة؛ لا توجد أسماء تحتاج إلى تغيير.
            </p>
          )}
          <DialogFooter>
            {!!completed.length && (
              <Badge variant="outline">{completed.length} نُظّمت؛ إعادة المحاولة تتجاوزها</Badge>
            )}
            <Badge variant="secondary">{selected.length} صور مختارة</Badge>
            <Button
              variant="outline"
              disabled={rename.isPending}
              onClick={() => {
                void client.cancelQueries({
                  queryKey: ["admin", "images", "rename-preview", filters],
                });
                setOpen(false);
              }}
            >
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

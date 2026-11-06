import {
  DeviceMediaBatchRequestSchema,
  DeviceMediaBatchResultSchema,
  ServerMediaFilesSchema,
} from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { nativeCall } from "@/lib/bridge";

import { formatSourceSize } from "./source-format";

export function HomeBatchDownload({ workId }: { workId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        تنزيل حلقات من مكتبة المنزل
      </DialogTrigger>
      <DialogContent className="max-h-5/6 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>تنزيل فيديوهات إلى هذا الجهاز</DialogTitle>
          <DialogDescription>
            اختر النسخ المطلوبة من مكتبة المنزل. تُحفظ بيانات العمل وصوره تلقائيًا، ثم يبدأ تنزيل
            الفيديوهات. لا يُحذف شيء من الخادم.
          </DialogDescription>
        </DialogHeader>
        {open && <BatchSelection workId={workId} />}
      </DialogContent>
    </Dialog>
  );
}
function BatchSelection({ workId }: { workId: string }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const files = useQuery({
    queryKey: ["viewer", "home-media", workId],
    queryFn: async ({ signal }) =>
      ServerMediaFilesSchema.parse(await nativeCall("homeMedia", { id: workId }, signal)),
    retry: false,
  });
  const available =
    files.data?.filter(
      (file) => file.availability === "present" && !file.isTrashed && Boolean(file.sha256),
    ) ?? [];
  const picked = available.filter((file) => selected.includes(file.id));
  const action = useMutation({
    mutationFn: async () =>
      DeviceMediaBatchResultSchema.parse(
        await nativeCall(
          "media.homeDownloadBatch",
          DeviceMediaBatchRequestSchema.parse({ workId, fileIds: picked.map((file) => file.id) }),
        ),
      ),
    onSuccess: async (results) => {
      setSelected((previous) =>
        previous.filter((id) => !results.some((result) => result.id === id && result.queued)),
      );
      await client.invalidateQueries({ queryKey: ["native", "downloads"] });
      await client.invalidateQueries({ queryKey: ["offline"] });
    },
    retry: false,
    networkMode: "always",
  });
  return (
    <div className="flex flex-col gap-4">
      {files.isPending && <p role="status">جارٍ فحص مكتبة المنزل…</p>}
      {files.error && (
        <Alert variant="destructive">
          <AlertDescription>
            مكتبة المنزل غير متاحة؛ تحتاج إلى الاتصال بالشبكة المنزلية.
          </AlertDescription>
        </Alert>
      )}
      {files.isSuccess && !available.length && (
        <p>لا توجد فيديوهات متحقّق منها لهذا العمل في مكتبة المنزل.</p>
      )}
      {available.length > 0 && (
        <>
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() => {
              const seen = new Set<string>();
              setSelected(
                available
                  .filter((file) => {
                    const key = file.episodeId ?? file.installmentId;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  })
                  .slice(0, 100)
                  .map((file) => file.id),
              );
            }}
          >
            تحديد نسخة لكل حلقة أو فيلم — حتى 100
          </Button>
          <FieldGroup>
            {available.map((file) => (
              <Field key={file.id} orientation="horizontal">
                <Checkbox
                  id={`batch-${file.id}`}
                  checked={selected.includes(file.id)}
                  disabled={action.isPending}
                  onCheckedChange={(checked) =>
                    setSelected((previous) =>
                      checked
                        ? [
                            ...previous.filter((id) => {
                              const other = available.find((candidate) => candidate.id === id);
                              return (
                                other &&
                                (other.episodeId ?? other.installmentId) !==
                                  (file.episodeId ?? file.installmentId)
                              );
                            }),
                            file.id,
                          ]
                        : previous.filter((id) => id !== file.id),
                    )
                  }
                />
                <FieldLabel htmlFor={`batch-${file.id}`}>
                  {file.installmentTitle} · {file.episodeNumber ? `${file.episodeNumber} · ` : ""}
                  {file.episodeTitle ?? "فيلم"} · {formatSourceSize(file.byteSize ?? 0)}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
          <p>
            {picked.length} فيديو ·{" "}
            {formatSourceSize(picked.reduce((sum, file) => sum + (file.byteSize ?? 0), 0))}. يمكن
            إيقاف كل تنزيل أو استئنافه من مكتبة الجهاز.
          </p>
          <Button
            disabled={!picked.length || picked.length > 100 || action.isPending}
            onClick={() => action.mutate()}
          >
            {action.isPending
              ? "جارٍ حفظ بيانات العمل وإضافة التنزيلات…"
              : "تأكيد التنزيل إلى الجهاز"}
          </Button>
        </>
      )}
      {action.error && (
        <Alert variant="destructive">
          <AlertDescription>{action.error.message}</AlertDescription>
        </Alert>
      )}
      {action.data && (
        <div role="status">
          <p>أُضيف {action.data.filter((result) => result.queued).length} فيديو إلى التنزيلات.</p>
          {action.data
            .filter((result) => !result.queued)
            .map((result) => (
              <p key={result.id}>{result.error}</p>
            ))}
        </div>
      )}
    </div>
  );
}

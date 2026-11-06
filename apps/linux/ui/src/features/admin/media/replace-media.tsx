import { MediaQueuedSchema, type ServerMediaFile } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { formatSourceSize } from "@/features/player/source-format";
import { nativeCall } from "@/lib/bridge";

import { unitFilesOptions } from "./media-data";

export function ReplaceMedia({
  file,
  control,
}: {
  file: ServerMediaFile;
  control?: { open: boolean; onOpenChange: (open: boolean) => void };
}) {
  const client = useQueryClient();
  const [localOpen, setLocalOpen] = useState(false);
  const open = control?.open ?? localOpen;
  const setOpen = control?.onOpenChange ?? setLocalOpen;
  const [replacement, setReplacement] = useState("");
  const [page, setPage] = useState(1);
  const alternatives = useQuery({
    ...unitFilesOptions(file.workId, file.installmentId, file.episodeId ?? "none", page),
    enabled: open,
    retry: false,
  });
  const available =
    alternatives.data?.items.filter(
      (candidate) =>
        candidate.id !== file.id &&
        candidate.installmentId === file.installmentId &&
        candidate.episodeId === file.episodeId &&
        candidate.availability === "present" &&
        !candidate.isTrashed &&
        Boolean(candidate.lastVerifiedAt && candidate.sha256),
    ) ?? [];
  const selected = available.find((candidate) => candidate.id === replacement);
  const action = useMutation({
    mutationFn: async () =>
      MediaQueuedSchema.parse(
        await nativeCall("adminMediaFile", {
          id: file.id,
          action: "replace",
          replacementFileId: replacement,
          expectedRevision: file.revision,
        }),
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin", "media"] });
      await client.invalidateQueries({ queryKey: ["viewer", "home-media", file.workId] });
    },
    retry: false,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!control && (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          استبدال بنسخة أخرى
        </DialogTrigger>
      )}
      <DialogContent className="max-h-5/6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>مراجعة استبدال الفيديو</DialogTitle>
          <DialogDescription>
            استورد النسخة الجديدة واربطها بالحلقة نفسها أولًا. بعد التحقق من النسخة الجديدة، يُنقل
            الفيديو الحالي وترجماته إلى المحذوفات لمدة سبعة أيام. تبقى بيانات الحلقة والمشاهدة.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>النسخة الجديدة</FieldLabel>
          <Choice
            label="النسخة البديلة المتحقق منها"
            value={replacement}
            onChange={setReplacement}
            options={available.map((candidate) => ({
              value: candidate.id,
              label: `${candidate.relativePath} · ${formatSourceSize(candidate.byteSize ?? 0)}`,
            }))}
          />
          <FieldDescription>تُعرض النسخ المتحقق منها للحلقة أو الفيلم نفسه فقط.</FieldDescription>
        </Field>
        {alternatives.data && alternatives.data.total > alternatives.data.pageSize && (
          <nav className="flex items-center justify-between gap-2" aria-label="صفحات النسخ البديلة">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => {
                setPage(page - 1);
                setReplacement("");
              }}
            >
              السابق
            </Button>
            <span className="text-sm text-muted-foreground">الصفحة {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page * alternatives.data.pageSize >= alternatives.data.total}
              onClick={() => {
                setPage(page + 1);
                setReplacement("");
              }}
            >
              التالي
            </Button>
          </nav>
        )}
        {selected && (
          <dl className="flex flex-col gap-2">
            <dt>إلى المحذوفات</dt>
            <dd className="break-all" dir="auto">
              {file.relativePath} · {formatSourceSize(file.byteSize ?? 0)}
            </dd>
            <dt>تبقى متاحة للمشاهدة</dt>
            <dd className="break-all" dir="auto">
              {selected.relativePath} · {formatSourceSize(selected.byteSize ?? 0)}
            </dd>
          </dl>
        )}
        {alternatives.isPending && <p role="status">جارٍ فحص النسخ المتاحة…</p>}
        {alternatives.isSuccess && !available.length && (
          <p>
            لا توجد نسخة بديلة متحقق منها في هذه الصفحة. استورد نسخة جديدة أو تحقّق من نسختها قبل
            الاستبدال.
          </p>
        )}
        {(alternatives.error ?? action.error) && (
          <Alert variant="destructive">
            <AlertDescription>{(alternatives.error ?? action.error)?.message}</AlertDescription>
          </Alert>
        )}
        {action.isSuccess ? (
          <p role="status">أُضيفت مهمة الاستبدال. تابع نتيجتها قبل حذف أي ملفات يدويًا.</p>
        ) : (
          <Button disabled={!selected || action.isPending} onClick={() => action.mutate()}>
            {action.isPending
              ? "جارٍ إضافة مهمة الاستبدال…"
              : "تأكيد الاستبدال ونقل النسخة الحالية إلى المحذوفات"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldGroup, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

import {
  entityDeletePreviewOptions,
  bulkDeleteEntities,
  type EntityKind,
} from "./entities.queries";

export function EntityDelete({
  kind,
  ids,
  open,
  onOpenChange,
  onDeleted,
}: {
  kind: EntityKind;
  ids: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent className="max-h-11/12 overflow-y-auto sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            مراجعة حذف {ids.length} {kind === "person" ? "شخص" : "استوديو"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            تحذف السجلات وأسماءها وروابط صورها. الأعمال وملفات الصور تبقى محفوظة. راجع التأثير وأكد
            العدد قبل التنفيذ.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {open && (
          <DeleteReview
            key={ids.join(":")}
            kind={kind}
            ids={ids}
            onOpenChange={onOpenChange}
            onDeleted={onDeleted}
            onBusy={setBusy}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
function DeleteReview({
  kind,
  ids,
  onOpenChange,
  onDeleted,
  onBusy,
}: {
  kind: EntityKind;
  ids: string[];
  onOpenChange: (open: boolean) => void;
  onDeleted: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const preview = useQuery(entityDeletePreviewOptions(kind, ids));
  const [removeCredits, setRemoveCredits] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const credits =
    preview.data?.reduce((total, value) => total + value.draft.credits.length, 0) ?? 0;
  const blocked =
    preview.data?.some((value) => value.links.some((link) => link.table !== "contributions")) ??
    true;
  const remove = useMutation({
    onMutate: () => onBusy(true),
    onSettled: () => onBusy(false),
    mutationFn: () => {
      if (!preview.data) throw new Error("راجع التأثير أولاً.");
      return bulkDeleteEntities({
        kind,
        records: preview.data.map((value) => ({ id: value.entity.id, revision: value.revision })),
        removeCredits,
      });
    },
    onSuccess: async (result) => {
      onOpenChange(false);
      await onDeleted();
      toast.add({
        type: "success",
        title: "حُذفت السجلات",
        description: `${result.deleted} سجل · ${result.removedCredits} مساهمة أُزيلت`,
      });
    },
  });
  return (
    <>
      {preview.isPending ? (
        <Skeleton className="h-40" />
      ) : preview.isError ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّرت مراجعة الحذف</AlertTitle>
          <AlertDescription>{preview.error.message}</AlertDescription>
        </Alert>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>السجل</TableHead>
              <TableHead>الأعمال</TableHead>
              <TableHead>المساهمات</TableHead>
              <TableHead>الحالة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.data.map((value) => (
              <TableRow key={value.entity.id}>
                <TableCell dir="auto">{value.entity.name}</TableCell>
                <TableCell>{value.entity.workCount}</TableCell>
                <TableCell>{value.draft.credits.length}</TableCell>
                <TableCell>
                  {value.links.some((link) => link.table !== "contributions")
                    ? "محمي بروابط أخرى"
                    : "يمكن حذفه"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {blocked && preview.data && (
        <Alert variant="destructive">
          <AlertTitle>بعض السجلات مرتبطة بسياسات أو مراجع أو علاقات</AlertTitle>
          <AlertDescription>
            ألغِ اختيار السجلات المحمية أو أزل روابطها من صفحاتها. لن تحذف الدفعة جزئياً.
          </AlertDescription>
        </Alert>
      )}
      <fieldset disabled={remove.isPending}>
        <FieldGroup>
          {credits > 0 && (
            <Field orientation="horizontal">
              <Checkbox
                id="delete-entity-credits"
                checked={removeCredits}
                onCheckedChange={(checked) => setRemoveCredits(checked === true)}
              />
              <FieldLabel htmlFor="delete-entity-credits">
                أوافق على إزالة {credits} مساهمة من الأعمال، دون حذف الأعمال
              </FieldLabel>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="delete-entity-count">
              اكتب عدد السجلات للتأكيد: {ids.length}
            </FieldLabel>
            <Input
              id="delete-entity-count"
              dir="ltr"
              inputMode="numeric"
              value={confirmation}
              onChange={(event) =>
                setConfirmation(
                  event.target.value.replace(/[٠-٩۰-۹]/g, (digit) =>
                    String(digit.charCodeAt(0) - (digit >= "۰" ? 1776 : 1632)),
                  ),
                )
              }
            />
            <FieldDescription>التأكيد ينطبق على هذه الدفعة فقط.</FieldDescription>
          </Field>
        </FieldGroup>
      </fieldset>
      {remove.isError && (
        <Alert variant="destructive">
          <AlertTitle>لم تحذف الدفعة</AlertTitle>
          <AlertDescription>{remove.error.message}</AlertDescription>
        </Alert>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={remove.isPending}>إلغاء</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={
            blocked ||
            !preview.data ||
            preview.isFetching ||
            confirmation.trim() !== String(ids.length) ||
            (credits > 0 && !removeCredits) ||
            remove.isPending
          }
          onClick={() => remove.mutate()}
        >
          {remove.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Trash2 data-icon="inline-start" />
          )}
          تأكيد حذف {ids.length}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

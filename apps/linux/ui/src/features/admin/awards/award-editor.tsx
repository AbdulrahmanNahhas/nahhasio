import { awardDrafts } from "@arcadia/contracts/editor-rpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";
import { ReferenceField } from "@/features/editor/references/reference-field";
import { useConfirm } from "@/features/editor/use-confirm";

import {
  awardDetailQuery,
  awardLabel,
  deleteAward,
  saveAward,
  text,
  type AwardDetail,
  type AwardRow,
  type DefinitionTable,
} from "./awards.queries";

const labels = new Map(
  Object.entries({
    slug: "الرمز",
    name_ar: "الاسم العربي",
    name_en: "الاسم الإنجليزي",
    description: "الوصف",
    website_url: "الموقع الرسمي",
    logo_path: "مسار الشعار المسجل",
    is_active: "نشط",
    organization_id: "الجهة المانحة",
    year: "السنة",
    edition: "رقم الدورة",
    label: "اسم الدورة",
    held_on: "تاريخ الحفل",
    source_url: "المصدر",
  }),
);
const defaults = new Map<DefinitionTable, AwardRow>([
  [
    "award_organizations",
    {
      slug: "",
      name_ar: "",
      name_en: null,
      description: "",
      website_url: null,
      logo_path: null,
      is_active: true,
    },
  ],
  [
    "award_categories",
    {
      organization_id: "",
      slug: "",
      name_ar: "",
      name_en: null,
      description: "",
      is_active: true,
    },
  ],
  [
    "award_ceremonies",
    {
      organization_id: "",
      year: new Date().getFullYear(),
      edition: null,
      label: "",
      held_on: null,
      source_url: null,
    },
  ],
]);
export function AwardEditor({
  table,
  id,
  organization,
  onClose,
}: {
  table: DefinitionTable;
  id: string | null;
  organization: string;
  onClose: () => void;
}) {
  const detail = useQuery({ ...awardDetailQuery(table, id ?? ""), enabled: !!id });
  if (id && detail.isPending)
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تحميل السجل</DialogTitle>
            <DialogDescription>جارٍ قراءة أحدث بياناته وارتباطاته.</DialogDescription>
          </DialogHeader>
          <Skeleton className="h-72" />
        </DialogContent>
      </Dialog>
    );
  if (id && detail.isError)
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعذّر فتح السجل</DialogTitle>
            <DialogDescription>{detail.error.message}</DialogDescription>
          </DialogHeader>
          <Button onClick={() => void detail.refetch()}>إعادة المحاولة</Button>
        </DialogContent>
      </Dialog>
    );
  return (
    <DefinitionForm
      key={detail.data?.revision ?? "new"}
      table={table}
      detail={id ? (detail.data ?? null) : null}
      organization={organization}
      onClose={onClose}
    />
  );
}
function DefinitionForm({
  table,
  detail,
  organization,
  onClose,
}: {
  table: DefinitionTable;
  detail: AwardDetail | null;
  organization: string;
  onClose: () => void;
}) {
  const [initial] = useState<AwardRow>(() =>
    Object.fromEntries(
      Object.keys(defaults.get(table) ?? {}).map((key) => [
        key,
        detail
          ? (detail.row[key] ?? null)
          : key === "organization_id"
            ? organization
            : (defaults.get(table)?.[key] ?? null),
      ]),
    ),
  );
  const [draft, setDraft] = useState(initial);
  const [review, setReview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [committed, setCommitted] = useState(false);
  const client = useQueryClient();
  const confirm = useConfirm();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const blocker = useBlocker({
    withResolver: true,
    shouldBlockFn: () => dirty && !committed,
    enableBeforeUnload: dirty && !committed,
  });
  const save = useMutation({
    mutationFn: () =>
      saveAward({
        table,
        id: detail ? text(detail.row, "id") : null,
        revision: detail?.revision ?? null,
        draft: awardDrafts[table].parse(draft),
      }),
    onSuccess: async () => {
      setCommitted(true);
      await invalidateCatalogEdit(client);
      toast.add({ type: "success", title: "حُفظ سجل الجائزة" });
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => {
      if (!detail) throw new Error("السجل غير موجود");
      return deleteAward({
        table,
        id: text(detail.row, "id"),
        revision: detail.revision,
        confirmation,
      });
    },
    onSuccess: async () => {
      setCommitted(true);
      await invalidateCatalogEdit(client);
      toast.add({ type: "success", title: "حُذف السجل غير المرتبط" });
      onClose();
    },
  });
  const busy = save.isPending || remove.isPending;
  const changed = Object.keys(initial).filter(
    (key) => JSON.stringify(initial[key]) !== JSON.stringify(draft[key]),
  );
  const title = detail
    ? awardLabel(detail.row)
    : table === "award_organizations"
      ? "جهة مانحة جديدة"
      : table === "award_categories"
        ? "فئة جديدة"
        : "دورة جديدة";
  const expected = detail
    ? table === "award_ceremonies"
      ? String(detail.row.year)
      : text(detail.row, "slug")
    : "";
  async function close() {
    if (busy) return;
    if (dirty && !(await confirm.confirm("تجاهل التغييرات غير المحفوظة؟"))) return;
    onClose();
  }
  function update(key: string, value: AwardRow[string]) {
    setDraft((old) => ({ ...old, [key]: value }));
    setMessage("");
    save.reset();
  }
  function prepare() {
    const parsed = awardDrafts[table].safeParse(draft);
    if (!parsed.success) {
      setMessage(
        parsed.error.issues
          .map((issue) => `${labels.get(String(issue.path[0])) ?? "الحقل"}: ${issue.message}`)
          .join(" · "),
      );
      return;
    }
    setReview(true);
  }
  return (
    <>
      {confirm.dialog}
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) void close();
        }}
      >
        <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-3xl" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              راجع التغييرات قبل حفظها. تعطيل الجهة أو الفئة يحفظ تاريخها وارتباطاتها.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid sm:grid-cols-2">
            {Object.keys(initial).map((key) =>
              key === "organization_id" ? (
                <ReferenceField
                  key={key}
                  table="award_organizations"
                  label="الجهة المانحة"
                  value={text(draft, key)}
                  useIdValue
                  onChange={(value) => update(key, value)}
                />
              ) : key === "is_active" ? (
                <Field key={key} orientation="horizontal">
                  <Switch
                    id={`award-${key}`}
                    checked={draft[key] === true}
                    onCheckedChange={(value) => update(key, value)}
                  />
                  <FieldLabel htmlFor={`award-${key}`}>نشط</FieldLabel>
                </Field>
              ) : (
                <Field key={key} className={key === "description" ? "sm:col-span-2" : undefined}>
                  <FieldLabel htmlFor={`award-${key}`}>{labels.get(key)}</FieldLabel>
                  {key === "description" ? (
                    <Textarea
                      id={`award-${key}`}
                      rows={4}
                      maxLength={20000}
                      value={text(draft, key)}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  ) : (
                    <Input
                      id={`award-${key}`}
                      type={
                        key === "year" || key === "edition"
                          ? "number"
                          : key === "held_on"
                            ? "date"
                            : key.endsWith("url")
                              ? "url"
                              : "text"
                      }
                      min={key === "year" ? 1900 : key === "edition" ? 1 : undefined}
                      max={key === "year" ? 2100 : undefined}
                      dir={key === "name_ar" || key === "label" ? "auto" : "ltr"}
                      maxLength={key === "slug" ? 100 : 2000}
                      value={draft[key] == null ? "" : String(draft[key])}
                      onChange={(e) =>
                        update(
                          key,
                          key === "year" || key === "edition"
                            ? e.target.value === ""
                              ? null
                              : Number(e.target.value)
                            : e.target.value === "" &&
                                [
                                  "name_en",
                                  "website_url",
                                  "logo_path",
                                  "held_on",
                                  "source_url",
                                ].includes(key)
                              ? null
                              : e.target.value,
                        )
                      }
                    />
                  )}
                  {key === "logo_path" && (
                    <FieldDescription>
                      مسار صورة موجودة في مكتبة الصور، يبدأ بـ /media/.
                    </FieldDescription>
                  )}
                  {key === "slug" && (
                    <FieldDescription>
                      رمز فريد بحروف إنجليزية صغيرة وأرقام وشرطات.
                    </FieldDescription>
                  )}
                </Field>
              ),
            )}
          </FieldGroup>
          {(message || save.error || remove.error) && (
            <Alert variant="destructive">
              <AlertTitle>لم يُحفظ التغيير</AlertTitle>
              <AlertDescription>
                {message || save.error?.message || remove.error?.message}
              </AlertDescription>
            </Alert>
          )}
          {detail && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                الارتباطات ومعلومات السجل
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {detail.links.length ? (
                    detail.links.map((link) => (
                      <Badge key={link.table} variant="outline">
                        {link.table}: {link.count}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">لا توجد ارتباطات</Badge>
                  )}
                </div>
                <p dir="ltr" className="break-all text-xs text-muted-foreground">
                  {text(detail.row, "id")}
                  <br />
                  Created: {text(detail.row, "created_at")}
                  <br />
                  Updated: {text(detail.row, "updated_at")}
                </p>
              </div>
            </details>
          )}
          <DialogFooter>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              {detail ? (
                <Button
                  variant="ghost"
                  disabled={busy || detail.links.length > 0}
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  حذف السجل غير المرتبط
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" disabled={busy} onClick={() => void close()}>
                  إلغاء
                </Button>
                <Button disabled={busy || !dirty} onClick={prepare}>
                  <Check data-icon="inline-start" />
                  مراجعة التغييرات
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={review}
        onOpenChange={(open) => {
          if (!busy) setReview(open);
        }}
      >
        <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-3xl" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>مراجعة {title}</DialogTitle>
            <DialogDescription>
              {changed.length} حقل متغيّر. الأسماء المحفوظة في نتائج الأعمال تبقى كسجل تاريخي؛ تحرير
              النتائج من محرر العمل.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الحقل</TableHead>
                <TableHead>قبل</TableHead>
                <TableHead>بعد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changed.map((key) => (
                <TableRow key={key}>
                  <TableCell>{labels.get(key)}</TableCell>
                  <TableCell className="max-w-64 whitespace-pre-wrap break-all">
                    {String(initial[key] ?? "—")}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-pre-wrap break-all">
                    {String(draft[key] ?? "—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {save.error && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر الحفظ</AlertTitle>
              <AlertDescription>{save.error.message} المسودة محفوظة هنا.</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setReview(false)}>
              العودة للتحرير
            </Button>
            <Button disabled={busy} onClick={() => save.mutate()}>
              {busy ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}حفظ
              التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleting}
        onOpenChange={(open) => {
          if (!busy) setDeleting(open);
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>حذف {title}</DialogTitle>
            <DialogDescription>
              يُحذف السجل فقط إذا لم تكن له ارتباطات. اكتب {expected} للتأكيد.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="award-delete-confirmation">تأكيد الحذف</FieldLabel>
            <Input
              id="award-delete-confirmation"
              dir="ltr"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          {remove.error && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر الحذف</AlertTitle>
              <AlertDescription>{remove.error.message}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setDeleting(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              disabled={busy || confirmation !== expected}
              onClick={() => remove.mutate()}
            >
              حذف السجل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغييرات غير محفوظة</DialogTitle>
            <DialogDescription>المغادرة ستتجاهل مسودة الجائزة.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              متابعة التحرير
            </Button>
            <Button onClick={() => blocker.proceed?.()}>تجاهل ومغادرة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

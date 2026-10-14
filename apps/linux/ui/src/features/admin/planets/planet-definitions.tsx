import { adminEmptyPlanetDraft, adminPlanetDraftSchema } from "@arcadia/contracts/editor-rpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { ArrowRight, Check, Pencil, Plus, Trash2, X, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { useConfirm } from "@/features/editor/use-confirm";

import {
  deletePlanet,
  planetDetailQuery,
  planetOptionsQuery,
  savePlanet,
  type PlanetDetail,
  type PlanetDraft,
} from "./planets.queries";

type CloseRegistrar = (handler: (() => void) | null) => void;
export function PlanetDefinitions({
  open,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const client = useQueryClient();
  const [id, setId] = useState<string | null>(null);
  const options = useQuery({ ...planetOptionsQuery(), enabled: open });
  const detail = useQuery({
    ...planetDetailQuery(id ?? ""),
    enabled: open && Boolean(id) && id !== "new",
  });
  const closeRequest = useRef<(() => void) | null>(null);
  const registerClose = useCallback((handler: (() => void) | null) => {
    closeRequest.current = handler;
  }, []);
  function close() {
    if (closeRequest.current) closeRequest.current();
    else onOpenChange(false);
  }
  return (
    <Drawer
      open={open}
      showSwipeHandle
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DrawerContent className="h-176">
        <DrawerHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DrawerTitle>
                {id === "new"
                  ? "كوكب جديد"
                  : id
                    ? (detail.data?.draft.name ?? "تحرير الكوكب")
                    : "تعريف الكواكب"}
              </DrawerTitle>
              <DrawerDescription>
                الأسماء والوصف والرمز والألوان وترتيب عرض الكواكب.
              </DrawerDescription>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="إغلاق" onClick={close}>
              <X data-icon="inline-start" />
            </Button>
          </div>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {!id ? (
            <div className="mx-auto flex max-w-320 flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {options.data?.planets.length ?? "…"} كوكب
                </p>
                <Button onClick={() => setId("new")}>
                  <Plus data-icon="inline-start" />
                  كوكب جديد
                </Button>
              </div>
              {options.isPending ? (
                <Skeleton className="h-72" />
              ) : options.isError ? (
                <Alert variant="destructive">
                  <AlertTitle>تعذّر تحميل الكواكب</AlertTitle>
                  <AlertDescription>{options.error.message}</AlertDescription>
                  <Button variant="outline" onClick={() => void options.refetch()}>
                    إعادة المحاولة
                  </Button>
                </Alert>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {options.data.planets.map((planet) => (
                    <Card key={planet.id} size="sm">
                      <CardHeader>
                        <CardTitle>
                          {planet.icon} {planet.name}
                        </CardTitle>
                        <CardDescription>
                          {planet.englishName || planet.description || "بدون وصف"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">{planet.count} عمل</Badge>
                          <Badge variant="outline">ترتيب {planet.displayOrder}</Badge>
                          {!planet.active && <Badge variant="outline">غير نشط</Badge>}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onPointerEnter={() => void detailClientPrefetch(planet.id)}
                          onClick={() => setId(planet.id)}
                        >
                          <Pencil data-icon="inline-start" />
                          تحرير
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : id === "new" ? (
            <DefinitionForm
              key="new"
              detail={null}
              initialOrder={
                Math.max(0, ...(options.data?.planets.map((planet) => planet.displayOrder) ?? [])) +
                1
              }
              registerClose={registerClose}
              onClose={() => onOpenChange(false)}
              onBack={() => setId(null)}
              onSaved={setId}
              onDeleted={onDeleted}
            />
          ) : detail.isPending ? (
            <Skeleton className="mx-auto h-96 max-w-320" />
          ) : detail.isError ? (
            <Alert variant="destructive">
              <AlertTitle>تعذّر فتح الكوكب</AlertTitle>
              <AlertDescription>{detail.error.message}</AlertDescription>
              <Button variant="outline" onClick={() => setId(null)}>
                العودة للكواكب
              </Button>
              <Button variant="outline" onClick={() => void detail.refetch()}>
                إعادة المحاولة
              </Button>
            </Alert>
          ) : (
            <DefinitionForm
              key={detail.data.revision}
              detail={detail.data}
              initialOrder={1}
              registerClose={registerClose}
              onClose={() => onOpenChange(false)}
              onBack={() => setId(null)}
              onSaved={setId}
              onDeleted={onDeleted}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
  function detailClientPrefetch(planetId: string) {
    return client.prefetchQuery(planetDetailQuery(planetId));
  }
}
const labels = {
  slug: "الرمز",
  name: "الاسم العربي",
  englishName: "الاسم الإنجليزي",
  icon: "الأيقونة",
  description: "الوصف",
  primaryColor: "اللون الأساسي",
  secondaryColor: "اللون الثانوي",
  displayOrder: "ترتيب عرض الكوكب",
  active: "نشط",
} satisfies Record<keyof PlanetDraft, string>;
const fields = [
  "slug",
  "name",
  "englishName",
  "icon",
  "description",
  "primaryColor",
  "secondaryColor",
  "displayOrder",
  "active",
] as const;
const fieldLabels = new Map(Object.entries(labels));
function DefinitionForm({
  detail,
  initialOrder,
  registerClose,
  onClose,
  onBack,
  onSaved,
  onDeleted,
}: {
  detail: PlanetDetail | null;
  initialOrder: number;
  registerClose: CloseRegistrar;
  onClose: () => void;
  onBack: () => void;
  onSaved: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [initial] = useState(
    () => detail?.draft ?? { ...adminEmptyPlanetDraft, displayOrder: initialOrder },
  );
  const [draft, setDraft] = useState<PlanetDraft>(initial);
  const [review, setReview] = useState<PlanetDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [committed, setCommitted] = useState(false);
  const allowLeave = useRef(false);
  const confirm = useConfirm();
  const client = useQueryClient();
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft);
  const blocker = useBlocker({
    withResolver: true,
    shouldBlockFn: ({ current, next }) =>
      (current.pathname !== next.pathname || current.search.source !== next.search.source) &&
      dirty &&
      !allowLeave.current,
    enableBeforeUnload: dirty && !committed,
  });
  const save = useMutation({
    mutationFn: () => {
      if (!review) throw new Error("راجع التغييرات أولاً.");
      return savePlanet({
        id: detail?.id ?? null,
        revision: detail?.revision ?? null,
        draft: review,
      });
    },
    onSuccess: async (result) => {
      allowLeave.current = true;
      setCommitted(true);
      setReview(null);
      await invalidateCatalogEdit(client);
      onSaved(result.id);
      toast.add({ type: "success", title: result.created ? "أُضيف الكوكب" : "حُفظ تعريف الكوكب" });
    },
  });
  const remove = useMutation({
    mutationFn: () => {
      if (!detail) throw new Error("الكوكب غير موجود.");
      return deletePlanet({ id: detail.id, revision: detail.revision, confirmation });
    },
    onSuccess: async () => {
      if (!detail) return;
      allowLeave.current = true;
      setCommitted(true);
      setDeleting(false);
      onDeleted(detail.id);
      onBack();
      await invalidateCatalogEdit(client);
      toast.add({ type: "success", title: "حُذف الكوكب الفارغ" });
    },
  });
  const busy = save.isPending || remove.isPending;
  const leave = useCallback(
    async (next: () => void) => {
      if (busy) return;
      if (dirty && !(await confirm.confirm("تجاهل مسودة الكوكب غير المحفوظة؟"))) return;
      allowLeave.current = true;
      setCommitted(true);
      next();
    },
    [busy, dirty, confirm],
  );
  useEffect(() => {
    registerClose(() => void leave(onClose));
    return () => registerClose(null);
  }, [registerClose, leave, onClose]);
  function update(patch: Partial<PlanetDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    setMessage(null);
    allowLeave.current = false;
    setCommitted(false);
    save.reset();
  }
  function prepare() {
    const parsed = adminPlanetDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setMessage(
        parsed.error.issues
          .slice(0, 4)
          .map((issue) => `${fieldLabels.get(String(issue.path[0])) ?? "الحقل"}: ${issue.message}`)
          .join(" · "),
      );
      return;
    }
    setReview(parsed.data);
  }
  async function reloadDefinition() {
    if (!detail || busy) return;
    if (dirty && !(await confirm.confirm("تجاهل المسودة وإعادة تحميل تعريف الكوكب الحالي؟")))
      return;
    setDraft(detail.draft);
    setReview(null);
    setMessage(null);
    save.reset();
    await client.invalidateQueries({ queryKey: planetDetailQuery(detail.id).queryKey });
  }
  const reviewRows = review ? fields.filter((key) => !detail || initial[key] !== review[key]) : [];
  return (
    <div className="mx-auto flex max-w-320 flex-col gap-5">
      {confirm.dialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" disabled={busy} onClick={() => void leave(onBack)}>
          <ArrowRight data-icon="inline-start" />
          كل الكواكب
        </Button>
        <div className="flex items-center gap-2">
          {detail && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void reloadDefinition()}
            >
              <RefreshCw data-icon="inline-start" />
              إعادة تحميل
            </Button>
          )}
          <Badge variant="outline">{dirty ? "مسودة غير محفوظة" : "محفوظ"}</Badge>
        </div>
      </div>
      {message && (
        <Alert variant="destructive">
          <AlertTitle>راجع الحقول</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={busy}>
        <FieldGroup className="grid items-start gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>هوية الكوكب</CardTitle>
              <CardDescription>الاسم والرمز والوصف.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="planet-name">الاسم العربي</FieldLabel>
                  <Input
                    id="planet-name"
                    maxLength={300}
                    value={draft.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="planet-english-name">الاسم الإنجليزي</FieldLabel>
                  <Input
                    id="planet-english-name"
                    dir="ltr"
                    maxLength={300}
                    value={draft.englishName ?? ""}
                    onChange={(event) => update({ englishName: event.target.value || null })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="planet-slug">الرمز</FieldLabel>
                  <Input
                    id="planet-slug"
                    dir="ltr"
                    maxLength={80}
                    placeholder="adventure"
                    value={draft.slug}
                    onChange={(event) => update({ slug: event.target.value })}
                  />
                  <FieldDescription>
                    حروف إنجليزية صغيرة وأرقام وشرطات، يبدأ بحرف. معرّف الكوكب وروابط أعماله تبقى
                    محفوظة عند تغييره.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="planet-description">الوصف</FieldLabel>
                  <Textarea
                    id="planet-description"
                    maxLength={20000}
                    rows={4}
                    value={draft.description}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {draft.icon || "🪐"} {draft.name || "عرض الكوكب"}
              </CardTitle>
              <CardDescription>الأيقونة والألوان والظهور في المكتبة.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="planet-icon">الأيقونة</FieldLabel>
                  <Input
                    id="planet-icon"
                    maxLength={64}
                    value={draft.icon}
                    onChange={(event) => update({ icon: event.target.value })}
                  />
                  <FieldDescription>الصق رمزاً تعبيرياً مناسباً للكوكب.</FieldDescription>
                </Field>
                <ColorField
                  id="planet-primary"
                  label="اللون الأساسي"
                  value={draft.primaryColor}
                  onChange={(primaryColor) => update({ primaryColor })}
                />
                <ColorField
                  id="planet-secondary"
                  label="اللون الثانوي"
                  value={draft.secondaryColor}
                  onChange={(secondaryColor) => update({ secondaryColor })}
                />
                <Field>
                  <FieldLabel htmlFor="planet-display-order">ترتيب عرض الكوكب</FieldLabel>
                  <Input
                    id="planet-display-order"
                    type="number"
                    min={0}
                    max={1000000}
                    value={draft.displayOrder}
                    onChange={(event) => update({ displayOrder: Number(event.target.value) })}
                  />
                  <FieldDescription>
                    الأرقام الأصغر تظهر أولاً. هذا ترتيب الكواكب، وليس ترتيب الأعمال داخلها.
                  </FieldDescription>
                </Field>
                <Field orientation="horizontal">
                  <Switch
                    id="planet-active"
                    checked={draft.active}
                    onCheckedChange={(active) => update({ active })}
                  />
                  <FieldLabel htmlFor="planet-active">إظهار الكوكب في المكتبة</FieldLabel>
                </Field>
                <p className="text-xs text-muted-foreground">
                  التعطيل يخفي الكوكب عن اختيارات المشاهدة ويمنع النقل إليه، مع الاحتفاظ بأعماله
                  وانتماءاتها.
                </p>
              </FieldGroup>
            </CardContent>
          </Card>
        </FieldGroup>
      </fieldset>
      <footer className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-popover p-3">
        <Button
          variant="ghost"
          disabled={!detail || busy}
          onClick={() => {
            remove.reset();
            setConfirmation("");
            setDeleting(true);
          }}
        >
          <Trash2 data-icon="inline-start" />
          حذف الكوكب
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void leave(onClose)}>
            إغلاق
          </Button>
          <Button disabled={!dirty || busy} onClick={prepare}>
            <Check data-icon="inline-start" />
            مراجعة التغييرات
          </Button>
        </div>
      </footer>
      <Dialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setReview(null);
        }}
      >
        <DialogContent
          className="max-h-11/12 overflow-y-auto sm:max-w-3xl"
          showCloseButton={!save.isPending}
        >
          <DialogHeader>
            <DialogTitle>مراجعة تعريف الكوكب</DialogTitle>
            <DialogDescription>
              تُحفظ الأسماء والعرض فقط، وتبقى انتماءات الأعمال كما هي.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الحقل</TableHead>
                <TableHead>الحالي</TableHead>
                <TableHead>الجديد</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewRows.map((key) => (
                <TableRow key={key}>
                  <TableCell>{labels[key]}</TableCell>
                  <TableCell className="max-w-64 whitespace-pre-wrap break-words" dir="auto">
                    {detail ? String(initial[key] ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-pre-wrap break-words" dir="auto">
                    {String(review?.[key] ?? "—")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {save.isError && (
            <Alert variant="destructive">
              <AlertTitle>لم يُحفظ الكوكب</AlertTitle>
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={save.isPending} onClick={() => setReview(null)}>
              العودة للمسودة
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              تأكيد الحفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleting}
        onOpenChange={(open) => {
          if (!remove.isPending) setDeleting(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف {detail?.draft.name}</AlertDialogTitle>
            <AlertDialogDescription>
              يُسمح بحذف الكوكب الفارغ فقط. لن تُحذف أعمال أو صور أو انتماءات مرتبطة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {detail?.links.length ? (
            <Alert>
              <AlertTitle>هذا الكوكب مرتبط ببيانات</AlertTitle>
              <AlertDescription>
                {detail.links.map((link) => `${link.table}: ${link.count}`).join(" · ")} — انقل
                الأعمال أولاً، أو عطّل الكوكب.
              </AlertDescription>
            </Alert>
          ) : (
            <Field>
              <FieldLabel htmlFor="delete-planet-slug">
                اكتب الرمز للتأكيد: {detail?.draft.slug}
              </FieldLabel>
              <Input
                id="delete-planet-slug"
                dir="ltr"
                value={confirmation}
                disabled={remove.isPending}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
          )}
          {remove.isError && (
            <Alert variant="destructive">
              <AlertTitle>لم يُحذف الكوكب</AlertTitle>
              <AlertDescription>{remove.error.message}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                !detail ||
                detail.links.length > 0 ||
                confirmation !== detail.draft.slug ||
                remove.isPending
              }
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مسودة غير محفوظة</AlertDialogTitle>
            <AlertDialogDescription>تجاهل مسودة الكوكب ومغادرة الصفحة؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>البقاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (blocker.status === "blocked") blocker.proceed();
              }}
            >
              تجاهل ومغادرة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        {/^#[0-9a-fA-F]{6}$/.test(value) && (
          <Input
            type="color"
            className="w-16"
            aria-label={`اختيار ${label}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        <Input
          id={id}
          dir="ltr"
          maxLength={7}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Field>
  );
}

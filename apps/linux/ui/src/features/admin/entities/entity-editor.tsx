import { adminEntityDraftSchema, rpcResults } from "@arcadia/contracts/editor-rpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { X, Check, Braces, Trash2, Plus } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

import { Artwork } from "@/components/artwork";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { TextField } from "@/features/editor/fields/work-fields";
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";
import { ReferencePicker } from "@/features/editor/references/reference-picker";
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";
import { gateway } from "@/lib/bridge";

import { ImageUpload } from "../images/image-upload";
import {
  entityDetailOptions,
  saveEntity,
  type EntityKind,
  type EntityDraft,
  type EntityDetail,
} from "./entities.queries";
import { EntityCredits } from "./entity-credits";
import { EntityDelete } from "./entity-delete";

const emptyDraft: EntityDraft = {
  name: "",
  sortName: "",
  description: "",
  aliases: [],
  profileAssetId: null,
  credits: [],
};
type CloseRegistrar = (handler: (() => void) | null) => void;
export function EntityDrawer({
  kind,
  id,
  onClose,
  onSaved,
}: {
  kind: EntityKind;
  id: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [displayId, setDisplayId] = useState(id);
  if (id && displayId !== id) setDisplayId(id);
  const closeRequest = useRef<(() => void) | null>(null);
  const registerClose = useCallback((handler: (() => void) | null) => {
    closeRequest.current = handler;
  }, []);
  const detail = useQuery({
    ...entityDetailOptions(kind, displayId),
    enabled: Boolean(id) && Boolean(displayId) && displayId !== "new",
  });
  const close = () => {
    if (closeRequest.current) closeRequest.current();
    else onClose();
  };
  return (
    <Drawer
      open={Boolean(id)}
      showSwipeHandle
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DrawerContent className="h-176">
        <DrawerHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <DrawerTitle>
                {displayId === "new"
                  ? kind === "person"
                    ? "إضافة شخص"
                    : "إضافة استوديو"
                  : (detail.data?.entity.name ?? "تحرير السجل")}
              </DrawerTitle>
              <DrawerDescription>الهوية والصورة والأعمال والأدوار في مسودة واحدة.</DrawerDescription>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="إغلاق المحرر" onClick={close}>
              <X data-icon="inline-start" />
            </Button>
          </div>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {displayId === "new" ? (
            <EntityForm
              key="new"
              kind={kind}
              detail={null}
              registerClose={registerClose}
              onClose={onClose}
              onSaved={onSaved}
            />
          ) : detail.isPending ? (
            <Skeleton className="h-96" />
          ) : detail.isError ? (
            <Alert variant="destructive">
              <AlertTitle>تعذّر فتح السجل</AlertTitle>
              <AlertDescription>{detail.error.message}</AlertDescription>
              <Button variant="outline" onClick={() => void detail.refetch()}>
                إعادة المحاولة
              </Button>
            </Alert>
          ) : (
            detail.data && (
              <EntityForm
                key={detail.data.revision}
                kind={kind}
                detail={detail.data}
                registerClose={registerClose}
                onClose={onClose}
                onSaved={onSaved}
              />
            )
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
function EntityForm({
  kind,
  detail,
  registerClose,
  onClose,
  onSaved,
}: {
  kind: EntityKind;
  detail: EntityDetail | null;
  registerClose: CloseRegistrar;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState<EntityDraft>(() => detail?.draft ?? emptyDraft);
  const aliasRows = useEditorRows(draft.aliases);
  const [review, setReview] = useState<EntityDraft | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [picking, setPicking] = useState(false);
  const allowLeave = useRef(false);
  const [navigationConfirmed, setNavigationConfirmed] = useState(false);
  const client = useQueryClient();
  const before = detail?.draft ?? emptyDraft;
  const dirty = JSON.stringify(before) !== JSON.stringify(draft);
  const blocker = useBlocker({
    withResolver: true,
    shouldBlockFn: ({ current, next }) =>
      (current.pathname !== next.pathname || current.search.person !== next.search.person) &&
      dirty &&
      !allowLeave.current,
    enableBeforeUnload: dirty && !navigationConfirmed,
  });
  async function changed() {
    await invalidateCatalogEdit(client);
  }
  const save = useMutation({
    mutationFn: () => {
      if (!review) throw new Error("راجع المسودة أولاً.");
      return saveEntity({
        id: detail?.entity.id ?? null,
        kind,
        revision: detail?.revision ?? null,
        draft: review,
      });
    },
    onSuccess: async (result) => {
      allowLeave.current = true;
      setNavigationConfirmed(true);
      setReview(null);
      await changed();
      await client.prefetchQuery(entityDetailOptions(kind, result.id));
      toast.add({ type: "success", title: result.created ? "أُضيف السجل" : "حُفظت التغييرات" });
      onSaved(result.id);
    },
  });
  const busy = save.isPending || picking;
  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) setLeaving(true);
    else onClose();
  }, [busy, dirty, onClose]);
  useEffect(() => {
    registerClose(requestClose);
    return () => registerClose(null);
  }, [registerClose, requestClose]);

  function update(patch: Partial<EntityDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
    allowLeave.current = false;
    setNavigationConfirmed(false);
    setValidation(null);
    save.reset();
  }
  async function pick(path: string) {
    setPicking(true);
    try {
      const image = rpcResults.media.parse(
        await gateway.editorCall({ operation: "media", data: { path } }),
      );
      update({ profileAssetId: image.id });
    } catch {
      setValidation("تعذّر اختيار الصورة.");
    } finally {
      setPicking(false);
    }
  }
  function prepare() {
    const parsed = adminEntityDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setValidation("أكمل الاسم واسم الترتيب والأسماء البديلة والمساهمات قبل المراجعة.");
      return;
    }
    setReview(parsed.data);
  }
  const reviewRows = review
    ? [
        { label: "الاسم", before: before.name, after: review.name },
        { label: "اسم الترتيب", before: before.sortName, after: review.sortName },
        { label: "الوصف", before: before.description, after: review.description },
        {
          label: "الأسماء البديلة",
          before: before.aliases
            .map((alias) => `${alias.alias} (${alias.language ?? "—"})`)
            .join("، "),
          after: review.aliases
            .map((alias) => `${alias.alias} (${alias.language ?? "—"})`)
            .join("، "),
        },
        {
          label: "المساهمات",
          before: before.credits
            .map(
              (credit) =>
                `${credit.workTitle} · ${credit.roleName} · ${credit.position}${credit.isPrimary ? " · Primary" : ""}`,
            )
            .join("\n"),
          after: review.credits
            .map(
              (credit) =>
                `${credit.workTitle} · ${credit.roleName} · ${credit.position}${credit.isPrimary ? " · Primary" : ""}`,
            )
            .join("\n"),
        },
      ].filter((row) => row.before !== row.after)
    : [];
  return (
    <div className="mx-auto flex max-w-400 flex-col gap-5">
      {validation && (
        <Alert variant="destructive">
          <AlertTitle>راجع المسودة</AlertTitle>
          <AlertDescription>{validation}</AlertDescription>
        </Alert>
      )}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start gap-4">
            <Artwork
              id={
                draft.profileAssetId ??
                (before.profileAssetId ? null : (detail?.entity.artworkId ?? null))
              }
              alt={kind === "person" ? "الصورة الشخصية" : "شعار الاستوديو"}
              studioLogo={kind === "organization"}
              className="h-40 w-32 shrink-0 rounded-xl border border-border object-cover"
            />
            <div className="flex flex-col gap-2">
              <Badge variant="outline">
                {new Set(draft.credits.map((credit) => credit.workId)).size} عمل
              </Badge>
              <ReferencePicker
                table="media_assets"
                title="اختيار صورة"
                images
                imageRole={kind === "person" ? "profile" : "logo"}
                onPick={(path) => void pick(path)}
              />
              <ImageUpload
                defaultRole={kind === "person" ? "profile" : "logo"}
                onUploaded={async (id) => {
                  update({ profileAssetId: id });
                  await client.invalidateQueries({ queryKey: ["admin", "images"] });
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={!draft.profileAssetId || busy}
                onClick={() => update({ profileAssetId: null })}
              >
                إلغاء الأساسية
              </Button>
            </div>
          </div>
          <Card size="sm">
            <CardHeader>
              <CardTitle>الهوية</CardTitle>
              <CardDescription>الأسماء والوصف.</CardDescription>
            </CardHeader>
            <CardContent>
              <fieldset disabled={busy}>
                <FieldGroup>
                  <TextField
                    label="الاسم"
                    value={draft.name}
                    onChange={(name) =>
                      update({
                        name,
                        sortName: draft.sortName === draft.name ? name : draft.sortName,
                      })
                    }
                  />
                  <TextField
                    label="اسم الترتيب"
                    value={draft.sortName}
                    onChange={(sortName) => update({ sortName })}
                  />
                  <TextField
                    label="الوصف"
                    multiline
                    value={draft.description}
                    onChange={(description) => update({ description })}
                  />
                  <Field>
                    <FieldLabel>الأسماء البديلة</FieldLabel>
                    <div className="flex flex-col gap-2">
                      {aliasRows.map(({ key, value: alias }, index) => (
                        <div key={key} className="flex gap-2">
                          <Input
                            aria-label={`الاسم البديل ${index + 1}`}
                            dir="auto"
                            value={alias.alias}
                            onChange={(event) =>
                              update({
                                aliases: draft.aliases.map((item, position) =>
                                  position === index
                                    ? { ...item, alias: event.target.value }
                                    : item,
                                ),
                              })
                            }
                          />
                          <Input
                            className="w-20"
                            dir="ltr"
                            placeholder="ar / en"
                            aria-label={`لغة الاسم البديل ${index + 1}`}
                            value={alias.language ?? ""}
                            onChange={(event) =>
                              update({
                                aliases: draft.aliases.map((item, position) =>
                                  position === index
                                    ? { ...item, language: event.target.value || null }
                                    : item,
                                ),
                              })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="إزالة الاسم البديل"
                            onClick={() =>
                              update({
                                aliases: draft.aliases.filter((_, position) => position !== index),
                              })
                            }
                          >
                            <X data-icon="inline-start" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={draft.aliases.length >= 50}
                        onClick={() =>
                          update({
                            aliases: [...draft.aliases, { id: null, alias: "", language: null }],
                          })
                        }
                      >
                        <Plus data-icon="inline-start" />
                        اسم بديل
                      </Button>
                    </div>
                  </Field>
                </FieldGroup>
              </fieldset>
            </CardContent>
          </Card>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <EntityCredits
            kind={kind}
            credits={draft.credits}
            onChange={(credits) => update({ credits })}
            disabled={busy}
          />
        </div>
      </div>
      <footer className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-popover p-3 shadow-lg">
        <span className="text-sm text-muted-foreground">
          {dirty ? "مسودة غير محفوظة" : "لا توجد تغييرات"}
        </span>
        <div className="flex flex-wrap gap-2">
          {detail && (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => setDeleting(true)}>
                <Trash2 data-icon="inline-start" />
                حذف
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                render={
                  <a
                    href={`#/admin/json?target=${kind === "person" ? "people" : "studios"}&ids=${detail.entity.id}`}
                  />
                }
              >
                <Braces data-icon="inline-start" />
                JSON
              </Button>
            </>
          )}
          <Button variant="outline" disabled={busy} onClick={requestClose}>
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
            <DialogTitle>مراجعة السجل والمساهمات</DialogTitle>
            <DialogDescription>
              لن تُحذف الأعمال؛ تغييرات المساهمات تخص هذا السجل فقط.
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
              {reviewRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="max-w-72 whitespace-pre-wrap break-words" dir="auto">
                    {row.before || "—"}
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-pre-wrap break-words" dir="auto">
                    {row.after || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {review && review.profileAssetId !== before.profileAssetId && (
            <div className="grid grid-cols-2 gap-4">
              <Artwork
                id={before.profileAssetId}
                alt="الصورة الحالية"
                className="h-40 w-full rounded-xl object-contain"
              />
              <Artwork
                id={review.profileAssetId}
                alt="الصورة الجديدة"
                className="h-40 w-full rounded-xl object-contain"
              />
            </div>
          )}
          {save.isError && (
            <Alert variant="destructive">
              <AlertTitle>لم تُحفظ التغييرات</AlertTitle>
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
      {detail && (
        <EntityDelete
          kind={kind}
          ids={[detail.entity.id]}
          open={deleting}
          onOpenChange={setDeleting}
          onDeleted={async () => {
            allowLeave.current = true;
            setNavigationConfirmed(true);
            onClose();
            await changed();
          }}
        />
      )}
      <AlertDialog
        open={leaving || blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) {
            setLeaving(false);
            if (blocker.status === "blocked") blocker.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>مسودة غير محفوظة</AlertDialogTitle>
            <AlertDialogDescription>تجاهل المسودة ومغادرة المحرر؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>البقاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                allowLeave.current = true;
                setNavigationConfirmed(true);
                setLeaving(false);
                if (blocker.status === "blocked") blocker.proceed();
                else onClose();
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

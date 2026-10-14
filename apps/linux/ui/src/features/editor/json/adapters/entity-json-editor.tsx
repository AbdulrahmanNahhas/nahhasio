import { adminEntityJsonDocumentSchema } from "@arcadia/contracts/editor-rpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { cn } from "cn";
import { Copy, Download, Upload, WandSparkles, Undo2 } from "lucide-react";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { z } from "zod";

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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  entityJsonOptions,
  entityOptionsQuery,
  reviewEntityJson,
  saveEntityJson,
} from "@/features/admin/entities/entities.queries";
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";
import { useConfirm } from "@/features/editor/use-confirm";

import { ChangeReview } from "../document/change-review";
import type { DocumentReview } from "../document/document-model";
import { jsonEntityAdapters, type JsonEntityTarget } from "./registry";

const CodeEditor = lazy(() =>
  import("../document/code-editor").then((module) => ({ default: module.CodeEditor })),
);
const fields = [
  "schemaVersion",
  "target",
  "records",
  "id",
  "name",
  "sortName",
  "description",
  "aliases",
  "alias",
  "language",
  "profileImage",
  "credits",
  "work",
  "role",
  "position",
  "isPrimary",
];
import { rpcResults } from "@arcadia/contracts/editor-rpc";

// The exported result type is derived from the shared RPC schema, not an untrusted assertion.
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";
type LoadedEntities = z.infer<typeof rpcResults.entityJsonRead>;
export function EntityJsonEditor({ target, ids }: { target: JsonEntityTarget; ids: string[] }) {
  const adapter = jsonEntityAdapters[target];
  const query = useQuery({ ...entityJsonOptions(adapter.kind, ids), enabled: ids.length > 0 });
  if (!ids.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>اختر السجلات أولاً</EmptyTitle>
          <EmptyDescription>حدد السجلات من صفحة {adapter.title} ثم افتح JSON.</EmptyDescription>
        </EmptyHeader>
        <Button render={<a href={`#/admin/${target}`} />}>العودة</Button>
      </Empty>
    );
  if (query.isPending) return <Skeleton className="m-6 h-96" />;
  if (query.isError)
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل السجلات</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
          <Button variant="outline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </Button>
        </Alert>
      </div>
    );
  return (
    <Workspace
      key={query.data.originals.map((record) => record.revision).join(":")}
      target={target}
      loaded={query.data}
    />
  );
}
function Workspace({ target, loaded }: { target: JsonEntityTarget; loaded: LoadedEntities }) {
  const adapter = jsonEntityAdapters[target];
  const original = useMemo(() => JSON.stringify(loaded.document, null, 2), [loaded]);
  const [draft, setDraft] = useState(original);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [review, setReview] = useState<DocumentReview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const committed = useRef(false);
  const [saved, setSaved] = useState(false);
  const dirty = draft !== original;
  const client = useQueryClient();
  const confirmation = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const references = useQuery(entityOptionsQuery(adapter.kind));
  const parsed = useMemo(() => {
    try {
      return adminEntityJsonDocumentSchema.safeParse(JSON.parse(draft));
    } catch {
      return null;
    }
  }, [draft]);
  const issueRows = useEditorRows(
    parsed && !parsed.success
      ? parsed.error.issues
          .slice(0, 8)
          .map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }))
      : [],
  );
  const identityValid =
    parsed?.success &&
    parsed.data.target === target &&
    parsed.data.records.length === loaded.originals.length &&
    new Set(parsed.data.records.map((record) => record.id)).size === loaded.originals.length &&
    parsed.data.records.every((record) =>
      loaded.originals.some((selected) => selected.id === record.id),
    );
  const valueOptions = useMemo(
    () => ({
      work: [...new Set(references.data?.works.map((work) => work.title) ?? [])],
      role: [...new Set(references.data?.roles.map((role) => role.name) ?? [])],
    }),
    [references.data],
  );
  const blocker = useBlocker({
    withResolver: true,
    shouldBlockFn: ({ current, next }) =>
      (current.pathname !== next.pathname ||
        current.search.ids !== next.search.ids ||
        current.search.target !== next.search.target) &&
      dirty &&
      !committed.current,
    enableBeforeUnload: dirty && !saved,
  });
  const prepare = useMutation({
    mutationFn: () => reviewEntityJson({ json: draft, originals: loaded.originals }),
    onSuccess: setReview,
  });
  const save = useMutation({
    mutationFn: () => {
      if (!review) throw new Error("راجع التغييرات أولاً.");
      return saveEntityJson(review.ticket);
    },
    onSuccess: async (result) => {
      committed.current = true;
      setSaved(true);
      setReview(null);
      await invalidateCatalogEdit(client);
      toast.add({
        type: "success",
        title: "حُفظت تغييرات JSON",
        description: `${result.saved} سجل`,
      });
    },
  });
  const busy = prepare.isPending || save.isPending;
  function update(text: string) {
    setDraft(text);
    committed.current = false;
    setSaved(false);
    setReview(null);
    setMessage(null);
    prepare.reset();
    save.reset();
  }
  function exportFile() {
    const url = URL.createObjectURL(new Blob([draft], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${target}-${loaded.originals.length}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function importFile(file: File) {
    if (file.size > 4000000) {
      setMessage("الملف يتجاوز ٤ ميغابايت.");
      return;
    }
    try {
      const text = await file.text();
      const value = adminEntityJsonDocumentSchema.safeParse(JSON.parse(text));
      if (!value.success || value.data.target !== target)
        throw new Error("الملف لا يطابق نوع السجلات الحالي.");
      if (
        value.data.records.length !== loaded.originals.length ||
        new Set(value.data.records.map((record) => record.id)).size !== loaded.originals.length ||
        value.data.records.some(
          (record) => !loaded.originals.some((selected) => selected.id === record.id),
        )
      )
        throw new Error("الملف لا يطابق السجلات المحددة.");
      if (dirty && !(await confirmation.confirm("استبدال المسودة الحالية بالملف؟"))) return;
      update(text);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذّرت قراءة الملف.");
    }
  }
  return (
    <article className="mx-auto flex w-full min-w-0 max-w-400 flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">JSON · {adapter.title}</h1>
          <p className="text-sm text-muted-foreground">
            الأعمال بعناوينها الإنجليزية والأدوار بأسمائها. حل المراجع والتحقق منها يتم قبل الحفظ.
          </p>
        </div>
        <Button variant="outline" render={<a href={`#/admin/${target}`} />}>
          العودة إلى {adapter.title}
        </Button>
      </header>
      {confirmation.dialog}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {loaded.previews.map((person) => (
          <div
            key={person.id}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card p-2"
          >
            <Artwork
              id={person.artworkId}
              alt=""
              studioLogo={adapter.kind === "organization"}
              className={cn(
                "rounded-lg",
                adapter.kind === "organization" ? "size-12" : "h-12 w-10 object-cover",
              )}
            />
            <div className="flex flex-col gap-1">
              <span className="max-w-48 truncate text-sm font-medium" dir="auto">
                {person.name}
              </span>
              <span className="text-xs text-muted-foreground">{person.workCount} عمل</span>
            </div>
          </div>
        ))}
      </div>
      {(prepare.error || save.error || message) && (
        <Alert variant="destructive">
          <AlertTitle>راجع المسودة</AlertTitle>
          <AlertDescription>
            {prepare.error?.message ?? save.error?.message ?? message}
          </AlertDescription>
        </Alert>
      )}
      {review ? (
        <ChangeReview
          review={review}
          busy={busy}
          onBack={() => setReview(null)}
          onSave={() => save.mutate()}
          recordLabel={adapter.recordLabel}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={identityValid ? "outline" : "destructive"}>
              {identityValid ? "بنية صالحة · المراجع تُراجع قبل الحفظ" : "صحّح JSON ونطاق السجلات"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {loaded.originals.length} سجل · {draft.length.toLocaleString()} حرف
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!parsed?.success || busy}
              onClick={() => {
                if (parsed?.success) update(JSON.stringify(parsed.data, null, 2));
              }}
            >
              <WandSparkles data-icon="inline-start" />
              تنسيق
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigator.clipboard
                  .writeText(draft)
                  .then(() => toast.add({ type: "success", title: "نُسخ JSON" }))
                  .catch(() => setMessage("تعذّر النسخ إلى الحافظة."))
              }
            >
              <Copy data-icon="inline-start" />
              نسخ
            </Button>
            <Button variant="outline" size="sm" onClick={exportFile}>
              <Download data-icon="inline-start" />
              تصدير
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <Upload data-icon="inline-start" />
              استيراد
            </Button>
            <Input
              type="file"
              ref={fileInput}
              hidden
              accept=".json,application/json"
              aria-label="استيراد JSON"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importFile(file).catch(() => setMessage("تعذّرت قراءة الملف."));
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty || busy}
              onClick={() =>
                void confirmation.confirm("تجاهل المسودة واستعادة الأصل؟").then((yes) => {
                  if (yes) update(original);
                  return undefined;
                })
              }
            >
              <Undo2 data-icon="inline-start" />
              استعادة الأصل
            </Button>
          </div>
          <Tabs defaultValue="json">
            <TabsList>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="preview" disabled={!parsed?.success}>
                معاينة السجلات والأعمال
              </TabsTrigger>
            </TabsList>
            <TabsContent value="json">
              <Suspense fallback={<Skeleton className="h-96" />}>
                <CodeEditor
                  value={draft}
                  onChange={update}
                  readOnly={busy}
                  suggestions={fields}
                  valueOptions={valueOptions}
                />
              </Suspense>
            </TabsContent>
            <TabsContent value="preview">
              {parsed?.success && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {parsed.data.records.map((record) => (
                    <Card key={record.id} size="sm">
                      <CardHeader>
                        <CardTitle>
                          <span dir="auto">{record.name}</span>
                        </CardTitle>
                        <CardDescription>{record.sortName}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-3 line-clamp-3 text-sm text-muted-foreground" dir="auto">
                          {record.description || "بدون وصف"}
                        </p>
                        <CreditPreview credits={record.credits} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          {!parsed && (
            <Alert variant="destructive">
              <AlertTitle>صيغة JSON غير مكتملة</AlertTitle>
              <AlertDescription>صحّح الصيغة داخل المحرر قبل المراجعة.</AlertDescription>
            </Alert>
          )}
          {parsed && !parsed.success && (
            <Alert variant="destructive">
              <AlertTitle>حقول تحتاج تصحيحاً</AlertTitle>
              <AlertDescription>
                <ul>
                  {issueRows.map(({ key, value: issue }) => (
                    <li key={key}>
                      <code dir="ltr">{issue.path}</code>: {issue.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <Collapsible
            open={referenceOpen}
            onOpenChange={setReferenceOpen}
            className="flex flex-col gap-3"
          >
            <CollapsibleTrigger render={<Button variant="outline" />}>
              مرجع أسماء الأعمال والأدوار
            </CollapsibleTrigger>
            <CollapsibleContent>
              {referenceOpen && (
                <NamedReferenceList
                  works={valueOptions.work}
                  roles={valueOptions.role}
                  error={references.error?.message}
                  pending={references.isPending}
                />
              )}
            </CollapsibleContent>
          </Collapsible>
          <footer className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-popover p-3 shadow-lg">
            <span className="text-sm text-muted-foreground">
              {dirty ? "مسودة غير محفوظة" : "لا توجد تغييرات"}
            </span>
            <Button disabled={!dirty || !identityValid || busy} onClick={() => prepare.mutate()}>
              {prepare.isPending ? "جارٍ التحقق من المراجع…" : "مراجعة التغييرات"}
            </Button>
          </footer>
        </>
      )}
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
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
                if (blocker.status === "blocked") blocker.proceed();
              }}
            >
              تجاهل ومغادرة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
function NamedReferenceList({
  works,
  roles,
  error,
  pending,
}: {
  works: string[];
  roles: string[];
  error?: string;
  pending: boolean;
}) {
  const [search, setSearch] = useState("");
  const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase());
  const visibleWorks = works.filter(matches);
  const visibleRoles = roles.filter(matches);

  return (
    <Card>
      <CardHeader>
        <CardTitle>قيم المراجع</CardTitle>
        <CardDescription>
          {works.length} عنوان عمل · {roles.length} دور. اضغط قيمة لنسخها، أو انسخ المرجع كاملاً.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || Boolean(error)}
            onClick={() => copyReference({ work: works, role: roles })}
          >
            <Copy data-icon="inline-start" />
            نسخ المرجع
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="json-entity-reference-search" className="sr-only">
            بحث في أسماء الأعمال والأدوار
          </FieldLabel>
          <Input
            id="json-entity-reference-search"
            placeholder="ابحث عن عنوان أو دور…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        {pending ? (
          <Skeleton className="mt-3 h-24" />
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>تعذّر تحميل المرجع</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
            <ReferenceValues title="الأعمال" field="work" values={visibleWorks} allValues={works} />
            <ReferenceValues title="الأدوار" field="role" values={visibleRoles} allValues={roles} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReferenceValues({
  title,
  field,
  values,
  allValues,
}: {
  title: string;
  field: string;
  values: string[];
  allValues: string[];
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          {title} · {allValues.length}
        </CardTitle>
        <CardDescription>
          <span className="font-mono" dir="ltr">
            {field}
          </span>
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`نسخ جميع ${title}`}
            onClick={() => copyReference(allValues)}
          >
            <Copy data-icon="inline-start" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex max-h-80 flex-wrap content-start gap-2 overflow-y-auto">
          {values.map((value) => (
            <Button key={value} variant="outline" size="sm" onClick={() => copyReference(value)}>
              <span dir="ltr">{value}</span>
            </Button>
          ))}
          {!values.length && <p className="text-sm text-muted-foreground">لا توجد قيم مطابقة.</p>}
        </div>
        <p className="mt-4 text-xs text-muted-foreground font-mono" dir="ltr">
          records[].credits[].{field}
        </p>
      </CardContent>
    </Card>
  );
}
const copyReference = (value: string | string[] | { work: string[]; role: string[] }) =>
  void navigator.clipboard
    .writeText(JSON.stringify(value, null, 2))
    .then(() => toast.add({ type: "success", title: "نُسخت القيم بصيغة JSON" }))
    .catch(() => toast.add({ type: "error", title: "تعذّر النسخ" }));

function CreditPreview({
  credits,
}: {
  credits: z.infer<typeof adminEntityJsonDocumentSchema>["records"][number]["credits"];
}) {
  const rows = useEditorRows(credits);
  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ key, value: credit }) => (
        <div key={key} className="rounded-lg border border-border p-2">
          <p className="text-sm font-medium" dir="ltr">
            {credit.work}
          </p>
          <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
            {credit.role} · {credit.position}
            {credit.isPrimary ? " · Primary" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

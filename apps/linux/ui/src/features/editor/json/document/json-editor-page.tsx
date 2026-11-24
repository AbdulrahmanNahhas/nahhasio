import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BracesIcon,
  UploadIcon,
  CopyIcon,
  DownloadIcon,
  ChevronDownIcon,
  Undo2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ChangeReview } from "@/features/editor/json/document/change-review";
import {
  documentRow,
  equalValue,
  fieldKeys,
  type WorkField,
  type WorkSnapshot,
} from "@/features/editor/json/document/document-model";
import { workSnapshotsOptions } from "@/features/editor/json/document/document.queries";
import {
  readEditorDocument,
  jsonIssueKey,
} from "@/features/editor/json/document/json-document-input";
import { useDocumentReview } from "@/features/editor/json/document/use-document-review";
import { JsonEnumReference } from "@/features/editor/json/tree/json-enum-reference";
import {
  episodeFields,
  installmentFields,
  fullStructureScope,
  projectRows,
  type StructureScope,
} from "@/features/editor/json/tree/json-projection";
import { JsonTreeEditor } from "@/features/editor/json/tree/json-tree-editor";
import { useConfirm } from "@/features/editor/use-confirm";

import { downloadJson, maxJsonFileBytes } from "../json-file";
import { useScopeControls, WorkDocumentScope } from "./work-document-scope";
import { analyzeWorkDraft, checkRecordIdentities, serializeWorkReview } from "./work-draft";

const CodeEditor = lazy(() =>
  import("@/features/editor/json/document/code-editor").then((module) => ({
    default: module.CodeEditor,
  })),
);
const completionKeys = [
  ...fieldKeys,
  ...installmentFields.map(({ key }) => key),
  ...episodeFields.map(({ key }) => key),
  "id",
  "schemaVersion",
  "records",
  "fields",
  "story",
  "characters",
  "depth",
  "worldBuilding",
  "originality",
  "craft",
  "entity",
  "role",
  "isPrimary",
  "target",
  "kind",
  "notes",
  "poster",
  "banner",
  "logo",
  "provider",
  "externalId",
  "url",
  "organization",
  "category",
  "year",
  "result",
  "installment",
  "isFeatured",
  "sourceUrl",
  "ceremonyId",
];
export function JsonEditorPage({ ids, bulk = false }: { ids: string[]; bulk?: boolean }) {
  return (
    <article className="flex min-w-0 flex-col p-4 sm:p-6">
      <PageHeader
        title={bulk ? "التحرير الجماعي" : "مساحة تحرير JSON"}
        description={
          ids.length
            ? `${ids.length} عمل في نطاق التحرير.`
            : "حدد الأعمال من الكتالوج لفتح مستند واحد أو تحرير عدة أعمال معاً."
        }
      />
      {ids.length ? (
        <JsonLoader ids={ids} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>اختر الأعمال أولاً</EmptyTitle>
            <EmptyDescription>
              حدد عملاً أو أكثر باستخدام مربعات التحديد، ثم افتح محرر JSON من شريط التحديد.
            </EmptyDescription>
          </EmptyHeader>
          <Link to="/admin/works" className={buttonVariants()}>
            <BracesIcon data-icon="inline-start" />
            العودة إلى الأعمال
          </Link>
        </Empty>
      )}
    </article>
  );
}
function JsonLoader({ ids }: { ids: string[] }) {
  const query = useQuery(workSnapshotsOptions(ids));
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError)
    return (
      <Alert variant="destructive" className="border-border">
        <AlertTitle>تعذّر تحميل الأعمال</AlertTitle>
        <AlertDescription>
          {query.error instanceof z.ZodError
            ? "تعذّر قراءة بيانات الأعمال من الخادم. أعد تحميلها بعد تحديث الخادم."
            : query.error.message}
        </AlertDescription>
        <Button variant="outline" onClick={() => void query.refetch()}>
          إعادة المحاولة
        </Button>
      </Alert>
    );
  return (
    <JsonWorkspace
      key={query.data.map((snapshot) => snapshot.revision).join(":")}
      snapshots={query.data}
    />
  );
}
function JsonWorkspace({ snapshots }: { snapshots: WorkSnapshot[] }) {
  const confirmation = useConfirm();
  const controls = useScopeControls();
  const [fields, setFields] = useState<WorkField[]>(fieldKeys);
  const [scope, setScope] = useState<StructureScope>(fullStructureScope);
  const originalRows = useMemo(
    () => snapshots.map(({ document }) => documentRow.parse(document)),
    [snapshots],
  );
  const [buffers, setBuffers] = useState(originalRows);
  const initial = useMemo(
    () => JSON.stringify(projectRows(originalRows, fields, scope), null, 2),
    [originalRows, fields, scope],
  );
  const [draft, setDraft] = useState(initial);
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const { input, parsed, mergedRows, identityIssues } = useMemo(
    () => analyzeWorkDraft(draft, originalRows, buffers),
    [draft, originalRows, buffers],
  );
  const visibleFields = parsed?.success ? parsed.data.fields : fields;
  const scopeValid = parsed?.success && identityIssues.length === 0;
  const reviewJson = useMemo(() => serializeWorkReview(mergedRows), [mergedRows]);
  const hasEdits = useMemo(() => !equalValue(originalRows, mergedRows), [originalRows, mergedRows]);
  const dirty = hasEdits || ((!parsed?.success || !scopeValid) && draft !== initial);
  const flow = useDocumentReview(snapshots, () => reviewJson, dirty);
  function update(value: string) {
    setDraft(value);
    setNotice(null);
    flow.changed();
  }
  function choose(next: WorkField[], nextScope = scope) {
    if (!parsed?.success) {
      setNotice("صحّح JSON قبل تغيير نطاق الحقول حتى تبقى المسودة محفوظة.");
      return;
    }
    if (!scopeValid) {
      setNotice("معرّفات الأعمال ثابتة؛ أعد المعرّفات الأصلية وأزل السجلات المكررة قبل تغيير النطاق.");
      return;
    }
    if (!next.length) next = ["canonicalTitle"];
    setBuffers(mergedRows);
    setFields(next);
    if (!equalValue(next, visibleFields)) controls.setPreset("custom");
    setScope(nextScope);
    update(JSON.stringify(projectRows(mergedRows, next, nextScope), null, 2));
  }
  const operationError = flow.save.error ?? flow.prepare.error;
  return (
    <div className="flex min-w-0 flex-col gap-5 overflow-x-clip">
      {flow.leaveDialog}
      {confirmation.dialog}
      <div className="flex flex-wrap gap-2" aria-label="الأعمال قيد التحرير">
        {snapshots.slice(0, 3).map(({ document }) => (
          <Badge key={document.id} variant="outline">
            <span className="max-w-56 truncate" dir="auto">
              {document.titleAr || document.canonicalTitle}
            </span>
          </Badge>
        ))}
        {snapshots.length > 3 && <Badge variant="secondary">+{snapshots.length - 3}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={flow.review ? "outline" : "secondary"}>1 · المحرر</Badge>
        <span className="text-muted-foreground">←</span>
        <Badge variant={flow.review ? "secondary" : "outline"}>2 · مراجعة التغييرات</Badge>
      </div>
      {operationError && (
        <Alert variant="destructive" className="border-border">
          <AlertTitle>لم تُحفظ التغييرات</AlertTitle>
          <AlertDescription>{operationError.message}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="border-border">
          <AlertTitle>{notice}</AlertTitle>
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>
            إخفاء
          </Button>
        </Alert>
      )}
      {flow.review ? (
        <ChangeReview
          review={flow.review}
          busy={flow.busy}
          onBack={flow.back}
          onSave={() => {
            if (flow.review) flow.save.mutate(flow.review.ticket);
          }}
        />
      ) : (
        <>
          <div className="grid min-w-0 items-start gap-5 xl:grid-cols-4">
            <div className="flex min-w-0 flex-col gap-3 xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant={parsed?.success && scopeValid ? "outline" : "destructive"}>
                  {parsed?.success && scopeValid
                    ? "بنية JSON صالحة · القيود تُراجع قبل الحفظ"
                    : "JSON يحتاج تصحيحاً"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {snapshots.length} سجل · {visibleFields.length} حقل ·{" "}
                  {draft.length.toLocaleString("ar-u-nu-latn")} حرف
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!("raw" in input) || flow.busy}
                  onClick={() => {
                    if ("raw" in input) update(JSON.stringify(input.raw, null, 2));
                  }}
                >
                  <WandSparklesIcon data-icon="inline-start" />
                  تنسيق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(draft)
                      .then(() => toast.add({ type: "success", title: "نُسخ JSON إلى الحافظة" }))
                      .catch(() => setNotice("تعذّر النسخ؛ يمكنك تحديد النص ونسخه من المحرر."))
                  }
                >
                  <CopyIcon data-icon="inline-start" />
                  نسخ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadJson(draft, `works-${snapshots.length}.json`)}
                >
                  <DownloadIcon data-icon="inline-start" />
                  تصدير JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={flow.busy}
                  aria-controls="json-file"
                  onClick={() => fileInput.current?.click()}
                >
                  <UploadIcon data-icon="inline-start" />
                  استيراد JSON
                </Button>
                <Input
                  ref={fileInput}
                  id="json-file"
                  aria-label="استيراد مسودة JSON"
                  hidden
                  tabIndex={-1}
                  type="file"
                  accept="application/json,.json"
                  disabled={flow.busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    event.target.value = "";
                    if (file.size > maxJsonFileBytes) {
                      setNotice("حجم الملف يتجاوز الحد المتاح (4 MB).");
                      return;
                    }
                    void file
                      .text()
                      .then(async (text) => {
                        const imported = readEditorDocument(text);
                        if (!("projection" in imported)) throw new Error(imported.error);
                        const result = imported.projection;
                        if (!result.success)
                          throw new Error(
                            "الملف لا يطابق قالب المستند. صدّر المسودة الحالية للاطلاع على القالب.",
                          );
                        if (checkRecordIdentities(originalRows, result.data.records).length)
                          throw new Error("الملف يحتوي أعمالاً خارج نطاق التحرير الحالي.");
                        if (
                          dirty &&
                          !(await confirmation.confirm("استبدال المسودة الحالية بالملف؟"))
                        )
                          return false;
                        setBuffers(originalRows);
                        setFields(result.data.fields);
                        setScope(fullStructureScope);
                        update(text);
                        return true;
                      })
                      .catch((cause: Error) => setNotice(cause.message));
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!dirty || flow.busy}
                  onClick={() => {
                    void confirmation
                      .confirm("تجاهل التغييرات وإعادة النسخة الأصلية؟")
                      .then((confirmed) => {
                        if (confirmed) {
                          setBuffers(originalRows);
                          update(initial);
                        }
                        return undefined;
                      });
                  }}
                >
                  <Undo2Icon data-icon="inline-start" />
                  استعادة الأصل
                </Button>
              </div>
              <Tabs defaultValue="json">
                <TabsList>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                  <TabsTrigger value="cards" disabled={!parsed?.success}>
                    البطاقات والتفاصيل
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="json">
                  <Suspense fallback={<Skeleton className="h-96" />}>
                    <CodeEditor
                      value={draft}
                      onChange={update}
                      readOnly={flow.busy}
                      suggestions={completionKeys}
                    />
                  </Suspense>
                </TabsContent>
                <TabsContent value="cards">
                  {parsed?.success && (
                    <div className="flex flex-col gap-4">
                      {parsed.data.records.map((record, index) => (
                        <JsonTreeEditor
                          key={String(record.id)}
                          value={record}
                          label={String(
                            record.titleAr ||
                              record.canonicalTitle ||
                              snapshots[index]?.document.canonicalTitle ||
                              `عمل ${index + 1}`,
                          )}
                          readOnly={flow.busy}
                          profile="work"
                          onChange={(next) =>
                            update(
                              JSON.stringify(
                                {
                                  ...parsed.data,
                                  records: parsed.data.records.map((value, position) =>
                                    position === index ? next : value,
                                  ),
                                },
                                null,
                                2,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              {parsed?.success && !scopeValid && (
                <Alert variant="destructive" className="border-border">
                  <AlertTitle>بعض معرّفات الأعمال تحتاج إلى تصحيح</AlertTitle>
                  <AlertDescription>
                    لا يمكن ربط هذه السجلات بالأعمال المحددة. أعد المعرّف الأصلي لكل عمل؛ لا تعدّل قيمة id
                    عند تحرير بقية الحقول.
                    <ul className="mt-2 flex flex-col gap-2">
                      {identityIssues.map((issue) => (
                        <li key={`${issue.id ?? "missing"}-${issue.title}`}>
                          <span className="font-medium">{issue.title}:</span> {issue.reason}
                          {issue.expectedId && (
                            <span className="flex flex-wrap items-baseline gap-x-1">
                              <span>الموجود</span>
                              <code dir="ltr" className="wrap-break-word">
                                {issue.id}
                              </code>
                              <span>والصحيح</span>
                              <code dir="ltr" className="wrap-break-word">
                                {issue.expectedId}
                              </code>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2">لإضافة عمل جديد، افتح صفحة إنشاء العمل.</p>
                  </AlertDescription>
                </Alert>
              )}
              {"error" in input && (
                <Alert variant="destructive" className="border-border">
                  <AlertTitle>صيغة JSON غير مكتملة</AlertTitle>
                  <AlertDescription>{input.error}</AlertDescription>
                </Alert>
              )}
              {parsed && !parsed.success && (
                <Alert variant="destructive" className="border-border">
                  <AlertTitle>راجع الحقول التالية ({parsed.error.issues.length})</AlertTitle>
                  <AlertDescription>
                    <ul>
                      {parsed.error.issues.slice(0, 8).map((issue) => (
                        <li key={jsonIssueKey(issue.path, issue.code, issue.message)}>
                          <code dir="ltr">{issue.path.join(".") || "JSON"}</code>: {issue.message}
                        </li>
                      ))}
                    </ul>
                    {parsed.error.issues.length > 8 && (
                      <p>تظهر أول 8 مشكلات؛ صحّحها لإظهار بقية المشكلات.</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Collapsible
                open={referenceOpen}
                onOpenChange={setReferenceOpen}
                className="flex flex-col gap-3"
              >
                <CollapsibleTrigger render={<Button variant="outline" />}>
                  <ChevronDownIcon data-icon="inline-start" />
                  {referenceOpen ? "إخفاء مرجع القيم" : "مرجع القيم والخيارات"}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {referenceOpen && <JsonEnumReference fields={visibleFields} scope={scope} />}
                </CollapsibleContent>
              </Collapsible>
            </div>

            <WorkDocumentScope
              visibleFields={visibleFields}
              scope={scope}
              busy={flow.busy}
              canChoose={Boolean(scopeValid)}
              controls={controls}
              onChoose={choose}
            />
          </div>
          <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
            <span className="text-sm text-muted-foreground">
              {dirty ? "مسودة غير محفوظة" : "لا توجد تغييرات"}
            </span>
            <Button
              disabled={!dirty || !parsed?.success || !scopeValid || flow.busy}
              onClick={() => flow.prepare.mutate(reviewJson)}
            >
              {flow.prepare.isPending ? "جارٍ إعداد المراجعة…" : "مراجعة التغييرات"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

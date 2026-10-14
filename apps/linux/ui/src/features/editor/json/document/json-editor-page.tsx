import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BracesIcon,
  CheckCheckIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { SelectField } from "@/features/editor/fields/work-fields";
import { ChangeReview } from "@/features/editor/json/document/change-review";
import {
  documentRow,
  equalValue,
  fieldKeys,
  workFields,
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
  preserveHidden,
  projectRows,
  type StructureScope,
} from "@/features/editor/json/tree/json-projection";
import { JsonTreeEditor } from "@/features/editor/json/tree/json-tree-editor";
import { useConfirm } from "@/features/editor/use-confirm";

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
const groups = [...new Set(workFields.map((field) => field.group))];
const identityFields: WorkField[] = ["canonicalTitle", "titleAr", "aliases", "trivia", "summary"];
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
  const [fields, setFields] = useState<WorkField[]>(fieldKeys);
  const [scope, setScope] = useState<StructureScope>(fullStructureScope);
  const [buffers, setBuffers] = useState(() =>
    snapshots.map(({ document }) => documentRow.parse(document)),
  );
  const originalRows = useMemo(
    () => snapshots.map(({ document }) => documentRow.parse(document)),
    [snapshots],
  );
  const initial = useMemo(
    () => JSON.stringify(projectRows(originalRows, fields, scope), null, 2),
    [originalRows, fields, scope],
  );
  const [draft, setDraft] = useState(initial);
  const [fieldSearch, setFieldSearch] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preset, setPreset] = useState("all");
  const [referenceOpen, setReferenceOpen] = useState(false);
  const input = useMemo(() => readEditorDocument(draft), [draft]);
  const parsed = "projection" in input ? input.projection : null;
  const visibleFields = parsed?.success ? parsed.data.fields : fields;
  const mergedRows = parsed?.success
    ? buffers.map((record) => {
        const patch = parsed.data.records.find((value) => value.id === record.id);
        return patch ? documentRow.parse(preserveHidden(record, patch)) : record;
      })
    : buffers;
  const recordIdCounts = new Map<string, number>();
  if (parsed?.success)
    for (const record of parsed.data.records) {
      const id = z.string().safeParse(record.id).data;
      if (id) recordIdCounts.set(id, (recordIdCounts.get(id) ?? 0) + 1);
    }
  const originalIds = new Set(
    originalRows.flatMap((record) => {
      const id = z.string().safeParse(record.id).data;
      return id ? [id] : [];
    }),
  );
  const originalIdByTitle = new Map<string, string>();
  for (const record of originalRows) {
    const id = z.string().safeParse(record.id).data;
    const title = z.string().safeParse(record.canonicalTitle).data;
    if (id && title) originalIdByTitle.set(title, id);
  }
  const identityIssues: Array<{
    title: string;
    id: string | null;
    expectedId: string | null;
    reason: string;
  }> = [];
  if (parsed?.success)
    parsed.data.records.forEach((record, index) => {
      const id = z.string().safeParse(record.id).data ?? null;
      const canonicalTitle = z.string().safeParse(record.canonicalTitle).data;
      const title =
        z.string().safeParse(record.titleAr).data || canonicalTitle || `السجل ${index + 1}`;
      if (!id) {
        identityIssues.push({ title, id, expectedId: null, reason: "لا يوجد معرّف نصي." });
        return;
      }
      if ((recordIdCounts.get(id) ?? 0) > 1) {
        if (
          index ===
          parsed.data.records.findIndex(
            (candidate) => z.string().safeParse(candidate.id).data === id,
          )
        )
          identityIssues.push({
            title,
            id,
            expectedId: null,
            reason: "هذا المعرّف مستخدم في أكثر من سجل.",
          });
        return;
      }
      if (originalIds.has(id)) return;
      const expectedId = canonicalTitle ? (originalIdByTitle.get(canonicalTitle) ?? null) : null;
      identityIssues.push({
        title,
        id,
        expectedId,
        reason: expectedId
          ? "المعرّف لا يطابق العمل الأصلي."
          : "هذا المعرّف لا ينتمي إلى الأعمال المحددة للتحرير.",
      });
    });
  const scopeValid = parsed?.success && identityIssues.length === 0;
  const reviewJson = JSON.stringify({ schemaVersion: 1, fields: fieldKeys, records: mergedRows });
  const dirty =
    !equalValue(originalRows, mergedRows) ||
    ((!parsed?.success || !scopeValid) && draft !== initial);
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
    if (!equalValue(next, visibleFields)) setPreset("custom");
    setScope(nextScope);
    update(JSON.stringify(projectRows(mergedRows, next, nextScope), null, 2));
  }
  function download() {
    const blob = new Blob([draft], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `works-${snapshots.length}.json`;
    link.click();
    URL.revokeObjectURL(url);
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
                  {draft.length.toLocaleString()} حرف
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
                <Button variant="outline" size="sm" onClick={download}>
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
                    if (file.size > 4000000) {
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
                        if (
                          new Set(result.data.records.map((record) => record.id)).size !==
                            result.data.records.length ||
                          result.data.records.some(
                            (record) => !originalRows.some((original) => original.id === record.id),
                          )
                        )
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
                    event.target.value = "";
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
                          setBuffers(snapshots.map(({ document }) => documentRow.parse(document)));
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
                      <p>تظهر أول ٨ مشكلات؛ صحّحها لإظهار بقية المشكلات.</p>
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

            <Card size="sm" className="min-w-0 xl:sticky xl:top-4 xl:order-last">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>محتوى JSON</CardTitle>
                  <Badge variant="secondary">
                    {visibleFields.length} / {fieldKeys.length}
                  </Badge>
                </div>
                <CardDescription>
                  اختر ما يظهر في النص. إخفاء الحقول يحفظ قيمها وتعديلاتها.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <SelectField
                    label="قالب الحقول"
                    value={
                      preset !== "custom" && sameFields(visibleFields, presetFields(preset))
                        ? preset
                        : "custom"
                    }
                    items={[
                      { value: "all", label: "كل الحقول" },
                      { value: "identity", label: "هوية العمل" },
                      { value: "indexing", label: "الفهرسة والعلاقات" },
                      { value: "editorial", label: "التحرير" },
                      { value: "structure", label: "الأجزاء والحلقات والتقييمات" },
                      { value: "custom", label: "اختيار مخصص" },
                    ]}
                    onChange={(value) => {
                      if (!parsed?.success || !scopeValid || value === "custom") return;
                      choose(presetFields(value));
                      setPreset(value);
                    }}
                  />
                  <Field>
                    <FieldLabel htmlFor="json-field-search" className="sr-only">
                      بحث في الحقول والتفاصيل
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="json-field-search"
                        value={fieldSearch}
                        onChange={(event) => setFieldSearch(event.target.value)}
                        placeholder="بحث بالاسم أو المفتاح…"
                      />
                      <InputGroupAddon>
                        <SearchIcon />
                      </InputGroupAddon>
                      {fieldSearch && (
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            size="icon-xs"
                            aria-label="مسح بحث الحقول"
                            onClick={() => setFieldSearch("")}
                          >
                            <XIcon data-icon="inline-start" />
                          </InputGroupButton>
                        </InputGroupAddon>
                      )}
                    </InputGroup>
                  </Field>
                  <Tabs defaultValue="fields">
                    <TabsList className="w-full">
                      <TabsTrigger value="fields">الحقول</TabsTrigger>
                      <TabsTrigger value="structure">الأجزاء</TabsTrigger>
                      <TabsTrigger value="episodes">الحلقات</TabsTrigger>
                    </TabsList>
                    <TabsContent value="fields">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Field orientation="horizontal">
                            <Checkbox
                              id="json-select-all"
                              checked={visibleFields.length === fieldKeys.length}
                              indeterminate={
                                visibleFields.length > 0 && visibleFields.length < fieldKeys.length
                              }
                              disabled={flow.busy}
                              onCheckedChange={(checked) => {
                                choose(checked === true ? fieldKeys : ["canonicalTitle"]);
                                if (checked === true) setPreset("all");
                              }}
                            />
                            <FieldLabel htmlFor="json-select-all">تحديد الكل</FieldLabel>
                          </Field>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={flow.busy}
                            onClick={() => choose(["canonicalTitle"])}
                          >
                            العنوان فقط
                          </Button>
                        </div>
                        <ScrollArea className="h-80">
                          <div className="pe-3">
                            <FieldGroup>
                              {groups.map((group) => {
                                const all = workFields.filter((field) => field.group === group);
                                const items = all.filter((field) =>
                                  matchesFieldSearch(field, fieldSearch),
                                );
                                if (!items.length) return null;
                                return (
                                  <JsonScopeGroup
                                    key={group}
                                    prefix={`json-${group.replace(/\s+/g, "-")}`}
                                    label={group}
                                    items={items}
                                    allItems={all}
                                    selected={visibleFields}
                                    disabled={flow.busy}
                                    onChange={(next) => {
                                      const keys = new Set(all.map(({ key }) => key));
                                      choose([
                                        ...visibleFields.filter((key) => !keys.has(key)),
                                        ...next,
                                      ]);
                                    }}
                                  />
                                );
                              })}
                              {!workFields.some((field) =>
                                matchesFieldSearch(field, fieldSearch),
                              ) && (
                                <Empty>
                                  <EmptyHeader>
                                    <EmptyTitle>لا توجد حقول مطابقة</EmptyTitle>
                                    <EmptyDescription>
                                      جرّب اسم الحقل بالعربية أو مفتاحه.
                                    </EmptyDescription>
                                  </EmptyHeader>
                                </Empty>
                              )}
                            </FieldGroup>
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                    <TabsContent value="structure">
                      {visibleFields.includes("installments") ? (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              المعرّف والعنوان ثابتان في النص.
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={flow.busy}
                              onClick={() =>
                                choose(visibleFields, {
                                  ...scope,
                                  installments: fullStructureScope.installments,
                                })
                              }
                            >
                              <CheckCheckIcon data-icon="inline-start" />
                              كل التفاصيل
                            </Button>
                          </div>
                          <ScrollArea className="h-80">
                            <div className="pe-3">
                              <FieldGroup>
                                {installmentGroups.map((group) => {
                                  const all = installmentFields.filter((field) =>
                                    group.keys.some((key) => key === field.key),
                                  );
                                  const items = all.filter((field) =>
                                    matchesFieldSearch(field, fieldSearch),
                                  );
                                  if (!items.length) return null;
                                  return (
                                    <JsonScopeGroup
                                      key={group.label}
                                      prefix={`json-part-${group.keys[0]}`}
                                      label={group.label}
                                      items={items}
                                      allItems={all}
                                      selected={scope.installments}
                                      disabled={flow.busy}
                                      onChange={(next) => {
                                        const keys = all.map(({ key }) => key);
                                        choose(visibleFields, {
                                          ...scope,
                                          installments: [
                                            ...scope.installments.filter(
                                              (key) => !keys.some((value) => value === key),
                                            ),
                                            ...next,
                                          ],
                                        });
                                      }}
                                    />
                                  );
                                })}
                                {!installmentFields.some((field) =>
                                  matchesFieldSearch(field, fieldSearch),
                                ) && (
                                  <Empty>
                                    <EmptyHeader>
                                      <EmptyTitle>لا توجد تفاصيل مطابقة</EmptyTitle>
                                    </EmptyHeader>
                                  </Empty>
                                )}
                              </FieldGroup>
                            </div>
                          </ScrollArea>
                        </div>
                      ) : (
                        <Empty>
                          <EmptyHeader>
                            <EmptyTitle>الأجزاء مخفية في النص</EmptyTitle>
                            <EmptyDescription>
                              أظهر الأجزاء لتحديد الحلقات والتقييمات وبقية التفاصيل.
                            </EmptyDescription>
                          </EmptyHeader>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={flow.busy}
                            onClick={() => choose([...visibleFields, "installments"])}
                          >
                            إظهار الأجزاء
                          </Button>
                        </Empty>
                      )}
                    </TabsContent>
                    <TabsContent value="episodes">
                      <FieldGroup>
                        <Field orientation="horizontal">
                          <Checkbox
                            id="json-include-episodes"
                            checked={
                              visibleFields.includes("installments") &&
                              scope.installments.includes("episodes")
                            }
                            disabled={flow.busy}
                            onCheckedChange={(checked) =>
                              choose(
                                visibleFields.includes("installments")
                                  ? visibleFields
                                  : [...visibleFields, "installments"],
                                {
                                  ...scope,
                                  installments:
                                    checked === true
                                      ? [...new Set([...scope.installments, "episodes"])]
                                      : scope.installments.filter((key) => key !== "episodes"),
                                },
                              )
                            }
                          />
                          <FieldLabel htmlFor="json-include-episodes">
                            إظهار الحلقات في JSON
                          </FieldLabel>
                        </Field>
                        {visibleFields.includes("installments") &&
                        scope.installments.includes("episodes") ? (
                          <>
                            <p className="text-xs text-muted-foreground">
                              رقم الحلقة ومعرّفها يظهران دائماً. اختر التفاصيل الإضافية.
                            </p>
                            <JsonScopeGroup
                              prefix="json-episodes"
                              label="تفاصيل الحلقات"
                              items={episodeFields.filter((field) =>
                                matchesFieldSearch(field, fieldSearch),
                              )}
                              allItems={episodeFields}
                              selected={scope.episodes}
                              disabled={flow.busy}
                              onChange={(episodes) => choose(visibleFields, { ...scope, episodes })}
                            />
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            الحلقات المخفية محفوظة ولا تتأثر بتعديل بقية العمل.
                          </p>
                        )}
                      </FieldGroup>
                    </TabsContent>
                  </Tabs>
                </FieldGroup>
              </CardContent>
            </Card>
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

const installmentGroups = [
  {
    label: "الهوية والعرض",
    keys: ["kind", "position", "summary", "status", "releaseDate", "runtimeMinutes"],
  },
  {
    label: "التصنيف والمخاطر",
    keys: [
      "audienceOverride",
      "ageOverride",
      "sexualityRiskOverride",
      "behavioralRiskOverride",
      "theologyRiskOverride",
    ],
  },
  { label: "التقييمات والصور والحلقات", keys: ["score", "media", "episodes"] },
  { label: "المعرّفات الخارجية", keys: ["tmdbId", "imdbId", "anilistId", "malId"] },
] as const;
function matchesFieldSearch(field: { key: string; label: string }, search: string) {
  return `${field.label} ${field.key}`.toLowerCase().includes(search.trim().toLowerCase());
}
function JsonScopeGroup<Key extends string>({
  prefix,
  label,
  items,
  allItems,
  selected,
  disabled,
  onChange,
}: {
  prefix: string;
  label: string;
  items: readonly { key: Key; label: string }[];
  allItems: readonly { key: Key; label: string }[];
  selected: readonly Key[];
  disabled: boolean;
  onChange: (keys: Key[]) => void;
}) {
  const keys = allItems.map(({ key }) => key);
  const count = keys.filter((key) => selected.includes(key)).length;
  return (
    <FieldSet>
      <FieldLegend variant="label" className="sr-only">
        {label}
      </FieldLegend>
      <FieldGroup data-slot="checkbox-group">
        <Field orientation="horizontal">
          <Checkbox
            id={`${prefix}-all`}
            checked={count === keys.length}
            indeterminate={count > 0 && count < keys.length}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked === true ? keys : [])}
          />
          <FieldLabel htmlFor={`${prefix}-all`}>{label}</FieldLabel>
          <Badge variant="outline">
            {count}/{keys.length}
          </Badge>
        </Field>
        <div className="ps-6">
          <FieldGroup data-slot="checkbox-group">
            {items.map((field) => (
              <Field key={field.key} orientation="horizontal">
                <Checkbox
                  id={`${prefix}-${field.key}`}
                  checked={selected.includes(field.key)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...keys.filter((key) => selected.includes(key)), field.key]
                        : keys.filter((key) => selected.includes(key) && key !== field.key),
                    )
                  }
                />
                <FieldLabel htmlFor={`${prefix}-${field.key}`}>
                  <span>
                    {field.label}
                    <span
                      dir="ltr"
                      className="block break-all font-utility text-xs text-muted-foreground"
                    >
                      {field.key}
                    </span>
                  </span>
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
        </div>
      </FieldGroup>
    </FieldSet>
  );
}

function presetFields(value: string): WorkField[] {
  if (value === "all") return [...fieldKeys];
  if (value === "identity") return [...identityFields];
  if (value === "structure") return ["canonicalTitle", "installments", "awards"];
  return workFields
    .filter((field) => field.group === (value === "indexing" ? "الفهرسة" : "التحرير"))
    .map((field) => field.key);
}

function sameFields(left: readonly WorkField[], right: readonly WorkField[]) {
  return left.length === right.length && right.every((key) => left.includes(key));
}

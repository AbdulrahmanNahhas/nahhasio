import type { WorkDocument } from "@arcadia/contracts/work";
import { workScore } from "@arcadia/domain";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  CheckIcon,
  FileText,
  Layers,
  Tags,
  ShieldCheck,
  Images,
  Trophy,
  ArrowRight,
} from "lucide-react";
import { lazy, Suspense, useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ageChoices,
  audienceChoices,
  riskChoices,
} from "@/features/catalog/works/classification-choices";
import { workflowLabels } from "@/features/catalog/works/works-model";
import { WorkImages } from "@/features/editor/artwork/work-images";
import { AwardsEditor } from "@/features/editor/fields/awards-editor";
import { PlaybackFields } from "@/features/editor/fields/playback-fields";
import { SelectField, StringListField, TextField } from "@/features/editor/fields/work-fields";
import { ChangeReview } from "@/features/editor/json/document/change-review";
import {
  equalValue,
  fieldKeys,
  projectDocuments,
  type WorkSnapshot,
} from "@/features/editor/json/document/document-model";
import { workSnapshotsOptions } from "@/features/editor/json/document/document.queries";
import { useDocumentReview } from "@/features/editor/json/document/use-document-review";
import { ReferenceListField } from "@/features/editor/references/reference-field";
import { WorkReferences } from "@/features/editor/references/work-references";
import { RegisteredImage } from "@/features/editor/registered-image";
import { WorkDraftJson } from "@/features/editor/work/work-draft-json";
import { WorkScoreBadge, WorkScoreDetails } from "@/features/scoring/work-score";

const StructureEditor = lazy(() =>
  import("@/features/editor/structure/structure-editor").then((module) => ({
    default: module.StructureEditor,
  })),
);

export function WorkDetailPage({ id }: { id: string }) {
  const query = useQuery(workSnapshotsOptions([id]));
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError)
    return (
      <Alert variant="destructive" className="border-border">
        <AlertTitle>تعذّر تحميل العمل</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
        <Button variant="outline" onClick={() => void query.refetch()}>
          إعادة المحاولة
        </Button>
      </Alert>
    );
  const snapshot = query.data[0];
  if (!snapshot) return null;
  return <WorkWorkspace key={snapshot.revision} snapshot={snapshot} />;
}
export function WorkWorkspace({
  snapshot,
  create = false,
}: {
  snapshot: WorkSnapshot;
  create?: boolean;
}) {
  const [draft, setDraft] = useState(snapshot.document);
  const state = useSearch({ strict: false });
  const navigate = useNavigate();
  const dirty = !equalValue(snapshot.document, draft);
  const json = useCallback(
    () => JSON.stringify(create ? draft : projectDocuments([draft], fieldKeys)),
    [create, draft],
  );
  const flow = useDocumentReview([snapshot], json, dirty, create);
  function update<K extends keyof WorkDocument>(key: K, value: WorkDocument[K]) {
    flow.changed();
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const name = draft.titleAr || draft.canonicalTitle || "عمل جديد";
  const error = flow.save.error ?? flow.prepare.error;
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-400 flex-col gap-6 p-4 pb-8 sm:p-6">
      {flow.leaveDialog}
      <header className="flex flex-wrap items-start justify-between gap-5 rounded-2xl bg-card p-5 sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          {snapshot.document.media?.poster?.startsWith("/media/") && (
            <RegisteredImage
              src={snapshot.document.media.poster}
              alt=""
              className="aspect-2/3 w-16 shrink-0 rounded-xl sm:w-20"
              fit="cover"
            />
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <Link
              to="/admin/works"
              className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowRight className="size-3.5" aria-hidden="true" />
              الأعمال
            </Link>
            <h1 className="break-words text-2xl font-semibold">{name}</h1>
            <p dir="auto" className="text-sm text-muted-foreground">
              {draft.canonicalTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {draft.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
              </Badge>
              <Badge variant="outline">{draft.releaseYear ?? "بلا سنة"}</Badge>
              <Badge variant="outline">{workflowLabels[draft.workflowStatus ?? "draft"]}</Badge>
              {draft.isPrivate && <Badge variant="secondary">خاص</Badge>}
              <WorkScoreBadge
                score={workScore((draft.installments ?? []).map((item) => item.score ?? {}))}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <p className="text-sm text-muted-foreground">
            {draft.installments?.length ?? 0} جزء ·{" "}
            {draft.installments?.reduce((sum, item) => sum + (item.episodes?.length ?? 0), 0) ?? 0}{" "}
            حلقة
          </p>
          {!create && (
            <Button variant="secondary" render={<a href={`#/titles/${snapshot.document.id}`} />}>
              عرض العمل
            </Button>
          )}
        </div>
      </header>
      {error && (
        <Alert variant="destructive" className="border-border">
          <AlertTitle>لم تُحفظ التغييرات</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {flow.saved && (
        <Alert className="border-border">
          <AlertTitle>حُفظت التغييرات</AlertTitle>
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
          <Tabs
            className="gap-5"
            value={state.section === "references" ? "images" : (state.section ?? "identity")}
            onValueChange={(section) => {
              if (
                section === "identity" ||
                section === "structure" ||
                section === "indexing" ||
                section === "editorial" ||
                section === "images" ||
                section === "references" ||
                section === "awards"
              )
                void navigate({
                  to: ".",
                  replace: true,
                  search: { section },
                });
            }}
          >
            <div className="sticky top-0 z-10 min-w-0 bg-background py-2">
              <TabsList
                className="group-data-horizontal/tabs:h-auto w-full flex-wrap justify-start gap-1"
                aria-label="أقسام تحرير العمل"
              >
                <TabsTrigger value="identity">
                  <FileText data-icon="inline-start" />
                  نظرة عامة
                </TabsTrigger>
                <TabsTrigger value="structure">
                  <Layers data-icon="inline-start" />
                  البنية
                </TabsTrigger>
                <TabsTrigger value="indexing">
                  <Tags data-icon="inline-start" />
                  الفهرسة
                </TabsTrigger>
                <TabsTrigger value="editorial">
                  <ShieldCheck data-icon="inline-start" />
                  التحرير
                </TabsTrigger>
                <TabsTrigger value="images">
                  <Images data-icon="inline-start" />
                  الصور والمراجع
                </TabsTrigger>
                <TabsTrigger value="awards">
                  <Trophy data-icon="inline-start" />
                  الجوائز
                </TabsTrigger>
              </TabsList>
            </div>
            <fieldset disabled={flow.busy} className="min-w-0">
              <TabsContent value="identity" className="flex flex-col gap-5">
                <div className="grid items-start gap-5 xl:grid-cols-3">
                  <Card className="xl:col-span-2">
                    <CardHeader>
                      <CardTitle>هوية العمل</CardTitle>
                      <CardDescription>الأسماء والوصف والحقائق.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup>
                        <FieldGroup className="grid md:grid-cols-2">
                          <TextField
                            label="العنوان الأصلي"
                            value={draft.canonicalTitle}
                            onChange={(value) => update("canonicalTitle", value)}
                          />
                          <TextField
                            label="العنوان العربي"
                            value={draft.titleAr}
                            onChange={(value) => update("titleAr", value || null)}
                          />
                          <TextField
                            label="سنة الإصدار"
                            type="number"
                            min={1800}
                            max={2200}
                            value={draft.releaseYear}
                            onChange={(value) =>
                              update("releaseYear", value ? Number(value) : null)
                            }
                          />
                          <SelectField
                            label="الصيغة"
                            value={draft.format ?? "animated"}
                            onChange={(value) => update("format", value)}
                            items={[
                              { value: "animated", label: "رسوم متحركة" },
                              { value: "live-action", label: "تمثيل حي" },
                            ]}
                          />
                        </FieldGroup>
                        <TextField
                          label="الملخص"
                          multiline
                          value={draft.summary}
                          onChange={(value) => update("summary", value)}
                        />
                      </FieldGroup>
                    </CardContent>
                  </Card>
                  <div className="flex min-w-0 flex-col gap-5">
                    <Card size="sm">
                      <CardHeader>
                        <CardTitle>الأسماء البديلة</CardTitle>
                        <CardDescription>أسماء إضافية تساعد في البحث عن العمل.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <StringListField
                          label="الأسماء البديلة"
                          values={draft.aliases ?? []}
                          onChange={(value) => update("aliases", value)}
                        />
                      </CardContent>
                    </Card>
                    <Card size="sm">
                      <CardHeader>
                        <CardTitle>حقائق ومعلومات</CardTitle>
                        <CardDescription>أضف معلومة مستقلة في كل سطر.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <StringListField
                          label="حقائق ومعلومات"
                          ordered
                          values={draft.trivia ?? []}
                          onChange={(value) => update("trivia", value)}
                        />
                      </CardContent>
                    </Card>
                  </div>
                </div>
                <PlaybackFields draft={draft} update={update} />
                <WorkScoreDetails installments={draft.installments ?? []} />
              </TabsContent>
              <TabsContent value="structure">
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <StructureEditor
                    workId={snapshot.document.id ?? ""}
                    tmdbId={draft.tmdbId}
                    installments={draft.installments ?? []}
                    onChange={(value) => update("installments", value)}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="indexing">
                <Card>
                  <CardHeader>
                    <CardTitle>التصنيف والمساهمون</CardTitle>
                    <CardDescription>اختر المفردات المعتمدة أو ابحث عن سجل محدد.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <FieldGroup className="grid md:grid-cols-2">
                        {(
                          [
                            { key: "genres", label: "التصنيفات" },
                            { key: "tags", label: "الوسوم" },
                            { key: "tones", label: "الطابع" },
                            { key: "countries", label: "الدول" },
                            { key: "planets", label: "الكواكب" },
                          ] as const
                        ).map((field) => (
                          <ReferenceListField
                            key={field.key}
                            label={field.label}
                            table={field.key}
                            values={draft[field.key] ?? []}
                            onChange={(value) => update(field.key, value)}
                          />
                        ))}
                      </FieldGroup>
                      <WorkReferences draft={draft} update={update} creditsOnly />
                    </FieldGroup>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="editorial">
                <Card>
                  <CardHeader>
                    <CardTitle>التحرير والتصنيف العائلي</CardTitle>
                    <CardDescription>التصنيف والتنبيهات والملاحظات وحالة النشر.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <Field orientation="horizontal" className="rounded-xl bg-muted/40 p-4">
                        <FieldContent>
                          <FieldLabel htmlFor="editor-work-private">عمل خاص</FieldLabel>
                          <FieldDescription>
                            إخفاء العمل من المكتبة العامة، مع إبقائه متاحًا للإدارة.
                          </FieldDescription>
                        </FieldContent>
                        <Switch
                          id="editor-work-private"
                          checked={draft.isPrivate ?? false}
                          onCheckedChange={(value) => update("isPrivate", value)}
                        />
                      </Field>
                      <FieldGroup className="grid md:grid-cols-2 lg:grid-cols-3">
                        <SelectField
                          label="الجمهور"
                          value={draft.audience ?? "general"}
                          items={audienceChoices}
                          onChange={(value) => update("audience", value)}
                        />
                        <SelectField
                          label="تصنيف السن"
                          value={draft.age ?? "all"}
                          items={ageChoices}
                          onChange={(value) => update("age", value)}
                        />
                        {(
                          [
                            { key: "sexualityRisk", label: "المحتوى الجنسي" },
                            { key: "behavioralRisk", label: "المحتوى السلوكي" },
                            { key: "theologyRisk", label: "المحتوى العقدي" },
                          ] as const
                        ).map((field) => (
                          <SelectField
                            key={field.key}
                            label={field.label}
                            value={draft[field.key] ?? "none"}
                            items={riskChoices}
                            onChange={(value) => update(field.key, value)}
                          />
                        ))}
                        <SelectField
                          label="حالة النشر"
                          value={draft.workflowStatus ?? "draft"}
                          items={[
                            { value: "draft", label: workflowLabels.draft },
                            { value: "in_review", label: workflowLabels.in_review },
                            { value: "approved", label: workflowLabels.approved },
                            { value: "published", label: workflowLabels.published },
                            { value: "archived", label: workflowLabels.archived },
                          ]}
                          onChange={(value) => update("workflowStatus", value)}
                        />
                      </FieldGroup>
                      {(
                        [
                          { key: "contentWarnings", label: "تنبيهات المحتوى" },
                          { key: "analysisNotes", label: "ملاحظات التحليل" },
                          { key: "curatorNotes", label: "ملاحظات المحرر" },
                        ] as const
                      ).map((field) => (
                        <TextField
                          key={field.key}
                          label={field.label}
                          multiline
                          value={draft[field.key]}
                          onChange={(value) => update(field.key, value)}
                        />
                      ))}
                    </FieldGroup>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="images">
                <WorkImages draft={draft} original={snapshot.document} update={update} />
              </TabsContent>
              <TabsContent value="awards">
                <AwardsEditor draft={draft} onChange={(value) => update("awards", value)} />
              </TabsContent>
            </fieldset>
          </Tabs>
          <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-popover p-3 shadow-lg sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={dirty ? "secondary" : "outline"}>
                {dirty ? "تغييرات غير محفوظة" : create ? "مسودة جديدة" : "كل التغييرات محفوظة"}
              </Badge>
              <WorkDraftJson
                document={draft}
                disabled={flow.busy}
                onApply={(value) => {
                  flow.changed();
                  setDraft((current) => ({ ...current, ...value }));
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={!dirty || flow.busy}
                onClick={() => {
                  setDraft(snapshot.document);
                  flow.changed();
                }}
              >
                تجاهل التغييرات
              </Button>
              <Button
                disabled={!dirty || flow.busy || !draft.canonicalTitle.trim()}
                onClick={() => flow.prepare.mutate(json())}
              >
                {flow.prepare.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CheckIcon data-icon="inline-start" />
                )}
                {flow.prepare.isPending
                  ? "جارٍ المراجعة…"
                  : create
                    ? "مراجعة العمل"
                    : "مراجعة التغييرات"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

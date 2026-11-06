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
  ExternalLink,
} from "lucide-react";
import { lazy, Suspense, useCallback, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ageChoices,
  audienceChoices,
  riskChoices,
} from "@/features/catalog/works/classification-choices";
import { workflowLabels } from "@/features/catalog/works/works-model";
import { WorkImages } from "@/features/editor/artwork/work-images";
import { AwardsEditor } from "@/features/editor/fields/awards-editor";
import { SelectField, TextField } from "@/features/editor/fields/work-fields";
import { ChangeReview } from "@/features/editor/json/document/change-review";
import {
  equalValue,
  fieldKeys,
  projectDocuments,
  type WorkSnapshot,
} from "@/features/editor/json/document/document-model";
import { workSnapshotsOptions } from "@/features/editor/json/document/document.queries";
import { useDocumentReview } from "@/features/editor/json/document/use-document-review";
import { ReferenceField, ReferenceListField } from "@/features/editor/references/reference-field";
import { vocabularyOptions } from "@/features/editor/references/reference.functions";
import { WorkReferences } from "@/features/editor/references/work-references";
import { RegisteredImage } from "@/features/editor/registered-image";
import { WorkDraftJson } from "@/features/editor/work/work-draft-json";
import { WorkScoreBadge } from "@/features/scoring/work-score";

import { WorkOverview } from "./work-overview";

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
  useQuery(vocabularyOptions());
  const [draft, setDraft] = useState(snapshot.document);
  const [selectedPartId, setSelectedPartId] = useState("");
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
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-400 flex-1 flex-col gap-4 p-4 pb-3 sm:p-6 sm:pb-3">
      {flow.leaveDialog}
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {draft.media?.poster?.startsWith("/media/") && (
            <RegisteredImage
              src={draft.media.poster}
              alt=""
              className="aspect-2/3 w-12 shrink-0 rounded-lg"
              fit="cover"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Link
              to="/admin/works"
              className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <ArrowRight className="size-3.5" aria-hidden="true" />
              الأعمال
            </Link>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="break-words text-xl font-semibold">{name}</h1>
              {draft.canonicalTitle !== name && (
                <p dir="auto" className="text-sm text-muted-foreground">
                  {draft.canonicalTitle}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {draft.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}
              </Badge>
              <Badge variant="outline">{draft.releaseYear ?? "بلا سنة"}</Badge>
              <Badge variant="outline">{workflowLabels[draft.workflowStatus ?? "draft"]}</Badge>
              {draft.isPrivate && <Badge variant="secondary">خاص</Badge>}
              {draft.playbackPolicy === "files-only" && <Badge variant="outline">ملفات فقط</Badge>}
              <WorkScoreBadge
                score={workScore((draft.installments ?? []).map((item) => item.score ?? {}))}
              />
              <span className="text-xs text-muted-foreground">
                {draft.installments?.length ?? 0} جزء ·{" "}
                {draft.installments?.reduce((sum, item) => sum + (item.episodes?.length ?? 0), 0) ??
                  0}{" "}
                حلقة
              </span>
            </div>
          </div>
        </div>
        {!create && (
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<a href={`#/titles/${snapshot.document.id}`} />}
          >
            <ExternalLink data-icon="inline-start" />
            عرض العمل
          </Button>
        )}
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
            className="min-h-0 flex-1 gap-4"
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
                  الصور
                </TabsTrigger>
                <TabsTrigger value="awards">
                  <Trophy data-icon="inline-start" />
                  الجوائز
                </TabsTrigger>
              </TabsList>
            </div>
            <fieldset disabled={flow.busy} className="min-w-0">
              <TabsContent value="identity" className="flex flex-col gap-5">
                <WorkOverview
                  draft={draft}
                  update={update}
                  onStructure={() =>
                    void navigate({ to: ".", replace: true, search: { section: "structure" } })
                  }
                />
              </TabsContent>
              <TabsContent value="structure">
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <StructureEditor
                    format={draft.format}
                    selectedPartId={selectedPartId}
                    onSelectPart={setSelectedPartId}
                    workId={snapshot.document.id ?? ""}
                    tmdbId={draft.tmdbId}
                    installments={draft.installments ?? []}
                    persistedInstallments={create ? [] : (snapshot.document.installments ?? [])}
                    playbackPolicy={draft.playbackPolicy}
                    workLanguages={
                      draft.languages ?? (draft.dubLanguages?.includes("ar") ? ["ar"] : ["en"])
                    }
                    allowImport={!dirty && !create}
                    onChange={(value) => update("installments", value)}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="indexing" className="flex flex-col gap-4">
                <div className="grid items-start gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>التصنيفات والوسوم</CardTitle>
                      <CardDescription>النوع والطابع والوسوم التي تصف العمل.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        {(
                          [
                            { key: "genres", label: "التصنيفات" },
                            { key: "tags", label: "الوسوم" },
                            { key: "tones", label: "الطابع" },
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
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>العالم وبلدان الإنتاج</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup className="gap-4">
                        <ReferenceListField
                          label="الدول"
                          table="countries"
                          values={draft.countries ?? []}
                          onChange={(value) => update("countries", value)}
                        />
                        <FieldGroup className="gap-2">
                          <ReferenceField
                            label="الكوكب"
                            table="planets"
                            value={draft.planets?.[0] ?? ""}
                            onChange={(value) => update("planets", value ? [value] : [])}
                          />
                          {!!draft.planets?.length && (
                            <Button
                              variant="ghost"
                              size="xs"
                              className="w-fit"
                              onClick={() => update("planets", [])}
                            >
                              إزالة الكوكب
                            </Button>
                          )}
                        </FieldGroup>
                      </FieldGroup>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle>المساهمون والاستوديوهات</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WorkReferences draft={draft} update={update} creditsOnly />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>المعرّفات والمراجع والروابط</CardTitle>
                    <CardDescription>
                      معرّفات العمل ومراجعه. معرّفات كل جزء في تبويب البنية.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <WorkReferences draft={draft} update={update} />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="editorial">
                <Card>
                  <CardHeader>
                    <CardTitle>التحرير والتصنيف العائلي</CardTitle>
                    <CardDescription>التصنيف والتنبيهات والملاحظات.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
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
                          label={
                            field.key === "curatorNotes"
                              ? "ملاحظة المحرر (تظهر للمشاهدين في صفحة العمل)"
                              : field.label
                          }
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
          <div className="sticky bottom-3 z-20 mt-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-popover p-3 shadow-lg">
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
                size="sm"
                disabled={!dirty || flow.busy}
                onClick={() => {
                  setDraft(snapshot.document);
                  flow.changed();
                }}
              >
                تجاهل التغييرات
              </Button>
              <Button
                size="sm"
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

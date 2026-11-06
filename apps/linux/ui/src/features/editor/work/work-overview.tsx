import type { WorkDocument } from "@arcadia/contracts/work";
import { installmentRating, workScore } from "@arcadia/domain";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { workflowLabels } from "@/features/catalog/works/works-model";
import { LanguagesField } from "@/features/editor/fields/languages-field";
import { WorkTrailers } from "@/features/editor/fields/playback-fields";
import { TextField, SelectField, StringListField } from "@/features/editor/fields/work-fields";
import { scoreDefinitions } from "@/features/scoring/score-model";
import { WorkScoreBadge } from "@/features/scoring/work-score";

type Update = <K extends keyof WorkDocument>(key: K, value: WorkDocument[K]) => void;

export function WorkOverview({
  draft,
  update,
  onStructure,
}: {
  draft: WorkDocument;
  update: Update;
  onStructure: () => void;
}) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>بيانات العمل</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FieldGroup className="grid sm:grid-cols-2">
                <TextField
                  label="العنوان العربي"
                  value={draft.titleAr}
                  onChange={(value) => update("titleAr", value || null)}
                />
                <TextField
                  label="العنوان الأصلي"
                  value={draft.canonicalTitle}
                  onChange={(value) => update("canonicalTitle", value)}
                />
                <TextField
                  label="سنة الإصدار"
                  type="number"
                  min={1800}
                  max={2200}
                  value={draft.releaseYear}
                  onChange={(value) => update("releaseYear", value ? Number(value) : null)}
                />
                <SelectField
                  label="الصيغة"
                  value={draft.format ?? "animated"}
                  items={[
                    { value: "animated", label: "رسوم متحركة" },
                    { value: "live-action", label: "تمثيل حي" },
                  ]}
                  onChange={(value) => update("format", value)}
                />
              </FieldGroup>
              <TextField
                label="الملخص"
                multiline
                value={draft.summary}
                onChange={(value) => update("summary", value)}
              />
              <StringListField
                label="أسماء بديلة"
                values={draft.aliases ?? []}
                onChange={(value) => update("aliases", value)}
              />
            </FieldGroup>
          </CardContent>
        </Card>
        <Collapsible>
          <Card size="sm" aria-label="حقائق ومعلومات">
            <CardHeader>
              <CardTitle>
                حقائق ومعلومات <Badge variant="outline">{draft.trivia?.length ?? 0}</Badge>
              </CardTitle>
              <CardAction>
                <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                  تحرير <ChevronDown data-icon="inline-end" />
                </CollapsibleTrigger>
              </CardAction>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <StringListField
                  label="الحقائق"
                  ordered
                  values={draft.trivia ?? []}
                  onChange={(value) => update("trivia", value)}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        <Collapsible>
          <Card size="sm" aria-label="الإعلانات التشويقية">
            <CardHeader>
              <CardTitle>
                الإعلانات التشويقية <Badge variant="outline">{draft.trailers?.length ?? 0}</Badge>
              </CardTitle>
              <CardAction>
                <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                  تحرير <ChevronDown data-icon="inline-end" />
                </CollapsibleTrigger>
              </CardAction>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <WorkTrailers draft={draft} update={update} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle>الإتاحة والنشر</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>الخصوصية</FieldLabel>
                <ToggleGroup
                  variant="outline"
                  value={[draft.isPrivate ? "private" : "public"]}
                  aria-label="خصوصية العمل"
                  onValueChange={(next) => {
                    if (next[0]) update("isPrivate", next[0] === "private");
                  }}
                >
                  <ToggleGroupItem value="public">عام</ToggleGroupItem>
                  <ToggleGroupItem value="private">خاص</ToggleGroupItem>
                </ToggleGroup>
              </Field>
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
              <Field>
                <FieldLabel>التشغيل</FieldLabel>
                <ToggleGroup
                  variant="outline"
                  className="flex-wrap"
                  value={[draft.playbackPolicy ?? "torrents-allowed"]}
                  aria-label="مصادر التشغيل"
                  onValueChange={(next) => {
                    const value = next[0];
                    if (value === "files-only" || value === "torrents-allowed")
                      update("playbackPolicy", value);
                  }}
                >
                  <ToggleGroupItem value="torrents-allowed">ملفات + إنترنت</ToggleGroupItem>
                  <ToggleGroupItem value="files-only">ملفات فقط</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <LanguagesField
                label="اللغات"
                values={draft.languages ?? (draft.dubLanguages?.includes("ar") ? ["ar"] : ["en"])}
                onChange={(value) => update("languages", value)}
                description={null}
              />
              <Collapsible>
                <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                  ملاحظات الدبلجة <ChevronDown data-icon="inline-end" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <TextField
                    label="ملاحظات الدبلجة"
                    multiline
                    value={draft.dubbingNotes}
                    onChange={(value) => update("dubbingNotes", value)}
                  />
                </CollapsibleContent>
              </Collapsible>
            </FieldGroup>
          </CardContent>
        </Card>
        <OverviewScore installments={draft.installments ?? []} onStructure={onStructure} />
      </div>
    </div>
  );
}

function OverviewScore({
  installments,
  onStructure,
}: {
  installments: NonNullable<WorkDocument["installments"]>;
  onStructure: () => void;
}) {
  const summary = workScore(installments.map((part) => part.score ?? {}));
  const complete = installments.filter((part) => installmentRating(part.score ?? {}) !== null);
  return (
    <Card size="sm" aria-label="ملخص تقييم العمل">
      <CardHeader>
        <CardTitle>التقييم</CardTitle>
        <CardAction>
          <WorkScoreBadge score={summary} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {complete.length ? (
          <div className="flex flex-col gap-3">
            {scoreDefinitions.map((criterion) => {
              const value =
                complete.reduce((sum, part) => sum + (part.score?.[criterion.key] ?? 0), 0) /
                complete.length;
              return (
                <div key={criterion.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span>{criterion.label}</span>
                    <span>{value.toFixed(1)}</span>
                  </div>
                  <Progress value={value} max={10} aria-label={criterion.label} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">بلا تقييم مكتمل</p>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <Badge variant="outline">
          {summary.scored} / {summary.total} أجزاء
        </Badge>
        <Button variant="ghost" size="sm" onClick={onStructure}>
          تقييم الأجزاء
        </Button>
      </CardFooter>
    </Card>
  );
}

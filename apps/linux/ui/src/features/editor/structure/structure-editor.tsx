import type { WorkDocument } from "@arcadia/contracts/work";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { suggestedTmdbSeason } from "@/features/editor/artwork/artwork-model";
import { SelectField, TextField } from "@/features/editor/fields/work-fields";
import { ScoreComparison, scoreCriteria } from "@/features/scoring/score-comparison";

import { EpisodeWorkspace } from "./episode-workspace";
import { useEditorRows } from "./use-editor-rows";

type Installment = NonNullable<WorkDocument["installments"]>[number];
export function StructureEditor({
  installments,
  onChange,
  workId,
  tmdbId,
}: {
  installments: Installment[];
  workId: string;
  tmdbId?: number | null;
  onChange: (value: Installment[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const partRows = useEditorRows(installments);
  const item = installments[index];
  function change(patch: Partial<Installment>) {
    onChange(
      installments.map((value, position) => (position === index ? { ...value, ...patch } : value)),
    );
  }
  const episodes = item?.episodes ?? [];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full sm:w-72">
          {item && (
            <SelectField
              label="الجزء"
              value={String(index)}
              items={installments.map((value, position) => ({
                value: String(position),
                label: value.title,
              }))}
              onChange={(value) => {
                setIndex(Number(value));
              }}
            />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onChange([
              ...installments,
              {
                kind: "season",
                position: Math.max(0, ...installments.map((value) => value.position ?? 0)) + 1,
                title: "جزء جديد",
                summary: "",
                status: "unknown",
                episodes: [],
              },
            ]);
            setIndex(installments.length);
          }}
        >
          <PlusIcon data-icon="inline-start" />
          إضافة جزء
        </Button>
      </div>
      {!item ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد أجزاء</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>
                {episodes.length} حلقة · التعديلات تحافظ على معرّفات الجزء والحلقات.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <FieldGroup className="grid sm:grid-cols-2 lg:grid-cols-3">
                  <TextField
                    label="اسم الجزء"
                    value={item.title}
                    onChange={(value) => change({ title: value })}
                  />
                  <SelectField
                    label="نوع الجزء"
                    value={item.kind}
                    items={[
                      { value: "season", label: "موسم" },
                      { value: "movie", label: "فيلم" },
                      { value: "special", label: "عرض خاص" },
                    ]}
                    onChange={(value) => change({ kind: value })}
                  />
                  <SelectField
                    label="حالة الإصدار"
                    value={item.status ?? "unknown"}
                    items={[
                      { value: "announced", label: "معلن" },
                      { value: "airing", label: "يعرض" },
                      { value: "completed", label: "مكتمل" },
                      { value: "unknown", label: "غير معروف" },
                    ]}
                    onChange={(value) => change({ status: value })}
                  />
                  <TextField
                    label="تاريخ الإصدار"
                    type="date"
                    value={item.releaseDate}
                    onChange={(value) => change({ releaseDate: value || null })}
                  />
                  <TextField
                    label="مدة الجزء بالدقائق"
                    type="number"
                    min={0}
                    value={item.runtimeMinutes}
                    onChange={(value) => change({ runtimeMinutes: value ? Number(value) : null })}
                  />
                  <TextField
                    label="ترتيب الجزء"
                    type="number"
                    min={0}
                    value={item.position}
                    onChange={(value) => change({ position: Number(value) })}
                  />
                </FieldGroup>
                <TextField
                  label="ملخص الجزء"
                  multiline
                  value={item.summary}
                  onChange={(value) => change({ summary: value })}
                />
                <div className="grid items-center gap-6 xl:grid-cols-2">
                  <ScoreComparison installments={installments} selected={index} />
                  <FieldGroup className="grid sm:grid-cols-2">
                    {scoreCriteria.map((criterion) => (
                      <TextField
                        key={criterion.key}
                        label={`${criterion.label} · ${criterion.weight * 100}%`}
                        type="number"
                        min={0}
                        max={10}
                        step="0.1"
                        value={item.score?.[criterion.key]}
                        onChange={(value) =>
                          change({
                            score: { ...item.score, [criterion.key]: value ? Number(value) : null },
                          })
                        }
                      />
                    ))}
                  </FieldGroup>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
          {item.kind !== "movie" && (
            <EpisodeWorkspace
              key={partRows[index]?.key}
              episodes={episodes}
              workId={workId}
              tmdbId={tmdbId}
              title={item.title}
              suggestedSeason={suggestedTmdbSeason(installments, item) ?? 1}
              onChange={(value) => change({ episodes: value })}
            />
          )}
        </>
      )}
    </div>
  );
}

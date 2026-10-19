import type { WorkDocument } from "@arcadia/contracts/work";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { EpisodeArtwork } from "@/features/editor/artwork/episode-artwork";
import { SelectField, TextField } from "@/features/editor/fields/work-fields";
import { EpisodeDelete } from "@/features/editor/structure/episode-delete";
import { ScoreComparison, scoreCriteria } from "@/features/scoring/score-comparison";

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
  const [offset, setOffset] = useState(0);
  const item = installments[index];
  function change(patch: Partial<Installment>) {
    onChange(
      installments.map((value, position) => (position === index ? { ...value, ...patch } : value)),
    );
  }
  const episodes = item?.episodes ?? [];
  function episode(position: number, patch: Partial<(typeof episodes)[number]>) {
    change({
      episodes: episodes.map((value, row) => (row === position ? { ...value, ...patch } : value)),
    });
  }
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
                setOffset(0);
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
            setOffset(0);
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
            <Card>
              <CardHeader>
                <CardTitle>الحلقات</CardTitle>
                <CardDescription>
                  {episodes.length} حلقة · عدّل الرقم والعنوان والموعد مباشرة، وافتح الملخص عند
                  الحاجة.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  {episodes.slice(offset, offset + 10).map((value, relative) => {
                    const position = offset + relative;
                    return (
                      <div
                        key={value.id ?? position}
                        className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Badge variant="secondary">الحلقة {value.number}</Badge>
                          <EpisodeDelete
                            workId={workId}
                            episodeId={value.id}
                            number={value.number}
                            onDelete={() => {
                              change({ episodes: episodes.filter((_, row) => row !== position) });
                              setOffset(
                                Math.min(
                                  offset,
                                  Math.max(0, Math.floor((episodes.length - 2) / 10) * 10),
                                ),
                              );
                            }}
                          />
                        </div>
                        <div className="flex flex-col items-start gap-4 sm:flex-row">
                          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-36">
                            <EpisodeArtwork
                              episode={value}
                              ownerName={`${item.title} · ${value.number}`}
                              tmdbId={tmdbId}
                              season={
                                installments
                                  .filter((part) => part.kind === "season")
                                  .findIndex((part) => part === item) + 1
                              }
                              onChange={(next) => episode(position, next)}
                            />
                          </div>
                          <FieldGroup className="min-w-0 flex-1">
                            <FieldGroup className="grid sm:grid-cols-2 xl:grid-cols-4">
                              <TextField
                                label={`رقم الحلقة ${position + 1}`}
                                type="number"
                                min={0}
                                step="0.5"
                                value={value.number}
                                onChange={(text) => episode(position, { number: Number(text) })}
                              />
                              <TextField
                                label={`اسم الحلقة ${position + 1}`}
                                value={value.title}
                                onChange={(text) => episode(position, { title: text || null })}
                              />
                              <TextField
                                label={`تاريخ الحلقة ${position + 1}`}
                                type="date"
                                value={value.releaseDate}
                                onChange={(text) =>
                                  episode(position, { releaseDate: text || null })
                                }
                              />
                              <TextField
                                label={`مدة الحلقة ${position + 1}`}
                                type="number"
                                min={0}
                                value={value.runtimeMinutes}
                                onChange={(text) =>
                                  episode(position, { runtimeMinutes: text ? Number(text) : null })
                                }
                              />
                            </FieldGroup>
                            <details>
                              <summary className="cursor-pointer text-sm text-muted-foreground">
                                ملخص الحلقة
                              </summary>
                              <div className="pt-3">
                                <TextField
                                  label={`ملخص الحلقة ${position + 1}`}
                                  multiline
                                  value={value.summary}
                                  onChange={(text) => episode(position, { summary: text })}
                                />
                              </div>
                            </details>
                          </FieldGroup>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      change({
                        episodes: [
                          ...episodes,
                          {
                            number: Math.max(0, ...episodes.map((value) => value.number)) + 1,
                            position:
                              Math.max(0, ...episodes.map((value) => value.position ?? 0)) + 1,
                            title: "",
                            summary: "",
                          },
                        ],
                      });
                      setOffset(Math.floor(episodes.length / 10) * 10);
                    }}
                  >
                    <PlusIcon data-icon="inline-start" />
                    إضافة حلقة
                  </Button>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      {episodes.length ? offset + 1 : 0}–{Math.min(offset + 10, episodes.length)} /{" "}
                      {episodes.length}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={offset === 0}
                        onClick={() => setOffset(Math.max(0, offset - 10))}
                      >
                        الحلقات السابقة
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={offset + 10 >= episodes.length}
                        onClick={() => setOffset(offset + 10)}
                      >
                        الحلقات التالية
                      </Button>
                    </div>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

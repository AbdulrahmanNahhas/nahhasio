import type { WorkDocument } from "@arcadia/contracts/work";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, Upload } from "lucide-react";
import { useState } from "react";

import { LanguageBadges } from "@/components/language-badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ImportMediaDialog } from "@/features/admin/media/import-media-dialog";
import { mediaUnitsOptions } from "@/features/admin/media/media-data";
import { UnitMedia } from "@/features/admin/media/unit-media";
import { suggestedTmdbSeason } from "@/features/editor/artwork/artwork-model";
import { installmentIdentityKeys } from "@/features/editor/artwork/artwork-model";
import { IdentityFields } from "@/features/editor/fields/identity-fields";
import { LanguagesField } from "@/features/editor/fields/languages-field";
import { SelectField, TextField } from "@/features/editor/fields/work-fields";
import { ScoreComparison, scoreCriteria } from "@/features/scoring/score-comparison";
import { languageName } from "@/lib/languages";

import { EpisodeWorkspace } from "./episode-workspace";
import { useEditorRows } from "./use-editor-rows";

type Installment = NonNullable<WorkDocument["installments"]>[number];
export function StructureEditor({
  installments,
  onChange,
  workId,
  tmdbId,
  persistedInstallments,
  playbackPolicy,
  allowImport,
  workLanguages,
  format,
  selectedPartId,
  onSelectPart,
}: {
  installments: Installment[];
  workId: string;
  tmdbId?: number | null;
  persistedInstallments: Installment[];
  playbackPolicy?: string;
  allowImport: boolean;
  workLanguages: string[];
  format?: WorkDocument["format"];
  selectedPartId: string;
  onSelectPart: (id: string) => void;
  onChange: (value: Installment[]) => void;
}) {
  const [draftIndex, setIndex] = useState(0);
  const [displayModes, setDisplayModes] = useState<Record<string, "files" | "internet">>({});
  const selectedIndex = selectedPartId
    ? installments.findIndex((part) => part.id === selectedPartId)
    : -1;
  const index = selectedIndex >= 0 ? selectedIndex : draftIndex;
  const partRows = useEditorRows(installments);
  const item = installments[index];
  const partKey = partRows[index]?.key ?? "";
  const displayMode =
    playbackPolicy === "files-only" ? "files" : (displayModes[partKey] ?? "internet");
  const showFiles = displayMode === "files";
  const persisted = persistedInstallments.find((part) => part.id === item?.id && Boolean(part.id));
  const movieMedia = useQuery(
    mediaUnitsOptions(
      workId,
      showFiles && item?.kind === "movie" && persisted ? (item.id ?? "") : "",
      "none",
    ),
  );
  function change(patch: Partial<Installment>) {
    onChange(
      installments.map((value, position) => (position === index ? { ...value, ...patch } : value)),
    );
  }
  const episodes = item?.episodes ?? [];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
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
                onSelectPart(installments[Number(value)]?.id ?? "");
              }}
            />
          )}
        </div>
        {item && playbackPolicy !== "files-only" && (
          <ToggleGroup
            size="sm"
            variant="outline"
            value={[displayMode]}
            aria-label="عرض الجزء"
            onValueChange={(next) => {
              const mode = next[0];
              if (mode === "files" || mode === "internet")
                setDisplayModes((previous) => ({ ...previous, [partKey]: mode }));
            }}
          >
            <ToggleGroupItem value="files">ملفات</ToggleGroupItem>
            <ToggleGroupItem value="internet">تورنت / مزوّدون</ToggleGroupItem>
          </ToggleGroup>
        )}
        <div className="flex flex-wrap gap-2 sm:ms-auto">
          {item && showFiles && (
            <ImportMediaDialog workId={workId} installmentId={persisted?.id}>
              <Button variant="outline" size="sm" disabled={!allowImport || !persisted}>
                <Upload data-icon="inline-start" />
                استيراد فيديوهات
              </Button>
            </ImportMediaDialog>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
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
              onSelectPart("");
            }}
          >
            <PlusIcon data-icon="inline-start" />
            إضافة جزء
          </Button>
        </div>
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
                {item.kind === "movie" ? "فيلم" : `${episodes.length} حلقة`}
              </CardDescription>
              <LanguageBadges languages={item.languages ?? workLanguages} />
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
                {!!installmentIdentityKeys({ format }, item).length && (
                  <FieldGroup className="gap-3">
                    <h3 className="text-sm font-medium">معرّفات الجزء</h3>
                    <IdentityFields
                      ids={item}
                      series={false}
                      keys={installmentIdentityKeys({ format }, item)}
                      onChange={(key, value) => change({ [key]: value })}
                    />
                  </FieldGroup>
                )}
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="installment-language-override">
                      لغات مخصّصة لهذا الجزء
                    </FieldLabel>
                    <FieldDescription>
                      العمل: {workLanguages.map(languageName).join("، ")}؛ تُستخدم هذه اللغات ما لم
                      تحدّد استثناءً.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="installment-language-override"
                    checked={item.languages != null}
                    onCheckedChange={(checked) =>
                      change({ languages: checked ? [...workLanguages] : null })
                    }
                  />
                </Field>
                {item.languages != null && (
                  <LanguagesField
                    label="لغات هذا الجزء"
                    values={item.languages}
                    onChange={(languages) => change({ languages })}
                  />
                )}
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
                            score: {
                              ...item.score,
                              [criterion.key]: value ? Number(value) : null,
                            },
                          })
                        }
                      />
                    ))}
                  </FieldGroup>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
          {showFiles && item.kind === "movie" && (
            <div className="flex flex-col items-start gap-3">
              {movieMedia.error && (
                <Alert variant="destructive">
                  <AlertDescription>{movieMedia.error.message}</AlertDescription>
                </Alert>
              )}
              <UnitMedia
                allowImport={allowImport}
                workId={workId}
                installmentId={item.id ?? ""}
                title={item.title}
                persisted={Boolean(persisted)}
                status={movieMedia.data?.[0]}
              />
            </div>
          )}
          {item.kind !== "movie" && (
            <EpisodeWorkspace
              showFiles={showFiles}
              allowImport={allowImport}
              key={partRows[index]?.key}
              episodes={episodes}
              workId={workId}
              tmdbId={tmdbId}
              title={item.title}
              suggestedSeason={suggestedTmdbSeason(installments, item) ?? 1}
              installmentId={persisted?.id}
              persistedEpisodeIds={(persisted?.episodes ?? []).flatMap((episode) =>
                episode.id ? [episode.id] : [],
              )}
              onChange={(value) => change({ episodes: value })}
            />
          )}
        </>
      )}
    </div>
  );
}

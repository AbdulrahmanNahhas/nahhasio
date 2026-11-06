import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Search } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { mediaUnitsOptions } from "@/features/admin/media/media-data";
import { UnitMedia } from "@/features/admin/media/unit-media";
import { unitMediaLabel } from "@/features/admin/media/unit-media-status";
import { EpisodeArtwork } from "@/features/editor/artwork/episode-artwork";
import { episodeImage } from "@/features/editor/artwork/episode-images-model";
import { SelectField } from "@/features/editor/fields/work-fields";

import { EpisodeDelete } from "./episode-delete";
import { EpisodeEditor, type Episode } from "./episode-editor";
import { useEditorRows } from "./use-editor-rows";

type Filter = "all" | "missing-images" | "missing-details";
export function EpisodeWorkspace({
  episodes,
  workId,
  tmdbId,
  suggestedSeason,
  title,
  installmentId,
  persistedEpisodeIds,
  allowImport,
  showFiles = true,
  onChange,
}: {
  episodes: Episode[];
  workId: string;
  tmdbId?: number | null;
  title: string;
  suggestedSeason: number;
  installmentId?: string;
  persistedEpisodeIds: string[];
  allowImport: boolean;
  showFiles?: boolean;
  onChange: (episodes: Episode[]) => void;
}) {
  const rows = useEditorRows(episodes);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{ key: string | null; episode: Episode } | null>(null);
  const latest = useRef({ rows, onChange });
  const active = useRef(true);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    latest.current = { rows, onChange };
  }, [rows, onChange]);
  const visible = rows.filter(({ value }) => {
    const query = search
      .normalize("NFKD")
      .replace(/\p{M}|ـ/gu, "")
      .toLowerCase()
      .trim();
    const text = `${value.number} ${value.title ?? ""}`
      .normalize("NFKD")
      .replace(/\p{M}|ـ/gu, "")
      .toLowerCase();
    return (
      text.includes(query) &&
      (filter !== "missing-images" || !episodeImage(value)) &&
      (filter !== "missing-details" || !value.title?.trim() || !value.releaseDate)
    );
  });
  const lastPage = Math.max(0, Math.ceil(visible.length / 10) - 1);
  const currentPage = Math.min(page, lastPage);
  const pageRows = visible.slice(currentPage * 10, currentPage * 10 + 10);
  const mediaIds = pageRows
    .flatMap(({ value }) => (value.id && persistedEpisodeIds.includes(value.id) ? [value.id] : []))
    .join(",");
  const media = useQuery(mediaUnitsOptions(workId, installmentId ?? "", showFiles ? mediaIds : ""));
  function patch(key: string, values: Partial<Episode>, expectedNumber?: number) {
    if (!active.current) throw new Error("تغيّر الجزء؛ أعد فتح محرر الحلقة.");
    const current = latest.current;
    const target = current.rows.find((row) => row.key === key);
    if (!target || (expectedNumber !== undefined && target.value.number !== expectedNumber))
      throw new Error("تغيّرت الحلقة؛ أعد فتح محرر الحلقة قبل الاختيار.");
    current.onChange(
      current.rows.map((row) => (row.key === key ? { ...row.value, ...values } : row.value)),
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <CardTitle>الحلقات</CardTitle>
            <CardDescription>
              {title} · {episodes.length} حلقة ·{" "}
              {episodes.filter((episode) => episodeImage(episode)).length} بصورة
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEditor({
                  key: null,
                  episode: {
                    number: Math.max(0, ...episodes.map((episode) => episode.number)) + 1,
                    position: Math.max(-1, ...episodes.map((episode) => episode.position ?? 0)) + 1,
                    title: "",
                    summary: "",
                  },
                })
              }
            >
              <Plus data-icon="inline-start" />
              إضافة حلقة
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field className="min-w-48 flex-1">
              <FieldLabel className="sr-only">البحث في حلقات الموسم</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="البحث في حلقات الموسم"
                  placeholder="ابحث بالرقم أو عنوان الحلقة…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                />
              </InputGroup>
            </Field>
            <div className="w-48">
              <SelectField
                label="إظهار الحلقات"
                value={filter}
                onChange={(next) => {
                  setFilter(next);
                  setPage(0);
                }}
                items={[
                  { value: "all", label: "كل الحلقات" },
                  { value: "missing-images", label: "بلا صور" },
                  { value: "missing-details", label: "بلا عنوان أو تاريخ" },
                ]}
              />
            </div>
          </div>
          {!visible.length && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {episodes.length ? "لا توجد حلقات مطابقة" : "لا توجد حلقات بعد"}
                </EmptyTitle>
                <EmptyDescription>
                  {episodes.length
                    ? "غيّر البحث أو المرشح لعرض الحلقات."
                    : "أضف حلقة، ثم اختر صورتها وبياناتها."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {showFiles && media.error && (
            <Alert variant="destructive">
              <AlertDescription>
                تعذّر فحص ملفات الخادم؛ تبقى بيانات الحلقات قابلة للتحرير. {media.error.message}
                <Button variant="outline" size="sm" onClick={() => void media.refetch()}>
                  إعادة المحاولة
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 xl:grid-cols-2">
            {pageRows.map(({ key, value }) => {
              const fileStatus = media.data?.find((item) => item.episodeId === value.id);
              return (
                <article
                  key={key}
                  className="flex min-w-0 items-start gap-3 rounded-xl border border-border p-3"
                  aria-label={`الحلقة ${value.number}`}
                >
                  <div className="shrink-0">
                    <EpisodeArtwork
                      episode={value}
                      ownerName={`${title} · ${value.number}`}
                      tmdbId={tmdbId}
                      season={suggestedSeason}
                      onChange={(next) => patch(key, { media: next.media }, value.number)}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">الحلقة {value.number}</Badge>
                      {!episodeImage(value) && <Badge variant="outline">بلا صورة</Badge>}
                      {showFiles && fileStatus && (
                        <span className="text-xs text-muted-foreground">
                          {unitMediaLabel(fileStatus)}
                        </span>
                      )}
                    </div>
                    <span className="line-clamp-2 font-medium" dir="auto">
                      {value.title || "بلا عنوان"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {value.releaseDate || "بلا تاريخ عرض"} ·{" "}
                      {value.runtimeMinutes === null || value.runtimeMinutes === undefined
                        ? "المدة غير مسجّلة"
                        : `${value.runtimeMinutes} دقيقة`}
                    </span>
                    {value.summary && (
                      <p className="line-clamp-1 text-sm text-muted-foreground">{value.summary}</p>
                    )}
                  </div>
                  <ButtonGroup
                    orientation="vertical"
                    className="shrink-0"
                    aria-label={`تحرير بيانات الحلقة ${value.number}`}
                  >
                    {showFiles && (
                      <UnitMedia
                        compact
                        allowImport={allowImport}
                        workId={workId}
                        installmentId={installmentId ?? ""}
                        episodeId={value.id}
                        title={`الحلقة ${value.number}`}
                        persisted={Boolean(
                          installmentId && value.id && persistedEpisodeIds.includes(value.id),
                        )}
                        status={fileStatus}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`تحرير الحلقة ${value.number}`}
                      onClick={() => setEditor({ key, episode: value })}
                    >
                      <Pencil data-icon="inline-start" />
                    </Button>
                    <EpisodeDelete
                      workId={workId}
                      episodeId={value.id}
                      number={value.number}
                      onDelete={() =>
                        latest.current.onChange(
                          latest.current.rows
                            .filter((row) => row.key !== key)
                            .map((row) => row.value),
                        )
                      }
                    />
                  </ButtonGroup>
                </article>
              );
            })}
          </div>
          {!!visible.length && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {currentPage * 10 + 1}–{Math.min((currentPage + 1) * 10, visible.length)} /{" "}
                {visible.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  السابق
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= lastPage}
                  onClick={() => setPage(currentPage + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        {editor && (
          <EpisodeEditor
            key={editor.key ?? "new"}
            initial={editor.episode}
            creating={editor.key === null}
            onClose={() => setEditor(null)}
            onApply={(next) => {
              const current = latest.current;
              if (
                current.rows.some(
                  (row) => row.key !== editor.key && row.value.number === next.number,
                )
              )
                return "رقم الحلقة موجود بالفعل في هذا الموسم.";
              const metadata = {
                number: next.number,
                title: next.title,
                summary: next.summary,
                releaseDate: next.releaseDate,
                runtimeMinutes: next.runtimeMinutes,
              };
              try {
                if (editor.key) patch(editor.key, metadata, editor.episode.number);
                else current.onChange([...current.rows.map((row) => row.value), next]);
                setEditor(null);
                return null;
              } catch (error) {
                return error instanceof Error ? error.message : "تعذّر تطبيق الحلقة.";
              }
            }}
          />
        )}
      </Dialog>
    </Card>
  );
}

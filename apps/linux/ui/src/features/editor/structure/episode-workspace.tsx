import { Images, Plus, Pencil, Search, Image } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { EpisodeArtwork } from "@/features/editor/artwork/episode-artwork";
import { EpisodeImagesBatch } from "@/features/editor/artwork/episode-images-batch";
import {
  episodeImage,
  mergeEpisodeImages,
  type ImageTarget,
} from "@/features/editor/artwork/episode-images-model";
import { SelectField } from "@/features/editor/fields/work-fields";

import { EpisodeDelete } from "./episode-delete";
import { EpisodeEditor, type Episode } from "./episode-editor";
import { useEditorRows } from "./use-editor-rows";

type Filter = "all" | "missing-images" | "missing-details";
export function EpisodeWorkspace({
  episodes,
  workId,
  tmdbId,
  title,
  suggestedSeason,
  onChange,
}: {
  episodes: Episode[];
  workId: string;
  tmdbId?: number | null;
  title: string;
  suggestedSeason: number;
  onChange: (episodes: Episode[]) => void;
}) {
  const rows = useEditorRows(episodes);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [seasonText, setSeasonText] = useState(String(suggestedSeason));
  const seasonValue = Number(seasonText);
  const season =
    seasonText !== "" && Number.isInteger(seasonValue) && seasonValue >= 0
      ? seasonValue
      : undefined;
  const [editor, setEditor] = useState<{ key: string | null; episode: Episode } | null>(null);
  const [batch, setBatch] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
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
  function patch(key: string, values: Partial<Episode>, expectedNumber?: number) {
    if (!active.current) throw new Error("تغيّر الجزء؛ أعد فتح محرر الصورة.");
    const current = latest.current;
    const target = current.rows.find((row) => row.key === key);
    if (!target || (expectedNumber !== undefined && target.value.number !== expectedNumber))
      throw new Error("تغيّرت الحلقة؛ أعد فتح محرر الصورة قبل الاختيار.");
    current.onChange(
      current.rows.map((row) => (row.key === key ? { ...row.value, ...values } : row.value)),
    );
  }
  function applyImages(images: ImageTarget[]) {
    if (!active.current) throw new Error("تغيّر الجزء؛ أعد فتح مراجعة الصور.");
    latest.current.onChange(mergeEpisodeImages(latest.current.rows, images));
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
              disabled={!episodes.length}
              onClick={() => setBatch(true)}
            >
              <Images data-icon="inline-start" />
              جلب صور الحلقات
            </Button>
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
          <div className="grid items-end gap-3 sm:grid-cols-2">
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
          <Field>
            <FieldLabel htmlFor="episode-tmdb-season">موسم TMDB (تلقائي، قابل للتعديل)</FieldLabel>
            <Input
              id="episode-tmdb-season"
              type="number"
              min={0}
              className="w-24"
              value={seasonText}
              placeholder="رقم الموسم؛ 0 للعروض الخاصة"
              onChange={(event) => setSeasonText(event.target.value)}
            />
          </Field>
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
          {visible.slice(currentPage * 10, currentPage * 10 + 10).map(({ key, value }) => (
            <article
              key={key}
              className="flex min-w-0 flex-wrap items-center gap-4 rounded-2xl border border-border p-3 sm:flex-nowrap"
              aria-label={`الحلقة ${value.number}`}
            >
              <div className="w-40 shrink-0">
                {!episodeImage(value) && (
                  <div className="mb-2 grid aspect-video place-items-center rounded-lg bg-muted">
                    <Image className="size-6 text-muted-foreground" aria-label="بلا صورة" />
                  </div>
                )}
                <EpisodeArtwork
                  episode={value}
                  ownerName={`${title} · ${value.number}`}
                  tmdbId={tmdbId}
                  season={season}
                  onChange={(next) => patch(key, { media: next.media }, value.number)}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">الحلقة {value.number}</Badge>
                  {!episodeImage(value) && <Badge variant="outline">بلا صورة</Badge>}
                </div>
                <span className="font-medium" dir="auto">
                  {value.title || "بلا عنوان"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {value.releaseDate || "بلا تاريخ عرض"} ·{" "}
                  {value.runtimeMinutes === null || value.runtimeMinutes === undefined
                    ? "المدة غير مسجّلة"
                    : `${value.runtimeMinutes} دقيقة`}
                </span>
                {value.summary && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{value.summary}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
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
                      latest.current.rows.filter((row) => row.key !== key).map((row) => row.value),
                    )
                  }
                />
              </div>
            </article>
          ))}
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
      <Dialog
        open={batch}
        onOpenChange={(open) => {
          if (!open && !batchBusy) setBatch(false);
        }}
      >
        {batch && (
          <EpisodeImagesBatch
            rows={rows}
            title={title}
            tmdbId={tmdbId}
            season={season}
            onApply={applyImages}
            onBusyChange={setBatchBusy}
            onClose={() => setBatch(false)}
          />
        )}
      </Dialog>
    </Card>
  );
}

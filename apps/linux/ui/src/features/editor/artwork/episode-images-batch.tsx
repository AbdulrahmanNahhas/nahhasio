import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { ingestArtwork } from "@/features/artwork/library/artwork.functions";
import { SelectField, TextField } from "@/features/editor/fields/work-fields";
import { RegisteredImage } from "@/features/editor/registered-image";
import type { Episode } from "@/features/editor/structure/episode-editor";
import { gateway } from "@/lib/bridge";

import { EpisodeImageChoices } from "./episode-image-choices";
import { episodeImage, type ImageTarget } from "./episode-images-model";

type Row = { key: string; value: Episode };
type Selection = {
  key: string;
  number: number;
  title: string;
  before: string | null;
  url: string | null;
  path: string | null;
  error: string | null;
  sourceSeason: number;
  sourceEpisode: number;
  sourceLabel: string;
};
export function EpisodeImagesBatch({
  rows,
  tmdbId,
  season,
  title,
  onApply,
  onClose,
  onBusyChange,
}: {
  rows: Row[];
  tmdbId?: number | null;
  season?: number;
  title: string;
  onApply: (images: ImageTarget[]) => void;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}) {
  const [snapshot] = useState(rows);
  const [series, setSeries] = useState(String(tmdbId ?? ""));
  const [seasonText, setSeasonText] = useState(season === undefined ? "" : String(season));
  const [groupLink, setGroupLink] = useState("");
  const [mode, setMode] = useState<"missing" | "replace">("missing");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [prepared, setPrepared] = useState(false);
  const [gallery, setGallery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const stop = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);
  const source = useMutation({
    mutationFn: async () => {
      const id = Number(series),
        number = Number(seasonText);
      if (
        !series ||
        !Number.isInteger(id) ||
        id <= 0 ||
        seasonText === "" ||
        !Number.isInteger(number) ||
        number < 0
      )
        throw new Error("حدّد معرّف المسلسل ورقم موسم TMDB؛ العروض الخاصة تستخدم الموسم 0.");
      let groupId: string | undefined;
      if (groupLink.trim()) {
        try {
          const url = new URL(groupLink);
          if (url.hostname !== "www.themoviedb.org" && url.hostname !== "themoviedb.org")
            throw new Error();
          groupId = /\/episode_group\/([A-Za-z0-9_-]+)/.exec(url.pathname)?.[1];
          if (!groupId || !url.pathname.startsWith(`/tv/${id}/`)) throw new Error();
        } catch {
          throw new Error("الصق رابط مجموعة حلقات TMDB التابعة لهذا المسلسل.");
        }
      }
      const episodes = rpcResults.season.parse(
        await gateway.editorCall({
          operation: "season",
          data: { tmdbId: id, season: number, groupId },
        }),
      );
      if (!episodes) throw new Error("لم يُعثر على هذا الموسم في TMDB. راجع المطابقة.");
      return episodes;
    },
    onSuccess: (episodes) => {
      setSelections(
        snapshot
          .filter(
            (row) =>
              Number.isInteger(row.value.number) &&
              row.value.number > 0 &&
              (mode === "replace" || !episodeImage(row.value)),
          )
          .map((row) => ({
            key: row.key,
            number: row.value.number,
            title: row.value.title || `الحلقة ${row.value.number}`,
            before: episodeImage(row.value),
            url: episodes.find((episode) => episode.number === row.value.number)?.stillUrl ?? null,
            path: null,
            error: null,
            sourceSeason:
              episodes.find((episode) => episode.number === row.value.number)?.sourceSeason ??
              Number(seasonText),
            sourceEpisode:
              episodes.find((episode) => episode.number === row.value.number)?.sourceEpisode ??
              row.value.number,
            sourceLabel:
              episodes.find((episode) => episode.number === row.value.number)?.sourceLabel ??
              `TMDB · الموسم ${seasonText}`,
          })),
      );
      setPrepared(true);
      setNotice(null);
    },
  });
  function update(key: string, patch: Partial<Selection>) {
    setSelections((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }
  async function importImages() {
    stop.current = false;
    setBusy(true);
    onBusyChange(true);
    setNotice(null);
    const pending = selections.filter((item) => item.url && !item.path);
    let next = 0;
    async function worker() {
      while (!stop.current) {
        const item = pending[next++];
        if (!item || !item.url) return;
        try {
          const result = await ingestArtwork({
            data: {
              url: item.url,
              role: "still",
              ownerName: `${title} · ${item.number}`.slice(0, 200),
            },
          });
          if (alive.current) update(item.key, { path: result.path, error: null });
        } catch (error) {
          if (alive.current)
            update(item.key, {
              error: error instanceof Error ? error.message : "تعذّر استيراد الصورة.",
            });
        }
      }
    }
    try {
      await Promise.all([worker(), worker()]);
    } finally {
      if (alive.current) {
        setBusy(false);
        onBusyChange(false);
      }
    }
  }
  const chosen = selections.filter((item) => item.url);
  const imported = chosen.filter((item) => item.path);
  const active = selections.find((item) => item.key === gallery);
  return (
    <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-4xl" showCloseButton={!busy}>
      <DialogHeader>
        <DialogTitle>جلب صور حلقات {title}</DialogTitle>
        <DialogDescription>
          طابق الموسم أولاً، راجع الصور واختر بدائل عند الحاجة. تُستورد الملفات إلى مكتبة الخادم؛ لا
          تُربط بالحلقات حتى تطبيق المسودة وحفظ العمل.
        </DialogDescription>
      </DialogHeader>
      {!prepared ? (
        <fieldset disabled={source.isPending}>
          <FieldGroup>
            {source.isError && (
              <Alert variant="destructive">
                <AlertTitle>{source.error.message}</AlertTitle>
              </Alert>
            )}
            <FieldGroup className="grid sm:grid-cols-2">
              <TextField
                label="معرّف مسلسل TMDB"
                type="number"
                min={1}
                value={series}
                onChange={setSeries}
              />
              <TextField
                label="رقم موسم TMDB (0 للعروض الخاصة)"
                type="number"
                min={0}
                value={seasonText}
                onChange={setSeasonText}
              />
            </FieldGroup>
            <TextField
              label="رابط مجموعة حلقات TMDB (اختياري، يُكتشف تلقائياً عند الحاجة)"
              value={groupLink}
              onChange={setGroupLink}
            />
            <SelectField
              label="الصور المطلوبة"
              value={mode}
              onChange={setMode}
              items={[
                { value: "missing", label: "الحلقات بلا صور فقط" },
                { value: "replace", label: "مراجعة صور جميع الحلقات واستبدال المختار" },
              ]}
            />
            <p className="text-sm text-muted-foreground">
              يشمل الطلب كامل الموسم المحلي، وليس صفحة النتائج أو البحث فقط. الحلقات ذات الأرقام
              الكسرية تُحرّر صورها يدوياً.
            </p>
            <DialogFooter>
              <Button variant="outline" disabled={source.isPending} onClick={onClose}>
                إلغاء
              </Button>
              <Button disabled={source.isPending} onClick={() => source.mutate()}>
                {source.isPending ? "جارٍ جلب الصور…" : "جلب ومعاينة الصور"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </fieldset>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              TMDB {series} · الموسم {seasonText}
            </Badge>
            <Badge variant="secondary">
              {chosen.length} مختارة · {imported.length} مستوردة
            </Badge>
          </div>
          {notice && (
            <Alert variant="destructive">
              <AlertTitle>{notice}</AlertTitle>
            </Alert>
          )}
          {!selections.length && (
            <p className="text-sm text-muted-foreground">
              لا توجد حلقات مطابقة لهذا الطلب. الصور الحالية محفوظة.
            </p>
          )}
          <div className="flex max-h-112 flex-col gap-4 overflow-y-auto">
            {selections.map((item) => (
              <article
                key={item.key}
                className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium" dir="auto">
                    {item.number} · {item.title}
                  </span>
                  {item.path && <Badge variant="secondary">تم الاستيراد</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {item.sourceLabel} · {item.sourceSeason}×{item.sourceEpisode}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">الحالية</span>
                    {item.before ? (
                      <RegisteredImage
                        src={item.before}
                        alt={`الصورة الحالية للحلقة ${item.number}`}
                        className="aspect-video w-full rounded-lg"
                        fit="cover"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">لا توجد صورة</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">المختارة</span>
                    {item.url ? (
                      <RegisteredImage
                        src={item.url
                          .replace("/t/p/original/", "/t/p/w300/")
                          .replace("/t/p/w780/", "/t/p/w300/")}
                        alt={`الصورة المقترحة للحلقة ${item.number}`}
                        className="aspect-video w-full rounded-lg"
                        fit="cover"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        لم تُختر صورة؛ افتح الخيارات للبحث عن بدائل.
                      </p>
                    )}
                  </div>
                </div>
                {item.error && (
                  <Alert variant="destructive">
                    <AlertTitle>{item.error}</AlertTitle>
                  </Alert>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Field orientation="horizontal">
                    <Checkbox
                      id={`batch-episode-${item.key}`}
                      checked={Boolean(item.url)}
                      disabled={busy}
                      onCheckedChange={(value) => {
                        if (value !== true)
                          update(item.key, { url: null, path: null, error: null });
                        else setGallery(item.key);
                      }}
                    />
                    <FieldLabel htmlFor={`batch-episode-${item.key}`}>
                      استيراد هذه الصورة
                    </FieldLabel>
                  </Field>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setGallery(item.key)}
                  >
                    اختيار صورة أخرى
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              إغلاق دون تطبيق
            </Button>
            {busy ? (
              <Button
                variant="outline"
                onClick={() => {
                  stop.current = true;
                  setNotice("سيتوقف الاستيراد بعد اكتمال الطلبات الجارية.");
                }}
              >
                إيقاف الاستيراد
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={chosen.length === imported.length}
                  onClick={() => void importImages()}
                >
                  {selections.some((item) => item.error)
                    ? "إعادة محاولة الصور المتبقية"
                    : `استيراد الصور المختارة (${chosen.length - imported.length})`}
                </Button>
                <Button
                  disabled={!imported.length}
                  onClick={() => {
                    try {
                      onApply(
                        imported.flatMap((item) =>
                          item.path
                            ? [
                                {
                                  key: item.key,
                                  number: item.number,
                                  before: item.before,
                                  path: item.path,
                                },
                              ]
                            : [],
                        ),
                      );
                      onClose();
                    } catch (error) {
                      setNotice(
                        error instanceof Error ? error.message : "تغيّرت المسودة؛ أعد مراجعة الصور.",
                      );
                    }
                  }}
                >
                  تطبيق الصور المستوردة على المسودة ({imported.length})
                </Button>
              </>
            )}
          </DialogFooter>
        </>
      )}
      <Dialog
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) setGallery(null);
        }}
      >
        <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>خيارات صورة الحلقة {active?.number}</DialogTitle>
            <DialogDescription>
              اختر من الصور المتاحة في TMDB؛ لا يُستورد الملف حتى تأكيد الاختيارات.
            </DialogDescription>
          </DialogHeader>
          {active && (
            <EpisodeImageChoices
              tmdbId={Number(series)}
              season={active.sourceSeason}
              episode={active.sourceEpisode}
              selected={active.url}
              onPick={(url) => {
                update(active.key, { url, path: null, error: null });
                setGallery(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </DialogContent>
  );
}

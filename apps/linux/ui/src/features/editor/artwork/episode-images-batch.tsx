import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import { ChevronDown, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <DialogContent
      className={cn(
        "flex max-h-11/12 flex-col",
        prepared ? "h-5/6 sm:max-w-7xl" : "overflow-y-auto sm:max-w-2xl",
      )}
      showCloseButton={!busy}
    >
      <DialogHeader className="shrink-0 gap-1 pe-8">
        <DialogTitle>جلب صور حلقات {title}</DialogTitle>
        <DialogDescription>
          {prepared
            ? "راجع الصور، استورد المختار، ثم طبّقه على المسودة. يلزم حفظ العمل لتثبيت الربط."
            : "حدّد موسم المصدر في TMDB لمعاينة صور حلقات هذا الجزء قبل استيرادها."}
        </DialogDescription>
      </DialogHeader>
      {!prepared ? (
        <fieldset disabled={source.isPending}>
          <FieldGroup className="gap-4">
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
                label="موسم TMDB (0 للعروض الخاصة)"
                type="number"
                min={0}
                value={seasonText}
                onChange={setSeasonText}
              />
            </FieldGroup>
            <SelectField
              label="الصور المطلوبة"
              value={mode}
              onChange={setMode}
              items={[
                { value: "missing", label: "الحلقات بلا صور فقط" },
                { value: "replace", label: "مراجعة صور جميع الحلقات واستبدال المختار" },
              ]}
            />
            <Collapsible>
              <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                <ChevronDown data-icon="inline-start" />
                مطابقة متقدمة
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <TextField
                  label="رابط مجموعة حلقات TMDB (اختياري)"
                  value={groupLink}
                  onChange={setGroupLink}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  لترتيب حلقات خاص؛ يُكتشف تلقائيًا عند الحاجة.
                </p>
              </CollapsibleContent>
            </Collapsible>
            <p className="text-sm text-muted-foreground">
              يشمل جميع حلقات الجزء. الحلقات ذات الأرقام الكسرية تُحرّر صورها يدويًا.
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
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
          <ScrollArea className="min-h-0 flex-1">
            <div className="grid items-start gap-3 p-1 md:grid-cols-2 xl:grid-cols-3">
              {selections.map((item) => (
                <article
                  key={item.key}
                  className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="line-clamp-2 font-medium" dir="auto">
                      {item.number} · {item.title}
                    </span>
                    {item.path && <Badge variant="secondary">تم الاستيراد</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {item.sourceLabel} · {item.sourceSeason}×{item.sourceEpisode}
                    </span>
                  </div>
                  <div className={cn("grid gap-3", item.before && "grid-cols-2")}>
                    {item.before && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">الحالية</span>
                        <RegisteredImage
                          src={item.before}
                          alt={`الصورة الحالية للحلقة ${item.number}`}
                          className="aspect-video w-full rounded-lg"
                          fit="contain"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {item.before ? "المختارة" : "الصورة الجديدة · بلا صورة حالية"}
                      </span>
                      {item.url ? (
                        <RegisteredImage
                          src={item.url
                            .replace("/t/p/original/", "/t/p/w780/")
                            .replace("/t/p/w300/", "/t/p/w780/")}
                          alt={`الصورة المقترحة للحلقة ${item.number}`}
                          className="aspect-video w-full rounded-lg"
                          fit="contain"
                        />
                      ) : (
                        <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg bg-muted text-muted-foreground">
                          <ImageIcon className="size-6" />
                          <p className="text-xs">اختر صورة من البدائل</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {item.error && (
                    <Alert variant="destructive">
                      <AlertTitle>{item.error}</AlertTitle>
                    </Alert>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Field orientation="horizontal" className="w-auto">
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
                      <FieldLabel htmlFor={`batch-episode-${item.key}`}>اختيار الصورة</FieldLabel>
                    </Field>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setGallery(item.key)}
                    >
                      البدائل
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter className="shrink-0 flex-wrap border-t border-border pt-3">
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
                  تطبيق على المسودة ({imported.length})
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

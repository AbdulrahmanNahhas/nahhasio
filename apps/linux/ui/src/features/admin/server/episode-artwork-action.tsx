import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { ingestArtwork } from "@/features/artwork/library/artwork.functions";
import { EpisodeImageChoices } from "@/features/editor/artwork/episode-image-choices";
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";
import { RegisteredImage } from "@/features/editor/registered-image";
import { gateway } from "@/lib/bridge";

import { assignImage } from "../images/images.queries";
import type { LibraryInsights } from "./overview-insights";

type Target = LibraryInsights["episodeTargets"][number];
type Candidate = Target & { url: string | null; selected: boolean };
const groupKey = (target: Target) => `${target.workId}:${target.season}`;
export function EpisodeArtworkAction({
  targets,
  onClose,
}: {
  targets: Target[];
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [snapshot] = useState(targets);
  const [groups, setGroups] = useState(() => [
    ...new Map(
      targets.map((target) => [
        groupKey(target),
        {
          key: groupKey(target),
          name: target.workName,
          workId: target.workId,
          tmdbId: String(target.tmdbId),
          season: String(target.season),
          selected: true,
        },
      ]),
    ).values(),
  ]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [choosing, setChoosing] = useState<Candidate | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const stop = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop.current = true;
    };
  }, []);
  const preview = useMutation({
    mutationFn: async () => {
      const rows: Candidate[] = [];
      for (const group of groups.filter((item) => item.selected)) {
        if (stop.current) throw new Error("أُلغيت المعاينة.");
        const tmdbId = Number(group.tmdbId),
          season = Number(group.season);
        if (
          !group.tmdbId ||
          !group.season ||
          !Number.isInteger(tmdbId) ||
          tmdbId <= 0 ||
          !Number.isInteger(season) ||
          season < 0
        )
          throw new Error("راجع معرّف TMDB ورقم الموسم.");
        const episodes = rpcResults.season.parse(
          await gateway.editorCall({ operation: "season", data: { tmdbId, season } }),
        );
        if (!episodes) throw new Error(`لم يُعثر على موسم ${group.name}؛ راجع المطابقة.`);
        for (const target of snapshot.filter((row) => groupKey(row) === group.key)) {
          const url =
            episodes.find((episode) => episode.number === target.number)?.stillUrl ?? null;
          rows.push({ ...target, url, selected: !!url });
        }
      }
      return rows;
    },
    onSuccess: (rows) => {
      if (alive.current) setCandidates(rows);
    },
  });
  const selected = candidates.filter((row) => row.selected && row.url);
  const run = useMutation({
    mutationFn: async () => {
      let imported = 0;
      const errors: string[] = [];
      for (let index = 0; index < selected.length; index++) {
        if (stop.current) break;
        const target = selected[index];
        try {
          if (!target.url) continue;
          const image = await ingestArtwork({
            data: {
              url: target.url,
              role: "still",
              ownerName: `${target.workName} · ${target.number}`.slice(0, 200),
            },
          });
          await assignImage({
            assetId: image.id,
            ownerKind: "episode",
            ownerId: target.id,
            role: "still",
            expectedPrimaryId: null,
            expectedPrimaryAssetId: null,
          });
          imported++;
        } catch (error) {
          errors.push(
            `${target.workName} · ${target.number}: ${error instanceof Error ? error.message : "تعذّر الاستيراد"}`,
          );
        }
        if (alive.current) setProgress(index + 1);
      }
      return { imported, errors };
    },
    onSuccess: async (data) => {
      if (alive.current) setResult(data);
      await invalidateCatalogEdit(client);
      await client.invalidateQueries({ queryKey: ["admin", "server"] });
    },
  });
  const busy = preview.isPending || run.isPending;
  useBlocker({ shouldBlockFn: () => busy, enableBeforeUnload: busy });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="flex h-5/6 max-h-11/12 flex-col sm:max-w-7xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>استكمال صور الحلقات</DialogTitle>
          <DialogDescription>
            دفعة من {snapshot.length} حلقة بلا صورة. راجع مطابقة الموسم مع TMDB، ثم عاين الصور قبل
            الاستيراد. الصور الموجودة لا تُستبدل.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {!preview.isSuccess ? (
            <>
              <Alert>
                <AlertTitle>راجع أرقام المواسم</AlertTitle>
                <AlertDescription>
                  أرقام المواسم تُقترح حسب ترتيب المواسم داخل العمل، وليس رقم الجزء الخام. راجع
                  المطابقة للمواسم المجمّعة أو الترتيب الخاص. اختر أكثر من عمل للدفعة نفسها؛ حتى 1000
                  حلقة في هذه المعاينة.
                </AlertDescription>
              </Alert>
              <div className="my-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    setGroups((rows) => rows.map((row) => ({ ...row, selected: true })))
                  }
                >
                  تحديد الكل
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    setGroups((rows) => rows.map((row) => ({ ...row, selected: false })))
                  }
                >
                  إلغاء التحديد
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.map((group, index) => (
                  <div
                    key={group.key}
                    className="flex flex-col gap-3 rounded-xl border border-border p-3"
                  >
                    <Field orientation="horizontal">
                      <Checkbox
                        id={`group-${index}`}
                        checked={group.selected}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                          setGroups((rows) =>
                            rows.map((row) =>
                              row.key === group.key ? { ...row, selected: checked === true } : row,
                            ),
                          )
                        }
                      />
                      <FieldLabel htmlFor={`group-${index}`}>
                        {group.name} · الموسم {group.season}
                      </FieldLabel>
                    </Field>
                    <Button
                      variant="link"
                      className="justify-start"
                      render={<a href={`#/admin/works/${group.workId}?section=structure`} />}
                    >
                      {group.name}
                    </Button>
                    <FieldGroup className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor={`tmdb-${index}`}>TMDB للمسلسل</FieldLabel>
                        <Input
                          id={`tmdb-${index}`}
                          type="number"
                          min={1}
                          disabled={busy}
                          value={group.tmdbId}
                          onChange={(event) =>
                            setGroups((rows) =>
                              rows.map((row) =>
                                row.key === group.key
                                  ? { ...row, tmdbId: event.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`season-${index}`}>رقم موسم TMDB</FieldLabel>
                        <Input
                          id={`season-${index}`}
                          type="number"
                          min={0}
                          disabled={busy}
                          value={group.season}
                          onChange={(event) =>
                            setGroups((rows) =>
                              rows.map((row) =>
                                row.key === group.key
                                  ? { ...row, season: event.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </Field>
                    </FieldGroup>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {selected.length} صورة مختارة · {candidates.filter((row) => !row.url).length} حلقة
                بلا صورة في المصدر
              </p>
              <div className="grid gap-3 p-1 md:grid-cols-2 xl:grid-cols-3">
                {candidates.map((row) => (
                  <article
                    key={row.id}
                    className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3"
                  >
                    <Field orientation="horizontal">
                      <Checkbox
                        id={`candidate-${row.id}`}
                        aria-label={`استيراد ${row.workName} الحلقة ${row.number}`}
                        disabled={!row.url || busy || !!result}
                        checked={row.selected}
                        onCheckedChange={(checked) =>
                          setCandidates((rows) =>
                            rows.map((item) =>
                              item.id === row.id ? { ...item, selected: checked === true } : item,
                            ),
                          )
                        }
                      />
                      <FieldLabel htmlFor={`candidate-${row.id}`}>
                        {row.workName} · الحلقة {row.number}
                      </FieldLabel>
                    </Field>
                    {row.url ? (
                      <RegisteredImage
                        src={row.url}
                        alt={`${row.workName} · ${row.number}`}
                        className="aspect-video w-full rounded-lg"
                      />
                    ) : (
                      "غير متاحة"
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !!result}
                      onClick={() => setChoosing(row)}
                    >
                      اختيار صورة أخرى
                    </Button>
                  </article>
                ))}
              </div>
            </>
          )}
          {preview.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّرت المعاينة</AlertTitle>
              <AlertDescription>{preview.error.message}</AlertDescription>
            </Alert>
          )}
          {run.isPending && (
            <Progress
              value={selected.length ? (progress / selected.length) * 100 : 0}
              aria-label="تقدم استيراد صور الحلقات"
            />
          )}
          {result && (
            <Alert>
              <AlertTitle>انتهت الدفعة</AlertTitle>
              <AlertDescription>
                {result.imported} صورة رُبطت · {result.errors.length} تعذّرت ·{" "}
                {selected.length - progress} لم تُعالج
                {result.errors.length > 0 && (
                  <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
                    {[...new Set(result.errors)].map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <Dialog
          open={Boolean(choosing)}
          onOpenChange={(open) => {
            if (!open) setChoosing(null);
          }}
        >
          <DialogContent className="max-h-5/6 overflow-y-auto sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>
                صور {choosing?.workName} · الحلقة {choosing?.number}
              </DialogTitle>
            </DialogHeader>
            {choosing && (
              <EpisodeImageChoices
                tmdbId={Number(groups.find((group) => group.key === groupKey(choosing))?.tmdbId)}
                season={Number(groups.find((group) => group.key === groupKey(choosing))?.season)}
                episode={choosing.number}
                selected={choosing.url}
                onPick={(url) => {
                  setCandidates((rows) =>
                    rows.map((row) =>
                      row.id === choosing.id ? { ...row, url, selected: true } : row,
                    ),
                  );
                  setChoosing(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
        <DialogFooter className="shrink-0 flex-wrap border-t border-border pt-3">
          {busy ? (
            <Button
              variant="outline"
              onClick={() => {
                stop.current = true;
              }}
            >
              إيقاف بعد الحلقة الحالية
            </Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={onClose}>
              إغلاق
            </Button>
          )}
          {!preview.isSuccess ? (
            <Button
              disabled={busy || !groups.some((group) => group.selected)}
              onClick={() => {
                stop.current = false;
                preview.mutate();
              }}
            >
              {preview.isPending && <Spinner data-icon="inline-start" />}معاينة الصور
            </Button>
          ) : (
            !result && (
              <Button
                disabled={busy || !selected.length}
                onClick={() => {
                  stop.current = false;
                  run.mutate();
                }}
              >
                تأكيد استيراد {selected.length} صورة
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

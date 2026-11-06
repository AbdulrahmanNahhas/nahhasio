import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import {
  MediaQueuedSchema,
  YoutubePreviewSchema,
  type WorkDetail,
  type MediaImportRequest,
} from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListVideoIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";
import { ChangeReview } from "@/features/editor/json/document/change-review";
import { gateway, nativeCall } from "@/lib/bridge";

import { mediaJobsOptions, importMedia } from "./media-data";
import { playlistRows, renumberPlaylist, type YoutubeEdit } from "./youtube-plan";
import { YoutubeThumbnail } from "./youtube-thumbnail";

export function YoutubeImport({
  work,
  partId,
  onComplete,
}: {
  work: WorkDetail;
  partId: string;
  onComplete: () => void;
}) {
  const client = useQueryClient();
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("1080");
  const [edits, setEdits] = useState<Record<string, YoutubeEdit>>({});
  const [firstNumber, setFirstNumber] = useState(1);
  const [prepared, setPrepared] = useState<{
    ticket: string | null;
    request: MediaImportRequest;
    changes: number;
    review: z.infer<typeof rpcResults.review> | null;
  } | null>(null);
  const part = work.installments.find((candidate) => candidate.id === partId);
  const preview = useMutation({
    mutationFn: async () => MediaQueuedSchema.parse(await nativeCall("adminMediaYoutube", { url })),
    onSuccess: () => {
      setEdits({});
      setPrepared(null);
    },
  });
  const jobs = useQuery({ ...mediaJobsOptions(), enabled: Boolean(preview.data) });
  const job = jobs.data?.find((candidate) => candidate.id === preview.data?.id);
  const data = job?.status === "completed" ? YoutubePreviewSchema.safeParse(job.result) : null;
  const entries = data?.success ? data.data.entries : [];
  const rows = playlistRows(entries, edits);
  const selected = rows.filter((row) => row.included);
  function updateEntry(id: string, change: YoutubeEdit) {
    setEdits((previous) => ({ ...previous, [id]: { ...previous[id], ...change } }));
    setPrepared(null);
  }
  const review = useMutation({
    mutationFn: async () => {
      if (!part) throw new Error("اختر جزءًا أولًا.");
      if (part.kind !== "season" && selected.length !== 1)
        throw new Error("اختر فيديو واحدًا للفيلم أو الحلقة الخاصة.");
      const snapshots = rpcResults.read.parse(
        await gateway.editorCall({ operation: "read", data: { ids: [work.id] } }),
      );
      const snapshot = snapshots[0];
      if (!snapshot) throw new Error("تعذّر تحميل مستند العمل.");
      const installments = structuredClone(snapshot.document.installments ?? []);
      const draft = installments.find((p) => p.id === partId);
      if (!draft) throw new Error("تغيّر الجزء؛ أعد تحميل العمل.");
      const items: MediaImportRequest["items"] = [];
      const numbers = new Set<number>();
      const videos = new Set<string>();
      const targets = new Set<string>();
      for (const { entry, index, edit } of selected) {
        if (!entry.videoId) continue;
        if (videos.has(entry.videoId))
          throw new Error("الفيديو مكرر في القائمة؛ اختر نسخة واحدة منه فقط.");
        videos.add(entry.videoId);
        const mapped = part.episodes.find((episode) => episode.id === edit.episodeId);
        const number = edit.number ?? Number(mapped?.number ?? index + 1);
        if (!Number.isFinite(number) || number < 0)
          throw new Error("راجع أرقام الحلقات قبل المتابعة.");
        if (numbers.has(number)) throw new Error("تكرّر رقم حلقة؛ راجع الترقيم قبل المتابعة.");
        numbers.add(number);
        const episodeId =
          edit.episodeId ??
          part.episodes.find((episode) => Number(episode.number) === number)?.id ??
          "new";
        if (episodeId !== "new" && targets.has(episodeId))
          throw new Error("رُبط فيديوهان بالحلقة نفسها؛ راجع الربط.");
        if (episodeId !== "new") targets.add(episodeId);
        let episode = draft.episodes?.find((candidate) => candidate.id === episodeId);
        if (part.kind === "season" && !episode) {
          episode = {
            id: crypto.randomUUID(),
            number,
            position: Math.max(0, ...(draft.episodes ?? []).map((e) => e.position ?? 0)) + 1,
            title: edit.title ?? entry.title,
            summary: "",
          };
          draft.episodes = [...(draft.episodes ?? []), episode];
        }
        if (episode) {
          episode.title = edit.title ?? (episode.title?.trim() ? episode.title : entry.title);
          if (edit.number !== undefined) episode.number = number;
          const existingImage = part.episodes.find((candidate) => candidate.id === episode.id);
          const hasImage = Boolean(
            episode.media?.still || existingImage?.still || existingImage?.artwork.length,
          );
          if (edit.thumbnail ?? !hasImage) {
            const result = rpcResults.preview.parse(
              await gateway.editorCall({
                operation: "preview",
                data: { url: `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg` },
              }),
            );
            const uploaded = rpcResults.upload.parse(
              await gateway.editorCall({
                operation: "upload",
                data: {
                  dataUrl: result.dataUrl,
                  fileName: `${entry.videoId}.jpg`,
                  role: "still",
                  ownerName: work.titleAr ?? work.canonicalTitle,
                },
              }),
            );
            episode.media = { ...episode.media, still: uploaded.path };
          }
        }
        items.push({
          relativePath: `youtube/${entry.videoId}.mkv`,
          installmentId: partId,
          episodeId: part.kind === "season" ? episode!.id! : null,
          byteSize: 0,
          modifiedSeconds: 0,
          copy: false,
          youtubeId: entry.videoId,
          quality: z.enum(["720", "1080", "best"]).parse(quality),
        });
      }
      if (!items.length) throw new Error("اختر فيديو واحدًا على الأقل.");
      const changed =
        JSON.stringify(installments) !== JSON.stringify(snapshot.document.installments ?? []);
      const result = changed
        ? rpcResults.review.parse(
            await gateway.editorCall({
              operation: "review",
              data: rpcInputs.review.parse({
                json: JSON.stringify({
                  schemaVersion: 1,
                  fields: ["installments"],
                  records: [{ id: work.id, installments }],
                }),
                originals: [{ id: work.id, revision: snapshot.revision }],
              }),
            }),
          )
        : null;
      return {
        review: result,
        ticket: result?.ticket ?? null,
        changes: result?.records.reduce((sum, record) => sum + record.changes.length, 0) ?? 0,
        request: { workId: work.id, items, idempotencyKey: crypto.randomUUID() },
      };
    },
    onSuccess: setPrepared,
  });
  const start = useMutation({
    mutationFn: async () => {
      if (!prepared) throw new Error("راجع الاستيراد أولًا.");
      if (prepared.ticket)
        await gateway.editorCall({ operation: "save", data: { ticket: prepared.ticket } });
      return importMedia(prepared.request);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin", "media"] });
      await client.invalidateQueries({ queryKey: ["viewer"] });
      if (prepared?.ticket) await invalidateCatalogEdit(client);
      await client.invalidateQueries({ queryKey: ["admin", "import-work", work.id] });
      onComplete();
    },
  });
  const error = preview.error ?? review.error ?? start.error ?? jobs.error;
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup className="grid gap-4 sm:grid-cols-3">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="youtube-source">رابط فيديو أو قائمة YouTube</FieldLabel>
          <Input
            id="youtube-source"
            type="url"
            placeholder="https://www.youtube.com/playlist?list=…"
            dir="ltr"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              preview.reset();
              setPrepared(null);
            }}
          />
        </Field>
        <Field>
          <FieldLabel>جودة الفيديو</FieldLabel>
          <Choice
            label="جودة استيراد YouTube"
            value={quality}
            onChange={(value) => {
              setQuality(value);
              setPrepared(null);
            }}
            options={[
              { value: "720", label: "حتى 720p" },
              { value: "1080", label: "حتى 1080p" },
              { value: "best", label: "أفضل جودة متاحة" },
            ]}
          />
        </Field>
      </FieldGroup>
      <Button
        variant="outline"
        disabled={
          !url || preview.isPending || job?.status === "queued" || job?.status === "running"
        }
        onClick={() => preview.mutate()}
      >
        <SearchIcon data-icon="inline-start" />
        {preview.isPending || job?.status === "queued" || job?.status === "running"
          ? "جارٍ جلب الفيديوهات…"
          : "معاينة الفيديوهات"}
      </Button>
      {!preview.data && !entries.length && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListVideoIcon />
            </EmptyMedia>
            <EmptyTitle>معاينة قبل التنزيل</EmptyTitle>
            <EmptyDescription>
              ألصق رابط فيديو أو قائمة تشغيل. ستظهر الفيديوهات هنا لتحديدها وترتيبها وربطها بالحلقات
              قبل بدء التنزيل.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {job && ["queued", "running"].includes(job.status) && (
        <p role="status">جارٍ جلب عناصر القائمة من الخادم…</p>
      )}
      {job?.error && (
        <Alert variant="destructive">
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}
      {entries.length > 0 && (
        <FieldGroup>
          <FieldDescription>
            {selected.length} فيديو محدد من {entries.length}. العناصر غير المتاحة لا تُنزّل؛ تُستبعد
            النسخ المكررة افتراضيًا.
          </FieldDescription>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEdits((previous) =>
                  Object.fromEntries(
                    rows.map((row) => [
                      row.key,
                      { ...previous[row.key], include: row.entry.available && !row.duplicate },
                    ]),
                  ),
                );
                setPrepared(null);
              }}
            >
              تحديد الفيديوهات المتاحة
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEdits((previous) =>
                  Object.fromEntries(
                    rows.map((row) => [row.key, { ...previous[row.key], include: false }]),
                  ),
                );
                setPrepared(null);
              }}
            >
              إلغاء التحديد
            </Button>
          </div>
          <Field>
            <FieldLabel htmlFor="youtube-first-number">بدء ترقيم الفيديوهات المحددة من</FieldLabel>
            <Input
              id="youtube-first-number"
              type="number"
              min={1}
              max={100000}
              value={firstNumber}
              onChange={(event) => setFirstNumber(Number(event.target.value))}
            />
          </Field>
          <Button
            variant="outline"
            disabled={!Number.isSafeInteger(firstNumber) || firstNumber < 1 || firstNumber > 100000}
            onClick={() => {
              setEdits((previous) => renumberPlaylist(entries, previous, firstNumber));
              setPrepared(null);
            }}
          >
            تطبيق ترقيم متتابع حسب الترتيب المعروض
          </Button>
        </FieldGroup>
      )}
      <FieldGroup>
        {rows.map((row, position) => {
          const { entry, index, key: id, edit: values } = row;
          const mapped = part?.episodes.find((episode) => episode.id === values.episodeId);
          const number = values.number ?? Number(mapped?.number ?? index + 1);
          const existing = part?.episodes.find(
            (episode) =>
              episode.id ===
              (values.episodeId ?? part.episodes.find((e) => Number(e.number) === number)?.id),
          );
          return (
            <Field key={id}>
              <FieldLabel>
                <Checkbox
                  disabled={!entry.available}
                  checked={row.included}
                  onCheckedChange={(checked) => updateEntry(id, { include: Boolean(checked) })}
                />
                {entry.title}
              </FieldLabel>
              <FieldDescription>
                الموضع في المصدر: {index + 1} ·{" "}
                {entry.durationSeconds == null
                  ? "المدة غير متاحة"
                  : `${Math.round(entry.durationSeconds / 60)} دقيقة`}
                {row.duplicate ? " · فيديو مكرر" : ""}
                {!entry.available ? " · خاص أو غير متاح" : ""}
              </FieldDescription>
              <div className="flex flex-wrap gap-2">
                {[-1, 1].map((direction) => (
                  <Button
                    key={direction}
                    variant="outline"
                    size="sm"
                    disabled={position + direction < 0 || position + direction >= rows.length}
                    onClick={() => {
                      const reordered = [...rows];
                      const other = position + direction;
                      [reordered[position], reordered[other]] = [
                        reordered[other]!,
                        reordered[position]!,
                      ];
                      setEdits((previous) =>
                        Object.fromEntries(
                          reordered.map((item, order) => [
                            item.key,
                            { ...previous[item.key], order },
                          ]),
                        ),
                      );
                      setPrepared(null);
                    }}
                  >
                    {direction === -1 ? "نقل للأعلى" : "نقل للأسفل"}
                  </Button>
                ))}
              </div>
              {row.included && (
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`yt-title-${id}`}>عنوان الحلقة</FieldLabel>
                    <Input
                      id={`yt-title-${id}`}
                      value={
                        values.title ?? (existing?.title?.trim() ? existing.title : entry.title)
                      }
                      onChange={(event) => updateEntry(id, { title: event.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`yt-number-${id}`}>رقم الحلقة</FieldLabel>
                    <Input
                      id={`yt-number-${id}`}
                      type="number"
                      min={1}
                      value={number}
                      onChange={(event) => updateEntry(id, { number: Number(event.target.value) })}
                    />
                  </Field>
                  {part?.kind === "season" && (
                    <Field>
                      <FieldLabel>الربط</FieldLabel>
                      <Choice
                        label={`حلقة الفيديو ${entry.title}`}
                        value={values.episodeId ?? existing?.id ?? "new"}
                        onChange={(value) => updateEntry(id, { episodeId: value })}
                        options={[
                          { value: "new", label: "إنشاء حلقة جديدة" },
                          ...part.episodes.map((episode) => ({
                            value: episode.id,
                            label: `${episode.number} · ${episode.title ?? "حلقة"}`,
                          })),
                        ]}
                      />
                    </Field>
                  )}
                  <Field orientation="horizontal">
                    <Checkbox
                      id={`yt-image-${id}`}
                      checked={values.thumbnail ?? !(existing?.still || existing?.artwork.length)}
                      onCheckedChange={(checked) =>
                        updateEntry(id, { thumbnail: Boolean(checked) })
                      }
                    />
                    <FieldLabel htmlFor={`yt-image-${id}`}>
                      {existing?.still || existing?.artwork.length
                        ? "استبدال صورة الحلقة بصورة الفيديو"
                        : "استخدام صورة الفيديو للحلقة"}
                    </FieldLabel>
                  </Field>
                  {entry.videoId && (
                    <YoutubeThumbnail videoId={entry.videoId} title={entry.title} />
                  )}
                  <FieldDescription>
                    تُراجع تغييرات العنوان والترقيم والصورة قبل الحفظ.
                  </FieldDescription>
                </FieldGroup>
              )}
            </Field>
          );
        })}
      </FieldGroup>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {prepared && (
        <Alert>
          <AlertDescription>
            {prepared.request.items.length} فيديو محددًا، و{prepared.changes} تغييرًا في بيانات
            الحلقات. سيُحفظ تعديل الحلقات أولًا ثم تبدأ مهمة تنزيل مستقلة؛ فشل التنزيل لا يحذف الحلقات.
          </AlertDescription>
        </Alert>
      )}
      {prepared?.review && (
        <ChangeReview
          review={prepared.review}
          onBack={() => setPrepared(null)}
          onSave={() => start.mutate()}
          busy={start.isPending}
        />
      )}
      {selected.length > 0 && !prepared?.review && (
        <Button
          disabled={!selected.length || review.isPending || start.isPending}
          onClick={() => (prepared ? start.mutate() : review.mutate())}
        >
          {review.isPending
            ? "جارٍ مراجعة التغييرات…"
            : start.isPending
              ? "جارٍ بدء الاستيراد…"
              : prepared
                ? "تأكيد الحفظ والتنزيل"
                : "مراجعة الحلقات والاستيراد"}
        </Button>
      )}
    </div>
  );
}

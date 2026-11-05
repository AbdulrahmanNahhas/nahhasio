import { rpcInputs, rpcResults } from "@arcadia/contracts/editor-rpc";
import {
  MediaQueuedSchema,
  YoutubePreviewSchema,
  type WorkDetail,
  type MediaImportRequest,
} from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ChangeReview } from "@/features/editor/json/document/change-review";
import { gateway, nativeCall } from "@/lib/bridge";

import { mediaJobsOptions, importMedia } from "./media-data";

type Edit = {
  include?: boolean;
  episodeId?: string;
  number?: number;
  title?: string;
  thumbnail?: boolean;
};
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
  const [edits, setEdits] = useState<Record<string, Edit>>({});
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
  const selected = entries.flatMap((entry, index) =>
    entry.videoId && entry.available && edits[entry.videoId]?.include !== false
      ? [{ entry, index, edit: edits[entry.videoId] ?? {} }]
      : [],
  );
  function updateEntry(id: string, change: Edit) {
    setEdits((previous) => ({ ...previous, [id]: { ...previous[id], ...change } }));
    setPrepared(null);
  }
  const review = useMutation({
    mutationFn: async () => {
      if (!part) throw new Error("اختر جزءًا أولًا.");
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
      for (const { entry, index, edit } of selected) {
        if (!entry.videoId) continue;
        const number = edit.number ?? index + 1;
        if (numbers.has(number)) throw new Error("تكرّر رقم حلقة؛ راجع الترقيم قبل المتابعة.");
        numbers.add(number);
        const episodeId =
          edit.episodeId ??
          part.episodes.find((episode) => Number(episode.number) === number)?.id ??
          "new";
        let episode = draft.episodes?.find((candidate) => candidate.id === episodeId);
        if (part.kind === "season" && !episode) {
          episode = {
            id: crypto.randomUUID(),
            number,
            position: Math.max(0, ...(draft.episodes ?? []).map((e) => e.position ?? 0)) + 1,
            title: entry.title,
            summary: "",
          };
          draft.episodes = [...(draft.episodes ?? []), episode];
        }
        if (episode) {
          episode.title = edit.title ?? episode.title ?? entry.title;
          if (edit.number !== undefined) episode.number = number;
          if (edit.thumbnail === true) {
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
      onComplete();
    },
  });
  const error = preview.error ?? review.error ?? start.error ?? jobs.error;
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="youtube-source">رابط فيديو أو قائمة YouTube</FieldLabel>
          <Input
            id="youtube-source"
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
        معاينة القائمة دون تنزيل
      </Button>
      {job && ["queued", "running"].includes(job.status) && (
        <p role="status">جارٍ جلب عناصر القائمة من الخادم…</p>
      )}
      {job?.error && (
        <Alert variant="destructive">
          <AlertDescription>{job.error}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        {entries.map((entry, index) => {
          const id = entry.videoId ?? `unavailable-${index}`;
          const values = edits[id] ?? {};
          const number = values.number ?? index + 1;
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
                  checked={entry.available && values.include !== false}
                  onCheckedChange={(checked) => updateEntry(id, { include: Boolean(checked) })}
                />
                {entry.title}
              </FieldLabel>
              {entry.available && values.include !== false && (
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`yt-title-${id}`}>عنوان الحلقة</FieldLabel>
                    <Input
                      id={`yt-title-${id}`}
                      value={values.title ?? existing?.title ?? entry.title}
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
                      checked={values.thumbnail === true}
                      onCheckedChange={(checked) =>
                        updateEntry(id, { thumbnail: Boolean(checked) })
                      }
                    />
                    <FieldLabel htmlFor={`yt-image-${id}`}>استخدام صورة الفيديو للحلقة</FieldLabel>
                  </Field>
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
      {!prepared?.review && (
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

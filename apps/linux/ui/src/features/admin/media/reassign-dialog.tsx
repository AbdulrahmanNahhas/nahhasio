import { MediaQueuedSchema, type ServerMediaFile } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { gateway, nativeCall } from "@/lib/bridge";
export function ReassignMedia({
  file,
  control,
}: {
  file: ServerMediaFile;
  control?: { open: boolean; onOpenChange: (open: boolean) => void };
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = control?.open ?? localOpen;
  const setOpen = control?.onOpenChange ?? setLocalOpen;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!control && (
        <DialogTrigger render={<Button variant="outline" size="sm" disabled={!file.revision} />}>
          تغيير الربط
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغيير ربط الفيديو</DialogTitle>
          <DialogDescription>
            الربط الحالي: {file.workTitle} / {file.episodeTitle ?? file.installmentTitle}. يتغيّر
            الربط فقط؛ تبقى بايتات الفيديو وسجلات المشاهدة.
          </DialogDescription>
        </DialogHeader>
        {open && <ReassignForm file={file} onSaved={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
function ReassignForm({ file, onSaved }: { file: ServerMediaFile; onSaved: () => void }) {
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [workId, setWorkId] = useState(file.workId);
  const [partId, setPartId] = useState(file.installmentId);
  const [episodeId, setEpisodeId] = useState(file.episodeId ?? "");
  const [review, setReview] = useState(false);
  const works = useQuery({
    queryKey: ["admin", "media-reassign", q],
    queryFn: ({ signal }) => gateway.adminWorks({ q, page: 1, pageSize: 30 }, signal),
  });
  const work = useQuery({
    queryKey: ["admin", "import-work", workId],
    queryFn: ({ signal }) => gateway.work(workId, signal),
  });
  const part = work.data?.installments.find((candidate) => candidate.id === partId);
  const workChoices = (works.data?.items ?? []).map((candidate) => ({
    value: candidate.id,
    label: candidate.titleAr ?? candidate.canonicalTitle,
  }));
  if (work.data && !workChoices.some((candidate) => candidate.value === workId))
    workChoices.unshift({ value: workId, label: work.data.titleAr ?? work.data.canonicalTitle });
  const action = useMutation({
    mutationFn: async () =>
      MediaQueuedSchema.parse(
        await nativeCall("adminMediaFile", {
          id: file.id,
          action: "reassign",
          expectedRevision: file.revision,
          workId,
          installmentId: partId,
          episodeId: part?.kind === "season" ? episodeId : null,
        }),
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin", "media"] });
      await client.invalidateQueries({ queryKey: ["viewer", "home-media", file.workId] });
      if (workId !== file.workId)
        await client.invalidateQueries({ queryKey: ["viewer", "home-media", workId] });
      onSaved();
    },
  });
  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reassign-search">البحث عن عمل</FieldLabel>
          <Input id="reassign-search" value={q} onChange={(event) => setQ(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel>العمل</FieldLabel>
          <Choice
            label="العمل الجديد للفيديو"
            value={workId}
            onChange={(id) => {
              setWorkId(id);
              setPartId("");
              setEpisodeId("");
              setReview(false);
            }}
            options={workChoices}
          />
        </Field>
        <Field>
          <FieldLabel>الجزء</FieldLabel>
          <Choice
            label="الجزء الجديد للفيديو"
            value={partId}
            onChange={(id) => {
              setPartId(id);
              setEpisodeId("");
              setReview(false);
            }}
            options={(work.data?.installments ?? []).map((candidate) => ({
              value: candidate.id,
              label: candidate.title,
            }))}
          />
        </Field>
        {part?.kind === "season" && (
          <Field>
            <FieldLabel>الحلقة</FieldLabel>
            <Choice
              label="الحلقة الجديدة للفيديو"
              value={episodeId}
              onChange={(id) => {
                setEpisodeId(id);
                setReview(false);
              }}
              options={part.episodes.map((episode) => ({
                value: episode.id,
                label: `${episode.number} · ${episode.title ?? "حلقة"}`,
              }))}
            />
          </Field>
        )}
      </FieldGroup>
      {review && (
        <Alert>
          <AlertDescription>
            سيُنقل الربط من «{file.workTitle} / {file.episodeTitle ?? file.installmentTitle}» إلى «
            {work.data?.titleAr ?? work.data?.canonicalTitle} / {part?.title} /{" "}
            {part?.episodes.find((episode) => episode.id === episodeId)?.title ?? "فيلم"}».
          </AlertDescription>
        </Alert>
      )}
      {(works.error || work.error || action.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {(works.error ?? work.error ?? action.error)?.message}
          </AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button
          disabled={!part || (part.kind === "season" && !episodeId) || action.isPending}
          onClick={() => (review ? action.mutate() : setReview(true))}
        >
          {review ? "تأكيد تغيير الربط" : "مراجعة الربط الجديد"}
        </Button>
      </DialogFooter>
    </>
  );
}

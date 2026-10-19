import { rpcResults } from "@arcadia/contracts/editor-rpc";
import type { WorkDocument } from "@arcadia/contracts/work";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, Upload, X, Download } from "lucide-react";
import { useState, useId } from "react";
import { z } from "zod";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ingestArtwork, uploadArtwork } from "@/features/artwork/library/artwork.functions";
import { TextField } from "@/features/editor/fields/work-fields";
import { ReferencePicker } from "@/features/editor/references/reference-picker";
import { RegisteredImage } from "@/features/editor/registered-image";
import { gateway } from "@/lib/bridge";
type Episode = NonNullable<NonNullable<WorkDocument["installments"]>[number]["episodes"]>[number];
export function EpisodeArtwork({
  episode,
  onChange,
  ownerName,
  tmdbId,
  season,
}: {
  episode: Episode;
  onChange: (episode: Episode) => void;
  ownerName: string;
  tmdbId?: number | null;
  season?: number;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const id = useId();
  const value = episode.media?.still ?? episode.media?.poster ?? episode.media?.banner;
  function pick(path: string | null) {
    onChange({ ...episode, media: { ...episode.media, still: path } });
    setOpen(false);
  }
  const upload = useMutation({
    mutationFn: async (selectedFile: File) => {
      if (selectedFile.size > 10000000 || !selectedFile.type.startsWith("image/"))
        throw new Error("اختر صورة حتى 10 ميغابايت.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener(
          "load",
          () => {
            const result = z.string().safeParse(reader.result);
            if (result.success) resolve(result.data);
            else reject(new Error("تعذّرت قراءة الصورة."));
          },
          { once: true },
        );
        reader.addEventListener("error", () => reject(new Error("تعذّرت قراءة الصورة.")), {
          once: true,
        });
        reader.readAsDataURL(selectedFile);
      });
      return uploadArtwork({
        data: { dataUrl, fileName: selectedFile.name, role: "still", ownerName },
      });
    },
    onSuccess: (result) => pick(result.path),
  });
  const source = useMutation({
    mutationFn: async () => {
      if (!tmdbId || season === undefined)
        throw new Error("أضف معرّف TMDB للمسلسل ورقم الموسم أولاً.");
      const episodes = rpcResults.season.parse(
        await gateway.editorCall({ operation: "season", data: { tmdbId, season } }),
      );
      const match = episodes?.find((item) => item.number === episode.number);
      if (!match?.stillUrl) throw new Error("لا توجد صورة لهذه الحلقة في TMDB.");
      return match.stillUrl;
    },
  });
  const ingest = useMutation({
    mutationFn: (url: string) => ingestArtwork({ data: { url, role: "still", ownerName } }),
    onSuccess: (result) => pick(result.path),
  });
  const error = upload.error ?? source.error ?? ingest.error;
  const busy = upload.isPending || source.isPending || ingest.isPending;
  return (
    <div className="flex flex-col gap-2">
      {value?.startsWith("/media/") && (
        <RegisteredImage
          src={value}
          alt={`صورة ${ownerName}`}
          className="aspect-video w-40 rounded-lg object-cover"
          loading="lazy"
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ImagePlus data-icon="inline-start" />
          {value ? "تغيير صورة الحلقة" : "صورة الحلقة"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="إزالة صورة الحلقة"
            onClick={() =>
              onChange({ ...episode, media: { still: null, poster: null, banner: null } })
            }
          >
            <X />
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>صورة الحلقة {episode.number}</DialogTitle>
            <DialogDescription>
              {ownerName} · تُضاف الصورة إلى مكتبة الخادم ويبقى ربطها في المسودة حتى الحفظ.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {error && (
              <Alert variant="destructive" className="border-border">
                <AlertTitle>تعذّر اختيار الصورة</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <ReferencePicker
                table="media_assets"
                title="صورة الحلقة"
                triggerLabel="مكتبة الصور"
                images
                imageRole="still"
                onPick={pick}
              />
              <Button
                type="button"
                variant="outline"
                disabled={
                  !tmdbId || season === undefined || !Number.isInteger(episode.number) || busy
                }
                onClick={() => source.mutate()}
              >
                <Download data-icon="inline-start" />
                {source.isPending ? "جارٍ البحث…" : "صورة من TMDB"}
              </Button>
            </div>
            {source.data && (
              <div className="flex flex-col gap-3">
                <RegisteredImage
                  src={source.data}
                  alt="معاينة الصورة من TMDB"
                  className="aspect-video w-full rounded-xl object-contain"
                />
                <Button type="button" disabled={busy} onClick={() => ingest.mutate(source.data)}>
                  {ingest.isPending ? "جارٍ الاستيراد…" : "استيراد واختيار هذه الصورة"}
                </Button>
              </div>
            )}
            <Field>
              <FieldLabel htmlFor={id}>رفع صورة</FieldLabel>
              <Input
                id={id}
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={!file || busy}
              onClick={() => {
                if (file) upload.mutate(file);
              }}
            >
              <Upload data-icon="inline-start" />
              {upload.isPending ? "جارٍ الرفع…" : "رفع واختيار"}
            </Button>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                مسار صورة مسجّلة
              </summary>
              <TextField
                label="المسار داخل مكتبة الصور"
                value={value}
                onChange={(path) =>
                  onChange({ ...episode, media: { ...episode.media, still: path || null } })
                }
              />
            </details>
          </FieldGroup>
        </DialogContent>
      </Dialog>
    </div>
  );
}

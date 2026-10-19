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

import { EpisodeImageChoices } from "./episode-image-choices";
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
  const [gallery, setGallery] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const id = useId();
  const imageRole = episode.media?.still ? "still" : episode.media?.poster ? "poster" : "banner";
  const value = episode.media?.[imageRole];
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
        data: {
          dataUrl,
          fileName: selectedFile.name,
          role: "still",
          ownerName: ownerName.slice(0, 200),
        },
      });
    },
    onSuccess: (result) => pick(result.path),
  });
  const ingest = useMutation({
    mutationFn: (url: string) =>
      ingestArtwork({ data: { url, role: "still", ownerName: ownerName.slice(0, 200) } }),
    onSuccess: (result) => pick(result.path),
  });
  const error = upload.error ?? ingest.error;
  const busy = upload.isPending || ingest.isPending;
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
            onClick={() => onChange({ ...episode, media: { ...episode.media, [imageRole]: null } })}
          >
            <X />
          </Button>
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!busy) {
            setOpen(isOpen);
            setGallery(false);
          }
        }}
      >
        <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-2xl">
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
                onClick={() => setGallery(true)}
              >
                <Download data-icon="inline-start" />
                خيارات TMDB
              </Button>
            </div>
            {gallery && tmdbId && season !== undefined && Number.isInteger(episode.number) && (
              <EpisodeImageChoices
                tmdbId={tmdbId}
                season={season}
                episode={episode.number}
                disabled={busy}
                onPick={(url) => ingest.mutate(url)}
              />
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

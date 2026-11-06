import type { WorkDocument } from "@arcadia/contracts/work";
import { useMutation } from "@tanstack/react-query";
import { cn } from "cn";
import { ImagePlus, Upload, Download, Undo2, Pencil } from "lucide-react";
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
import { RemoveArtwork } from "./remove-artwork";
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
  const [removed, setRemoved] = useState<{
    role: "still" | "poster" | "banner";
    path: string;
  } | null>(null);
  const [gallery, setGallery] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const id = useId();
  const imageRole = episode.media?.still ? "still" : episode.media?.poster ? "poster" : "banner";
  const value = episode.media?.[imageRole];
  function pick(path: string | null) {
    setRemoved(null);
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
      <div className="relative aspect-video w-24 overflow-hidden rounded-lg bg-muted sm:w-32">
        {value?.startsWith("/media/") ? (
          <RegisteredImage
            src={value}
            alt={`صورة ${ownerName}`}
            className="size-full"
            fit="cover"
            loading="lazy"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <span className="sr-only">بلا صورة</span>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size={value ? "icon-sm" : "icon"}
          className={value ? "absolute end-1 bottom-1" : "absolute inset-0 size-full"}
          aria-label={value ? "تغيير صورة الحلقة" : "صورة الحلقة"}
          title={value ? "تغيير صورة الحلقة" : "اختيار صورة الحلقة"}
          onClick={() => setOpen(true)}
        >
          {value ? <Pencil /> : <ImagePlus />}
        </Button>
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
        <DialogContent
          className={cn("max-h-11/12 overflow-y-auto", gallery ? "sm:max-w-6xl" : "sm:max-w-2xl")}
        >
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
            <div className="flex flex-wrap items-center gap-2">
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
                size="sm"
                disabled={
                  !tmdbId || season === undefined || !Number.isInteger(episode.number) || busy
                }
                onClick={() => setGallery(true)}
              >
                <Download data-icon="inline-start" />
                خيارات TMDB
              </Button>
              {value && (
                <RemoveArtwork
                  label="الحلقة"
                  iconOnly={false}
                  disabled={busy}
                  onRemove={() => {
                    setRemoved({ role: imageRole, path: value });
                    onChange({ ...episode, media: { ...episode.media, [imageRole]: null } });
                  }}
                />
              )}
              {removed && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    onChange({
                      ...episode,
                      media: { ...episode.media, [removed.role]: removed.path },
                    });
                    setRemoved(null);
                  }}
                >
                  <Undo2 data-icon="inline-start" />
                  تراجع عن الإزالة
                </Button>
              )}
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

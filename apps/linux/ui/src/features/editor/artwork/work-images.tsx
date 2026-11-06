import type { WorkDocument } from "@arcadia/contracts/work";
import { cn } from "cn";
import { ImageIcon, Expand, Link2, Undo2, Images } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextField } from "@/features/editor/fields/work-fields";
import { ReferencePicker } from "@/features/editor/references/reference-picker";
import { RegisteredImage } from "@/features/editor/registered-image";
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";

import { suggestedTmdbSeason } from "./artwork-model";
import { ArtworkPicker } from "./artwork-picker";
import { EpisodeArtwork } from "./episode-artwork";
import { EpisodeImagesBatch } from "./episode-images-batch";
import { mergeEpisodeImages } from "./episode-images-model";
import { RemoveArtwork } from "./remove-artwork";
type Installment = NonNullable<WorkDocument["installments"]>[number];
type Update = <K extends keyof WorkDocument>(key: K, value: WorkDocument[K]) => void;
export function WorkImages({
  draft,
  original,
  update,
}: {
  draft: WorkDocument;
  original: WorkDocument;
  update: Update;
}) {
  const [selected, setSelected] = useState("work");
  const [batch, setBatch] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const parts = draft.installments ?? [];
  const index = selected === "work" ? -1 : Number(selected);
  const part = parts[index];
  const episodes = part?.episodes ?? [];
  const rows = useEditorRows(episodes);
  const season = part ? (suggestedTmdbSeason(parts, part) ?? 1) : 1;
  function patchPart(value: Partial<Installment>) {
    update(
      "installments",
      parts.map((item, position) => (position === index ? { ...item, ...value } : item)),
    );
  }
  return (
    <FieldGroup>
      <Tabs
        value={selected}
        onValueChange={(value) => {
          if (batchBusy) return;
          setBatch(false);
          setSelected(value);
        }}
      >
        <TabsList className="h-auto flex-wrap justify-start" aria-label="صور العمل والأجزاء">
          <TabsTrigger value="work">العمل والملصقات</TabsTrigger>
          {parts.map((item, position) => (
            <TabsTrigger key={item.id ?? position} value={String(position)}>
              {item.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div
        className={cn(
          "grid items-start gap-4",
          part ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {(
          [
            { key: "poster", label: "الملصق" },
            { key: "banner", label: "الخلفية" },
            { key: "logo", label: "الشعار" },
          ] as const
        )
          .filter(() => !part)
          .map((field) => (
            <ArtworkField
              key={`${selected}-${field.key}`}
              label={field.label}
              role={field.key}
              work={draft}
              original={original.media?.[field.key]}
              value={draft.media?.[field.key]}
              onChange={(value) => update("media", { ...draft.media, [field.key]: value })}
            />
          ))}
        {!part && parts.length > 0 && (
          <section
            className="flex min-w-0 flex-col gap-3 sm:col-span-2 xl:col-span-3"
            aria-label="ملصقات الأجزاء"
          >
            <h3 className="text-sm font-medium">ملصقات الأجزاء</h3>
            <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {parts.map((installment, position) => (
                <ArtworkField
                  key={installment.id ?? position}
                  label={installment.title || `الجزء ${position + 1}`}
                  role="poster"
                  work={draft}
                  installment={installment}
                  original={
                    original.installments?.find(
                      (item) => Boolean(installment.id) && item.id === installment.id,
                    )?.media?.poster
                  }
                  value={installment.media?.poster}
                  onChange={(value) =>
                    update(
                      "installments",
                      parts.map((item, current) =>
                        current === position
                          ? { ...item, media: { ...item.media, poster: value } }
                          : item,
                      ),
                    )
                  }
                />
              ))}
            </div>
          </section>
        )}
        {part && (
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>
                صور الحلقات <span className="text-muted-foreground">{episodes.length}</span>
              </CardTitle>
              {!!episodes.length && (
                <CardAction>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setBatch(true)}>
                      <Images data-icon="inline-start" />
                      جلب الصور من TMDB
                    </Button>
                  </div>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="@container">
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 @min-2xl:grid-cols-2 @min-5xl:grid-cols-3 @min-7xl:grid-cols-4">
                  {episodes.map((episode, offset) => (
                    <div
                      key={`${selected}-${episode.id ?? offset}`}
                      className="flex items-center gap-3 rounded-xl border p-3"
                    >
                      <EpisodeArtwork
                        episode={episode}
                        ownerName={`${part.title} · ${episode.number}`}
                        tmdbId={draft.tmdbId}
                        season={season}
                        onChange={(next) =>
                          patchPart({
                            episodes: episodes.map((item, position) =>
                              position === offset ? { ...item, media: next.media } : item,
                            ),
                          })
                        }
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">الحلقة {episode.number}</p>
                        <p className="line-clamp-2 text-sm">{episode.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {!episodes.length && (
                  <p className="text-sm text-muted-foreground">لا توجد حلقات في هذا الجزء.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Dialog
        open={batch && Boolean(part)}
        onOpenChange={(open) => {
          if (!batchBusy) setBatch(open);
        }}
      >
        {batch && part && (
          <EpisodeImagesBatch
            key={selected}
            rows={rows}
            title={part.title}
            tmdbId={draft.tmdbId}
            season={season}
            onApply={(images) => patchPart({ episodes: mergeEpisodeImages(rows, images) })}
            onBusyChange={setBatchBusy}
            onClose={() => setBatch(false)}
          />
        )}
      </Dialog>
    </FieldGroup>
  );
}
function ArtworkField({
  label,
  role,
  work,
  installment,
  original,
  value,
  onChange,
  children,
}: {
  children?: ReactNode;
  label: string;
  role: "poster" | "banner" | "logo";
  work: WorkDocument;
  installment?: Installment;
  original?: string | null;
  value?: string | null;
  onChange: (value: string | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [pathOpen, setPathOpen] = useState(false);
  const [removed, setRemoved] = useState<string | null>(null);
  const changed = (value ?? null) !== (original ?? null);
  function choose(next: string | null) {
    setRemoved(null);
    onChange(next);
  }
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardAction>
          <ButtonGroup aria-label={`إجراءات صورة ${label}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!value && !original}
              aria-label={`معاينة ${label}`}
              title="معاينة"
              onClick={() => {
                setPreview(value || original || null);
              }}
            >
              <Expand />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`مسار صورة ${label}`}
              title="المسار"
              onClick={() => setPathOpen(true)}
            >
              <Link2 />
            </Button>
            <RemoveArtwork
              label={label}
              disabled={!value}
              onRemove={() => {
                setRemoved(value ?? null);
                onChange(null);
              }}
            />
          </ButtonGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-3">
          <div className={cn("grid gap-3", changed && "grid-cols-2")}>
            {(changed
              ? [
                  { label: "الحالية", path: original },
                  { label: "المسودة", path: value },
                ]
              : [{ label: "الحالية", path: value }]
            ).map((preview) => (
              <div key={preview.label} className="flex min-w-0 flex-col gap-2">
                <p className="text-xs text-muted-foreground">{preview.label}</p>
                <div
                  className={cn(
                    "flex items-center justify-center overflow-hidden rounded-lg border border-border bg-muted",
                    "h-48",
                  )}
                >
                  {preview.path?.startsWith("/media/") ? (
                    <RegisteredImage
                      src={preview.path}
                      alt={`${label} ${preview.label}`}
                      loading="lazy"
                      className="size-full"
                    />
                  ) : (
                    <ImageIcon className="size-6 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>
          {(removed || changed) && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              aria-label={`التراجع عن تغيير صورة ${label}`}
              title="التراجع عن تغيير الصورة"
              onClick={() => {
                onChange(removed ?? original ?? null);
                setRemoved(null);
              }}
            >
              <Undo2 data-icon="inline-start" />
              تراجع عن التغيير
            </Button>
          )}
          <div className="flex w-full items-start gap-1">
            <ReferencePicker
              table="media_assets"
              title={`اختيار صورة ${label}`}
              triggerLabel="المكتبة"
              triggerClassName="min-w-0 flex-1"
              images
              imageRole={role}
              onPick={choose}
            />
            <ArtworkPicker work={work} installment={installment} role={role} onPick={choose} />
          </div>
          <Dialog open={pathOpen} onOpenChange={setPathOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>مسار صورة {label}</DialogTitle>
              </DialogHeader>
              <TextField
                label={`مسار صورة ${label}`}
                value={value}
                onChange={(next) => choose(next || null)}
              />
            </DialogContent>
          </Dialog>
          <Dialog
            open={Boolean(preview)}
            onOpenChange={(open) => {
              if (!open) setPreview(null);
            }}
          >
            <DialogContent className="flex h-5/6 max-h-dvh flex-col sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>معاينة {label}</DialogTitle>
              </DialogHeader>
              {original && value && original !== value && (
                <div className="flex flex-wrap gap-2">
                  {original && original !== value && (
                    <Button variant="outline" size="sm" onClick={() => setPreview(original)}>
                      الحالية
                    </Button>
                  )}
                  {value && original !== value && (
                    <Button variant="outline" size="sm" onClick={() => setPreview(value)}>
                      المسودة
                    </Button>
                  )}
                </div>
              )}
              {preview && (
                <RegisteredImage
                  src={preview}
                  alt={`معاينة ${label}`}
                  width={1920}
                  loading="eager"
                  className="min-h-0 w-full flex-1"
                />
              )}
            </DialogContent>
          </Dialog>
          {children}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

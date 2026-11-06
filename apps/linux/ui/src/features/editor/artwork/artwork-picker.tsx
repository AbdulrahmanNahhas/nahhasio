import type { artworkSearchQuerySchema } from "@arcadia/contracts";
import type { WorkDocument } from "@arcadia/contracts/work";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { SearchIcon, UploadIcon } from "lucide-react";
import { useState, useRef } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  ingestArtwork,
  searchArtwork,
  uploadArtwork,
} from "@/features/artwork/library/artwork.functions";
import { databaseKeys } from "@/features/database/data/database.queries";
import { artworkContext } from "@/features/editor/artwork/artwork-model";
import { RegisteredImage } from "@/features/editor/registered-image";
import { languageName } from "@/lib/languages";

import { ArtworkFilter } from "./artwork-filter";

type Installment = NonNullable<WorkDocument["installments"]>[number];
type Role = "poster" | "banner" | "logo";
const languageCode = (value: string | null | undefined) =>
  value?.trim().toLowerCase().split(/[-_]/)[0] || "none";
export function ArtworkPicker({
  work,
  installment,
  role,
  onPick,
}: {
  work: WorkDocument;
  installment?: Installment;
  role: Role;
  onPick: (path: string) => void;
}) {
  return <ArtworkResults work={work} installment={installment} role={role} onPick={onPick} />;
}

function ArtworkResults({
  work,
  installment,
  role,
  onPick,
}: {
  work: WorkDocument;
  installment?: Installment;
  role: Role;
  onPick: (path: string) => void;
}) {
  const context = artworkContext(work, installment);
  const input: z.infer<typeof artworkSearchQuerySchema> = {
    title: context.title,
    year: context.year,
    seriesTitle: context.seriesTitle,
    kind: context.kind,
    tmdbId: context.tmdbId,
    anilistId: context.anilistId,
    season: context.season,
    role,
  };
  const [providers, setProviders] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(["ar", "en"]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  async function picked(result: Awaited<ReturnType<typeof ingestArtwork>>) {
    await client.invalidateQueries({ queryKey: databaseKeys.records("media_assets") });
    onPick(z.string().parse(result.path));
    setResultsOpen(false);
  }
  const search = useMutation({
    mutationFn: (query: z.infer<typeof artworkSearchQuerySchema>) => searchArtwork({ data: query }),
    onSuccess: () => {
      setProviders([]);
      setLanguages(["ar", "en"]);
      setResultsOpen(true);
    },
  });
  const ingest = useMutation({
    mutationFn: (url: string) => ingestArtwork({ data: { url, role, ownerName: context.title } }),
    onSuccess: picked,
  });
  const upload = useMutation({
    mutationFn: async (value: File) => {
      if (value.size > 10000000) throw new Error("الحد الأقصى للصورة 10 ميغابايت.");
      if (!value.type.startsWith("image/")) throw new Error("اختر ملف صورة.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(z.string().parse(reader.result)), {
          once: true,
        });
        reader.addEventListener("error", () => reject(new Error("تعذّرت قراءة الصورة.")), {
          once: true,
        });
        reader.readAsDataURL(value);
      });
      return uploadArtwork({
        data: { dataUrl, fileName: value.name, role, ownerName: context.title },
      });
    },
    onSuccess: picked,
  });
  const busy = ingest.isPending || upload.isPending;

  const languageOptions = [
    ...new Set([
      "ar",
      "en",
      "none",
      ...(search.data?.candidates ?? []).map((candidate) => languageCode(candidate.language)),
    ]),
  ].map((code) => ({ value: code, label: code === "none" ? "بلا لغة" : languageName(code) }));
  const candidates =
    search.data?.candidates.filter(
      (candidate) =>
        (!providers.length || providers.includes(candidate.provider)) &&
        (!languages.length || languages.includes(languageCode(candidate.language))),
    ) ?? [];
  const error = search.error ?? ingest.error ?? upload.error;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {error && (
        <Alert variant="destructive" className="border-border">
          <AlertTitle>تعذّرت العملية</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          className="min-w-0 flex-1"
          aria-label="مصادر الصور"
          disabled={search.isPending || busy || !input.title.trim()}
          onClick={() => search.mutate(input)}
        >
          <SearchIcon data-icon="inline-start" />
          {search.isPending ? "جارٍ البحث…" : "المصادر"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={upload.isPending ? "جارٍ رفع الصورة" : "رفع صورة من الجهاز"}
          title="رفع صورة من الجهاز"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <UploadIcon data-icon="inline-start" />
        </Button>
        <Input
          ref={fileInput}
          className="sr-only"
          tabIndex={-1}
          type="file"
          accept="image/*"
          aria-label="رفع صورة من الجهاز"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = "";
          }}
        />
      </div>
      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="flex h-11/12 flex-col sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>نتائج البحث عن الصور</DialogTitle>
            <DialogDescription>
              {search.variables?.title} · {candidates.length} من{" "}
              {search.data?.candidates.length ?? 0} صورة
            </DialogDescription>
          </DialogHeader>
          {ingest.isError && (
            <Alert variant="destructive" className="border-border">
              <AlertTitle>تعذّر الاستيراد</AlertTitle>
              <AlertDescription>{ingest.error.message}</AlertDescription>
            </Alert>
          )}
          {search.data?.warnings.length ? (
            <Alert className="border-border">
              <AlertTitle>بعض المصادر غير متاحة</AlertTitle>
              <AlertDescription>{search.data.warnings.join(" · ")}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <ArtworkFilter
              label="لغات الصور"
              placeholder="كل اللغات"
              options={languageOptions}
              value={languages}
              onChange={setLanguages}
            />
            <ArtworkFilter
              label="مصادر الصور"
              placeholder="كل المصادر"
              options={[
                { value: "tmdb", label: "TMDB" },
                { value: "fanart", label: "Fanart" },
                { value: "anilist", label: "AniList" },
              ]}
              value={providers}
              onChange={setProviders}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLanguages([]);
                setProviders([]);
              }}
            >
              عرض الكل
            </Button>
          </div>
          {search.isSuccess && !candidates.length && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {search.data?.candidates.length
                    ? "لا توجد صور تطابق المرشحات"
                    : "لا توجد صور مطابقة"}
                </EmptyTitle>
                <EmptyDescription>
                  اختر لغات أو مصادر أخرى، أو اعرض الكل. إذا لم تُرجع المصادر أي صور، راجع معرّفات
                  العمل والجزء.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <div
            className={cn(
              "grid min-h-0 flex-1 content-start gap-3 overflow-y-auto grid-cols-2 sm:grid-cols-3",
              role === "poster" && candidates.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-3",
            )}
          >
            {candidates.map((candidate) => (
              <div
                key={candidate.downloadUrl}
                className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-2"
              >
                <RegisteredImage
                  src={candidate.previewUrl}
                  alt={candidate.matchLabel}
                  loading="lazy"
                  className={cn(
                    "w-full object-contain",
                    role === "poster" && "aspect-2/3",
                    role === "banner" && "aspect-video",
                    role === "logo" && "aspect-square",
                  )}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {candidate.provider === "tmdb"
                      ? "TMDB"
                      : candidate.provider === "fanart"
                        ? "Fanart"
                        : "AniList"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {candidate.width ?? "?"} × {candidate.height ?? "?"} ·{" "}
                    {candidate.language ? languageName(candidate.language) : "بلا لغة"}
                  </span>
                </div>
                <p dir="auto" title={candidate.matchLabel} className="truncate text-xs">
                  {candidate.matchLabel}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-auto"
                  disabled={busy}
                  onClick={() => ingest.mutate(candidate.downloadUrl)}
                >
                  {ingest.isPending && ingest.variables === candidate.downloadUrl
                    ? "جارٍ الاستيراد…"
                    : "استيراد واختيار"}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

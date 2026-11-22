import {
  SubtitleProviderStatusSchema,
  SubtitleSearchResultsSchema,
  SubtitleSearchSchema,
  type SubtitleSearch,
} from "@nahhasio/api-contract";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { Captions, Search } from "lucide-react";
import { useId, useState } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Failure } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { gateway, nativeCall } from "@/lib/bridge";

import type { PlayerSnapshot } from "./bridge";
function subtitleCall(command: string, payload: z.input<typeof z.json>, signal?: AbortSignal) {
  return nativeCall(command, payload, signal, 45000);
}

const connectionSchema = SubtitleProviderStatusSchema.extend({
  source: z.enum(["server", "device", "none"]),
});
const connectionKey = ["viewer", "opensubtitles", "status"];
const languages: { value: SubtitleSearch["language"]; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "الإنجليزية" },
  { value: "fr", label: "الفرنسية" },
  { value: "es", label: "الإسبانية" },
];
const subtitleStatus = () =>
  queryOptions({
    queryKey: connectionKey,
    queryFn: async ({ signal }) =>
      connectionSchema.parse(await subtitleCall("opensubtitles.status", {}, signal)),
    retry: false,
  });

export function OpenSubtitlesSettings() {
  const status = useQuery(subtitleStatus());
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>OpenSubtitles</CardTitle>
        <CardDescription>يُدار مفتاح الخدمة وحساب التنزيل من بيئة الخادم.</CardDescription>
      </CardHeader>
      <CardContent>
        {status.error ? (
          <Failure error={status.error} retry={() => void status.refetch()} />
        ) : status.data ? (
          <Badge variant={status.data.configured ? "secondary" : "outline"}>
            {status.data.source === "device"
              ? "اتصال محفوظ على هذا الجهاز"
              : status.data.downloads
                ? "البحث والتنزيل مهيّآن على الخادم"
                : status.data.configured
                  ? "البحث فقط مهيّأ على الخادم"
                  : "لم يهيّئ مدير الخادم مصدر الترجمة"}
          </Badge>
        ) : (
          <p role="status">جارٍ قراءة إعداد المصدر…</p>
        )}
      </CardContent>
    </Card>
  );
}
export function OpenSubtitlesSearch({
  snapshot,
  sessionId,
  title,
  disabled,
}: {
  snapshot: PlayerSnapshot;
  sessionId: string;
  title: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const work = useQuery({
    queryKey: ["viewer", "subtitle-context", snapshot.workId],
    queryFn: ({ signal }) => gateway.work(snapshot.workId!, signal),
    enabled: open && Boolean(snapshot.workId),
    staleTime: 300000,
    retry: false,
  });
  const part = work.data?.installments.find((item) => item.id === snapshot.installmentId);
  const episode = part?.episodes.find((item) => item.id === snapshot.episodeId);
  const seasons =
    work.data?.installments
      .filter((item) => item.kind === "season")
      .toSorted((a, b) => a.position - b.position) ?? [];
  const context = {
    title: work.data?.canonicalTitle ?? title,
    year: part?.kind === "season" ? null : (work.data?.releaseYear ?? null),
    season:
      part?.kind === "season"
        ? seasons.findIndex((item) => item.id === part.id) + 1
        : part?.kind === "special"
          ? 0
          : null,
    episode: episode && Number.isInteger(Number(episode.number)) ? Number(episode.number) : null,
    imdbId:
      part?.kind === "movie"
        ? (part.externalIds.imdbId ??
          (seasons.length === 0 ? work.data?.externalIds.imdbId : null) ??
          null)
        : (work.data?.externalIds.imdbId ?? null),
    tmdbId:
      part?.kind === "movie"
        ? (part.externalIds.tmdbId ??
          (seasons.length === 0 ? work.data?.externalIds.tmdbId : null) ??
          null)
        : (work.data?.externalIds.tmdbId ?? null),
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="w-full" disabled={disabled} />}
      >
        <Captions data-icon="inline-start" />
        البحث عن ترجمة عبر OpenSubtitles
      </DialogTrigger>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ترجمة من OpenSubtitles</DialogTitle>
          <DialogDescription className="sr-only">اختيار ترجمة للفيديو الحالي.</DialogDescription>
        </DialogHeader>
        {open &&
          (work.isFetching && !work.data && snapshot.workId ? (
            <p role="status">جارٍ تحديد العمل والحلقة…</p>
          ) : (
            <SubtitleSearchForm
              key={`${sessionId}:${context.title}`}
              sessionId={sessionId}
              context={context}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
function SubtitleSearchForm({
  sessionId,
  context,
}: {
  sessionId: string;
  context: {
    title: string;
    year: number | null;
    season: number | null;
    episode: number | null;
    imdbId: string | null;
    tmdbId: number | null;
  };
}) {
  const [query, setQuery] = useState(context.title.slice(0, 200));
  const [language, setLanguage] = useState<SubtitleSearch["language"]>("ar");
  const [year, setYear] = useState(context.year?.toString() ?? "");
  const [season, setSeason] = useState(context.season?.toString() ?? "");
  const [episode, setEpisode] = useState(context.episode?.toString() ?? "");
  const id = useId();
  const search = useMutation({
    mutationFn: async (input: SubtitleSearch) =>
      SubtitleSearchResultsSchema.parse(
        await subtitleCall("opensubtitles.search", SubtitleSearchSchema.parse(input)),
      ),
  });
  const currentSearch = (page: number) => ({
    query: query.trim(),
    language,
    year: year ? Number(year) : null,
    season: season ? Number(season) : null,
    episode: episode ? Number(episode) : null,
    page,
    imdbId: query.trim() === context.title ? context.imdbId : null,
    tmdbId: query.trim() === context.title ? context.tmdbId : null,
  });
  const apply = useMutation({
    mutationFn: async (item: z.infer<typeof SubtitleSearchResultsSchema>["items"][number]) =>
      z.object({ ok: z.literal(true), remaining: z.number().nullable() }).parse(
        await subtitleCall("opensubtitles.apply", {
          sessionId,
          fileId: item.fileId,
          language: item.language,
          label: (item.release || item.fileName || "OpenSubtitles").slice(0, 200),
        }),
      ),
  });
  const status = useQuery(subtitleStatus());
  const pending = search.isPending || apply.isPending;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{context.title}</Badge>
        {season && <Badge variant="outline">الموسم {season}</Badge>}
        {episode && <Badge variant="outline">الحلقة {episode}</Badge>}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply.reset();
          search.mutate(currentSearch(1));
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-query`}>عنوان العمل أو اسم الإصدار</FieldLabel>
            <Input
              id={`${id}-query`}
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-language`}>لغة الترجمة</FieldLabel>
            <Choice
              id={`${id}-language`}
              label="لغة الترجمة"
              value={language}
              options={languages}
              onChange={(value) => {
                const selected = languages.find((item) => item.value === value);
                if (selected) setLanguage(selected.value);
              }}
            />
          </Field>
          <details>
            <summary className="cursor-pointer text-sm text-muted-foreground">
              تعديل السنة والموسم والحلقة
            </summary>
            <FieldGroup className="mt-3 grid grid-cols-3 gap-3">
              {[
                { key: "year", label: "السنة", value: year, set: setYear, min: 1880, max: 2200 },
                {
                  key: "season",
                  label: "الموسم",
                  value: season,
                  set: setSeason,
                  min: 0,
                  max: 1000,
                },
                {
                  key: "episode",
                  label: "الحلقة",
                  value: episode,
                  set: setEpisode,
                  min: 0,
                  max: 10000,
                },
              ].map((field) => (
                <Field key={field.key}>
                  <FieldLabel htmlFor={`${id}-${field.key}`}>{field.label}</FieldLabel>
                  <Input
                    id={`${id}-${field.key}`}
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={field.value}
                    onChange={(event) => field.set(event.target.value)}
                    disabled={pending}
                  />
                </Field>
              ))}
            </FieldGroup>
          </details>
          <Button
            type="submit"
            disabled={pending || !query.trim() || status.data?.configured === false}
          >
            <Search data-icon="inline-start" />
            {search.isPending ? "جارٍ البحث…" : "بحث"}
          </Button>
        </FieldGroup>
      </form>
      {status.data?.configured === false && (
        <p role="status" className="text-sm text-muted-foreground">
          لم يهيّئ مدير الخادم مصدر الترجمة.
        </p>
      )}
      {status.data?.configured && !status.data.downloads && (
        <p role="status" className="text-sm text-muted-foreground">
          البحث متاح. يتطلب تنزيل الترجمة حسابًا مهيّأ على الخادم.
        </p>
      )}
      {(search.error || apply.error) && <Failure error={(search.error || apply.error)!} />}
      {apply.data && (
        <p role="status" className="text-sm">
          أُرسلت الترجمة إلى المشغّل. يمكنك تصحيح التوقيت من أدوات الترجمة.
          {apply.data.remaining !== null ? ` التنزيلات المتبقية: ${apply.data.remaining}.` : ""}
        </p>
      )}
      {search.data?.items.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد ترجمة مطابقة</EmptyTitle>
            <EmptyDescription>
              جرّب العنوان الإنجليزي أو عدّل السنة ورقم الموسم والحلقة.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <ScrollArea className="max-h-80">
        <div className="flex min-w-0 flex-col gap-3">
          {search.data?.items.map((item) => (
            <div key={item.fileId} className="flex min-w-0 flex-col gap-2 rounded-xl border p-3">
              <p className="wrap-break-word text-sm font-medium" dir="auto">
                {item.release || item.fileName || "إصدار دون اسم"}
              </p>
              <p className="wrap-break-word text-xs text-muted-foreground" dir="auto">
                {item.fileName}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{item.language}</Badge>
                {item.hearingImpaired && <Badge variant="outline">وصف الأصوات</Badge>}
                {item.machineTranslated && <Badge variant="outline">ترجمة آلية</Badge>}
                {item.aiTranslated && <Badge variant="outline">ترجمة بالذكاء الاصطناعي</Badge>}
                <span className="text-xs text-muted-foreground">
                  {item.downloads} تنزيل · بيانات المزود
                </span>
              </div>
              <Button
                size="sm"
                className="self-start"
                disabled={
                  pending ||
                  status.data?.downloads === false ||
                  (apply.isSuccess && apply.variables.fileId === item.fileId)
                }
                onClick={() => apply.mutate(item)}
              >
                {apply.isPending && apply.variables?.fileId === item.fileId
                  ? "جارٍ التنزيل والإضافة…"
                  : "تنزيل وإضافة إلى المشغّل"}
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
      {search.data && search.data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending || search.data.page <= 1}
            onClick={() =>
              search.variables &&
              search.mutate({ ...search.variables, page: search.data!.page - 1 })
            }
          >
            السابق
          </Button>
          <span className="text-xs">
            صفحة {search.data.page} من {search.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || search.data.page >= Math.min(100, search.data.totalPages)}
            onClick={() =>
              search.variables &&
              search.mutate({ ...search.variables, page: search.data!.page + 1 })
            }
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}

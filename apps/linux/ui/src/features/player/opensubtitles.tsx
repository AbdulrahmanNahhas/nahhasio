import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { navigate } from "@/features/shell/navigation";
import { gateway, nativeCall } from "@/lib/bridge";

import type { PlayerSnapshot } from "./bridge";
function subtitleCall(command: string, payload: z.input<typeof z.json>, signal?: AbortSignal) {
  return nativeCall(command, payload, signal, 45000);
}
import { developmentBrowserAvailable } from "@/lib/development-platform";

const connectionSchema = z.object({ connected: z.boolean(), secureStorage: z.boolean() });
const quotaSchema = z.object({
  username: z.string(),
  remaining: z.number().nullable(),
  limit: z.number().nullable(),
});
const resultSchema = z.object({
  items: z
    .array(
      z.object({
        fileId: z.number().int().positive().safe(),
        release: z.string(),
        fileName: z.string(),
        language: z.string(),
        downloads: z.number(),
        hearingImpaired: z.boolean(),
        machineTranslated: z.boolean(),
        aiTranslated: z.boolean(),
      }),
    )
    .max(200),
  page: z.number(),
  totalPages: z.number(),
});
const connectionKey = ["device", "opensubtitles"];
const languages = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "الإنجليزية" },
  { value: "fr", label: "الفرنسية" },
  { value: "es", label: "الإسبانية" },
];
export function OpenSubtitlesSettings() {
  const browser = developmentBrowserAvailable();
  const query = useQuery({
    queryKey: connectionKey,
    queryFn: async ({ signal }) =>
      connectionSchema.parse(await subtitleCall("opensubtitles.status", {}, signal)),
    enabled: !browser,
    retry: false,
  });
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>OpenSubtitles</CardTitle>
        <CardDescription>
          مفتاحك وحسابك محفوظان مشفّرين على هذا الجهاز، منفصلين لكل حساب ومكتبة. لن تُرسل إلى خادم
          نحّاسيو.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {browser ? (
          <p className="text-sm text-muted-foreground">
            اربط الخدمة في تطبيق Linux. لا تُدخل بياناتك السرية في معاينة المتصفح.
          </p>
        ) : query.error ? (
          <Failure error={query.error} retry={() => void query.refetch()} />
        ) : query.data ? (
          <ConnectionForm key={String(query.data.connected)} connection={query.data} />
        ) : (
          <p role="status">جارٍ فحص الاتصال المحلي…</p>
        )}
      </CardContent>
    </Card>
  );
}
function ConnectionForm({ connection }: { connection: z.infer<typeof connectionSchema> }) {
  const client = useQueryClient();
  const id = useId();
  const [key, setKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: async () =>
      connectionSchema.parse(
        await subtitleCall("opensubtitles.login", {
          apiKey: key.trim(),
          username: username.trim(),
          password,
        }),
      ),
    onSuccess: (value) => {
      setKey("");
      setUsername("");
      setPassword("");
      client.setQueryData(connectionKey, value);
    },
  });
  const test = useMutation({
    mutationFn: async () => quotaSchema.parse(await subtitleCall("opensubtitles.test", {})),
  });
  const disconnect = useMutation({
    mutationFn: () => nativeCall("opensubtitles.disconnect", {}),
    onSuccess: () => {
      test.reset();
      client.setQueryData(connectionKey, {
        connected: false,
        secureStorage: connection.secureStorage,
      });
    },
  });
  const pending = login.isPending || test.isPending || disconnect.isPending;
  return (
    <>
      <Badge variant={connection.connected ? "secondary" : "outline"}>
        {connection.connected ? "حساب مربوط على هذا الجهاز" : "غير مربوط"}
      </Badge>
      {!connection.secureStorage && (
        <p className="text-sm text-muted-foreground">
          مخزن الأسرار الآمن غير متاح. لن تُحفظ المفاتيح دون تشفير.
        </p>
      )}
      {connection.connected ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={() => test.mutate()}>
            اختبار الاتصال والحصة
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => disconnect.mutate()}>
            إزالة الاتصال من هذا الجهاز
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-key`}>مفتاح OpenSubtitles API</FieldLabel>
              <Input
                id={`${id}-key`}
                type="password"
                autoComplete="off"
                maxLength={512}
                value={key}
                onChange={(event) => setKey(event.target.value)}
                disabled={pending || !connection.secureStorage}
              />
              <FieldDescription>
                أنشئه في حساب OpenSubtitles.com ضمن API Consumers؛ يختلف عن كلمة مرور الحساب.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-user`}>اسم المستخدم (اختياري)</FieldLabel>
              <Input
                id={`${id}-user`}
                autoComplete="off"
                maxLength={200}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={pending || !connection.secureStorage}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-password`}>كلمة المرور</FieldLabel>
              <Input
                id={`${id}-password`}
                type="password"
                autoComplete="off"
                maxLength={1024}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending || !connection.secureStorage}
              />
              <FieldDescription>
                تُستخدم للدخول فقط؛ يُحفظ رمز الجلسة والمفتاح مشفّرين، ولا تُحفظ كلمة المرور.
              </FieldDescription>
            </Field>
            <Button
              type="submit"
              disabled={
                pending ||
                !connection.secureStorage ||
                !key.trim() ||
                Boolean(username.trim()) !== Boolean(password)
              }
            >
              {login.isPending
                ? "جارٍ الربط…"
                : username.trim()
                  ? "ربط الحساب"
                  : "استخدام مفتاح API فقط"}
            </Button>
          </FieldGroup>
        </form>
      )}
      {test.data && (
        <p role="status" className="text-sm">
          متصل بحساب <bdi>{test.data.username}</bdi> · التنزيلات المتبقية:{" "}
          {test.data.remaining ?? "لم يحددها المزود"}
          {test.data.limit !== null ? ` من ${test.data.limit}` : ""}
        </p>
      )}
      {(login.error || test.error || disconnect.error) && (
        <Failure error={(login.error || test.error || disconnect.error)!} />
      )}
    </>
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
              onApplied={() => setOpen(false)}
              onSettings={() => {
                setOpen(false);
                navigate("/settings?section=subtitles");
              }}
            />
          ))}
      </DialogContent>
    </Dialog>
  );
}
function SubtitleSearchForm({
  sessionId,
  context,
  onSettings,
  onApplied,
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
  onSettings: () => void;
  onApplied: () => void;
}) {
  const [query, setQuery] = useState(context.title.slice(0, 200));
  const [language, setLanguage] = useState("ar");
  const [year, setYear] = useState(context.year?.toString() ?? "");
  const [season, setSeason] = useState(context.season?.toString() ?? "");
  const [episode, setEpisode] = useState(context.episode?.toString() ?? "");
  const id = useId();
  const search = useMutation({
    mutationFn: async (input: {
      query: string;
      language: string;
      year: number | null;
      season: number | null;
      episode: number | null;
      page: number;
      imdbId: string | null;
      tmdbId: number | null;
    }) => resultSchema.parse(await subtitleCall("opensubtitles.search", input)),
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
    mutationFn: async (item: z.infer<typeof resultSchema>["items"][number]) =>
      z.object({ ok: z.literal(true), remaining: z.number().nullable() }).parse(
        await subtitleCall("opensubtitles.apply", {
          sessionId,
          fileId: item.fileId,
          language: item.language,
          label: (item.release || item.fileName || "OpenSubtitles").slice(0, 200),
        }),
      ),
    onSuccess: onApplied,
  });
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
              onChange={setLanguage}
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
          <Button type="submit" disabled={pending || !query.trim()}>
            <Search data-icon="inline-start" />
            {search.isPending ? "جارٍ البحث…" : "بحث"}
          </Button>
        </FieldGroup>
      </form>
      <Button variant="link" onClick={onSettings}>
        إعداد اتصال OpenSubtitles
      </Button>
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
                disabled={pending}
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

import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Play, RefreshCw, Search, Users } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SelectField } from "@/features/editor/fields/work-fields";

import { choiceKey, playSource, sourceOptions, type FileChoice } from "./playback";
import { formatSource, formatSourceSize, sourceLanguageLabel } from "./source-format";
import type { PlayerController } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";

export function TorrentSources({
  target,
  player,
  onPlaybackStarted,
}: {
  target: WatchTarget | null;
  player: PlayerController;
  onPlaybackStarted?: () => void;
}) {
  const sessionId = player.snapshot?.sessionId ?? "";
  return (
    <SessionSources
      key={sessionId}
      sessionId={sessionId}
      target={target}
      player={player}
      onPlaybackStarted={onPlaybackStarted}
    />
  );
}

export function DownloadSources({
  sessionId,
  target,
  onQueued,
}: {
  sessionId: string;
  target: WatchTarget;
  onQueued: () => void;
}) {
  return <SessionSources sessionId={sessionId} target={target} onQueued={onQueued} />;
}

function SessionSources({
  sessionId,
  target,
  player,
  onPlaybackStarted,
  onQueued,
}: {
  sessionId: string;
  target: WatchTarget | null;
  player?: PlayerController;
  onQueued?: () => void;
  onPlaybackStarted?: () => void;
}) {
  const client = useQueryClient();
  const downloading = target?.intent === "download";
  const ActionIcon = downloading ? Download : Play;
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [quality, setQuality] = useState("all");
  const [language, setLanguage] = useState("all");
  const [provider, setProvider] = useState("all");
  const [sort, setSort] = useState("provider");
  const [limit, setLimit] = useState(20);
  const sources = useQuery({
    ...sourceOptions(
      sessionId,
      target ?? { workId: "00000000-0000-0000-0000-000000000000", title: "Video" },
    ),
    enabled: Boolean(sessionId && target),
  });
  const choice = useQuery<FileChoice | null>({
    queryKey: choiceKey(sessionId),
    queryFn: () => null,
    enabled: false,
  });
  const mutationKey = ["native", "source", sessionId] as const;
  const sourcePending = useIsMutating({ mutationKey }) > 0;
  const play = useMutation({
    mutationKey,
    mutationFn: ({ sourceId, fileIndex }: { sourceId: string; fileIndex?: number }) =>
      playSource(client, sessionId, sourceId, fileIndex, downloading ? "download" : "watch"),
    onSuccess: (reply) => {
      if (reply.mode === "playing") onPlaybackStarted?.();
      if (reply.mode === "downloading") onQueued?.();
    },
    networkMode: "always",
    retry: false,
  });
  const busy = sourcePending || player?.pending || !sessionId;
  const candidates = useMemo(
    () =>
      sources.data?.candidates.map((candidate) => ({
        candidate,
        display: formatSource(candidate),
      })) ?? [],
    [sources.data],
  );
  const term = search.trim().toLocaleLowerCase();
  const qualities = [
    ...new Set(
      candidates.flatMap(({ display }) => (display.resolution ? [display.resolution] : [])),
    ),
  ].toSorted((a, b) => b - a);
  const languages = [
    ...new Set(
      candidates.flatMap(({ display }) => [
        ...display.reportedLanguages,
        ...(display.englishInferred ? ["en"] : []),
      ]),
    ),
  ].toSorted(
    (a, b) =>
      (a === "en" ? -1 : a === "ar" ? 0 : 1) - (b === "en" ? -1 : b === "ar" ? 0 : 1) ||
      a.localeCompare(b),
  );
  const visible = candidates
    .filter(
      ({ candidate, display }) =>
        (quality === "all" || String(display.resolution) === quality) &&
        (provider === "all" || candidate.provider === provider) &&
        (language === "all" ||
          display.reportedLanguages.includes(language) ||
          (language === "en" && display.englishInferred)) &&
        [
          candidate.label,
          candidate.release,
          display.codec,
          display.hdr,
          display.resolution ? `${display.resolution}p` : null,
          ...display.reportedLanguages.map(sourceLanguageLabel),
          display.englishInferred ? "English الإنجليزية إنجليزي" : null,
          display.audioTag,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(term),
    )
    .toSorted((a, b) =>
      sort === "peers"
        ? (b.display.seeders ?? -1) - (a.display.seeders ?? -1)
        : sort === "smallest"
          ? (a.display.sizeBytes ?? Infinity) - (b.display.sizeBytes ?? Infinity)
          : 0,
    );
  const fileChoice = choice.data;
  const error = play.error ?? sources.error;
  function refresh() {
    play.reset();
    setLimit(20);
    void sources.refetch();
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          {sources.isFetching && <Spinner />}
          {sources.isFetching && !candidates.length
            ? "جارٍ البحث…"
            : candidates.length
              ? `${visible.length} مصدر`
              : "المصادر"}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="إعادة البحث عن مصادر"
          disabled={sources.isFetching || busy || !target}
          onClick={refresh}
        >
          <RefreshCw />
        </Button>
      </div>
      {play.data?.mode === "downloading" && (
        <Alert>
          <AlertTitle>أُضيف الفيديو إلى التنزيلات</AlertTitle>
          <AlertDescription>تابع التقدم من صفحة التنزيلات.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <AlertTitle>{play.error ? "تعذّر فتح المصدر" : "تعذّر البحث عن المصادر"}</AlertTitle>
            <AlertDescription className="wrap-anywhere">{error.message}</AlertDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || sources.isFetching}
            onClick={refresh}
          >
            إعادة المحاولة
          </Button>
        </Alert>
      )}
      {sources.data?.providers
        .filter((item) => item.error)
        .map((item) => (
          <Alert
            key={item.id}
            variant="destructive"
            className="flex items-center justify-between gap-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <AlertTitle>{item.id}</AlertTitle>
              <AlertDescription className="wrap-anywhere">{item.error?.message}</AlertDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || sources.isFetching}
              onClick={refresh}
            >
              إعادة المحاولة
            </Button>
          </Alert>
        ))}
      {fileChoice && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              <h3>اختر ملف الفيديو</h3>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {fileChoice.files.map((file) => (
              <div key={file.index} className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p dir="auto" className="text-sm wrap-anywhere">
                    {file.path}
                  </p>
                  <span dir="ltr" className="text-xs text-muted-foreground">
                    {formatSourceSize(file.size)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  aria-label={`${downloading ? "تنزيل" : "تشغيل"} الملف ${file.path}`}
                  onClick={() =>
                    play.mutate({ sourceId: fileChoice.sourceId, fileIndex: file.index })
                  }
                >
                  <ActionIcon data-icon="inline-start" />
                  {downloading ? "تنزيل هذا الملف" : "تشغيل هذا الملف"}
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => client.setQueryData(choiceKey(sessionId), null)}
            >
              العودة إلى المصادر
            </Button>
          </CardContent>
        </Card>
      )}
      {(candidates.length > 0 || Boolean(sources.data?.providers.length)) && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <FieldGroup className="min-w-48 flex-1">
              <Field>
                <FieldLabel htmlFor={searchId} className="sr-only">
                  البحث في المصادر
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={searchId}
                    type="search"
                    dir="auto"
                    autoComplete="off"
                    maxLength={200}
                    placeholder="ابحث بالإصدار أو اللغة…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setLimit(20);
                    }}
                  />
                </InputGroup>
              </Field>
            </FieldGroup>
            <div className="w-40">
              <SelectField
                label="ترتيب المصادر"
                hideLabel
                value={sort}
                items={[
                  { value: "provider", label: "ترتيب المزوّد" },
                  { value: "peers", label: "الأكثر مشاركة" },
                  { value: "smallest", label: "الأصغر حجمًا" },
                ]}
                onChange={(value) => {
                  setSort(value);
                  setLimit(20);
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {sources.data?.providers.length ? (
              <ToggleGroup
                variant="outline"
                spacing={1}
                aria-label="مزوّد التورنت"
                className="flex-wrap justify-start"
                value={[provider]}
                onValueChange={(values: string[]) => {
                  if (values[0]) {
                    setProvider(values[0]);
                    setLimit(20);
                  }
                }}
              >
                <ToggleGroupItem value="all">كل المزوّدين</ToggleGroupItem>
                {sources.data.providers.map((item) => (
                  <ToggleGroupItem key={item.id} value={item.id}>
                    <span dir="ltr">{item.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.error ? "!" : item.count}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : null}
            {qualities.length > 1 && (
              <ToggleGroup
                variant="outline"
                spacing={1}
                aria-label="جودة التورنت"
                className="flex-wrap justify-start"
                value={[quality]}
                onValueChange={(values: string[]) => {
                  if (values[0]) {
                    setQuality(values[0]);
                    setLimit(20);
                  }
                }}
              >
                <ToggleGroupItem value="all">الكل</ToggleGroupItem>
                {qualities.map((value) => (
                  <ToggleGroupItem key={value} value={String(value)}>
                    {value === 2160 ? "4K" : `${value}p`}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            {languages.length > 0 && (
              <ToggleGroup
                variant="outline"
                spacing={1}
                aria-label="لغة التورنت"
                className="flex-wrap justify-start"
                value={[language]}
                onValueChange={(values: string[]) => {
                  if (values[0]) {
                    setLanguage(values[0]);
                    setLimit(20);
                  }
                }}
              >
                <ToggleGroupItem value="all">كل اللغات</ToggleGroupItem>
                {languages.map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {sourceLanguageLabel(value)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </div>
        </>
      )}
      {sources.isFetching && !candidates.length && (
        <div className="flex flex-col gap-3" aria-label="جارٍ البحث عن المصادر">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}
      {sources.isSuccess && !candidates.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد مصادر تورنت لهذا الإصدار</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      {!target && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>اختر عملًا للبحث عن مصادره</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      {candidates.length > 0 && !visible.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد نتائج مطابقة</EmptyTitle>
            <EmptyDescription>غيّر البحث أو المزوّد أو الجودة أو اللغة.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <ItemGroup className="gap-2" aria-label="مصادر التورنت">
        {visible.slice(0, limit).map(({ candidate, display }) => {
          const opening = sourcePending && play.variables?.sourceId === candidate.id;
          const name =
            display.releaseTitle ??
            display.filename
              ?.split(/[\\/]/u)
              .at(-1)
              ?.replace(/\.(mkv|mp4|webm|avi)$/iu, "")
              .replace(/[._]/gu, " ") ??
            target?.title ??
            "إصدار فيديو";
          return (
            <div key={candidate.id} role="listitem">
              <Item variant={opening ? "muted" : "outline"} className="items-start">
                <ItemContent className="min-w-0">
                  <ItemTitle className="min-w-0 max-w-full">
                    <h3 dir="auto" className="line-clamp-2 wrap-anywhere">
                      {name}
                    </h3>
                  </ItemTitle>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                    <Badge variant="outline" dir="ltr">
                      {candidate.provider}
                    </Badge>
                    {display.resolution && (
                      <Badge variant="secondary" dir="ltr">
                        {display.resolution === 2160 ? "4K" : `${display.resolution}p`}
                      </Badge>
                    )}
                    {display.codec && <span dir="ltr">{display.codec}</span>}
                    {display.hdr && <span dir="ltr">{display.hdr}</span>}
                    {display.audioTag && (
                      <Badge variant="outline" dir="ltr">
                        {display.audioTag}
                      </Badge>
                    )}
                    {display.englishInferred && (
                      <span title="الإنجليزية مرجّحة من وسم الدبلجة في الإصدار">الإنجليزية ≈</span>
                    )}
                    {display.sizeBytes !== null && (
                      <span dir="ltr">{formatSourceSize(display.sizeBytes)}</span>
                    )}
                    {display.seeders !== null && (
                      <span className="flex items-center gap-1" title="المشاركون">
                        <Users className="size-3" aria-hidden="true" />
                        {display.seeders}
                      </span>
                    )}
                    {display.reportedLanguages.length > 0 && (
                      <span>
                        {display.reportedLanguages.slice(0, 3).map(sourceLanguageLabel).join("، ")}
                        {display.reportedLanguages.length > 3
                          ? ` +${display.reportedLanguages.length - 3}`
                          : ""}
                      </span>
                    )}
                  </div>
                  <details className="min-w-0 text-xs text-muted-foreground">
                    <summary className="w-fit cursor-pointer rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-ring">
                      تفاصيل الإصدار
                    </summary>
                    <div className="flex min-w-0 flex-col gap-2 pt-2">
                      <p dir="auto" className="whitespace-pre-line wrap-anywhere">
                        {candidate.release}
                      </p>
                      <p dir="auto">{display.providerLabel}</p>
                    </div>
                  </details>
                </ItemContent>
                <ItemActions>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !candidate.available}
                    aria-label={downloading ? "تنزيل هذا المصدر" : "تشغيل هذا المصدر"}
                    onClick={() => play.mutate({ sourceId: candidate.id })}
                  >
                    {opening ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <ActionIcon data-icon="inline-start" />
                    )}
                    {opening
                      ? "جارٍ الفتح…"
                      : !candidate.available
                        ? "غير مدعوم"
                        : downloading
                          ? "تنزيل"
                          : "تشغيل"}
                  </Button>
                </ItemActions>
              </Item>
            </div>
          );
        })}
      </ItemGroup>
      {visible.length > limit && (
        <Button variant="ghost" onClick={() => setLimit((value) => value + 20)}>
          عرض المزيد ({visible.length - limit})
        </Button>
      )}
    </div>
  );
}

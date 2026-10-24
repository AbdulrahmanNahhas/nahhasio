import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
  const visible = candidates.filter(({ candidate, display }) =>
    [
      candidate.label,
      candidate.release,
      display.codec,
      display.hdr,
      display.resolution ? `${display.resolution}p` : null,
      ...display.reportedLanguages.map(sourceLanguageLabel),
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase()
      .includes(term),
  );
  const fileChoice = choice.data;
  const error = play.error ?? sources.error;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {downloading
          ? "اختر التورنت والملف للتنزيل دون تشغيل. يُحفظ الفيديو المكتمل في مجلد العمل داخل Videos/nahhasio."
          : "اختر مصدرًا لبدء التشغيل. الجودة واللغات مبلّغ عنها من Torrentio؛ لا تثبت وجود دبلجة أو ترجمة. تظهر المسارات الفعلية بعد فتح الفيديو."}
      </p>
      {(sources.isFetching || sourcePending || player?.snapshot?.buffering) && (
        <p role="status" className="text-sm text-muted-foreground">
          {sourcePending
            ? "جارٍ فتح المصدر والتحقق من ملفات الفيديو…"
            : sources.isFetching
              ? "جارٍ البحث عن المصادر…"
              : "جارٍ تخزين الفيديو مؤقتًا…"}
        </p>
      )}
      {play.data?.mode === "downloading" && (
        <Alert>
          <AlertTitle>أُضيف الفيديو إلى التنزيلات</AlertTitle>
          <AlertDescription>
            تابع التقدم من التنزيلات. سيظهر الملف باسمه الأصلي بعد اكتماله؛ الترجمة الخارجية ليست
            مدمجة بعد.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{play.error ? "تعذّر فتح المصدر" : "تعذّر البحث عن المصادر"}</AlertTitle>
          <AlertDescription>
            <p className="wrap-anywhere">{error.message}</p>
            <p>أعد المحاولة أو اختر مصدرًا آخر؛ لن يبدأ التشغيل تلقائيًا.</p>
          </AlertDescription>
        </Alert>
      )}
      {fileChoice && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              <h3>اختر ملف الفيديو</h3>
            </CardTitle>
            <CardDescription>المصدر لا يحدد ملفًا واحدًا؛ لن يُختار أكبر ملف تلقائيًا.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {fileChoice.files.map((file) => (
              <div key={file.index} className="flex min-w-0 flex-col gap-2">
                <p dir="auto" className="text-sm wrap-anywhere">
                  {file.path}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" dir="ltr">
                    {formatSourceSize(file.size)}
                  </Badge>
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
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">اختر الملف المطابق للفيديو المطلوب.</p>
          </CardFooter>
        </Card>
      )}
      {candidates.length > 0 && (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={searchId}>البحث في المصادر</FieldLabel>
            <Input
              id={searchId}
              type="search"
              dir="auto"
              autoComplete="off"
              maxLength={200}
              placeholder="اسم الإصدار، الجودة أو اللغة"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        </FieldGroup>
      )}
      {sources.isSuccess && candidates.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد مصادر من Torrentio لهذا الإصدار</EmptyTitle>
            <EmptyDescription>يمكنك إعادة البحث لاحقًا أو فتح فيديو محلي.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {!target && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لم يُحدد عمل للبحث عن مصادر</EmptyTitle>
            <EmptyDescription>اختر تشغيلًا من صفحة العمل، أو افتح ملف فيديو محليًا.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {candidates.length > 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          {term ? `${visible.length} من ${candidates.length} مصدر` : `${candidates.length} مصدر`}
        </p>
      )}
      {candidates.length > 0 && visible.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد مصادر تطابق البحث</EmptyTitle>
            <EmptyDescription>جرّب اسمًا آخر أو امسح البحث لعرض جميع المصادر.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {visible.map(({ candidate, display }) => {
        const opening = sourcePending && play.variables?.sourceId === candidate.id;
        return (
          <Card key={candidate.id} size="sm">
            <CardHeader>
              <CardTitle>
                <h3 dir="auto" className="line-clamp-3 wrap-anywhere">
                  {display.releaseTitle ?? "عنوان الإصدار غير مذكور"}
                </h3>
              </CardTitle>
              <CardDescription dir="auto" className="wrap-anywhere">
                {display.providerLabel || "Torrentio"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap gap-2" aria-label="الجودة المبلّغ عنها">
                <Badge variant="secondary" dir="auto">
                  {display.resolution ? `${display.resolution}p` : "جودة غير معروفة"}
                </Badge>
                {display.codec && (
                  <Badge variant="outline" dir="auto">
                    {display.codec}
                  </Badge>
                )}
                {display.hdr && (
                  <Badge variant="outline" dir="auto">
                    {display.hdr}
                  </Badge>
                )}
                {display.sizeBytes !== null && (
                  <Badge variant="outline" dir="ltr">
                    {formatSourceSize(display.sizeBytes)}
                  </Badge>
                )}
                {display.seeders !== null && (
                  <Badge variant="outline">{display.seeders} مشارك مبلّغ عنه</Badge>
                )}
              </div>
              <dl className="flex min-w-0 flex-col gap-2 text-sm">
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-muted-foreground">اسم الملف المبلّغ عنه</dt>
                  <dd
                    dir="auto"
                    className="line-clamp-2 wrap-anywhere"
                    title={display.filename ?? undefined}
                  >
                    {display.filename ?? "غير مذكور؛ يُحدد عند فتح المصدر"}
                  </dd>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <dt className="text-muted-foreground">اللغات المبلّغ عنها</dt>
                  <dd dir="auto" className="wrap-anywhere">
                    {display.reportedLanguages.length
                      ? display.reportedLanguages.map(sourceLanguageLabel).join(" · ")
                      : "غير معروفة"}
                  </dd>
                </div>
              </dl>
              <details className="min-w-0 text-sm">
                <summary className="cursor-pointer rounded-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  تفاصيل المصدر الأصلية
                </summary>
                <div className="mt-2 flex min-w-0 flex-col gap-2">
                  <p dir="auto" className="whitespace-pre-wrap wrap-anywhere">
                    {candidate.label}
                  </p>
                  <p dir="auto" className="whitespace-pre-wrap wrap-anywhere">
                    {candidate.release}
                  </p>
                </div>
              </details>
            </CardContent>
            <CardFooter>
              {candidate.available ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => play.mutate({ sourceId: candidate.id })}
                >
                  {opening ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <ActionIcon data-icon="inline-start" />
                  )}
                  {opening
                    ? "جارٍ فتح هذا المصدر…"
                    : downloading
                      ? "تنزيل هذا المصدر"
                      : "تشغيل هذا المصدر"}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">مصدر مباشر — تشغيله غير مدعوم حاليًا</p>
              )}
            </CardFooter>
          </Card>
        );
      })}
      {target && (
        <Button
          variant="ghost"
          disabled={sources.isFetching || busy}
          onClick={() => {
            play.reset();
            void sources.refetch();
          }}
        >
          <RefreshCw data-icon="inline-start" />
          إعادة البحث عن مصادر
        </Button>
      )}
    </div>
  );
}

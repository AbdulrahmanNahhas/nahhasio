import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Captions, Play, Search, Volume2 } from "lucide-react";
import { useId, useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { nativeCall } from "@/lib/bridge";

import { PlayerSnapshotSchema } from "./bridge";
import { runPlayerAction } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";

const Candidates = z.object({
  candidates: z
    .array(z.object({ id: z.string().max(64), name: z.string().max(1000), dubListed: z.boolean() }))
    .max(20),
});
const Streams = z.object({
  streams: z
    .array(
      z.object({
        id: z.string().max(64),
        resolution: z.number().int().min(0).max(4320),
        hasArabic: z.boolean(),
        subtitleCount: z.number().int().min(0).max(20),
      }),
    )
    .max(16),
});

export function AnimeSource({
  sessionId,
  target,
  query,
  onPlaybackStarted,
}: {
  sessionId: string;
  target: WatchTarget;
  query: string;
  onPlaybackStarted?: () => void;
}) {
  const id = useId();
  const client = useQueryClient();
  const [provider, setProvider] = useState("animehub");
  const [text, setText] = useState(query);
  const [candidate, setCandidate] = useState("");
  const [quality, setQuality] = useState("");
  const payload = {
    sessionId,
    target: {
      workId: target.workId,
      installmentId: target.installmentId ?? null,
      episodeId: target.episodeId ?? null,
    },
  };
  const search = useMutation({
    mutationKey: [
      "anime",
      "search",
      sessionId,
      target.workId,
      target.installmentId,
      target.episodeId,
    ],
    mutationFn: async () =>
      Candidates.parse(
        await nativeCall(
          "anime.search",
          { ...payload, provider, query: text.trim() },
          undefined,
          65000,
        ),
      ),
    retry: false,
    networkMode: "always",
  });
  const resolve = useMutation({
    mutationKey: ["anime", "resolve", sessionId],
    mutationFn: async (candidateId: string) =>
      Streams.parse(
        await nativeCall("anime.resolve", { ...payload, candidateId }, undefined, 65000),
      ),
    retry: false,
    networkMode: "always",
  });
  const play = useMutation({
    mutationKey: ["anime", "play", sessionId],
    scope: { id: "native-anime-play" },
    mutationFn: async (streamId: string) =>
      runPlayerAction(client, async () =>
        PlayerSnapshotSchema.parse(
          await nativeCall("anime.play", { ...payload, streamId }, undefined, 20000),
        ),
      ),
    onSuccess: () => onPlaybackStarted?.(),
    retry: false,
    networkMode: "always",
  });
  const busy = search.isPending || resolve.isPending || play.isPending;
  const streams = resolve.data?.streams.toSorted((a, b) => b.resolution - a.resolution) ?? [];
  const selected = streams.find((item) => item.id === quality) ?? streams[0];
  const error = search.error ?? resolve.error ?? play.error;
  function reset() {
    search.reset();
    resolve.reset();
    play.reset();
    setCandidate("");
    setQuality("");
  }
  function startSearch() {
    resolve.reset();
    play.reset();
    setCandidate("");
    setQuality("");
    search.mutate();
  }
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>
            <h3>الأنمي، بمشغّل نحّاسيو</h3>
          </CardTitle>
          <Badge variant="outline">
            <Volume2 data-icon="inline-start" />
            English DUB
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">مصدر الفيديو</span>
          <ToggleGroup
            aria-label="مصدر الأنمي"
            variant="outline"
            spacing={1}
            value={[provider]}
            disabled={busy}
            onValueChange={(values: string[]) => {
              if (values[0]) {
                setProvider(values[0]);
                reset();
              }
            }}
          >
            <ToggleGroupItem value="animehub">AnimeHub</ToggleGroupItem>
            <ToggleGroupItem value="anidbapp">AniDBApp</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && text.trim()) startSearch();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-query`}>اسم الأنمي</FieldLabel>
              <div className="flex gap-2">
                <InputGroup className="min-w-0 flex-1">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={`${id}-query`}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={160}
                    disabled={busy}
                    dir="auto"
                  />
                </InputGroup>
                <Button type="submit" variant="outline" disabled={busy || !text.trim()}>
                  {search.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Search data-icon="inline-start" />
                  )}
                  {search.isPending ? "جارٍ البحث…" : "بحث"}
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </form>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>تعذّر تجهيز الأنمي</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {search.data?.candidates.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>لم نجد نسخة مدبلجة</EmptyTitle>
              <EmptyDescription>جرّب الاسم الياباني أو المصدر الآخر.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {Boolean(search.data?.candidates.length) && (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>اختر الموسم أو الفيلم</span>
              <span>{search.data?.candidates.length} نتائج</span>
            </div>
            <RadioGroup
              aria-label="نسخة الأنمي"
              className="max-h-64 overflow-y-auto p-1"
              value={candidate}
              disabled={busy}
              onValueChange={(value) => {
                const item = search.data?.candidates.find((entry) => entry.id === value);
                if (item) {
                  setCandidate(item.id);
                  setQuality("");
                  play.reset();
                  resolve.reset();
                  resolve.mutate(item.id);
                }
              }}
            >
              {search.data?.candidates.map((item) => (
                <FieldLabel key={item.id} htmlFor={`${id}-${item.id}`}>
                  <Field orientation="horizontal">
                    <RadioGroupItem id={`${id}-${item.id}`} value={item.id} />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 break-words" dir="auto">
                        {item.name}
                      </span>
                      <Badge variant="secondary">{item.dubListed ? "DUB" : "فحص الدبلجة"}</Badge>
                    </div>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </div>
        )}
        {resolve.isPending && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            جارٍ جلب فيديو الدبلجة…
          </p>
        )}
        {streams.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">جودة الفيديو</span>
              <span className="text-xs text-muted-foreground">
                {selected?.hasArabic ? "ترجمة عربية متاحة" : "يمكنك إضافة ملف ترجمة"}
              </span>
            </div>
            <RadioGroup
              aria-label="جودة فيديو الأنمي"
              className="grid-cols-2 sm:grid-cols-3"
              value={selected?.id ?? ""}
              disabled={busy}
              onValueChange={(value) => {
                const item = streams.find((entry) => entry.id === value);
                if (item) setQuality(item.id);
              }}
            >
              {streams.map((stream) => (
                <FieldLabel key={stream.id} htmlFor={`${id}-${stream.id}`}>
                  <Field orientation="horizontal">
                    <RadioGroupItem id={`${id}-${stream.id}`} value={stream.id} />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="text-lg font-semibold tabular-nums" dir="ltr">
                        {stream.resolution ? `${stream.resolution}p` : "Auto"}
                      </span>
                      {stream.hasArabic && (
                        <Badge variant="outline">
                          <Captions data-icon="inline-start" />
                          عربي
                        </Badge>
                      )}
                    </div>
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-3 border-t sm:flex-row sm:justify-between">
        <div
          className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <Volume2 className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {selected
              ? `${provider === "animehub" ? "AnimeHub" : "AniDBApp"} · ${selected.resolution ? `${selected.resolution}p` : "Auto"} · English dub`
              : "اختر النسخة لتجهيز الفيديو"}
          </span>
        </div>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={busy || !selected}
          onClick={() => {
            if (selected) play.mutate(selected.id);
          }}
        >
          {play.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {play.isPending ? "جارٍ فتح الفيديو…" : "تشغيل في نحّاسيو"}
        </Button>
      </CardFooter>
    </Card>
  );
}

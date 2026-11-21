import { SkipForward } from "lucide-react";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";

import type { BrowserEpisodeIdentity, BrowserSource } from "./browser-providers";
import { ProviderMenu } from "./provider-browser";
import { offerKey } from "./stream-providers";

const standardEmbeds = new Set([
  "https://vidora.ac",
  "https://embed.vidrift.net",
  "https://vidsrc.sh",
  "https://vidnest.fun",
  "https://cinextream.cc",
  "https://vidlink.pro",
  "https://player.vidzee.wtf",
]);

const cinextreamFailure = z.object({
  event: z.literal("player_error"),
  reason: z.literal("all_servers_failed"),
});
const vidRiftState = z.object({
  type: z.literal("vidrift:state"),
  servers: z
    .array(z.object({ state: z.literal("failed") }))
    .min(1)
    .max(64),
});

const time = {
  currentTime: z.number().finite().nonnegative(),
  duration: z.number().finite().positive(),
};
const episode = {
  mediaType: z.literal("tv"),
  tmdbId: z.number().int().positive().nullable().optional(),
  season: z.number().int().positive(),
  episode: z.number().int().positive(),
};
const vidoraProgress = z.object({
  type: z.literal("PLAYER_EVENT"),
  data: z.object({
    ...episode,
    ...time,
    event: z.enum(["timeupdate", "ended", "play", "pause", "seeked"]),
  }),
});
const vidRiftEpisode = z.object({
  ...episode,
  anilist: z
    .object({
      id: z.number().int().positive(),
      mal: z.number().int().positive().nullable().optional(),
      episode: z.number().int().positive(),
    })
    .nullable()
    .optional(),
});
const vidRiftEvent = z.discriminatedUnion("type", [
  vidRiftEpisode.extend({ type: z.literal("vidrift:progress"), ...time }),
  vidRiftEpisode.extend({ type: z.literal("vidrift:episode") }),
]);

function EmbedFrame({
  url,
  name,
  onFailure,
  identity,
  onProgress,
  onMismatch,
}: {
  url: string;
  name: string;
  onFailure: () => void;
  identity: BrowserEpisodeIdentity | null;
  onProgress: (position: number, duration: number) => void;
  onMismatch: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const origin = new URL(url).origin;
  const vidRift = origin === "https://embed.vidrift.net";
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(onFailure, 15000);
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [onFailure]);
  useEffect(() => {
    function receive(event: MessageEvent<unknown>) {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin) return;
      const text = z.string().max(8192).safeParse(event.data);
      let payload = event.data;
      if (text.success) {
        try {
          payload = z.json().parse(JSON.parse(text.data));
        } catch {
          return;
        }
      }
      if (
        (origin === "https://cinextream.cc" && cinextreamFailure.safeParse(payload).success) ||
        (vidRift && vidRiftState.safeParse(payload).success)
      ) {
        onFailure();
        return;
      }
      if (!identity) return;
      if (vidRift) {
        const report = vidRiftEvent.safeParse(payload);
        if (!report.success) return;
        const data = report.data;
        const sameAnime =
          data.anilist &&
          (data.anilist.id === identity.anilist ||
            (data.anilist.mal === identity.mal && identity.mal !== null));
        const sameShow = identity.tmdb !== null && data.tmdbId === identity.tmdb;
        if (!sameAnime && !sameShow) return;
        const matchesEpisode =
          data.anilist && (identity.anilist !== null || identity.mal !== null)
            ? sameAnime && data.anilist.episode === identity.episode
            : data.season === identity.season && data.episode === identity.episode;
        if (!matchesEpisode) onMismatch();
        else if (data.type === "vidrift:progress") onProgress(data.currentTime, data.duration);
      } else if (origin === "https://vidora.ac") {
        const report = vidoraProgress.safeParse(payload);
        if (!report.success || identity.tmdb === null || report.data.data.tmdbId !== identity.tmdb)
          return;
        const data = report.data.data;
        if (data.season !== identity.season || data.episode !== identity.episode) onMismatch();
        else if (data.event === "timeupdate" || data.event === "ended")
          onProgress(data.currentTime, data.duration);
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [identity, onFailure, onMismatch, onProgress, origin, vidRift]);

  return (
    <>
      <iframe
        ref={frame}
        className="absolute inset-0 block size-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
        src={url}
        title={name}
        sandbox={standardEmbeds.has(origin) ? undefined : "allow-scripts"}
        referrerPolicy={vidRift ? "strict-origin-when-cross-origin" : "no-referrer"}
        allow="autoplay; fullscreen; picture-in-picture; camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'"
        onLoad={() => {
          if (timer.current !== null) clearTimeout(timer.current);
          setLoaded(true);
          if (vidRift) {
            frame.current?.contentWindow?.postMessage({ type: "vidrift:get-state" }, origin);
            if (identity)
              frame.current?.contentWindow?.postMessage(
                { type: "vidrift:nextup-info", next: null },
                origin,
              );
          }
        }}
      />
      {!loaded && (
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center bg-background"
          role="status"
        >
          <span>
            جارٍ فتح <bdi>{name}</bdi>…
          </span>
        </div>
      )}
    </>
  );
}

type Selection = { index: number; attempt: number; automatic: boolean };

export function BrowserEmbeds({
  sources,
  children,
  navigation,
  videoRef,
  identity,
  anime,
  onProgress,
}: {
  sources: BrowserSource[];
  children: ReactNode;
  navigation: ReactNode;
  videoRef: RefObject<HTMLDivElement | null>;
  identity: BrowserEpisodeIdentity | null;
  anime: boolean;
  onProgress: (position: number, duration: number) => void;
}) {
  const first = sources.findIndex((source) => source.url);
  const [selection, setSelection] = useState<Selection>({
    index: first,
    attempt: 0,
    automatic: false,
  });
  const [mismatch, setMismatch] = useState(false);
  const markMismatch = useCallback(() => setMismatch(true), []);
  const current = sources[selection.index];
  const next = sources.findIndex((source, index) => index > selection.index && source.url);
  // Ignore errors from a frame that has already been replaced.
  const sourceKey = current ? offerKey(current.offer) : "";
  const advance = useCallback(() => {
    setMismatch(false);
    setSelection((previous) => {
      if (previous !== selection) return previous;
      return { index: next, attempt: previous.attempt + 1, automatic: true };
    });
  }, [next, selection]);
  return (
    <>
      <div
        ref={videoRef}
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-background sm:rounded-2xl"
        aria-label="منطقة الفيديو"
      >
        {mismatch ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            <p role="status">انتقل المشغّل إلى حلقة أخرى.</p>
            <Button
              variant="outline"
              onClick={() => {
                setMismatch(false);
                setSelection((previous) => ({ ...previous, attempt: previous.attempt + 1 }));
              }}
            >
              العودة إلى الحلقة المحددة
            </Button>
          </div>
        ) : current?.url ? (
          <EmbedFrame
            key={`${sourceKey}:${selection.attempt}`}
            url={current.url}
            name={current.offer.name}
            onFailure={advance}
            identity={identity}
            onProgress={onProgress}
            onMismatch={markMismatch}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
            <p role="status">
              {first < 0 ? "لا توجد مصادر متاحة لهذا الإصدار." : "تعذّر تشغيل المصادر المتاحة."}
            </p>
            {first >= 0 && (
              <Button
                variant="outline"
                onClick={() =>
                  setSelection({ index: first, attempt: selection.attempt + 1, automatic: false })
                }
              >
                إعادة المحاولة
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2" aria-label="أدوات المشاهدة">
        <div className="flex min-w-0 items-center gap-1.5">
          <ProviderMenu
            offers={sources.map(({ offer }) => offer)}
            selected={current?.offer}
            anime={anime}
            onSelect={(offer) => {
              setMismatch(false);
              setSelection({
                index: sources.findIndex((source) => offerKey(source.offer) === offerKey(offer)),
                attempt: selection.attempt + 1,
                automatic: false,
              });
            }}
          >
            {children}
          </ProviderMenu>
          {current && next >= 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="المصدر التالي"
              title={`المصدر التالي · ${sources[next]?.offer.name ?? ""}`}
              onClick={advance}
            >
              <SkipForward className="rtl:rotate-180" />
            </Button>
          )}
        </div>
        {navigation}
        {selection.automatic && current && (
          <span role="status" className="sr-only">
            تم الانتقال إلى <bdi>{current.offer.name}</bdi>
            {current.offer.audio === "sub" ? " · ترجمة" : ""}
          </span>
        )}
      </div>
    </>
  );
}

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { cn } from "cn";
import {
  AudioLines,
  Captions,
  Download,
  FolderOpen,
  ListVideo,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

import type { PlayerSnapshot } from "./bridge";
import { DownloadPanel } from "./download-control";
import { EpisodePanel, type PlayerEpisode } from "./episode-panel";
import { PlayerControl, PlayerPopover } from "./player-panels";
import { PlayerSettings } from "./player-settings";
import { PlayerSlider } from "./player-slider";
import { SourceControls } from "./source-selection";
import { TrackPanel } from "./track-panel";
import type { PlayerController } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";

export type { PlayerEpisode } from "./episode-panel";
export { trackLabel } from "./track-format";

type Panel = "source" | "audio" | "subtitle" | "settings" | "episodes" | "download";

type PlayerHostProps = {
  player: PlayerController;
  embedded?: boolean;
  hideEpisodes?: boolean;
  episodes?: readonly PlayerEpisode[];
  installmentTitle?: string;
  onSelectEpisode?: (episode: PlayerEpisode) => void;
  sourcePanel?: ReactNode;
  sourceTarget?: WatchTarget | null;
};

export function playerTime(seconds: number) {
  const value = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours ? `${hours}:` : ""}${hours ? String(minutes).padStart(2, "0") : minutes}:${String(value % 60).padStart(2, "0")}`;
}

/** No HTML video: the transparent interface sits over the native mpv surface. */
export function PlayerHost(props: PlayerHostProps) {
  const snapshot = props.player.snapshot;
  if (!snapshot?.active || !snapshot.sessionId) return null;
  return (
    <ActivePlayer
      key={`${snapshot.sessionId}:${Boolean(props.sourceTarget || props.sourcePanel)}`}
      {...props}
      snapshot={snapshot}
    />
  );
}

function ActivePlayer({
  player,
  embedded = false,
  hideEpisodes = false,
  snapshot: s,
  episodes,
  installmentTitle,
  onSelectEpisode,
  sourcePanel,
  sourceTarget,
}: PlayerHostProps & { snapshot: PlayerSnapshot }) {
  const hasSource = s.sourceKind !== null;
  const episodeIndex = episodes?.findIndex((episode) => episode.current) ?? -1;
  const nextEpisode = episodeIndex >= 0 ? episodes?.[episodeIndex + 1] : undefined;
  const [panel, setPanel] = useState<Panel | null>(
    !embedded && !hasSource && (sourcePanel || sourceTarget) ? "source" : null,
  );

  const [idle, setIdle] = useState(false);
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const footer = useRef<HTMLElement>(null);
  const sourceTrigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = s.sessionId!;
  const keepVisible =
    s.paused || s.ended || Boolean(s.error || player.error || panel) || focused || player.pending;
  const seekable = s.seekable && s.duration > 0;
  const seek = (seconds: number, relative: boolean) =>
    player.command({
      command: "player.seek",
      payload: {
        sessionId,
        seconds: relative ? seconds : Math.min(s.duration, Math.max(0, seconds)),
        relative,
      },
    });
  const pause = () => {
    if (!hasSource || (s.ended && !seekable)) return;
    if (s.ended) seek(0, false);
    player.command({
      command: "player.pause",
      payload: { sessionId, paused: s.ended ? false : !s.paused },
    });
  };
  const mute = () => {
    if (hasSource)
      player.command({ command: "player.mute", payload: { sessionId, muted: !s.muted } });
  };
  const fullscreen = () =>
    player.command({ command: "player.fullscreen", payload: { enabled: !s.fullscreen } });
  const close = () => player.command({ command: "player.close", payload: { sessionId } });
  function wake() {
    setIdle(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setIdle(true), 3000);
  }
  function changePanel(id: Panel, open: boolean) {
    setPanel((current) => (open ? id : current === id ? null : current));
    wake();
  }
  const closeSource = () => changePanel("source", false);
  const sources =
    sourcePanel ??
    (sourceTarget ? (
      <SourceControls target={sourceTarget} player={player} onPlaybackStarted={closeSource} />
    ) : undefined);

  useEffect(() => {
    // An initial source drawer owns focus; local video starts with keyboard transport ready.
    if (hasSource) root.current?.focus({ preventScroll: true });
    timer.current = setTimeout(() => setIdle(true), 3000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [hasSource]);
  // Consume Escape before a popup closes, so one key never also exits the player.
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (embedded && !s.fullscreen && !root.current?.contains(document.activeElement)) return;
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing
      )
        return;
      if (event.key === "Escape") {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-slot="slider"][data-drafting]')
        )
          return;
        event.preventDefault();
        if (panel) setPanel(null);
        else if (s.fullscreen) fullscreen();
        else close();
        return;
      }
      if (
        panel ||
        (event.target instanceof Element &&
          event.target.closest(
            "button,a,input,select,textarea,[contenteditable=true],[role=slider],[role=menu],[role=dialog],[role=combobox],[role=radio]",
          ))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "k") pause();
      else if ((key === "j" || key === "arrowleft") && seekable) seek(-10, true);
      else if ((key === "l" || key === "arrowright") && seekable) seek(10, true);
      else if (key === "m") mute();
      else if (key === "f") fullscreen();
      else return;
      event.preventDefault();
      wake();
    }
    window.addEventListener("keydown", keyboard, true);
    return () => window.removeEventListener("keydown", keyboard, true);
  });
  const hidden = idle && !keepVisible;
  return (
    <section
      ref={root}
      className={cn(
        embedded && !s.fullscreen ? "absolute inset-0" : "fixed inset-0",
        "player-host @container text-foreground bg-transparent outline-none font-sans [&[data-controls-hidden=true]]:cursor-none [&[data-controls-hidden=true]_.player-bottom]:opacity-0 [&[data-controls-hidden=true]_.player-bottom]:pointer-events-none",
      )}
      dir="rtl"
      tabIndex={-1}
      aria-label="مشغّل الفيديو"
      data-controls-hidden={hidden}
      onPointerMove={wake}
      onPointerDown={wake}
      onFocusCapture={(event) => {
        setFocused(
          event.target !== root.current &&
            event.target instanceof Element &&
            event.target.matches(":focus-visible"),
        );
        wake();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {!hasSource && !sources && (
        <div className="player-message absolute top-24 inset-x-6 max-w-128 mx-auto">
          <Alert>
            <AlertTitle>اختر مصدر الفيديو</AlertTitle>
            <AlertDescription>
              افتح ملفًا من جهازك لبدء التشغيل. لا تسجّل المعاينة مشاهدة.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {(s.error || player.error) && (
        <div className="player-message absolute top-24 inset-x-6 max-w-128 mx-auto">
          <Alert variant="destructive">
            <AlertTitle>تعذّر إكمال التشغيل</AlertTitle>
            <AlertDescription>{s.error ?? player.error?.message}</AlertDescription>
          </Alert>
        </div>
      )}
      {s.buffering && !s.error && panel !== "source" && (
        <div
          className="player-buffering absolute top-[45%] inset-x-0 flex flex-col items-center gap-3 text-[0.85rem] [&_svg]:w-8 [&_svg]:h-8"
          role="status"
        >
          <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span>جارٍ تحميل الفيديو…</span>
        </div>
      )}
      <footer
        ref={footer}
        className="player-bottom absolute inset-x-2 bottom-2 flex flex-col gap-1 transition-opacity duration-200 @xl:inset-x-3 @xl:bottom-3 motion-reduce:transition-none"
      >
        {s.ended && (
          <p className="player-ended self-center rounded-full bg-player-chrome px-4 py-2 text-sm">
            انتهى الفيديو
          </p>
        )}
        <div className="player-timeline px-1" dir="ltr">
          <PlayerSlider
            compact
            expandOnHover
            label="موضع التشغيل"
            value={s.position}
            max={Math.min(2592000, s.duration) || 1}
            disabled={!seekable}
            format={playerTime}
            commit={(seconds) => seek(seconds, false)}
          />
        </div>
        <div className="player-controls flex items-center justify-between gap-2" dir="ltr">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="player-transport flex shrink-0 items-center rounded-full bg-player-chrome p-0.5">
              <PlayerControl
                className="player-play"
                aria-label={s.ended ? "إعادة التشغيل" : s.paused ? "تشغيل" : "إيقاف مؤقت"}
                disabled={!hasSource || (s.ended && !seekable)}
                onClick={pause}
              >
                {s.paused || s.ended ? (
                  <Play data-icon="inline-start" />
                ) : (
                  <Pause data-icon="inline-start" />
                )}
              </PlayerControl>
              <PlayerControl
                aria-label="رجوع 10 ثوانٍ"
                title="رجوع 10 ثوانٍ"
                disabled={!seekable}
                onClick={() => seek(-10, true)}
              >
                <RotateCcw data-icon="inline-start" />
              </PlayerControl>
              <PlayerControl
                aria-label="تقديم 10 ثوانٍ"
                title="تقديم 10 ثوانٍ"
                disabled={!seekable}
                onClick={() => seek(10, true)}
              >
                <RotateCw data-icon="inline-start" />
              </PlayerControl>
              {nextEpisode && onSelectEpisode && (
                <PlayerControl
                  className="hidden @2xl:flex"
                  aria-label="الحلقة التالية"
                  title="الحلقة التالية"
                  disabled={nextEpisode.disabled}
                  onClick={() => onSelectEpisode(nextEpisode)}
                >
                  <SkipForward data-icon="inline-start" />
                </PlayerControl>
              )}
            </div>
            <div className="group/volume flex shrink-0 items-center rounded-full bg-player-chrome p-0.5">
              <PlayerControl
                aria-label={s.muted ? "إلغاء كتم الصوت" : "كتم الصوت"}
                title="مستوى الصوت"
                disabled={!hasSource}
                onClick={mute}
              >
                {s.muted ? (
                  <VolumeX data-icon="inline-start" />
                ) : (
                  <Volume2 data-icon="inline-start" />
                )}
              </PlayerControl>
              <div className="player-volume hidden w-0 overflow-hidden transition-[width] duration-150 @xl:block @xl:group-hover/volume:w-16 @xl:group-focus-within/volume:w-16 motion-reduce:transition-none">
                <div className="w-16 px-2">
                  <PlayerSlider
                    compact
                    label="مستوى الصوت"
                    value={s.volume}
                    max={100}
                    disabled={!hasSource}
                    commit={(volume) =>
                      player.command({ command: "player.volume", payload: { sessionId, volume } })
                    }
                  />
                </div>
              </div>
            </div>
            <span className="player-time shrink-0 rounded-full bg-player-chrome px-2.5 py-2 text-xs tabular-nums whitespace-nowrap">
              {playerTime(s.position)}
              <span className="hidden @2xl:inline">
                {" "}
                / {s.duration > 0 ? playerTime(s.duration) : "—"}
              </span>
            </span>
          </div>
          <nav
            className="player-tools flex shrink-0 items-center rounded-full bg-player-chrome p-0.5"
            aria-label="خيارات التشغيل"
          >
            {!hideEpisodes && (
              <div className="hidden @lg:flex">
                <PlayerPopover
                  boundary={root}
                  title="الحلقات"
                  icon={<ListVideo data-icon="inline-start" />}
                  open={panel === "episodes"}
                  onOpenChange={(open) => changePanel("episodes", open)}
                  anchor={footer}
                  wide
                  returnFocus={sourceTrigger}
                >
                  {episodes?.length ? (
                    <EpisodePanel
                      episodes={episodes}
                      installmentTitle={installmentTitle}
                      onSelectEpisode={(episode) => {
                        if (!episode.current) onSelectEpisode?.(episode);
                        setPanel(null);
                      }}
                    />
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>هذا الملف غير مرتبط بحلقات</EmptyTitle>
                        <EmptyDescription>
                          قائمة الحلقات تظهر عند تشغيل عمل مرتبط بالمكتبة.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </PlayerPopover>
              </div>
            )}
            {hasSource && (
              <div className="hidden @lg:flex">
                <PlayerPopover
                  boundary={root}
                  title="تنزيل الفيديو"
                  icon={<Download data-icon="inline-start" />}
                  open={panel === "download"}
                  onOpenChange={(open) => changePanel("download", open)}
                >
                  <DownloadPanel snapshot={s} />
                </PlayerPopover>
              </div>
            )}
            <DirectionProvider direction="ltr">
              <Drawer
                swipeDirection="right"
                open={panel === "source"}
                onOpenChange={(open) => changePanel("source", open)}
              >
                <DrawerContent
                  finalFocus={sourceTrigger}
                  className="player-source-drawer font-sans w-[calc(100vw_-_1rem)] max-w-2xl sm:max-w-2xl [--drawer-inset:--spacing(2)] [--drawer-bleed-background:transparent] rounded-3xl border border-border shadow-xl"
                  dir="ltr"
                >
                  <DirectionProvider direction="rtl">
                    <div dir="rtl" className="flex min-h-0 flex-1 flex-col">
                      <DrawerHeader>
                        <div className="flex items-center justify-between gap-3">
                          <DrawerTitle>مصدر الفيديو</DrawerTitle>
                          <DrawerClose render={<PlayerControl aria-label="إغلاق مصادر الفيديو" />}>
                            <X data-icon="inline-start" />
                          </DrawerClose>
                        </div>
                        <DrawerDescription>{s.title}</DrawerDescription>
                      </DrawerHeader>
                      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden px-5 py-4">
                        {sources ?? (
                          <p className="text-sm text-muted-foreground">
                            مصادر الشبكة غير متاحة في هذا الإصدار.
                          </p>
                        )}
                        {!sourceTarget && (
                          <Button
                            variant="outline"
                            disabled={player.pending}
                            onClick={() => {
                              void player
                                .commandAsync({ command: "player.pickVideo", payload: {} })
                                .then((next) => {
                                  if (next.sourceKind === "local") closeSource();
                                  return next;
                                })
                                .catch(() => {});
                            }}
                          >
                            <FolderOpen data-icon="inline-start" />
                            اختيار فيديو من جهازك
                          </Button>
                        )}
                      </div>
                    </div>
                  </DirectionProvider>
                </DrawerContent>
              </Drawer>
            </DirectionProvider>
            <div className="hidden @xl:flex">
              <PlayerPopover
                boundary={root}
                title="الصوت"
                icon={<AudioLines data-icon="inline-start" />}
                open={panel === "audio"}
                onOpenChange={(open) => changePanel("audio", open)}
              >
                <TrackPanel kind="audio" snapshot={s} player={player} />
              </PlayerPopover>
            </div>
            <PlayerPopover
              boundary={root}
              title="الترجمة"
              icon={<Captions data-icon="inline-start" />}
              open={panel === "subtitle"}
              onOpenChange={(open) => changePanel("subtitle", open)}
            >
              <TrackPanel kind="subtitle" snapshot={s} player={player} />
            </PlayerPopover>
            <PlayerPopover
              boundary={root}
              title="إعدادات التشغيل"
              triggerRef={sourceTrigger}
              icon={<Settings2 data-icon="inline-start" />}
              open={panel === "settings"}
              onOpenChange={(open) => changePanel("settings", open)}
            >
              <PlayerSettings
                snapshot={s}
                player={player}
                onSource={() => changePanel("source", true)}
                onEpisodes={!hideEpisodes ? () => changePanel("episodes", true) : undefined}
              />
            </PlayerPopover>
            <PlayerControl
              aria-label={s.fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
              title={s.fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
              onClick={fullscreen}
            >
              {s.fullscreen ? (
                <Minimize data-icon="inline-start" />
              ) : (
                <Maximize data-icon="inline-start" />
              )}
            </PlayerControl>
          </nav>
        </div>
      </footer>
    </section>
  );
}

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { cn } from "cn";
import {
  AudioLines,
  Captions,
  Cast,
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
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { PlayerSnapshot } from "./bridge";
import { DownloadControl } from "./download-control";
import { EpisodePanel, type PlayerEpisode } from "./episode-panel";
import { PlayerControl, PlayerPopover } from "./player-panels";
import { PlayerSlider } from "./player-slider";
import { SourceControls } from "./source-selection";
import { PlayerSetting, TrackPanel } from "./track-panel";
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
const speeds = [0.5, 1, 1.25, 1.5, 1.75, 2, 4];

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
        embedded && !s.fullscreen ? "relative size-full" : "fixed inset-0",
        "player-host text-foreground bg-transparent outline-none font-sans [&[data-controls-hidden=true]]:cursor-none [&[data-controls-hidden=true]_.player-bottom]:opacity-0 [&[data-controls-hidden=true]_.player-bottom]:pointer-events-none",
      )}
      dir="rtl"
      tabIndex={-1}
      aria-label="مشغّل الفيديو"
      data-controls-hidden={hidden}
      onPointerMove={wake}
      onPointerDown={wake}
      onFocusCapture={(event) => {
        setFocused(event.target !== root.current);
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
        className="player-bottom absolute inset-x-0 px-7 transition-opacity duration-180 bottom-0 pt-0 pb-4 [background:linear-gradient(to_top,_var(--rail),_transparent)] max-[800px]:px-4 motion-reduce:animate-none motion-reduce:transition-none"
      >
        {s.ended && <p className="player-ended mb-2 text-[0.85rem]">انتهى الفيديو</p>}
        <div className="player-timeline mb-0 py-2" dir="ltr">
          <PlayerSlider
            label="موضع التشغيل"
            value={s.position}
            max={Math.min(2592000, s.duration) || 1}
            disabled={!seekable}
            format={playerTime}
            commit={(seconds) => seek(seconds, false)}
          />
        </div>
        <div className="player-controls flex items-center gap-[0.35rem] flex-row-reverse flex-wrap justify-between gap-x-6 gap-y-2 max-[1000px]:gap-x-2 max-[800px]:justify-center">
          <div
            className="player-transport flex items-center gap-[0.35rem] flex-wrap max-[480px]:gap-[0.1rem]"
            dir="ltr"
          >
            <PlayerControl
              className="player-play w-12 h-12 [&_>_svg]:w-7 [&_>_svg]:h-7"
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
              <span
                className="player-seek-number absolute bottom-[0.45rem] start-1/2 [transform:translateX(-50%)] px-[0.1rem] font-sans text-[0.5rem] leading-none bg-primary-foreground pointer-events-none"
                aria-hidden="true"
              >
                10
              </span>
            </PlayerControl>
            <PlayerControl
              aria-label="تقديم 10 ثوانٍ"
              title="تقديم 10 ثوانٍ"
              disabled={!seekable}
              onClick={() => seek(10, true)}
            >
              <RotateCw data-icon="inline-start" />
              <span
                className="player-seek-number absolute bottom-[0.45rem] start-1/2 [transform:translateX(-50%)] px-[0.1rem] font-sans text-[0.5rem] leading-none bg-primary-foreground pointer-events-none"
                aria-hidden="true"
              >
                10
              </span>
            </PlayerControl>
            <PlayerControl
              aria-label={s.muted ? "إلغاء كتم الصوت" : "كتم الصوت"}
              disabled={!hasSource}
              onClick={mute}
            >
              {s.muted ? (
                <VolumeX data-icon="inline-start" />
              ) : (
                <Volume2 data-icon="inline-start" />
              )}
            </PlayerControl>
            <div className="player-volume w-20 px-[0.35rem] max-[1000px]:w-14 max-[480px]:w-12">
              <PlayerSlider
                label="مستوى الصوت"
                value={s.volume}
                max={100}
                disabled={!hasSource}
                commit={(volume) =>
                  player.command({ command: "player.volume", payload: { sessionId, volume } })
                }
              />
            </div>
            <span className="player-time ms-2 text-[0.8rem] tabular-nums whitespace-nowrap max-[480px]:ms-1 max-[480px]:text-xs">
              {playerTime(s.position)} / {s.duration > 0 ? playerTime(s.duration) : "—"}
            </span>
          </div>
          <nav
            className="player-tools flex items-center gap-[0.35rem] flex-wrap max-[800px]:w-full max-[800px]:justify-center max-[480px]:gap-[0.1rem]"
            aria-label="خيارات التشغيل"
          >
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
            {!hideEpisodes && (
              <PlayerPopover
                title="الحلقات"
                icon={<ListVideo data-icon="inline-start" />}
                open={panel === "episodes"}
                onOpenChange={(open) => changePanel("episodes", open)}
                anchor={footer}
                wide
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
            )}
            <DirectionProvider direction="ltr">
              <Drawer
                swipeDirection="right"
                open={panel === "source"}
                onOpenChange={(open) => changePanel("source", open)}
              >
                <DrawerTrigger
                  render={
                    <PlayerControl
                      ref={sourceTrigger}
                      aria-label="مصدر الفيديو"
                      title="مصدر الفيديو"
                    />
                  }
                >
                  <FolderOpen data-icon="inline-start" />
                </DrawerTrigger>
                <DrawerContent
                  finalFocus={sourceTrigger}
                  className="player-source-drawer font-sans w-[calc(100vw_-_1rem)] max-w-2xl sm:max-w-2xl [--drawer-inset:--spacing(2)] [--drawer-bleed-background:transparent] rounded-none border shadow-xl"
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
                      <Separator />
                      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-6">
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
                        {sources ?? (
                          <p className="text-sm text-muted-foreground">
                            مصادر الشبكة غير متاحة في هذا الإصدار.
                          </p>
                        )}
                      </div>
                    </div>
                  </DirectionProvider>
                </DrawerContent>
              </Drawer>
            </DirectionProvider>
            <DownloadControl
              snapshot={s}
              open={panel === "download"}
              onOpenChange={(open) => changePanel("download", open)}
            />
            <PlayerPopover
              title="الصوت"
              icon={<AudioLines data-icon="inline-start" />}
              open={panel === "audio"}
              onOpenChange={(open) => changePanel("audio", open)}
            >
              <TrackPanel kind="audio" snapshot={s} player={player} />
            </PlayerPopover>
            <PlayerPopover
              title="الترجمة"
              icon={<Captions data-icon="inline-start" />}
              open={panel === "subtitle"}
              onOpenChange={(open) => changePanel("subtitle", open)}
            >
              <TrackPanel kind="subtitle" snapshot={s} player={player} />
            </PlayerPopover>
            <PlayerControl
              aria-label="البث إلى جهاز آخر غير متاح"
              title="البث إلى جهاز آخر غير متاح بعد"
              disabled
            >
              <Cast data-icon="inline-start" />
            </PlayerControl>
            <PlayerPopover
              title="إعدادات التشغيل"
              icon={<Settings2 data-icon="inline-start" />}
              open={panel === "settings"}
              onOpenChange={(open) => changePanel("settings", open)}
            >
              <div className="flex flex-col gap-5">
                <FieldGroup>
                  <PlayerSetting
                    label="سرعة التشغيل"
                    value={s.speed}
                    min={0.25}
                    max={4}
                    step={0.25}
                    disabled={!hasSource || player.pending}
                    commit={(speed) =>
                      player.command({ command: "player.speed", payload: { sessionId, speed } })
                    }
                  />
                </FieldGroup>
                <DirectionProvider direction="ltr">
                  <ToggleGroup
                    aria-label="سرعات التشغيل"
                    value={[String(s.speed)]}
                    disabled={!hasSource || player.pending}
                    onValueChange={(values: string[]) => {
                      const speed = speeds.find((value) => String(value) === values[0]);
                      if (speed !== undefined)
                        player.command({ command: "player.speed", payload: { sessionId, speed } });
                    }}
                    className="w-full flex-wrap"
                    dir="ltr"
                    spacing={1}
                  >
                    {speeds.map((speed) => (
                      <ToggleGroupItem
                        key={speed}
                        value={String(speed)}
                        aria-label={`السرعة ${speed}×`}
                      >
                        {speed}×
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </DirectionProvider>
                <Separator />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <dt className="text-muted-foreground">ترميز الفيديو</dt>
                  <dd className="wrap-anywhere">{s.videoCodec ?? "غير متاح"}</dd>
                  <dt className="text-muted-foreground">فك الترميز العتادي</dt>
                  <dd className="wrap-anywhere">{s.hwdec ?? "غير متاح"}</dd>
                </dl>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  البث إلى جهاز آخر والمشاهدة الجماعية والنافذة العائمة غير متاحة.
                </p>
              </div>
            </PlayerPopover>
          </nav>
        </div>
      </footer>
    </section>
  );
}

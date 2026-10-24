import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  AudioLines,
  Captions,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Gauge,
  ListVideo,
  Monitor,
  PictureInPicture2,
  SkipForward,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { PlayerSnapshot } from "./bridge";
import { DownloadPanel } from "./download-control";
import { trackLabel } from "./track-format";
import { PlayerSetting, TrackPanel } from "./track-panel";
import type { PlayerController } from "./use-player-snapshot";

type Screen = "home" | "speed" | "audio" | "subtitle" | "volume" | "download";
const speeds = [0.5, 1, 1.25, 1.5, 1.75, 2, 4];

function SettingRow({
  icon: Icon,
  label,
  value,
  onClick,
  buttonRef,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onClick?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  disabled?: boolean;
}) {
  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      className="w-full justify-start"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon data-icon="inline-start" />
      <span>{label}</span>
      <span className="ms-auto max-w-28 truncate text-xs text-muted-foreground">{value}</span>
      {!disabled && <ChevronLeft data-icon="inline-end" />}
    </Button>
  );
}

export function PlayerSettings({
  snapshot: s,
  player,
  onSource,
  onEpisodes,
}: {
  snapshot: PlayerSnapshot;
  player: PlayerController;
  onSource: () => void;
  onEpisodes?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("home");
  const buttons = useRef(new Map<Screen, HTMLButtonElement>());
  const back = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Screen>("speed");
  const disabled = !s.sourceKind || player.pending;
  const audio = s.tracks.find((track) => track.kind === "audio" && track.selected);
  const subtitle = s.tracks.find((track) => track.kind === "subtitle" && track.selected);
  const titles = {
    home: "",
    speed: "سرعة التشغيل",
    audio: "الصوت",
    subtitle: "الترجمة",
    volume: "مستوى الصوت",
    download: "تنزيل الفيديو",
  };
  function remember(id: Screen) {
    return (button: HTMLButtonElement | null) => {
      if (button) buttons.current.set(id, button);
      else buttons.current.delete(id);
    };
  }
  function navigate(next: Screen) {
    if (next !== "home") returnTo.current = next;
    setScreen(next);
    requestAnimationFrame(() => {
      if (next === "home") buttons.current.get(returnTo.current)?.focus();
      else back.current?.focus();
    });
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {screen === "home" ? (
        <>
          <SettingRow
            buttonRef={remember("speed")}
            icon={Gauge}
            label="سرعة التشغيل"
            value={`${s.speed}×`}
            onClick={() => navigate("speed")}
          />
          <SettingRow
            buttonRef={remember("audio")}
            icon={AudioLines}
            label="الصوت"
            value={audio ? trackLabel(audio) : "تلقائي"}
            onClick={() => navigate("audio")}
          />
          <SettingRow
            buttonRef={remember("subtitle")}
            icon={Captions}
            label="الترجمة"
            value={subtitle ? trackLabel(subtitle) : "متوقفة"}
            onClick={() => navigate("subtitle")}
          />
          <SettingRow
            buttonRef={remember("volume")}
            icon={Volume2}
            label="مستوى الصوت"
            value={s.muted ? "مكتوم" : `${Math.round(s.volume)}%`}
            onClick={() => navigate("volume")}
          />
          <Separator />
          <SettingRow icon={FolderOpen} label="مصدر الفيديو" onClick={onSource} />
          {onEpisodes && <SettingRow icon={ListVideo} label="الحلقات" onClick={onEpisodes} />}
          {s.sourceKind && (
            <SettingRow
              buttonRef={remember("download")}
              icon={Download}
              label="تنزيل الفيديو"
              onClick={() => navigate("download")}
            />
          )}
          <Separator />
          <SettingRow icon={Monitor} label="نسبة أبعاد الفيديو" value="لاحقًا" disabled />
          <SettingRow icon={SkipForward} label="تخطي المقدمة تلقائيًا" value="لاحقًا" disabled />
          <SettingRow icon={ListVideo} label="تشغيل الحلقة التالية تلقائيًا" value="لاحقًا" disabled />
          <SettingRow icon={PictureInPicture2} label="نافذة عائمة" value="لاحقًا" disabled />
        </>
      ) : (
        <>
          <Button
            ref={back}
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("home")}
          >
            <ChevronRight data-icon="inline-start" />
            {titles[screen]}
          </Button>
          <div className="px-2 pb-2">
            {(screen === "audio" || screen === "subtitle") && (
              <TrackPanel kind={screen} snapshot={s} player={player} />
            )}
            {screen === "download" && <DownloadPanel snapshot={s} />}
            {screen === "volume" && (
              <FieldGroup>
                <PlayerSetting
                  label="مستوى الصوت"
                  value={s.volume}
                  min={0}
                  max={100}
                  disabled={disabled}
                  commit={(volume) =>
                    player.command({
                      command: "player.volume",
                      payload: { sessionId: s.sessionId!, volume },
                    })
                  }
                />
              </FieldGroup>
            )}
            {screen === "speed" && (
              <div className="flex flex-col gap-4">
                <DirectionProvider direction="ltr">
                  <ToggleGroup
                    aria-label="سرعات التشغيل"
                    spacing={1}
                    value={[String(s.speed)]}
                    disabled={disabled}
                    className="grid grid-cols-3"
                    dir="ltr"
                    onValueChange={(values: string[]) => {
                      const speed = speeds.find((value) => String(value) === values[0]);
                      if (speed !== undefined)
                        player.command({
                          command: "player.speed",
                          payload: { sessionId: s.sessionId!, speed },
                        });
                    }}
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
                <FieldGroup>
                  <PlayerSetting
                    label="سرعة التشغيل"
                    value={s.speed}
                    min={0.25}
                    max={4}
                    step={0.25}
                    disabled={disabled}
                    commit={(speed) =>
                      player.command({
                        command: "player.speed",
                        payload: { sessionId: s.sessionId!, speed },
                      })
                    }
                  />
                </FieldGroup>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

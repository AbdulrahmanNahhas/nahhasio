import { Radio } from "@base-ui/react/radio";
import { Check, ChevronLeft, ChevronRight, Globe, SlidersHorizontal, Upload } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";

import type { PlayerSnapshot, PlayerTrack } from "./bridge";
import { PlayerSlider } from "./player-slider";
import { groupTracks, trackFlag, trackLabel, trackLanguage, trackSecondary } from "./track-format";
import type { PlayerController } from "./use-player-snapshot";

export { trackLabel } from "./track-format";

type TrackPanelProps = {
  kind: "audio" | "subtitle";
  snapshot: PlayerSnapshot;
  player: PlayerController;
};

/** Content only: the parent owns the titled Popover, width, placement and closing. */
export function TrackPanel(props: TrackPanelProps) {
  return <TrackPanelContent key={`${props.snapshot.sessionId}:${props.kind}`} {...props} />;
}

function TrackPanelContent({ kind, snapshot, player }: TrackPanelProps) {
  const searchId = useId();

  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const groupButtons = useRef(new Map<string, HTMLElement>());
  const trackButtons = useRef(new Map<number, HTMLElement>());
  const customizeButton = useRef<HTMLButtonElement>(null);
  const settingsBack = useRef<HTMLButtonElement>(null);
  const tracks = useMemo(
    () => snapshot.tracks.filter((track) => track.kind === kind),
    [snapshot.tracks, kind],
  );
  const groups = useMemo(() => groupTracks(tracks), [tracks]);
  const selected = tracks.find((track) => track.selected);
  const activeGroup = groups.find((group) => group.language === language);
  const grouped = groups.length > 1;
  const query = search.trim().toLocaleLowerCase();
  function matchesSearch(track: PlayerTrack) {
    return `${trackLabel(track)} ${track.language ?? ""}`.toLocaleLowerCase().includes(query);
  }
  const visibleTracks = (activeGroup?.tracks ?? tracks).filter(matchesSearch);
  const visibleGroups = groups.filter((group) => group.tracks.some(matchesSearch));
  const overview = grouped && !activeGroup;
  const hasSource = snapshot.active && snapshot.sourceKind !== null;
  const sessionId = snapshot.sessionId;
  const disabled = !hasSource || !sessionId || player.pending;
  const title = kind === "audio" ? "مسار الصوت" : "مسار الترجمة";

  function select(trackId: number | null) {
    if (disabled || !sessionId || (trackId === null && kind !== "subtitle")) return;
    if (trackId !== null && !tracks.some((track) => track.id === trackId)) return;
    player.command({ command: "player.track", payload: { sessionId, kind, trackId } });
  }

  function backToLanguages() {
    const previous = activeGroup?.language;
    setLanguage(null);
    requestAnimationFrame(() => {
      if (previous) groupButtons.current.get(previous)?.focus();
    });
  }

  function showCustomization(open: boolean) {
    setCustomizing(open);
    requestAnimationFrame(() => (open ? settingsBack.current : customizeButton.current)?.focus());
  }

  const setDelay = (seconds: number) => {
    if (!disabled && sessionId)
      player.command({ command: "player.delay", payload: { sessionId, kind, seconds } });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2" dir="rtl">
      {customizing ? (
        <>
          <Button
            ref={settingsBack}
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => showCustomization(false)}
          >
            <ChevronRight data-icon="inline-start" />
            {kind === "audio" ? "العودة إلى مسارات الصوت" : "العودة إلى الترجمات"}
          </Button>
          <FieldGroup>
            <PlayerSetting
              label={kind === "audio" ? "تأخير الصوت (ثانية)" : "تأخير الترجمة (ثانية)"}
              value={kind === "audio" ? snapshot.audioDelay : snapshot.subtitleDelay}
              min={-600}
              max={600}
              step={0.1}
              disabled={disabled}
              commit={setDelay}
            />
            {kind === "subtitle" && (
              <>
                <PlayerSetting
                  label="حجم الترجمة"
                  value={snapshot.subtitleSize}
                  min={10}
                  max={120}
                  disabled={disabled}
                  commit={(size) => {
                    if (!disabled && sessionId)
                      player.command({
                        command: "player.subtitleStyle",
                        payload: { sessionId, size, position: snapshot.subtitlePosition },
                      });
                  }}
                />
                <PlayerSetting
                  label="موضع الترجمة"
                  value={snapshot.subtitlePosition}
                  max={100}
                  disabled={disabled}
                  commit={(position) => {
                    if (!disabled && sessionId)
                      player.command({
                        command: "player.subtitleStyle",
                        payload: { sessionId, size: snapshot.subtitleSize, position },
                      });
                  }}
                />
              </>
            )}
          </FieldGroup>
        </>
      ) : (
        <>
          {kind === "subtitle" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={disabled}
              onClick={() => {
                if (sessionId && !disabled)
                  player.command({ command: "player.pickSubtitle", payload: { sessionId } });
              }}
            >
              <Upload data-icon="inline-start" />
              إضافة ملف ترجمة
            </Button>
          )}
          {tracks.length > 1 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={searchId} className="sr-only">
                  {kind === "audio" ? "البحث في مسارات الصوت" : "البحث في الترجمات"}
                </FieldLabel>
                <Input
                  id={searchId}
                  type="search"
                  dir="auto"
                  value={search}
                  maxLength={200}
                  autoComplete="off"
                  placeholder="ابحث باللغة أو اسم المسار"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
            </FieldGroup>
          )}
          {activeGroup && grouped && (
            <div className="flex min-w-0 items-center justify-between gap-2">
              <Button size="sm" variant="ghost" onClick={backToLanguages}>
                <ChevronRight data-icon="inline-start" />
                اللغات
              </Button>
              <p className="min-w-0 text-sm font-medium wrap-anywhere" dir="auto">
                {activeGroup.language}
              </p>
            </div>
          )}
          {(kind === "subtitle" || (!overview && tracks.length > 0)) && (
            <RadioGroup
              value={selected?.id ?? null}
              onValueChange={select}
              disabled={disabled}
              aria-label={title}
              className="gap-1"
            >
              {kind === "subtitle" && <TrackOption value={null} primary="إيقاف الترجمة" />}
              {!overview && (
                <div className="flex min-w-0 flex-col gap-1 p-1">
                  {visibleTracks.map((track) => (
                    <TrackOption
                      key={track.id}
                      value={track.id}
                      primary={trackLanguage(track)}
                      secondary={trackSecondary(track)}
                      languageTag={track.language}
                      buttonRef={(button) => {
                        if (button) trackButtons.current.set(track.id, button);
                        else trackButtons.current.delete(track.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </RadioGroup>
          )}
          {overview && (
            <div className="flex min-w-0 flex-col gap-1 p-1" aria-label="لغات المسارات">
              {visibleGroups.map((group) => (
                <Button
                  key={group.language}
                  ref={(button) => {
                    if (button) groupButtons.current.set(group.language, button);
                    else groupButtons.current.delete(group.language);
                  }}
                  variant={group.tracks.some((track) => track.selected) ? "secondary" : "ghost"}
                  size="lg"
                  className="h-auto min-h-12 w-full justify-start gap-3"
                  disabled={disabled}
                  aria-label={`${group.language} · ${group.tracks.length} مسارات${group.tracks.some((track) => track.selected) ? " · تضم المسار الحالي" : ""}`}
                  onClick={() => {
                    if (group.tracks.length === 1) {
                      select(group.tracks[0].id);
                      return;
                    }
                    setLanguage(group.language);
                    const matches = group.tracks.filter(matchesSearch);
                    const first = matches.find((track) => track.selected) ?? matches[0];
                    requestAnimationFrame(() => {
                      if (first) trackButtons.current.get(first.id)?.focus();
                    });
                  }}
                >
                  <LanguageMark language={group.tracks[0].language} />
                  <span
                    className="flex min-w-0 flex-1 flex-col gap-1 text-start whitespace-normal wrap-anywhere"
                    dir="auto"
                  >
                    <span>{group.language}</span>
                    {group.tracks.length === 1 && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {trackSecondary(group.tracks[0])}
                      </span>
                    )}
                  </span>
                  {group.tracks.some((track) => track.selected) && (
                    <Check data-icon="inline-end" aria-hidden="true" />
                  )}
                  {group.tracks.length > 1 && (
                    <>
                      <Badge variant="secondary">{group.tracks.length}</Badge>
                      <ChevronLeft data-icon="inline-end" />
                    </>
                  )}
                </Button>
              ))}
            </div>
          )}
          {!tracks.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {kind === "audio" ? "لا توجد مسارات صوت" : "لا توجد ترجمة مرفقة"}
                </EmptyTitle>
                <EmptyDescription>
                  {!hasSource
                    ? "تظهر المسارات الفعلية بعد فتح الفيديو."
                    : kind === "subtitle"
                      ? "يمكنك إضافة ملف ترجمة من جهازك."
                      : "لم يوفّر المشغّل مسارًا صوتيًا لهذا الفيديو."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (overview ? visibleGroups.length === 0 : visibleTracks.length === 0) ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد مسارات تطابق البحث</EmptyTitle>
                <EmptyDescription>جرّب لغة أو اسمًا آخر.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          <Button
            ref={customizeButton}
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => showCustomization(true)}
          >
            <SlidersHorizontal data-icon="inline-start" />
            {kind === "audio" ? "ضبط توقيت الصوت" : "تخصيص الترجمة"}
          </Button>
        </>
      )}
    </div>
  );
}

function TrackOption({
  value,
  primary,
  secondary,
  buttonRef,
  languageTag,
}: {
  value: number | null;
  primary: string;
  secondary?: string;
  buttonRef?: (button: HTMLElement | null) => void;
  languageTag?: string | null;
}) {
  return (
    <Radio.Root
      value={value}
      render={<Button variant="ghost" size="lg" type="button" />}
      nativeButton
      ref={buttonRef}
      className="player-track-option flex h-auto min-h-12 w-full items-center gap-3 whitespace-normal text-start data-checked:bg-accent"
    >
      {value !== null && <LanguageMark language={languageTag} />}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium wrap-anywhere" dir="auto">
          {primary}
        </span>
        {secondary && (
          <span className="line-clamp-2 text-xs text-muted-foreground wrap-anywhere" dir="auto">
            {secondary}
          </span>
        )}
      </span>
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
        <Radio.Indicator>
          <Check className="size-4" />
        </Radio.Indicator>
      </span>
    </Radio.Root>
  );
}

function LanguageMark({ language }: { language?: string | null }) {
  const flag = trackFlag(language);
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-emoji text-lg"
      aria-hidden="true"
    >
      {flag ?? <Globe className="size-4" />}
    </span>
  );
}

export function PlayerSetting({
  label,
  value,
  min = 0,
  max,
  step = 1,
  disabled = false,
  commit,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  disabled?: boolean;
  commit: (value: number) => void;
}) {
  return (
    <Field data-disabled={disabled}>
      <FieldLabel>
        <span className="flex-1">{label}</span>
        <bdi className="tabular-nums">{value}</bdi>
      </FieldLabel>
      <PlayerSlider
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        commit={(next) => {
          if (!disabled) commit(next);
        }}
      />
    </Field>
  );
}

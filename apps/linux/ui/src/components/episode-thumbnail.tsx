import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "cn";
import { Clock, Play, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Artwork } from "./artwork";
import { useCardNavigation } from "./card-navigation";
import { ProgressIndicator, ProgressTrack } from "./ui/progress";

const tilts = [
  "motion-safe:group-hover/episode:-rotate-1 motion-safe:group-focus-within/episode:-rotate-1",
  "motion-safe:group-hover/episode:-rotate-0.5 motion-safe:group-focus-within/episode:-rotate-0.5",
  "motion-safe:group-hover/episode:rotate-0.5 motion-safe:group-focus-within/episode:rotate-0.5",
  "motion-safe:group-hover/episode:rotate-1 motion-safe:group-focus-within/episode:rotate-1",
] as const;

export function episodeTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}

export function episodeTiming(position: number, duration?: number | null) {
  if (position <= 0) return null;
  return duration && duration > 0
    ? `متبقٍ ${episodeTime(duration - position)}`
    : `متابعة من ${episodeTime(position)}`;
}

/** One image/play/progress composition for Home, Work and the episode catalog. */
export function EpisodeThumbnail({
  artworkId,
  label,
  onPlay,
  position = 0,
  duration,
  played = false,
  disabled = false,
  poster = false,
  topStart,
  topEnd,
  bottomStart,
  bottomEnd,
}: {
  artworkId?: string | null;
  label: string;
  onPlay: () => void;
  position?: number;
  duration?: number | null;
  played?: boolean;
  disabled?: boolean;
  poster?: boolean;
  topStart?: ReactNode;
  topEnd?: ReactNode;
  bottomStart?: ReactNode;
  bottomEnd?: ReactNode;
}) {
  const navigation = useCardNavigation();
  const [tilt, setTilt] = useState<string>(tilts[1]);
  const progress =
    duration && duration > 0 && position > 0
      ? Math.min(100, Math.max(0, (position / duration) * 100))
      : null;
  return (
    <div
      className={cn(
        "relative isolate aspect-video rounded-2xl border border-border bg-card group-focus-within/episode:ring-4 group-focus-within/episode:ring-offset-2 group-focus-within/episode:ring-offset-background motion-safe:transition motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none",
        played
          ? "group-focus-within/episode:ring-success group-hover/episode:border-success"
          : "group-focus-within/episode:ring-foreground group-hover/episode:border-foreground/60",
        !disabled &&
          "group-hover/episode:shadow-xl motion-safe:group-hover/episode:scale-104 motion-safe:group-focus-within/episode:scale-102 motion-safe:group-active/episode:scale-98",
        !disabled && tilt,
      )}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen")
          setTilt(tilts[Math.floor(Math.random() * tilts.length)]);
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        {poster && (
          <Artwork
            id={artworkId}
            alt=""
            className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-xl"
          />
        )}
        <Artwork
          id={artworkId}
          alt=""
          className={cn(
            "size-full motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none",
            played &&
              "opacity-50 group-hover/episode:opacity-100 group-focus-within/episode:opacity-100",
            poster ? "object-contain" : "object-cover",
          )}
        />
        <span className="absolute inset-0 bg-linear-to-t from-background/70 via-transparent to-transparent" />
      </div>
      <ButtonPrimitive
        {...navigation}
        data-episode-primary
        className="group/play absolute inset-0 grid size-full cursor-pointer place-items-center rounded-2xl border-0 bg-transparent p-0 outline-none disabled:cursor-default disabled:opacity-50"
        disabled={disabled}
        aria-label={label}
        onClick={onPlay}
      >
        <span className="grid size-11 place-items-center rounded-full border border-border bg-background/90 text-foreground opacity-0 shadow-sm group-hover/episode:opacity-100 group-focus-within/episode:opacity-100 pointer-coarse:opacity-100 motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none">
          {disabled ? (
            <Clock className="size-5" />
          ) : played ? (
            <RotateCcw className="size-5" />
          ) : (
            <Play className="size-5" />
          )}
        </span>
      </ButtonPrimitive>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <span>{topStart}</span>
        <span>{topEnd}</span>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
        <span>{bottomStart}</span>
        <span>{bottomEnd}</span>
      </div>
      {progress !== null && (
        <ProgressPrimitive.Root
          value={progress}
          aria-label={`تقدم ${label}`}
          className="pointer-events-none absolute inset-x-3 bottom-1"
        >
          <ProgressTrack className="h-1">
            <ProgressIndicator className="motion-reduce:transition-none" />
          </ProgressTrack>
        </ProgressPrimitive.Root>
      )}
    </div>
  );
}

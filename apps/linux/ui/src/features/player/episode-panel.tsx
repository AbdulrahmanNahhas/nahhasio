import type { Artwork as ArtworkData } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { Artwork } from "../../components/artwork";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { episodeNumberLabel } from "../work/format";

export type PlayerEpisode = {
  id: string;
  title: string;
  detail?: string;
  current?: boolean;
  number?: string;
  image?: ArtworkData | null;
  summary?: string | null;
  runtimeMinutes?: number | null;
  downloaded?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

function reveal(element: HTMLElement | undefined) {
  element?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "auto" });
}

/** Content only: PlayerHost owns the popup, its title and close/focus restoration. */
export function EpisodePanel({
  episodes,
  installmentTitle,
  onSelectEpisode,
}: {
  episodes: readonly PlayerEpisode[];
  installmentTitle?: string;
  onSelectEpisode?: (episode: PlayerEpisode) => void;
}) {
  const headingId = useId();
  const shelfId = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const currentId = episodes.find((episode) => episode.current)?.id;
  const [focusedId, setFocusedId] = useState<string | undefined>(currentId);
  const enabled = episodes.filter((episode) => !episode.disabled);
  const index = enabled.findIndex((episode) => episode.id === (focusedId ?? currentId));
  const previous = enabled[index - 1];
  const next = enabled[index + 1];

  function focusEpisode(episode: PlayerEpisode | undefined) {
    if (!episode) return;
    const button = buttons.current.get(episode.id);
    button?.focus({ preventScroll: true });
    reveal(button);
  }

  useEffect(() => {
    // Wait for the popup's initial focus, then enter at the actual current episode.
    const frame = requestAnimationFrame(() => {
      const button =
        (currentId && buttons.current.get(currentId)) ||
        [...buttons.current.values()].find((item) => !item.disabled);
      reveal(button);
      if (button && !button.disabled) button.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentId, buttons]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, episode: PlayerEpisode) {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      event.target !== event.currentTarget
    )
      return;
    const origin = enabled.findIndex((item) => item.id === episode.id);
    // Match the client's physical card navigation: left advances through an RTL shelf.
    const offset = event.key === "ArrowLeft" ? 1 : event.key === "ArrowRight" ? -1 : 0;
    if (!offset && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    event.stopPropagation();
    focusEpisode(
      enabled[
        event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : origin + offset
      ],
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-4" dir="rtl" aria-labelledby={headingId}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={headingId} className="min-w-0 text-lg font-semibold wrap-anywhere" dir="auto">
          {installmentTitle || "حلقات الإصدار"}
        </h3>
        <div className="flex items-center gap-2" aria-label="تصفّح الحلقات">
          <Button
            variant="outline"
            size="icon"
            disabled={!previous}
            aria-label="الحلقات السابقة"
            aria-controls={shelfId}
            onClick={() => focusEpisode(previous)}
          >
            <ChevronRight data-icon="inline-start" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={!next}
            aria-label="الحلقات التالية"
            aria-controls={shelfId}
            onClick={() => focusEpisode(next)}
          >
            <ChevronLeft data-icon="inline-start" />
          </Button>
        </div>
      </header>
      <ul
        id={shelfId}
        className="flex min-w-0 snap-x snap-proximity gap-4 scroll-fade-x overflow-x-auto overscroll-x-contain p-1 pb-3"
      >
        {episodes.map((episode) => (
          <EpisodeCard
            key={episode.id}
            episode={episode}
            onSelectEpisode={onSelectEpisode}
            buttonRef={(button) => {
              if (button) buttons.current.set(episode.id, button);
              else buttons.current.delete(episode.id);
            }}
            onFocus={() => setFocusedId(episode.id)}
            onKeyDown={(event) => navigate(event, episode)}
          />
        ))}
      </ul>
    </section>
  );
}

function EpisodeCard({
  episode,
  onSelectEpisode,
  buttonRef,
  onFocus,
  onKeyDown,
}: {
  episode: PlayerEpisode;
  onSelectEpisode?: (episode: PlayerEpisode) => void;
  buttonRef: (button: HTMLButtonElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const summaryId = useId();
  const titleId = useId();
  const detailId = useId();
  const number = episode.number ? episodeNumberLabel(episode.number) : undefined;
  const label = number ? `الحلقة ${number}` : episode.detail;
  const summary = episode.summary?.trim();
  return (
    <li className="flex w-64 max-w-full shrink-0 snap-start flex-col gap-3 sm:w-72">
      <article className="flex min-w-0 flex-col gap-3" aria-labelledby={titleId}>
        <Button
          variant="ghost"
          type="button"
          ref={buttonRef}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          disabled={episode.disabled || !onSelectEpisode}
          aria-current={episode.current ? "true" : undefined}
          aria-labelledby={titleId}
          aria-describedby={detailId}
          onClick={() => {
            if (!episode.disabled) onSelectEpisode?.(episode);
          }}
          className={cn(
            "group/episode relative block h-auto aspect-video w-full overflow-hidden rounded-xl border border-border bg-card p-0 text-start transition-[border-color,box-shadow] hover:border-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
            episode.current && "border-primary ring-2 ring-primary",
          )}
        >
          <Artwork
            id={episode.image?.id}
            alt=""
            priority={episode.current}
            className="block size-full object-cover"
          />
          {episode.current && (
            <span className="absolute start-3 bottom-3">
              <Badge>الحلقة الحالية</Badge>
            </span>
          )}
        </Button>
        <div
          id={detailId}
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          {label && <span>{label}</span>}
          {episode.runtimeMinutes != null && episode.runtimeMinutes > 0 && (
            <span>{episode.runtimeMinutes} د</span>
          )}
          {episode.downloaded && <Badge variant="secondary">محمّلة</Badge>}
          {episode.disabled && (
            <Badge variant="outline">{episode.disabledReason || "غير متاحة للمشاهدة"}</Badge>
          )}
        </div>
        <h4
          id={titleId}
          className="text-base leading-relaxed font-semibold wrap-anywhere"
          dir="auto"
        >
          {episode.title || label || "حلقة بلا عنوان"}
        </h4>
        {summary ? (
          <div className="flex flex-col items-start gap-2">
            <p
              id={summaryId}
              dir="auto"
              className={cn(
                "text-sm leading-relaxed whitespace-pre-line text-muted-foreground wrap-anywhere",
                !expanded && "line-clamp-2",
              )}
            >
              {summary}
            </p>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-controls={summaryId}
              aria-label={`${expanded ? "طي" : "قراءة"} ملخص ${label || episode.title}`}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "طي الملخص" : "قراءة الملخص"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">لا يوجد ملخص لهذه الحلقة</p>
        )}
      </article>
    </li>
  );
}

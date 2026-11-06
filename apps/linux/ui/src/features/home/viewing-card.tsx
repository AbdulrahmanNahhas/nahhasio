import type { HomeViewingItem } from "@nahhasio/api-contract";
import { Check } from "lucide-react";

import { useCardNavigation } from "../../components/card-navigation";
import { EpisodeThumbnail, episodeTime, episodeTiming } from "../../components/episode-thumbnail";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import type { WatchTarget } from "../player/watch-request";
import { requestWatch } from "../player/watch-request";
import { workLink } from "../shell/navigation";
import { episodeNumberLabel } from "../work/format";

export function homeDate(value: string) {
  return new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(value),
  );
}
function recentRelease(value: string | null) {
  if (!value) return null;
  const days = Math.floor(Date.now() / 86400000) - Math.floor(new Date(value).getTime() / 86400000);
  if (!Number.isFinite(days) || days < 0 || days >= 30) return null;
  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days === 2) return "قبل يومين";
  return `قبل ${days} ${days <= 10 ? "أيام" : "يومًا"}`;
}
export function ViewingCard({
  item,
  resume = false,
  poster = false,
}: {
  item: HomeViewingItem;
  resume?: boolean;
  poster?: boolean;
}) {
  const navigation = useCardNavigation();
  const title = item.work.titleAr || item.work.canonicalTitle;
  const episode = item.episodeNumber
    ? `الحلقة ${episodeNumberLabel(item.episodeNumber)}`
    : item.installmentTitle;
  const subtitle = item.episodeId ? `${title} — ${item.installmentTitle}` : title;
  const recency = resume ? null : recentRelease(item.releaseDate);
  const duration = item.durationSeconds;
  const watch = () => {
    const target: WatchTarget = { workId: item.work.id, title, installmentId: item.installmentId };
    if (item.episodeId) target.episodeId = item.episodeId;
    requestWatch(target);
  };
  const timing = !item.isPlayed ? episodeTiming(item.positionSeconds, duration) : null;
  return (
    <article
      data-episode-card
      className="group/episode relative flex min-w-0 flex-col gap-3 hover:z-10 focus-within:z-10"
    >
      <EpisodeThumbnail
        artworkId={item.artwork?.id}
        label={`${item.isPlayed ? "إعادة مشاهدة" : "مشاهدة"} ${title}، ${episode}`}
        onPlay={watch}
        position={item.positionSeconds}
        duration={duration}
        played={item.isPlayed}
        poster={poster}
        topStart={item.episodeId ? <Badge variant="secondary">{episode}</Badge> : null}
        topEnd={
          item.isPlayed ? (
            <Badge variant="secondary">
              <Check data-icon="inline-start" />
              مُشاهد
            </Badge>
          ) : null
        }
        bottomStart={timing ? <Badge variant="secondary">{timing}</Badge> : null}
        bottomEnd={
          duration && duration > 0 ? (
            <Badge variant="secondary">
              <bdi>{episodeTime(duration)}</bdi>
            </Badge>
          ) : null
        }
      />
      <div className="flex items-start gap-3 px-1">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="min-w-0" dir="auto">
            <Button
              {...navigation}
              variant="ghost"
              size="sm"
              className="h-auto max-w-full justify-start px-0 py-0 text-start whitespace-normal"
              onClick={watch}
            >
              {item.episodeTitle || episode}
            </Button>
          </h3>
          <a
            {...navigation}
            href={workLink(item.work.id, item.installmentId)}
            className="block truncate text-sm leading-5 text-muted-foreground outline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
            dir="auto"
          >
            {subtitle}
          </a>
          {recency && (
            <time
              dateTime={item.releaseDate ?? undefined}
              className="block text-xs text-muted-foreground tabular-nums"
            >
              {recency}
            </time>
          )}
        </div>
      </div>
    </article>
  );
}

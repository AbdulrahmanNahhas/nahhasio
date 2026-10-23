import type { HomeViewingItem } from "@nahhasio/api-contract";
import { Info, Play } from "lucide-react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requestWatch, type WatchTarget } from "@/features/player/watch-request";
import { workLink } from "@/features/shell/navigation";
import { episodeNumberLabel } from "@/features/work/format";

import { HomeSectionHeading } from "./home-section";
import { ScrollShelf } from "./scroll-shelf";

export type ContinueItem = { item: HomeViewingItem; resume: boolean };
export function continueItems(resume: HomeViewingItem[], next: HomeViewingItem[]): ContinueItem[] {
  const seen = new Set<string>();
  return [
    ...resume.map((item) => ({ item, resume: true })),
    ...next.map((item) => ({ item, resume: item.positionSeconds > 0 })),
  ]
    .filter(({ item }) => {
      if (seen.has(item.work.id)) return false;
      seen.add(item.work.id);
      return true;
    })
    .slice(0, 12);
}

export function ContinueWatching({ items }: { items: ContinueItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="تابع مشاهدتك">
      <HomeSectionHeading
        title="تابع مشاهدتك"
        description="استأنف من حيث توقفت، أو انتقل إلى الحلقة التالية."
      />
      <ScrollShelf
        items={items}
        layout="banner"
        render={({ item, resume }) => (
          <ContinueCard key={item.work.id} item={item} resume={resume} />
        )}
      />
    </section>
  );
}

function ContinueCard({ item, resume }: ContinueItem) {
  const navigation = useCardNavigation();
  const title = item.work.titleAr || item.work.canonicalTitle;
  const episode = item.episodeNumber
    ? `الحلقة ${episodeNumberLabel(item.episodeNumber)}`
    : item.installmentTitle;
  const duration = item.durationSeconds;
  const progress =
    duration && duration > 0 ? Math.min(100, (item.positionSeconds / duration) * 100) : null;
  const remaining =
    duration && duration > 0
      ? Math.max(0, Math.ceil((duration - item.positionSeconds) / 60))
      : null;
  return (
    <Card size="sm">
      <div className="relative aspect-video overflow-hidden">
        <Artwork id={item.artwork?.id} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute start-3 top-3">
          <Badge variant="secondary">{resume ? "استئناف" : "التالي لك"}</Badge>
        </div>
      </div>
      <CardHeader>
        <CardTitle>
          <a
            {...navigation}
            href={workLink(item.work.id, item.installmentId)}
            dir="auto"
            className="line-clamp-1 rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {title}
          </a>
        </CardTitle>
        <CardDescription>
          <span className="line-clamp-1" dir="auto">
            {item.episodeId ? `${item.installmentTitle} · ${episode}` : item.installmentTitle}
          </span>
          {item.episodeTitle && (
            <span className="line-clamp-1" dir="auto">
              {item.episodeTitle}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-12 flex-col justify-center gap-2">
        {resume ? (
          <>
            {progress !== null && <Progress value={progress} aria-label={`تقدم مشاهدة ${title}`} />}
            <p className="text-xs text-muted-foreground tabular-nums">
              {remaining !== null
                ? `متبقٍ ${remaining} دقيقة`
                : `${Math.floor(item.positionSeconds / 60)} دقيقة تمت مشاهدتها`}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {item.episodeId ? "حلقة صادرة لم تشاهدها بعد" : "الإصدار التالي في مشاهدتك"}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          {...navigation}
          className="flex-1"
          onClick={() => {
            const target: WatchTarget = {
              workId: item.work.id,
              title,
              installmentId: item.installmentId,
            };
            if (item.episodeId) target.episodeId = item.episodeId;
            requestWatch(target);
          }}
        >
          <Play data-icon="inline-start" />
          {resume ? "متابعة المشاهدة" : "شاهد التالي"}
        </Button>
        <a
          {...navigation}
          href={workLink(item.work.id, item.installmentId)}
          aria-label={`تفاصيل ${title}`}
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <Info />
        </a>
      </CardFooter>
    </Card>
  );
}

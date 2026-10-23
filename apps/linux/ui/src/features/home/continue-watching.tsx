import type { HomeViewingItem } from "@nahhasio/api-contract";
import { Clapperboard, Film, Play, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { NoResults } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [selected, setSelected] = useState("episodes");
  const episodes = items.filter(({ item }) => Boolean(item.episodeId));
  const movies = items.filter(({ item }) => !item.episodeId);
  const groups = [
    { value: "episodes", label: "الحلقات", icon: Clapperboard, items: episodes },
    { value: "movies", label: "الأفلام", icon: Film, items: movies },
  ];
  if (!items.length) return null;
  return (
    <section aria-label="تابع مشاهدتك">
      <Tabs
        value={selected}
        onValueChange={(value) => {
          if (value === "episodes" || value === "movies") setSelected(value);
        }}
      >
        <HomeSectionHeading
          title="تابع مشاهدتك"
          description={
            selected === "episodes"
              ? "استأنف حلقتك، أو ابدأ الحلقة التالية."
              : "استأنف فيلمك، أو شاهد الإصدار التالي."
          }
        >
          <TabsList aria-label="نوع المتابعة">
            {groups.map((group) => (
              <TabsTrigger key={group.value} value={group.value}>
                <group.icon data-icon="inline-start" />
                {group.label}
                <Badge variant="secondary">{group.items.length}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </HomeSectionHeading>
        {groups.map((group) => (
          <TabsContent key={group.value} value={group.value}>
            {group.items.length ? (
              <ScrollShelf
                items={group.items}
                layout="banner"
                render={({ item, resume }) => (
                  <ContinueCard key={item.work.id} item={item} resume={resume} />
                )}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 pb-4">
                <NoResults
                  title={
                    group.value === "episodes"
                      ? "لا توجد حلقات للمتابعة الآن"
                      : "لا توجد أفلام للمتابعة الآن"
                  }
                  description="ستظهر هنا مشاهدتك المحفوظة والإصدارات التالية المتاحة من أعمال بدأتَها."
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(group.value === "episodes" ? "movies" : "episodes")}
                >
                  {group.value === "episodes" ? "انتقل إلى الأفلام" : "انتقل إلى الحلقات"}
                </Button>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
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
  const detail = item.episodeId ? `${item.installmentTitle} · ${episode}` : item.installmentTitle;
  const watch = () => {
    const target: WatchTarget = { workId: item.work.id, title, installmentId: item.installmentId };
    if (item.episodeId) target.episodeId = item.episodeId;
    requestWatch(target);
  };
  const timing = resume
    ? remaining !== null
      ? `متبقٍ ${remaining} د`
      : `${Math.floor(item.positionSeconds / 60)} د تمت مشاهدتها`
    : null;
  return (
    <article className="flex min-w-0 flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl">
        <Button
          {...navigation}
          variant="ghost"
          className="group/continue relative aspect-video h-auto w-full overflow-hidden p-0"
          aria-label={`${resume ? "استأنف" : "شاهد التالي من"} ${title}، ${detail}${timing ? `، ${timing}` : ""}`}
          onClick={watch}
        >
          <Artwork
            id={item.artwork?.id ?? item.work.banner?.id ?? item.work.poster?.id}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/continue:scale-105 motion-reduce:transition-none"
          />
          <span className="absolute inset-0 bg-linear-to-t from-background/70 via-transparent to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground transition-transform duration-200 group-hover/continue:scale-110 motion-reduce:transition-none">
              <Play className="size-5" />
            </span>
          </span>
          {resume && (
            <span className="absolute start-3 top-3">
              <Badge variant="secondary">
                <RotateCcw data-icon="inline-start" />
                متابعة
              </Badge>
            </span>
          )}
          {timing && (
            <span className="absolute end-3 bottom-3">
              <Badge variant="secondary">{timing}</Badge>
            </span>
          )}
        </Button>
        {resume && progress !== null && (
          <Progress
            className="pointer-events-none absolute inset-x-0 bottom-0"
            value={progress}
            aria-label={`تقدم مشاهدة ${title}`}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1 px-1">
        <a
          {...navigation}
          href={workLink(item.work.id, item.installmentId)}
          dir="auto"
          className="truncate rounded-sm text-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {title}
        </a>
        <p
          className="truncate text-xs text-muted-foreground"
          dir="auto"
          title={item.episodeTitle ? `${detail} · ${item.episodeTitle}` : detail}
        >
          {detail}
        </p>
        {item.episodeTitle && (
          <p
            className="truncate text-xs text-muted-foreground"
            dir="auto"
            title={item.episodeTitle}
          >
            {item.episodeTitle}
          </p>
        )}
      </div>
    </article>
  );
}

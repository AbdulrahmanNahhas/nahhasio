import type { HomeViewingItem } from "@nahhasio/api-contract";
import { Clapperboard, Film, RotateCcw } from "lucide-react";
import { useState } from "react";

import { useCardNavigation } from "@/components/card-navigation";
import { EpisodeThumbnail, episodeTiming } from "@/components/episode-thumbnail";
import { NoResults } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const detail = item.episodeId
    ? `${item.installmentTitle} · ${episode}${item.episodeTitle ? ` · ${item.episodeTitle}` : ""}`
    : item.installmentTitle;
  const watch = () => {
    const target: WatchTarget = { workId: item.work.id, title, installmentId: item.installmentId };
    if (item.episodeId) target.episodeId = item.episodeId;
    requestWatch(target);
  };
  const timing = resume ? episodeTiming(item.positionSeconds, duration) : null;
  return (
    <article
      data-episode-card
      className="group/episode relative flex min-w-0 flex-col gap-3 hover:z-10 focus-within:z-10"
    >
      <EpisodeThumbnail
        artworkId={item.artwork?.id ?? item.work.banner?.id ?? item.work.poster?.id}
        label={`${resume ? "استأنف" : "شاهد التالي من"} ${title}، ${detail}${timing ? `، ${timing}` : ""}`}
        onPlay={watch}
        position={item.positionSeconds}
        duration={duration}
        topStart={<Badge variant="secondary">{episode}</Badge>}
        topEnd={
          resume ? (
            <Badge variant="secondary">
              <RotateCcw data-icon="inline-start" />
              متابعة
            </Badge>
          ) : (
            <Badge variant="secondary">التالي</Badge>
          )
        }
        bottomStart={timing ? <Badge variant="secondary">{timing}</Badge> : null}
      />
      <div className="flex min-w-0 flex-col gap-1 px-1">
        <a
          {...navigation}
          href={workLink(item.work.id, item.installmentId)}
          dir="auto"
          className="truncate rounded-sm text-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          {title}
        </a>
        <p className="truncate text-xs text-muted-foreground" dir="auto" title={detail}>
          {detail}
        </p>
      </div>
    </article>
  );
}

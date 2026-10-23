import { useQuery } from "@tanstack/react-query";

import { Failure } from "@/components/status";
import { Skeleton } from "@/components/ui/skeleton";
import { emptyFilters } from "@/features/catalog/filter-model";
import { gateway } from "@/lib/bridge";

import { continueItems, ContinueWatching } from "./continue-watching";
import { EpisodeSection } from "./episode-section";
import { FamilyActivitySection } from "./family-activity";
import { Hero } from "./hero";
import { HomeRecommendations } from "./home-recommendations";
import { DeferredHomeSection } from "./home-section";
import { PlanetShelves } from "./planet-shelves";
import { Shelf } from "./shelf";
import { UpcomingSection } from "./upcoming-section";

const releasedFilters = {
  ...emptyFilters(),
  facets: [{ key: "releaseStates", include: ["released"], exclude: [] }],
};
const releasedSearch = new URLSearchParams({
  view: "installments",
  sort: "year-desc",
  filters: JSON.stringify(releasedFilters),
});

export function HomePage() {
  const filters = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const feed = useQuery({
    queryKey: ["catalog", "home"],
    queryFn: ({ signal }) => gateway.home(signal),
    refetchOnMount: "always",
  });
  const continuing = continueItems(feed.data?.resume ?? [], feed.data?.nextUp ?? []);
  return (
    <div className="min-w-0">
      <Hero />
      <div className="mx-auto flex max-w-400 flex-col gap-12 px-4 pt-8 pb-16 sm:px-8 lg:gap-14 lg:px-10">
        {feed.error && <Failure error={feed.error} retry={() => void feed.refetch()} />}
        {feed.isPending && (
          <div className="grid gap-4 sm:grid-cols-3" role="status" aria-label="جارٍ تحميل مشاهدتك">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        )}
        <ContinueWatching items={continuing} />
        <EpisodeSection
          following={feed.data?.followingEpisodes ?? []}
          recent={feed.data?.recentEpisodes ?? []}
          continuing={continuing.map(({ item }) => item.work.id)}
        />
        <DeferredHomeSection>
          <Shelf
            title="صدر حديثًا"
            description="آخر المواسم والأفلام والإصدارات الصادرة، الأحدث أولًا."
            catalogQuery={{
              view: "installments",
              privacy: "public",
              sort: "year-desc",
              filters: JSON.stringify(releasedFilters),
            }}
            href={`#/browse?${releasedSearch}`}
            hideEmpty
          />
        </DeferredHomeSection>
        <UpcomingSection items={feed.data?.upcoming ?? []} />
        <DeferredHomeSection>
          <Shelf
            title="أضيف حديثًا"
            description="أحدث الأعمال التي انضمت إلى الكتالوج."
            catalogQuery={{
              view: "works",
              privacy: "public",
              sort: "added-desc",
              filters: JSON.stringify(emptyFilters()),
            }}
            href="#/browse?sort=added-desc"
            hideEmpty
          />
        </DeferredHomeSection>
        <HomeRecommendations value={feed.data?.recommendations} />
        <DeferredHomeSection>
          <PlanetShelves planets={filters.data?.planets ?? []} />
        </DeferredHomeSection>
        <FamilyActivitySection items={feed.data?.comments ?? []} />
        <DeferredHomeSection>
          <Shelf
            title="آخر تحديثات المكتبة"
            description="الأعمال التي حُدّثت بياناتها مؤخرًا."
            catalogQuery={{
              view: "works",
              privacy: "public",
              sort: "updated-desc",
              filters: JSON.stringify(emptyFilters()),
            }}
            href="#/browse?sort=updated-desc"
            hideEmpty
          />
        </DeferredHomeSection>
      </div>
    </div>
  );
}

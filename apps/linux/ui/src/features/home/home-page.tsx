import { useQuery } from "@tanstack/react-query";

import { Failure } from "@/components/status";
import { Skeleton } from "@/components/ui/skeleton";
import { emptyFilters } from "@/features/catalog/filter-model";
import { gateway } from "@/lib/bridge";

import { AwardShelf } from "./award-shelf";
import { continueItems, ContinueWatching } from "./continue-watching";
import { EpisodeSection } from "./episode-section";
import { Hero } from "./hero";
import { HomeCredits } from "./home-credits";
import { homeOptions } from "./home-data";
import { HomeRecommendations } from "./home-recommendations";
import { PlanetShelves } from "./planet-shelves";
import { Shelf } from "./shelf";
import { UpcomingSection } from "./upcoming-section";

const releasedFilters = {
  ...emptyFilters(),
  facets: [{ key: "releaseStates", include: ["released"], exclude: [] }],
};
const releasedSearch = new URLSearchParams({
  view: "installments",
  privacy: "public",
  sort: "latest-released-desc",
  filters: JSON.stringify(releasedFilters),
});

export function HomePage() {
  const filters = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const feed = useQuery(homeOptions());
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
        <Shelf
          title="صدر حديثًا"
          catalogQuery={{
            view: "installments",
            privacy: "public",
            sort: "latest-released-desc",
            filters: JSON.stringify(releasedFilters),
          }}
          href={`#/browse?${releasedSearch}`}
          hideEmpty
        />
        <EpisodeSection
          following={feed.data?.followingEpisodes ?? []}
          recent={feed.data?.recentEpisodes ?? []}
          continuing={continuing.map(({ item }) => item.work.id)}
        />
        <HomeRecommendations value={feed.data?.recommendations} />
        <UpcomingSection items={feed.data?.upcoming ?? []} />
        <PlanetShelves planets={filters.data?.planets ?? []} />
        <AwardShelf />
        <HomeCredits group="studios" />
        <HomeCredits group="contributors" />
      </div>
    </div>
  );
}

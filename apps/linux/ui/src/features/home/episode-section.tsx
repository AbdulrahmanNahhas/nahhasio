import type { HomeViewingItem } from "@nahhasio/api-contract";
import { useState } from "react";

import { useCardNavigation } from "@/components/card-navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { HomeSectionHeading } from "./home-section";
import { ScrollShelf } from "./scroll-shelf";
import { ViewingCard } from "./viewing-card";

export function EpisodeSection({
  following,
  recent,
  continuing,
}: {
  following: HomeViewingItem[];
  recent: HomeViewingItem[];
  continuing: string[];
}) {
  const navigation = useCardNavigation();
  const [selection, setSelection] = useState<"following" | "all" | null>(null);
  const relevant = following.filter((item) => !continuing.includes(item.work.id));
  const mode = relevant.length ? (selection ?? "following") : "all";
  const items = mode === "following" ? relevant : recent;
  if (!recent.length && !relevant.length) return null;
  return (
    <section aria-label="أحدث الحلقات">
      <HomeSectionHeading title="أحدث الحلقات" href="#/episodes">
        {relevant.length > 0 && (
          <ToggleGroup
            data-home-toggle
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="نطاق الحلقات"
            value={[mode]}
            onValueChange={(next) => {
              if (next[0] === "following" || next[0] === "all") setSelection(next[0]);
            }}
          >
            <ToggleGroupItem {...navigation} value="following">
              متابعتي
            </ToggleGroupItem>
            <ToggleGroupItem {...navigation} value="all">
              كل المكتبة
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </HomeSectionHeading>
      <ScrollShelf
        layout="banner"
        items={items}
        render={(item) => <ViewingCard key={item.episodeId ?? item.installmentId} item={item} />}
      />
    </section>
  );
}

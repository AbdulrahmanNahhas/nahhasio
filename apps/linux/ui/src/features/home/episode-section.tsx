import type { HomeViewingItem } from "@nahhasio/api-contract";
import { useState } from "react";

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
  const [selection, setSelection] = useState<"following" | "all" | null>(null);
  const relevant = following.filter((item) => !continuing.includes(item.work.id));
  const mode = relevant.length ? (selection ?? "following") : "all";
  const items = mode === "following" ? relevant : recent;
  if (!recent.length && !relevant.length) return null;
  return (
    <section aria-label="أحدث الحلقات">
      <HomeSectionHeading
        title={mode === "following" ? "الجديد من متابعتك" : "أحدث الحلقات"}
        description={
          mode === "following"
            ? "حلقات صادرة لم تشاهدها من أعمال بدأتَها أو أضفتها للمفضلة."
            : "آخر ما صدر من حلقات في المكتبة."
        }
        href="#/episodes"
        linkLabel="كل الحلقات"
      >
        {relevant.length > 0 && (
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="نطاق الحلقات"
            value={[mode]}
            onValueChange={(next) => {
              if (next[0] === "following" || next[0] === "all") setSelection(next[0]);
            }}
          >
            <ToggleGroupItem value="following">متابعتي</ToggleGroupItem>
            <ToggleGroupItem value="all">كل المكتبة</ToggleGroupItem>
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

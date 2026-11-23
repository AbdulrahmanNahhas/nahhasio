import { EntityCard } from "@/features/catalog/entity-card";
import {
  compareEntityWorkCount,
  useEntityDirectory,
} from "@/features/catalog/use-entity-directory";
import { entityLink } from "@/features/shell/navigation";

import { HomeSectionHeading } from "./home-section";
import { ScrollShelf } from "./scroll-shelf";

export function HomeCredits({ group }: { group: "studios" | "contributors" }) {
  const { entities } = useEntityDirectory(group);
  const studios = group === "studios";
  const cards = entities
    .toSorted(
      (a, b) =>
        Number(Boolean(b.artworkId)) - Number(Boolean(a.artworkId)) || compareEntityWorkCount(a, b),
    )
    .slice(0, 8);
  if (!cards.length) return null;
  return (
    <section aria-label={studios ? "الاستوديوهات" : "الصنّاع"}>
      <HomeSectionHeading
        title={studios ? "الاستوديوهات" : "الصنّاع"}
        href={studios ? "#/studios?role=all&shape=banner" : "#/people"}
      />
      <ScrollShelf
        layout={studios ? "logo" : "poster"}
        items={cards}
        render={(entity) => (
          <EntityCard
            key={entity.value}
            entity={entity}
            kind={studios ? "studio" : "person"}
            artworkLayout={studios ? "banner" : "portrait"}
            href={entityLink(group, entity.value)}
            compact
          />
        )}
      />
    </section>
  );
}

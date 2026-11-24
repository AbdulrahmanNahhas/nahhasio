import { taxonomy } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";
import {
  Atom,
  BookOpen,
  CircleHelp,
  Compass,
  Drama,
  Fingerprint,
  Ghost,
  Heart,
  Music,
  Sparkles,
  Swords,
  Tag,
  Timer,
  Trophy,
  WandSparkles,
} from "lucide-react";

import { WorkBrowseChips } from "./work-browse-chips";

const icons = new Map([
  ["action", Swords],
  ["adventure", Compass],
  ["comedy", Drama],
  ["crime", Fingerprint],
  ["drama", Drama],
  ["fantasy", WandSparkles],
  ["historical", BookOpen],
  ["horror", Ghost],
  ["music", Music],
  ["mystery", CircleHelp],
  ["romance", Heart],
  ["science-fiction", Atom],
  ["sports", Trophy],
  ["supernatural", Sparkles],
  ["thriller", Timer],
  ["war", Swords],
]);

const arabicNames = new Map<string, string>(
  taxonomy.genres.map(([slug, , label]) => [slug, label]),
);

export function WorkGenres({
  genres,
  hero = false,
}: {
  genres: WorkDetail["genres"];
  hero?: boolean;
}) {
  const options = genres.flatMap(({ slug, labelAr }) => {
    const recorded = labelAr.trim();
    const label = recorded && recorded !== slug ? recorded : (arabicNames.get(slug) ?? recorded);
    if (!label || !slug) return [];
    const Icon = icons.get(slug) ?? Tag;
    return [
      {
        value: slug,
        label,
        icon: (
          <Icon className="shrink-0 text-muted-foreground" data-icon="inline-start" aria-hidden />
        ),
      },
    ];
  });
  return <WorkBrowseChips facet="genres" options={options} label="الأنواع الفنية" hero={hero} />;
}

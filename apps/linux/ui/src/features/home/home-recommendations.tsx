import type { RecommendationPage } from "@nahhasio/api-contract";

import { MediaCard } from "@/components/media-card";

import { HomeSectionHeading } from "./home-section";
import { ScrollShelf } from "./scroll-shelf";

export function HomeRecommendations({ value }: { value?: RecommendationPage }) {
  if (!value?.items.length) return null;
  const personal = value.basis === "personal";
  return (
    <section aria-label="اقتراحات المكتبة">
      <HomeSectionHeading
        title={personal ? "قد يعجبك" : "مختارات المكتبة"}
        description={
          personal
            ? "أعمال لم تبدأها، تشترك في الأنواع أو الكواكب مع مفضلتك وتقييماتك الشخصية."
            : "أعمال صادرة لم تبدأها، مرتبة حسب تقييم المكتبة."
        }
      />
      <ScrollShelf
        items={value.items.slice(0, 12)}
        render={(work) => <MediaCard key={work.id} work={work} />}
      />
    </section>
  );
}

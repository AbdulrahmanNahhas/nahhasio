import type { UpcomingInstallment } from "@nahhasio/api-contract";
import { CalendarDays } from "lucide-react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { Badge } from "@/components/ui/badge";
import { workLink } from "@/features/shell/navigation";

import { HomeSectionHeading } from "./home-section";
import { ScrollShelf } from "./scroll-shelf";
import { homeDate } from "./viewing-card";

export function UpcomingSection({ items }: { items: UpcomingInstallment[] }) {
  if (!items.length) return null;
  const sorted = items.toSorted((a, b) =>
    (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"),
  );
  return (
    <section aria-label="قريبًا">
      <HomeSectionHeading
        title="قريبًا"
        description="المواسم والأفلام المعلنة، الأقرب موعدًا أولًا."
        href="#/releases?view=upcoming"
        linkLabel="التقويم"
      />
      <ScrollShelf
        layout="banner"
        items={sorted}
        render={(item) => <UpcomingCard key={item.id} item={item} />}
      />
    </section>
  );
}
function UpcomingCard({ item }: { item: UpcomingInstallment }) {
  const navigation = useCardNavigation();
  return (
    <a
      {...navigation}
      href={workLink(item.workId, item.id)}
      className="flex min-h-36 items-center gap-4 rounded-2xl border border-border bg-card p-4 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Artwork id={item.poster?.id} alt="" className="h-28 w-20 shrink-0 rounded-lg object-cover" />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <Badge variant="secondary">
          <CalendarDays data-icon="inline-start" />
          {item.releaseDate ? (
            <time dateTime={item.releaseDate}>{homeDate(item.releaseDate)}</time>
          ) : (
            "لم يُحدد الموعد"
          )}
        </Badge>
        <span className="line-clamp-2 font-semibold" dir="auto">
          {item.workTitleAr || item.workTitle}
        </span>
        <span className="line-clamp-1 text-sm text-muted-foreground" dir="auto">
          {item.title}
        </span>
      </span>
    </a>
  );
}

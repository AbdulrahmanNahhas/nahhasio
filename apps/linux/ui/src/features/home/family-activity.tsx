import type { FamilyActivity } from "@nahhasio/api-contract";
import { MessageCircle, Star } from "lucide-react";
import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccountAvatar } from "@/features/account/account-avatar";
import { workLink } from "@/features/shell/navigation";

import { HomeSectionHeading } from "./home-section";
import { ScrollShelf } from "./scroll-shelf";
import { homeDate } from "./viewing-card";

export function FamilyActivitySection({ items }: { items: FamilyActivity[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="من العائلة">
      <HomeSectionHeading title="من العائلة" description="آخر المراجعات والتعليقات المنشورة." />
      <ScrollShelf
        layout="banner"
        items={items.slice(0, 4)}
        render={(item) => <ActivityEntry key={`${item.kind}-${item.id}`} item={item} />}
      />
    </section>
  );
}
function ActivityEntry({ item }: { item: FamilyActivity }) {
  const navigation = useCardNavigation();
  const [shown, setShown] = useState(false);
  return (
    <article className="flex items-start gap-3 border-b border-border py-4">
      <a
        {...navigation}
        href={workLink(item.work.id)}
        aria-label={item.work.titleAr || item.work.canonicalTitle}
        className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Artwork id={item.work.poster?.id} alt="" className="h-24 w-16 rounded-lg object-cover" />
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <AccountAvatar
            name={item.authorName}
            avatarKey={item.avatarKey}
            className="size-6 shrink-0"
          />
          <span className="text-sm font-medium">{item.authorName}</span>
          <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
            {homeDate(item.createdAt)}
          </time>
        </div>
        <a
          {...navigation}
          className="truncate rounded-sm text-sm font-semibold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          href={workLink(item.work.id)}
        >
          {item.work.titleAr || item.work.canonicalTitle}
        </a>
        {item.containsSpoilers && !shown ? (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setShown(true)}>
            <MessageCircle data-icon="inline-start" />
            إظهار تعليق يحتوي على حرق
          </Button>
        ) : (
          <p
            className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
            dir="auto"
          >
            {item.body}
          </p>
        )}
        {item.rating !== null && (
          <Badge variant="outline">
            <Star data-icon="inline-start" />
            {item.rating}
          </Badge>
        )}
      </div>
    </article>
  );
}

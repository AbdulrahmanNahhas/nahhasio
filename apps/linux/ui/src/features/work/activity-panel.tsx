import type { WorkActivityItem } from "@nahhasio/api-contract";
import { useInfiniteQuery } from "@tanstack/react-query";
import { MessageCircle, Star } from "lucide-react";
import { useState } from "react";

import { AccountAvatar } from "@/features/account/account-avatar";

import { useCardNavigation } from "../../components/card-navigation";
import { Failure } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { gateway } from "../../lib/bridge";
import { Section } from "./field-list";
import { dateLabel } from "./format";

export function ActivityPanel({ id }: { id: string }) {
  const navigation = useCardNavigation();
  const feed = useInfiniteQuery({
    queryKey: ["work", id, "activity"],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => gateway.workActivity(id, pageParam, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  if (feed.isLoading) return <p role="status">جارٍ تحميل نقاش العائلة…</p>;
  if (feed.error) return <Failure error={feed.error} retry={() => void feed.refetch()} />;
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  if (!items.length) return null;
  return (
    <Section title="آراء العائلة ونقاشها">
      <div className="grid gap-5 xl:grid-cols-2">
        {items.map((item) => (
          <ActivityCard key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </div>
      {feed.hasNextPage && (
        <Button
          {...navigation}
          variant="outline"
          disabled={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          {feed.isFetchingNextPage ? "جارٍ التحميل…" : "عرض المزيد"}
        </Button>
      )}
    </Section>
  );
}
function ActivityCard({ item }: { item: WorkActivityItem }) {
  const [revealed, setRevealed] = useState(false);
  const navigation = useCardNavigation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <a href={`#/profiles/${item.author.id}`} aria-label={`ملف ${item.author.displayName}`}>
              <AccountAvatar name={item.author.displayName} avatarKey={item.author.avatarKey} />
            </a>
            <a href={`#/profiles/${item.author.id}`}>{item.author.displayName}</a>
            <Badge variant="outline">{item.kind === "review" ? "مراجعة" : "تعليق"}</Badge>
            {item.parentId && <Badge variant="secondary">ردّ</Badge>}
          </div>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time>
        </p>
      </CardHeader>
      <CardContent>
        {item.rating !== null && (
          <p className="mb-3 flex items-center gap-2">
            <Star className="size-4" aria-hidden="true" />
            {item.rating} / 5
          </p>
        )}
        {item.containsSpoilers && !revealed ? (
          <Button {...navigation} variant="outline" onClick={() => setRevealed(true)}>
            <MessageCircle data-icon="inline-start" />
            إظهار محتوى يحوي حرقًا للأحداث
          </Button>
        ) : (
          <p
            className="text-base leading-loose whitespace-pre-line wrap-anywhere md:text-lg"
            dir="auto"
          >
            {item.body}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

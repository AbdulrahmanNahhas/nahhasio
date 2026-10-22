import type { FamilyActivity } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Failure } from "../../components/status";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { gateway } from "../../lib/bridge";
import { AccountAvatar } from "../account/account-avatar";
import { emptyFilters } from "../catalog/filter-model";
import { workLink } from "../shell/navigation";
import { FittedRow } from "./fitted-row";
import { Hero } from "./hero";
import { PlanetShelves } from "./planet-shelves";
import { Shelf } from "./shelf";
import { ViewingCard, homeDate } from "./viewing-card";

function Comment({ item }: { item: FamilyActivity }) {
  const navigation = useCardNavigation();
  const [shown, setShown] = useState(false);
  return (
    <article className="flex gap-3 border-b border-border py-4 last:border-0">
      <AccountAvatar
        name={item.authorName}
        avatarKey={item.avatarKey}
        className="size-10 shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm">{item.authorName}</strong>
          <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
            {homeDate(item.createdAt)}
          </time>
        </div>
        <a
          {...navigation}
          className="block truncate text-sm font-medium text-primary hover:underline"
          href={workLink(item.work.id)}
        >
          {item.work.titleAr || item.work.canonicalTitle}
        </a>
        {item.containsSpoilers && !shown ? (
          <Button variant="outline" size="sm" onClick={() => setShown(true)}>
            إظهار تعليق يحتوي على حرق
          </Button>
        ) : (
          <p
            className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
            dir="auto"
          >
            {item.body}
          </p>
        )}
      </div>
    </article>
  );
}
function facetQuery(key: string, value: string) {
  return {
    view: "works" as const,
    privacy: "public" as const,
    sort: "updated-desc",
    filters: JSON.stringify({
      ...emptyFilters(),
      facets: [{ key, include: [value], exclude: [] }],
    }),
  };
}
export function HomePage() {
  const navigation = useCardNavigation();
  const filters = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const feed = useQuery({
    queryKey: ["catalog", "home"],
    queryFn: ({ signal }) => gateway.home(signal),
    refetchOnMount: "always",
  });
  const inProgress = facetQuery("watchStates", "in-progress");
  const favorites = facetQuery("favoriteStates", "favorite");
  const upcomingLink = `#/browse?view=installments&filters=${encodeURIComponent(JSON.stringify({ ...emptyFilters(), facets: [{ key: "releaseStatuses", include: ["announced"], exclude: [] }] }))}`;
  return (
    <div className="min-w-0">
      <Hero />
      <div className="mx-auto flex max-w-[1700px] flex-col gap-12 px-4 pt-8 pb-12 sm:px-8 lg:px-10">
        {feed.error && <Failure error={feed.error} retry={() => void feed.refetch()} />}
        {!!feed.data?.resume?.length && (
          <section aria-label="أكمل المشاهدة">
            <header className="mb-4">
              <h2 className="text-xl font-semibold">أكمل المشاهدة</h2>
              <p className="mt-1 text-sm text-muted-foreground">أعمال لديك فيها تقدم محفوظ</p>
            </header>
            <FittedRow
              layout="banner"
              items={feed.data.resume}
              render={(item) => (
                <ViewingCard
                  key={`${item.installmentId}-${item.episodeId ?? "movie"}`}
                  item={item}
                  resume
                />
              )}
            />
          </section>
        )}
        <Shelf
          title="قيد المشاهدة"
          description="تابع ما بدأت، وشاهد تقدمك في الحلقات والإصدارات المتاحة"
          catalogQuery={inProgress}
          href={`#/browse?filters=${encodeURIComponent(inProgress.filters)}`}
          showProgress
          layout="banner"
          hideEmpty
          className="mb-0"
        />
        <Shelf
          title="أضيف حديثًا"
          description="اكتشف الأعمال الجديدة في مكتبتك"
          catalogQuery={{
            view: "works",
            privacy: "public",
            sort: "added-desc",
            filters: JSON.stringify(emptyFilters()),
          }}
          href="#/browse?sort=added-desc"
          className="mb-0"
        />
        <section aria-label="أحدث الحلقات">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">أحدث الحلقات</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                الحلقات الصادرة، مرتبة حسب تاريخ الإصدار المسجّل
              </p>
            </div>
            <a
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              href="#/episodes"
            >
              عرض كل الحلقات
              <ArrowLeft className="size-4" />
            </a>
          </header>
          {feed.isLoading && (
            <div
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
              role="status"
              aria-label="جارٍ تحميل أحدث الحلقات"
            >
              <Skeleton className="aspect-video" />
              <Skeleton className="aspect-video" />
              <Skeleton className="aspect-video" />
            </div>
          )}
          <FittedRow
            layout="banner"
            items={feed.data?.recentEpisodes ?? []}
            render={(item) => <ViewingCard key={item.episodeId} item={item} />}
          />
          {feed.data && !feed.data.recentEpisodes?.length && (
            <p className="rounded-xl bg-muted/40 p-5 text-sm text-muted-foreground">
              لا توجد حلقات صادرة مسجّلة بعد.
            </p>
          )}
        </section>
        <PlanetShelves planets={filters.data?.planets ?? []} />
        <Shelf
          title="من مفضلتك"
          catalogQuery={favorites}
          href={`#/browse?filters=${encodeURIComponent(favorites.filters)}`}
          hideEmpty
          className="mb-0"
        />
        <Shelf
          title="آخر تحديثات المكتبة"
          catalogQuery={{
            view: "works",
            privacy: "public",
            sort: "updated-desc",
            filters: JSON.stringify(emptyFilters()),
          }}
          href="#/browse?sort=updated-desc"
          className="mb-0"
        />
        <div className="grid items-start gap-8 xl:grid-cols-2">
          <section
            className="rounded-2xl border border-border bg-card p-5 sm:p-6"
            aria-label="الإصدارات القادمة"
          >
            <header className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarDays className="size-5 text-muted-foreground" />
                قريبًا في المكتبة
              </h2>
              <a
                className="text-sm text-muted-foreground hover:text-foreground"
                href={upcomingLink}
              >
                عرض الكل
              </a>
            </header>
            <div className="grid gap-3 lg:grid-cols-2">
              {feed.data?.upcoming.slice(0, 6).map((unit) => (
                <a
                  {...navigation}
                  key={unit.id}
                  href={workLink(unit.workId, unit.id)}
                  className="flex min-w-0 items-center gap-3 rounded-xl p-2 outline-offset-4 transition-colors hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  <Artwork
                    id={unit.poster?.id}
                    alt=""
                    className="h-20 w-14 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="truncate text-sm font-semibold" dir="auto">
                      {unit.workTitleAr || unit.workTitle}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground" dir="auto">
                      {unit.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {unit.releaseDate ? homeDate(unit.releaseDate) : "لم يحدد موعد الإصدار"}
                    </p>
                  </div>
                </a>
              ))}
            </div>
            {feed.data?.upcoming.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">
                لا توجد إصدارات قادمة معلنة حاليًا.
              </p>
            )}
            {feed.isLoading && <Skeleton className="h-24" />}
          </section>
          <section
            className="rounded-2xl border border-border bg-card p-5 sm:p-6"
            aria-label="أحدث تعليقات العائلة"
          >
            <header className="mb-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <MessageCircle className="size-5 text-muted-foreground" />
                من العائلة
              </h2>
            </header>
            {feed.data?.comments.slice(0, 4).map((item) => (
              <Comment key={`${item.kind}-${item.id}`} item={item} />
            ))}
            {feed.data?.comments.length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">
                تعليقات العائلة ومراجعاتها ستظهر هنا.
              </p>
            )}
            {feed.isLoading && <Skeleton className="h-24" />}
          </section>
        </div>
      </div>
    </div>
  );
}

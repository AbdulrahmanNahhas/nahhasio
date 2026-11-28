import {
  ProfileSectionSchema,
  type ProfileSection,
  type ProfileOverview,
  type ProfileEntry,
} from "@nahhasio/api-contract";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { CalendarDays, LockKeyhole, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { Failure, NoResults } from "@/components/status";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-sdk/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gateway } from "@/lib/bridge";

import { homeDate } from "../home/viewing-card";
import { workLink } from "../shell/navigation";

const groups = [
  { key: "overview", label: "نظرة عامة", sections: [] },
  {
    key: "viewing",
    label: "المشاهدة",
    sections: ["watched", "watching", "favorites", "ratings", "follows", "saved"],
  },
  { key: "community", label: "الآراء والقوائم", sections: ["comments", "reviews", "collections"] },
  { key: "personal", label: "مكتبتي", sections: ["notes", "history", "saved-views", "downloads"] },
  {
    key: "social",
    label: "النشاط",
    sections: ["recommendations", "events", "reactions", "notifications"],
  },
  { key: "statistics", label: "الإحصاءات", sections: [] },
] satisfies { key: string; label: string; sections: ProfileSection[] }[];
const sharedSections: ProfileSection[] = ["collections", "reviews", "comments"];
const ownerHighlights = ["watching", "watched", "favorites"] satisfies ProfileSection[];
const accountSections = new Set<ProfileSection>(["preferences", "devices", "policies"]);
type ActivitySection = ProfileSection | "overview" | "statistics";

export function ProfileActivity({ id }: { id: string }) {
  const result = useQuery({
    queryKey: ["profile-activity", id, "overview"],
    queryFn: ({ signal }) => gateway.profileOverview(id, signal),
  });
  if (result.isPending) return <Skeleton className="h-64 w-full" />;
  if (result.error) return <Failure error={result.error} retry={() => void result.refetch()} />;
  return (
    <ProfileActivityContent key={`${id}-${result.data.owner}`} id={id} overview={result.data} />
  );
}
function ProfileActivityContent({ id, overview }: { id: string; overview: ProfileOverview }) {
  const [section, setSection] = useState<ActivitySection>("overview");
  const activityStats = overview.stats.filter(
    (stat) =>
      !accountSections.has(stat.key) && (overview.owner || sharedSections.includes(stat.key)),
  );
  const available = groups
    .map((group) => ({
      ...group,
      sections: group.sections.filter((key) => activityStats.some((stat) => stat.key === key)),
    }))
    .filter(
      (group) =>
        group.key === "overview" || group.key === "statistics" || group.sections.length > 0,
    );
  const active =
    available.find(
      (group) => group.key === section || group.sections.some((key) => key === section),
    ) ?? available[0];
  const highlights = (overview.owner ? ownerHighlights : sharedSections).flatMap((key) => {
    const stat = activityStats.find((entry) => entry.key === key);
    return stat ? [stat] : [];
  });
  const options = active.sections.map((key) => ({
    value: key,
    label: overview.stats.find((stat) => stat.key === key)?.label ?? key,
  }));
  return (
    <section className="flex min-w-0 flex-col gap-8" aria-label="نشاط الملف الشخصي">
      <dl className="grid grid-cols-3 gap-4">
        {highlights.map((stat) => (
          <div key={stat.key} className="flex flex-col gap-2">
            <dd className="text-3xl font-semibold tabular-nums">
              {stat.value.toLocaleString("ar-u-nu-latn")}
            </dd>
            <dt className="text-xs text-muted-foreground">
              {stat.key === "watched" ? "وحدات مشاهدة مكتملة" : stat.label}
            </dt>
          </div>
        ))}
      </dl>
      <Tabs
        value={active.key}
        onValueChange={(value) => {
          const group = available.find((item) => item.key === value);
          if (!group) return;
          if (group.key === "overview" || group.key === "statistics") setSection(group.key);
          else setSection(group.sections[0]);
        }}
        className="min-w-0 gap-6"
      >
        <div className="overflow-x-auto">
          <TabsList
            aria-label="أقسام الملف الشخصي"
            className="flex w-max min-w-full gap-1 border-b border-border"
          >
            {available.map((group) => (
              <TabsTab
                key={group.key}
                value={group.key}
                className="shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-selected:border-primary data-selected:text-foreground"
              >
                {group.label}
              </TabsTab>
            ))}
          </TabsList>
        </div>
        {available.map((group) => (
          <TabsPanel key={group.key} value={group.key} className="flex min-w-0 flex-col gap-5">
            {group.key !== active.key ? null : section === "overview" ? (
              <div className="flex flex-col gap-8">
                {highlights.map((stat) => (
                  <section
                    key={stat.key}
                    className="flex min-w-0 flex-col gap-3"
                    aria-labelledby={`profile-preview-${stat.key}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2
                        id={`profile-preview-${stat.key}`}
                        className="font-display text-xl font-semibold"
                      >
                        {stat.key === "watched" ? "آخر ما شاهدت" : stat.label}
                      </h2>
                      {stat.value > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setSection(stat.key)}>
                          عرض الكل
                          <span className="sr-only">: {stat.label}</span>
                        </Button>
                      )}
                    </div>
                    {stat.value > 0 ? (
                      <ProfileEntries id={id} section={stat.key} preview />
                    ) : (
                      <p className="text-sm text-muted-foreground">لا توجد سجلات في هذا القسم بعد.</p>
                    )}
                  </section>
                ))}
              </div>
            ) : section === "statistics" ? (
              <>
                <p className="text-sm leading-7 text-muted-foreground">
                  الأرقام مستخرجة من السجلات المحفوظة. المشاهدة المكتملة تُحسب لكل فيلم أو حلقة أو موسم
                  مسجّل؛ زيارات الصفحات لا تعني تشغيل الفيديو، والتقدم المسجّل يجمع مواضع التشغيل
                  الحالية ولا يقيس وقت المشاهدة أو الإعادات.
                </p>
                {overview.viewing && (
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[
                      { label: "أعمال مكتملة", value: overview.viewing.works },
                      { label: "حلقات مكتملة", value: overview.viewing.episodes },
                      { label: "أفلام وعروض خاصة مكتملة", value: overview.viewing.movies },
                      {
                        label: "دقائق من التقدم المسجّل",
                        value: Math.floor(overview.viewing.recordedSeconds / 60),
                      },
                    ].map((stat) => (
                      <div key={stat.label} className="flex flex-col gap-2">
                        <dd className="text-3xl font-semibold tabular-nums">
                          {stat.value.toLocaleString("ar-u-nu-latn")}
                        </dd>
                        <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                      </div>
                    ))}
                  </dl>
                )}
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activityStats.map((stat) => (
                    <div
                      key={stat.key}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
                    >
                      <dt className="text-sm text-muted-foreground">{stat.label}</dt>
                      <dd className="text-xl font-semibold tabular-nums">
                        {stat.value.toLocaleString("ar-u-nu-latn")}
                      </dd>
                    </div>
                  ))}
                </dl>
                {overview.owner && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    تقويم المشاهدة
                    <Badge variant="secondary">قريبًا</Badge>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Select
                    value={section}
                    items={options}
                    onValueChange={(value) => {
                      const parsed = ProfileSectionSchema.safeParse(value);
                      if (parsed.success) setSection(parsed.data);
                    }}
                  >
                    <SelectTrigger aria-label="عرض نشاط الملف">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {overview.owner && !["comments", "reviews", "collections"].includes(section) && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <LockKeyhole className="size-3" aria-hidden="true" />
                      تظهر لك وحدك
                    </span>
                  )}
                </div>
                {section === "saved" && (
                  <p className="text-sm text-muted-foreground">
                    هذه علامات الحفظ المسجلة في الخادم. الملفات المتاحة دون اتصال على جهازك موجودة في
                    التنزيلات.
                  </p>
                )}
                {section === "downloads" && (
                  <p className="text-sm text-muted-foreground">
                    سجلات التنزيل في حسابك؛ قد تختلف عن ملفات هذا الجهاز الحالية.
                  </p>
                )}
                {section === "watching" && (
                  <p className="text-sm text-muted-foreground">
                    نفس حالة المشاهدة في التصفّح: أعمال بدأت مشاهدتها ولم تُكمل كل وحداتها الصادرة.
                  </p>
                )}
                {section === "watched" && (
                  <p className="text-sm text-muted-foreground">
                    أحدث الأفلام والحلقات المكتملة. اكتمال عمل كامل يظهر منفصلًا في الإحصاءات.
                  </p>
                )}
                <ProfileEntries key={`${id}-${section}`} id={id} section={section} />
              </>
            )}
          </TabsPanel>
        ))}
      </Tabs>
    </section>
  );
}
function ProfileEntries({
  id,
  section,
  preview = false,
}: {
  id: string;
  section: ProfileSection;
  preview?: boolean;
}) {
  const result = useInfiniteQuery({
    queryKey: ["profile-activity", id, section],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => gateway.profileEntries(id, section, pageParam, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  if (result.isPending)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  if (result.error) return <Failure error={result.error} retry={() => void result.refetch()} />;
  const items = preview
    ? result.data.pages[0].items.slice(0, 2)
    : result.data.pages.flatMap((page) => page.items);
  if (items.length === 0)
    return (
      <NoResults
        title="لا يوجد نشاط هنا بعد"
        description="ستظهر هنا السجلات المحفوظة لهذا القسم عند إضافتها."
      />
    );
  return (
    <>
      {!preview && (
        <p className="text-xs text-muted-foreground">
          {result.data.pages[0].total.toLocaleString("ar-u-nu-latn")} سجل
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <ProfileEntryCard key={item.id} item={item} section={section} />
        ))}
      </div>
      {!preview && result.hasNextPage && (
        <Button
          variant="outline"
          className="self-center"
          disabled={result.isFetchingNextPage}
          onClick={() => void result.fetchNextPage()}
        >
          {result.isFetchingNextPage ? "جارٍ التحميل…" : "عرض المزيد"}
        </Button>
      )}
    </>
  );
}
const statusNames = new Map([
  ["published", "منشور"],
  ["pending", "قيد المراجعة"],
  ["hidden", "مخفي"],
  ["family", "مشتركة مع العائلة"],
  ["private", "خاصة"],
  ["unread", "غير مقروء"],
  ["read", "مقروء"],
  ["active", "نشط"],
  ["revoked", "ملغى"],
  ["default", "الافتراضي"],
  ["watched", "مكتمل"],
  ["watching", "قيد المشاهدة"],
]);
function ProfileEntryCard({ item, section }: { item: ProfileEntry; section: ProfileSection }) {
  const [revealed, setRevealed] = useState(false);
  const number = item.value;
  const metric =
    number === null
      ? null
      : section === "ratings" || section === "reviews"
        ? `${number} / 5`
        : section === "watching" || section === "watched"
          ? `${Math.floor(number / 60)} دقيقة من التقدم المسجّل`
          : section === "downloads"
            ? `${(number / 1024 / 1024).toFixed(1)} MiB`
            : section === "collections"
              ? `${number} عمل`
              : section === "history"
                ? `${number} زيارة`
                : null;
  return (
    <article className="flex min-w-0 items-start gap-4 rounded-xl border border-border p-4">
      {item.workId && (
        <a href={workLink(item.workId)} tabIndex={-1} aria-hidden="true" className="w-16 shrink-0">
          <Artwork
            id={item.artworkId}
            alt=""
            className="aspect-2/3 w-full rounded-sm object-cover"
          />
        </a>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="text-base font-medium break-words">
          {item.workId ? <a href={workLink(item.workId)}>{item.name}</a> : item.name}
        </h3>
        {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {metric && <Badge variant="secondary">{metric}</Badge>}
          {item.status && (
            <Badge variant="outline">{statusNames.get(item.status) ?? item.status}</Badge>
          )}
          {item.createdAt && (
            <time dateTime={item.createdAt} className="text-xs text-muted-foreground">
              {homeDate(item.createdAt)}
            </time>
          )}
        </div>
        {item.body &&
          (item.spoiler && !revealed ? (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setRevealed(true)}
            >
              <MessageCircle data-icon="inline-start" />
              إظهار محتوى يحوي حرقًا
            </Button>
          ) : (
            <p
              className="text-sm leading-7 whitespace-pre-wrap break-words text-muted-foreground"
              dir="auto"
            >
              {item.body}
            </p>
          ))}
      </div>
    </article>
  );
}

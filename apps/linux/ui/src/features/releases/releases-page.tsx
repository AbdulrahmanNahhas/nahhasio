import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Layers,
  List,
  Sparkles,
  Clapperboard,
} from "lucide-react";
import { useState } from "react";

import { Choice } from "../../components/choice";
import { Button, buttonVariants } from "../../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { gateway, type ReleasesQuery } from "../../lib/bridge";
import { replaceParams } from "../shell/navigation";
import { PublicPage, PublicPageHeader } from "../shell/public-page";
import { EpisodeCalendar } from "./episode-calendar";
import { ReleaseDisplay } from "./release-display";
import { ReleaseFeed } from "./release-feed";
import { months, seasons, numberParam } from "./release-model";

const views = [
  { value: "seasons", label: "المواسم", icon: Layers },
  { value: "calendar", label: "تقويم الحلقات", icon: CalendarDays },
  { value: "timeline", label: "الخط الزمني", icon: List },
  { value: "upcoming", label: "القادم", icon: Sparkles },
];
type ReleaseSetting =
  | "view"
  | "year"
  | "month"
  | "season"
  | "kind"
  | "timelineMonth"
  | "layout"
  | "size"
  | "seasonScope";
export function ReleasesPage({ params }: { params: URLSearchParams }) {
  const [now] = useState(() => new Date());
  const year = numberParam(params, "year", now.getUTCFullYear(), 9999);
  const month = numberParam(params, "month", now.getUTCMonth() + 1, 12);
  const season = numberParam(params, "season", Math.ceil(month / 3), 4);
  const wholeYear = params.get("seasonScope") === "year";
  const view = views.find((item) => item.value === params.get("view"))?.value ?? "seasons";
  const kind: ReleasesQuery["kind"] =
    params.get("kind") === "episodes"
      ? "episodes"
      : params.get("kind") === "installments"
        ? "installments"
        : "all";
  const layout =
    params.get("layout") === "banner"
      ? "banner"
      : params.get("layout") === "logo"
        ? "logo"
        : "poster";
  const size =
    params.get("size") === "large" ? "large" : params.get("size") === "small" ? "small" : "medium";
  const metadata = useQuery({
    queryKey: ["releases", "years"],
    queryFn: ({ signal }) => gateway.releases({ pageSize: 1 }, signal),
    staleTime: 60000,
  });
  const years = [
    ...new Set([year, now.getUTCFullYear(), ...(metadata.data?.years ?? [])]),
  ].toSorted((a, b) => b - a);
  const update = (key: ReleaseSetting, value: string) => {
    const next = new URLSearchParams(params);
    if ((key === "view" && value === "seasons") || (key === "timelineMonth" && value === "all"))
      next.delete(key);
    else next.set(key, value);
    replaceParams("/releases", next);
  };
  const moveMonth = (direction: -1 | 1) => {
    const nextMonth = month + direction;
    const next = new URLSearchParams(params);
    next.set("month", String(nextMonth < 1 ? 12 : nextMonth > 12 ? 1 : nextMonth));
    next.set("year", String(nextMonth < 1 ? year - 1 : nextMonth > 12 ? year + 1 : year));
    replaceParams("/releases", next);
  };
  const moveSeason = (direction: -1 | 1) => {
    const next = new URLSearchParams(params);
    if (wholeYear) next.set("year", String(year + direction));
    else {
      const period = season + direction;
      next.set("season", String(period < 1 ? 4 : period > 4 ? 1 : period));
      next.set("year", String(period < 1 ? year - 1 : period > 4 ? year + 1 : year));
    }
    replaceParams("/releases", next);
  };
  const seasonQuery: ReleasesQuery = { year, kind: "installments" };
  if (!wholeYear) seasonQuery.season = season;
  const timeline: ReleasesQuery = { year, kind };
  if (params.has("timelineMonth") && params.get("timelineMonth") !== "all")
    timeline.month = numberParam(params, "timelineMonth", month, 12);
  return (
    <PublicPage as="article" className="flex flex-col gap-6" aria-label="الإصدارات">
      <PublicPageHeader
        title="تقويم المكتبة"
        description="مواسم الإصدارات ومواعيد الحلقات"
        actions={
          <a className={buttonVariants({ variant: "outline", size: "sm" })} href="#/episodes">
            <Clapperboard data-icon="inline-start" />
            تصفّح الحلقات
          </a>
        }
      />
      <Tabs
        value={view}
        onValueChange={(value) => {
          if (views.some((item) => item.value === value)) update("view", String(value));
        }}
        className="gap-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <TabsList variant="line" className="h-auto flex-wrap" aria-label="طرق عرض الإصدارات">
            {views.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon data-icon="inline-start" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex flex-wrap items-center gap-3">
            {view !== "upcoming" && (
              <div className="flex items-center gap-1">
                {view !== "seasons" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="السنة السابقة"
                    disabled={year === 1}
                    onClick={() => update("year", String(year - 1))}
                  >
                    <ArrowRight />
                  </Button>
                )}
                <Choice
                  label="سنة الإصدار"
                  value={String(year)}
                  options={years.map((value) => ({ value: String(value), label: String(value) }))}
                  onChange={(value) => update("year", value)}
                />
                {view !== "seasons" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="السنة التالية"
                    disabled={year === 9999}
                    onClick={() => update("year", String(year + 1))}
                  >
                    <ArrowLeft />
                  </Button>
                )}
              </div>
            )}
            {view === "timeline" && (
              <Choice
                label="نوع الإصدار"
                value={kind ?? "all"}
                options={[
                  { value: "all", label: "الأجزاء والحلقات" },
                  { value: "installments", label: "الأجزاء فقط" },
                  { value: "episodes", label: "الحلقات فقط" },
                ]}
                onChange={(value) => update("kind", value)}
              />
            )}
          </div>
        </div>
        <TabsContent value="seasons" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-2xl font-semibold">
                {wholeYear ? "إصدارات" : seasons[season - 1]} {year}
              </h2>
              <p className="text-sm text-muted-foreground">
                {wholeYear
                  ? "الأفلام والمواسم التي تبدأ خلال السنة"
                  : `${months[(season - 1) * 3]} — ${months[season * 3 - 1]}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={wholeYear ? "السنة السابقة" : "الموسم السابق"}
                  disabled={year === 1 && (wholeYear || season === 1)}
                  onClick={() => moveSeason(-1)}
                >
                  <ArrowRight />
                </Button>
                {!wholeYear && (
                  <Choice
                    label="موسم السنة"
                    value={String(season)}
                    options={seasons.map((label, index) => ({ label, value: String(index + 1) }))}
                    onChange={(value) => update("season", value)}
                  />
                )}
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={wholeYear ? "السنة التالية" : "الموسم التالي"}
                  disabled={year === 9999 && (wholeYear || season === 4)}
                  onClick={() => moveSeason(1)}
                >
                  <ArrowLeft />
                </Button>
              </div>
              <Button
                variant={wholeYear ? "secondary" : "outline"}
                aria-pressed={wholeYear}
                onClick={() => update("seasonScope", wholeYear ? "season" : "year")}
              >
                <CalendarDays data-icon="inline-start" />
                السنة كاملة
              </Button>
              <ReleaseDisplay
                layout={layout}
                size={size}
                onLayout={(value) => update("layout", value)}
                onSize={(value) => update("size", value)}
              />
            </div>
          </div>
          <ReleaseFeed
            query={seasonQuery}
            cards
            layout={layout}
            size={size}
            grouped={false}
            empty={
              wholeYear
                ? "لا توجد إصدارات لها تاريخ بداية مسجّل في هذه السنة."
                : "لا توجد أفلام أو مواسم لها تاريخ بداية مسجّل في هذا الموسم."
            }
          />
        </TabsContent>
        <TabsContent value="calendar">
          <EpisodeCalendar
            key={`${year}-${month}`}
            year={year}
            month={month}
            onMonth={moveMonth}
            onSelectMonth={(value) => update("month", String(value))}
            onToday={() => {
              const next = new URLSearchParams(params);
              next.set("year", String(now.getUTCFullYear()));
              next.set("month", String(now.getUTCMonth() + 1));
              replaceParams("/releases", next);
            }}
          />
        </TabsContent>
        <TabsContent value="timeline" className="flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">على امتداد {year}</h2>
            </div>
            <div className="w-48">
              <Choice
                label="شهر الخط الزمني"
                value={params.get("timelineMonth") ?? "all"}
                options={[
                  { value: "all", label: "السنة كاملة" },
                  ...months.map((label, index) => ({ label, value: String(index + 1) })),
                ]}
                onChange={(value) => update("timelineMonth", value)}
              />
            </div>
          </header>
          <ReleaseFeed query={timeline} groupBy="month" />
        </TabsContent>
        <TabsContent value="upcoming">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
            <header className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold">في الأفق</h2>
              <p className="text-sm text-muted-foreground">الأفلام والمواسم القادمة، الأقرب أولًا</p>
            </header>
            <ReleaseFeed
              query={{ scope: "upcoming", kind: "installments" }}
              cards
              size="medium"
              groupBy="month"
              empty="لا توجد مواعيد قادمة مسجّلة."
            />
            <section className="flex flex-col gap-5 border-t border-border pt-6">
              <header className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">بانتظار الموعد</h2>
                <p className="text-sm text-muted-foreground">أفلام ومواسم معلنة دون تاريخ محدد</p>
              </header>
              <ReleaseFeed
                query={{ scope: "undated", kind: "installments" }}
                cards
                size="medium"
                grouped={false}
                empty="لا توجد إصدارات منتظرة دون موعد."
              />
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </PublicPage>
  );
}

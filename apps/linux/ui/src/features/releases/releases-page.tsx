import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clapperboard,
  Layers,
  List,
  Sparkles,
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
  { value: "calendar", label: "التقويم", icon: CalendarDays },
  { value: "timeline", label: "القائمة", icon: List },
  { value: "upcoming", label: "القادم", icon: Sparkles },
];
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
  const layout = params.get("layout") === "logo" ? "logo" : "poster";
  const size = params.get("size") === "medium" ? "medium" : "small";
  const metadata = useQuery({
    queryKey: ["releases", "years"],
    queryFn: ({ signal }) => gateway.releases({ pageSize: 1 }, signal),
    staleTime: 60000,
  });
  const years = [
    ...new Set([year, now.getUTCFullYear(), ...(metadata.data?.years ?? [])]),
  ].toSorted((a, b) => b - a);
  const change = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    replaceParams("/releases", next);
  };
  const update = (key: string, value: string) => {
    if (key === "month")
      change({ month: value, season: String(Math.ceil(Number(value) / 3)), day: null });
    else if (["year", "kind"].includes(key)) change({ [key]: value, day: null });
    else change({ [key]: value });
  };
  const moveMonth = (direction: -1 | 1) => {
    const period = month + direction;
    change({
      month: String(period < 1 ? 12 : period > 12 ? 1 : period),
      season: String(Math.ceil((period < 1 ? 12 : period > 12 ? 1 : period) / 3)),
      year: String(period < 1 ? year - 1 : period > 12 ? year + 1 : year),
      day: null,
    });
  };
  const moveSeason = (direction: -1 | 1) => {
    if (wholeYear) change({ year: String(year + direction), day: null });
    else {
      const period = season + direction;
      change({
        season: String(period < 1 ? 4 : period > 4 ? 1 : period),
        month: String(((period < 1 ? 4 : period > 4 ? 1 : period) - 1) * 3 + 1),
        year: String(period < 1 ? year - 1 : period > 4 ? year + 1 : year),
        day: null,
      });
    }
  };
  const seasonQuery: ReleasesQuery = { year, kind: "installments" };
  if (!wholeYear) seasonQuery.season = season;
  const timeline: ReleasesQuery = { year, kind };
  if (params.has("timelineMonth") && params.get("timelineMonth") !== "all")
    timeline.month = numberParam(params, "timelineMonth", month, 12);
  const display = (
    <ReleaseDisplay
      layout={layout}
      size={size}
      onLayout={(value) => update("layout", value)}
      onSize={(value) => update("size", value)}
    />
  );
  return (
    <PublicPage as="article" className="flex flex-col gap-6" aria-label="الإصدارات">
      <PublicPageHeader
        title="تقويم المكتبة"
        description="الأفلام، بدايات المواسم، ومواعيد الحلقات المسجّلة في مكتبتك."
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
          if (views.some((item) => item.value === value))
            change({ view: String(value), day: null });
        }}
        className="gap-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList className="w-full sm:w-fit" aria-label="طرق عرض الإصدارات">
            {views.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon data-icon="inline-start" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {view !== "upcoming" && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="السنة السابقة"
                disabled={year === 1}
                onClick={() => update("year", String(year - 1))}
              >
                <ArrowRight />
              </Button>
              <Choice
                label="سنة الإصدار"
                value={String(year)}
                options={years.map((value) => ({ value: String(value), label: String(value) }))}
                onChange={(value) => update("year", value)}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="السنة التالية"
                disabled={year === 9999}
                onClick={() => update("year", String(year + 1))}
              >
                <ArrowLeft />
              </Button>
            </div>
          )}
        </div>
        <TabsContent value="seasons" className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={wholeYear ? "فترة السنة السابقة" : "الموسم السابق"}
                  disabled={year === 1 && (wholeYear || season === 1)}
                  onClick={() => moveSeason(-1)}
                >
                  <ArrowRight />
                </Button>
                <div>
                  <h2 className="text-lg font-semibold">
                    {wholeYear ? "إصدارات" : seasons[season - 1]} {year}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {wholeYear
                      ? "كل الأفلام وبدايات المواسم خلال السنة"
                      : `${months[(season - 1) * 3]} — ${months[season * 3 - 1]}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={wholeYear ? "فترة السنة التالية" : "الموسم التالي"}
                  disabled={year === 9999 && (wholeYear || season === 4)}
                  onClick={() => moveSeason(1)}
                >
                  <ArrowLeft />
                </Button>
              </div>
              {display}
            </div>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
              role="group"
              aria-label="موسم السنة"
            >
              {seasons.map((label, index) => (
                <Button
                  key={label}
                  variant={!wholeYear && season === index + 1 ? "secondary" : "outline"}
                  aria-pressed={!wholeYear && season === index + 1}
                  onClick={() =>
                    change({
                      season: String(index + 1),
                      month: String(index * 3 + 1),
                      seasonScope: null,
                      day: null,
                    })
                  }
                >
                  {label}
                </Button>
              ))}
              <Button
                variant={wholeYear ? "secondary" : "outline"}
                aria-pressed={wholeYear}
                onClick={() => change({ seasonScope: wholeYear ? null : "year", day: null })}
              >
                <CalendarDays data-icon="inline-start" />
                السنة كاملة
              </Button>
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
                ? "لا توجد أفلام أو بدايات مواسم بتاريخ مسجّل في هذه السنة."
                : "لا توجد أفلام أو بدايات مواسم بتاريخ مسجّل في هذا الموسم. جرّب موسمًا آخر أو السنة كاملة."
            }
          />
        </TabsContent>
        <TabsContent value="calendar">
          <EpisodeCalendar
            key={`${year}-${month}-${kind}`}
            year={year}
            month={month}
            kind={kind}
            selectedDay={numberParam(params, "day", 0, 31) || null}
            onDay={(day) => change({ day: day === null ? null : String(day) })}
            onKind={(value) => change({ kind: value, day: null })}
            onMonth={moveMonth}
            onSelectMonth={(value) => update("month", String(value))}
            onToday={() =>
              change({
                year: String(now.getUTCFullYear()),
                month: String(now.getUTCMonth() + 1),
                season: String(Math.ceil((now.getUTCMonth() + 1) / 3)),
                day: String(now.getUTCDate()),
              })
            }
          />
        </TabsContent>
        <TabsContent value="timeline" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">مواعيد {year}</h2>
            <div className="flex flex-wrap gap-2">
              <Choice
                label="نوع الإصدار"
                value={kind ?? "all"}
                options={[
                  { value: "all", label: "كل المواعيد" },
                  { value: "installments", label: "الأفلام والمواسم" },
                  { value: "episodes", label: "الحلقات" },
                ]}
                onChange={(value) => update("kind", value)}
              />
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
          </div>
          <ReleaseFeed query={timeline} groupBy="month" />
        </TabsContent>
        <TabsContent value="upcoming" className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">القادم من اليوم</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                أفلام وبدايات مواسم من كل السنوات، مرتّبة حسب موعدها.
              </p>
            </div>
            <ReleaseFeed
              query={{ scope: "upcoming", kind: "installments" }}
              groupBy="month"
              empty="لا توجد أفلام أو مواسم بمواعيد قادمة مسجّلة."
            />
          </section>
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">بانتظار تحديد الموعد</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                إصدارات معلنة دون تاريخ مسجّل؛ لا توضع في يوم أو موسم تقديري.
              </p>
            </div>
            <ReleaseFeed
              query={{ scope: "undated", kind: "installments" }}
              grouped={false}
              empty="لا توجد إصدارات معلنة دون موعد."
            />
          </section>
        </TabsContent>
      </Tabs>
    </PublicPage>
  );
}

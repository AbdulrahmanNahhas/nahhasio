import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft, ArrowRight, CalendarDays, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Artwork } from "../../components/artwork";
import { Choice } from "../../components/choice";
import { ContentScrollArea } from "../../components/content-scroll-area";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "../../components/ui/drawer";
import { useIsMobile } from "../../hooks/use-mobile";
import { gateway, type ReleasesQuery } from "../../lib/bridge";
import { watchRequestEvent } from "../player/watch-request";
import { ReleaseFeed } from "./release-feed";
import { dateLabel, dayDate, months, releaseTitle } from "./release-model";

export function EpisodeCalendar({
  year,
  month,
  kind = "all",
  selectedDay,
  onDay,
  onKind,
  onMonth,
  onSelectMonth,
  onToday,
}: {
  year: number;
  month: number;
  kind: ReleasesQuery["kind"];
  selectedDay: number | null;
  onDay: (day: number | null) => void;
  onKind: (kind: string) => void;
  onMonth: (direction: -1 | 1) => void;
  onSelectMonth: (month: number) => void;
  onToday: () => void;
}) {
  const mobile = useIsMobile();
  const grid = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLButtonElement>(null);
  const overview = useQuery({
    queryKey: ["releases", "calendar", year, month, kind],
    // The month is bounded and paginated. Day counts remain complete even above 100 events.
    queryFn: ({ signal }) => gateway.releases({ year, month, kind, pageSize: 100 }, signal),
    staleTime: 60000,
  });
  const first = new Date(0);
  first.setUTCFullYear(year, month - 1, 1);
  const last = new Date(0);
  last.setUTCFullYear(year, month, 0);
  const days = last.getUTCDate();
  const selected = selectedDay && selectedDay <= days ? selectedDay : null;
  const entries = new Map(overview.data?.days.map((day) => [Number(day.date.slice(8)), day]));
  const initialDay = overview.data?.days.find((day) => day.count > 0)?.date.slice(8);
  const detailDay = selected ?? (initialDay ? Number(initialDay) : null);
  useEffect(() => {
    if (!mobile || selected === null) return;
    const close = () => onDay(null);
    window.addEventListener(watchRequestEvent, close);
    return () => window.removeEventListener(watchRequestEvent, close);
  }, [mobile, selected, onDay]);
  const detail =
    detailDay !== null ? (
      <ReleaseFeed
        query={{ year, month, day: detailDay, kind }}
        grouped={false}
        singleColumn
        empty="لا توجد مواعيد مسجّلة في هذا اليوم. جرّب يومًا آخر أو غيّر نوع المواعيد."
      />
    ) : (
      <NoResults
        title="اختر يومًا"
        description="ستظهر هنا الأفلام، بدايات المواسم، والحلقات المسجّلة لهذا اليوم."
      />
    );
  return (
    <Drawer
      open={mobile && selected !== null}
      onOpenChange={(open) => {
        if (!open) onDay(null);
      }}
      showSwipeHandle
    >
      <div className="flex min-w-0 flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="الشهر السابق"
              disabled={year === 1 && month === 1}
              onClick={() => onMonth(-1)}
            >
              <ArrowRight />
            </Button>
            <Choice
              label="شهر التقويم"
              value={String(month)}
              options={months.map((label, index) => ({ label, value: String(index + 1) }))}
              onChange={(value) => onSelectMonth(Number(value))}
            />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="الشهر التالي"
              disabled={year === 9999 && month === 12}
              onClick={() => onMonth(1)}
            >
              <ArrowLeft />
            </Button>
            <Button variant="ghost" size="sm" onClick={onToday}>
              اليوم
            </Button>
          </div>
          <div className="w-full sm:w-52">
            <Choice
              label="مواعيد التقويم"
              value={kind ?? "all"}
              options={[
                { value: "all", label: "كل المواعيد" },
                { value: "installments", label: "الأفلام والمواسم" },
                { value: "episodes", label: "الحلقات" },
              ]}
              onChange={onKind}
            />
          </div>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {months[month - 1]} {year}
          </h2>
          <p className="text-xs text-muted-foreground" role="status">
            {overview.data
              ? `${overview.data.total} موعد مسجّل · ${overview.data.days.length} أيام إصدار`
              : "جارٍ تحميل المواعيد…"}
          </p>
        </div>
        {overview.error && <Failure error={overview.error} retry={() => void overview.refetch()} />}
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
          <section
            aria-label="أيام التقويم"
            className="min-w-0 rounded-2xl border border-border p-2 sm:p-4 xl:col-span-2"
          >
            <div
              className="mb-2 grid grid-cols-7 text-center text-xs text-muted-foreground"
              aria-hidden="true"
            >
              {["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"].map((label) => (
                <span key={label} className="py-2">
                  {label}
                </span>
              ))}
            </div>
            <div
              ref={grid}
              className="grid grid-cols-7 gap-1 sm:gap-2"
              aria-busy={overview.isFetching}
              onKeyDown={(event) => {
                if (
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  !(event.target instanceof HTMLButtonElement)
                )
                  return;
                const delta = new Map([
                  ["ArrowLeft", 1],
                  ["ArrowRight", -1],
                  ["ArrowDown", 7],
                  ["ArrowUp", -7],
                ]).get(event.key);
                if (delta === undefined) return;
                event.preventDefault();
                const day = Number(event.target.dataset.day);
                grid.current
                  ?.querySelector<HTMLButtonElement>(
                    `[data-day="${Math.max(1, Math.min(days, day + delta))}"]`,
                  )
                  ?.focus();
              }}
            >
              {Array.from({ length: first.getUTCDay() }, (_, index) => (
                <span key={`empty-${index}`} aria-hidden="true" />
              ))}
              {Array.from({ length: days }, (_, index) => {
                const day = index + 1;
                const date = dayDate(year, month, day);
                const entry = entries.get(day);
                const count = entry?.count ?? 0;
                const seen = new Set<string>();
                const previews = (
                  entry?.previews?.length
                    ? entry.previews
                    : (overview.data?.items.filter((item) => item.releaseDate === date) ?? [])
                )
                  .filter((item) => {
                    if (seen.has(item.installmentId)) return false;
                    seen.add(item.installmentId);
                    return true;
                  })
                  .slice(0, 2);
                return (
                  <Button
                    key={day}
                    variant={detailDay === day ? "secondary" : "outline"}
                    data-day={day}
                    aria-label={
                      overview.data
                        ? `${dateLabel(date)}، ${count} موعد`
                        : `${dateLabel(date)}، جارٍ تحميل المواعيد`
                    }
                    aria-pressed={detailDay === day}
                    aria-current={overview.data?.asOf === date ? "date" : undefined}
                    title={
                      previews
                        .map(
                          (item) => `${item.workTitleAr || item.workTitle}، ${releaseTitle(item)}`,
                        )
                        .join("، ") || undefined
                    }
                    onClick={(event) => {
                      lastTrigger.current = event.currentTarget;
                      onDay(day);
                    }}
                    className="flex h-auto min-h-20 min-w-0 flex-col items-stretch justify-start gap-2 rounded-xl p-1.5 sm:min-h-28 sm:p-2"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-1">
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          overview.data?.asOf === date && "text-primary",
                        )}
                      >
                        {day}
                      </span>
                      {count > 0 && (
                        <Badge variant="secondary" className="hidden sm:inline-flex">
                          {count}
                        </Badge>
                      )}
                    </span>
                    {count > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums sm:hidden">
                        {count} موعد
                      </span>
                    )}
                    <span className="hidden gap-1 sm:flex">
                      {previews.map((item) => (
                        <Artwork
                          key={item.id}
                          id={item.poster?.id}
                          width={320}
                          alt=""
                          className="h-10 w-7 min-w-0 rounded-sm object-cover"
                          fallback={<CalendarDays className="size-3" aria-hidden="true" />}
                        />
                      ))}
                    </span>
                    {count > 0 && (
                      <span className="mt-auto hidden truncate text-xs text-muted-foreground sm:block">
                        {previews[0]?.workTitleAr || previews[0]?.workTitle || "عرض المواعيد"}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              اختر يومًا لعرض تفاصيله. الأيام الفارغة لا تحتوي على مواعيد مسجّلة.
            </p>
          </section>
          {!mobile && (
            <aside
              aria-label="مواعيد اليوم المحدّد"
              className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border p-4"
            >
              <h3 className="font-semibold">
                {detailDay !== null ? dateLabel(dayDate(year, month, detailDay)) : "تفاصيل اليوم"}
              </h3>
              {detail}
            </aside>
          )}
        </div>
      </div>
      {mobile && (
        <DrawerContent className="max-h-5/6" finalFocus={lastTrigger}>
          <DrawerHeader>
            <div className="flex items-center justify-between gap-3">
              <DrawerTitle>
                {selected !== null ? dateLabel(dayDate(year, month, selected)) : "مواعيد اليوم"}
              </DrawerTitle>
              <DrawerClose
                render={<Button variant="ghost" size="icon-sm" aria-label="إغلاق مواعيد اليوم" />}
              >
                <X />
              </DrawerClose>
            </div>
          </DrawerHeader>
          <ContentScrollArea>
            <div className="px-4 pt-3 pb-safe">{detail}</div>
          </ContentScrollArea>
        </DrawerContent>
      )}
    </Drawer>
  );
}

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft, ArrowRight, Film, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Artwork } from "../../components/artwork";
import { Choice } from "../../components/choice";
import { Failure } from "../../components/status";
import { Button } from "../../components/ui/button";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "../../components/ui/drawer";
import { gateway } from "../../lib/bridge";
import { watchRequestEvent } from "../player/watch-request";
import { ReleaseFeed } from "./release-feed";
import { dateLabel, dayDate, months, releaseTitle } from "./release-model";

export function EpisodeCalendar({
  year,
  month,
  onMonth,
  onSelectMonth,
  onToday,
}: {
  year: number;
  month: number;
  onMonth: (direction: -1 | 1) => void;
  onSelectMonth: (month: number) => void;
  onToday: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener(watchRequestEvent, close);
    return () => window.removeEventListener(watchRequestEvent, close);
  }, [open]);
  const [selected, setSelected] = useState<number | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const overview = useQuery({
    queryKey: ["releases", "calendar", year, month],
    queryFn: ({ signal }) =>
      gateway.releases({ year, month, kind: "episodes", pageSize: 1 }, signal),
    staleTime: 60000,
  });
  const first = new Date(0);
  first.setUTCFullYear(year, month - 1, 1);
  const last = new Date(0);
  last.setUTCFullYear(year, month, 0);
  const days = last.getUTCDate();
  const entries = new Map(overview.data?.days.map((day) => [Number(day.date.slice(8)), day]));
  return (
    <Drawer swipeDirection="left" open={open} onOpenChange={setOpen}>
      <div className="flex min-w-0 flex-col gap-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="الشهر السابق"
              disabled={year === 1 && month === 1}
              onClick={() => onMonth(-1)}
            >
              <ArrowRight />
            </Button>
            <Choice
              label="شهر التقويم"
              value={String(month)}
              options={months.map((label, index) => ({ value: String(index + 1), label }))}
              onChange={(value) => onSelectMonth(Number(value))}
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="الشهر التالي"
              disabled={year === 9999 && month === 12}
              onClick={() => onMonth(1)}
            >
              <ArrowLeft />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelected(null);
              onToday();
            }}
          >
            هذا الشهر
          </Button>
          <p className="text-sm text-muted-foreground" role="status">
            {overview.data ? `${overview.data.total} حلقة لها موعد مسجّل` : "جارٍ تحميل المواعيد…"}
          </p>
        </header>
        {overview.error && <Failure error={overview.error} retry={() => void overview.refetch()} />}
        <div className="overflow-x-auto rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="min-w-[700px]">
            <div
              className="mb-2 grid grid-cols-7 text-center text-xs text-muted-foreground"
              aria-hidden="true"
            >
              {["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"].map((day) => (
                <span key={day} className="py-2">
                  {day}
                </span>
              ))}
            </div>
            <div
              ref={grid}
              className="grid grid-cols-7 gap-2"
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
                const previews = entry?.previews ?? [];
                return (
                  <DrawerTrigger
                    key={day}
                    render={<Button variant="ghost" />}
                    data-day={day}
                    aria-label={
                      overview.data
                        ? `${dateLabel(date)}، ${count} حلقة`
                        : `${dateLabel(date)}، جارٍ تحميل المواعيد`
                    }
                    title={
                      previews
                        .map(
                          (item) => `${item.workTitleAr || item.workTitle}، ${releaseTitle(item)}`,
                        )
                        .join("، ") || undefined
                    }
                    aria-pressed={selected === day}
                    aria-current={overview.data?.asOf === date ? "date" : undefined}
                    onClick={() => setSelected(day)}
                    className={cn(
                      "flex h-auto min-h-44 min-w-0 flex-col items-stretch justify-start gap-2 rounded-xl border border-border bg-background p-2 text-start",
                      selected === day && "border-primary bg-secondary",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          overview.data?.asOf === date && "text-primary",
                        )}
                      >
                        {day}
                      </span>
                      {count > 0 && (
                        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                      )}
                    </span>
                    <span className="flex gap-1">
                      {previews.map((item) => (
                        <Artwork
                          key={item.id}
                          id={item.poster?.id}
                          alt={`${item.workTitleAr || item.workTitle}، ${releaseTitle(item)}`}
                          className="aspect-2/3 w-1/3 min-w-0 self-start rounded-md object-cover"
                          fallback={<Film className="size-3" aria-hidden="true" />}
                        />
                      ))}
                    </span>
                    {count > previews.length && count > 0 && (
                      <span className="mt-auto text-xs text-muted-foreground">
                        {previews.length ? `+${count - previews.length} أخرى` : "عرض الحلقات"}
                      </span>
                    )}
                  </DrawerTrigger>
                );
              })}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          اختر يومًا لعرض حلقاته. يمكنك تحريك التقويم أفقيًا على الشاشات الصغيرة.
        </p>
      </div>
      <DrawerContent className="data-[swipe-direction=left]:start-auto data-[swipe-direction=left]:left-0">
        <DrawerHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle>
              {selected !== null ? dateLabel(dayDate(year, month, selected)) : "حلقات اليوم"}
            </DrawerTitle>
            <DrawerClose
              render={<Button variant="ghost" size="icon-sm" aria-label="إغلاق حلقات اليوم" />}
            >
              <X />
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {selected !== null && (
            <ReleaseFeed
              query={{ year, month, day: selected, kind: "episodes" }}
              grouped={false}
              episodeCards
              empty="لا توجد حلقات مسجّلة في هذا اليوم."
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

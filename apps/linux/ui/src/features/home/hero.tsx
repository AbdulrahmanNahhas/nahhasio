import { useQuery } from "@tanstack/react-query";
import { Info, Play, Pause } from "lucide-react";
import { useEffect, useState } from "react";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { ScoreBadge } from "../../components/media-card";
import { Button, buttonVariants } from "../../components/ui/button";
import { gateway } from "../../lib/bridge";
import { requestWatch } from "../player/watch-request";
import { navigate, workLink } from "../shell/navigation";
export function Hero() {
  const navigation = useCardNavigation();
  const result = useQuery({
    queryKey: ["catalog", "home"],
    queryFn: ({ signal }) => gateway.home(signal),
  });
  const [index, setIndex] = useState(0);
  const [pause, setPause] = useState(false);
  const [stopped, setStopped] = useState(false);
  const items = result.data?.featured ?? [];
  useEffect(() => {
    if (
      pause ||
      stopped ||
      items.length < 2 ||
      window.matchMedia("(prefers-reduced-motion:reduce)").matches
    )
      return;
    const timer = setTimeout(() => setIndex((index + 1) % items.length), 15000);
    return () => clearTimeout(timer);
  }, [pause, stopped, items.length, index]);
  const work = items[index % Math.max(items.length, 1)];
  if (!work)
    return (
      <div
        className="relative isolate grid min-h-160 place-items-center overflow-hidden bg-card text-muted-foreground sm:min-h-180 lg:min-h-home-hero"
        role="status"
      >
        {result.error
          ? result.error.message
          : result.isLoading
            ? "جارٍ تحميل المكتبة…"
            : "لا توجد أعمال عامة بعد."}
      </div>
    );
  return (
    <section
      {...navigation}
      tabIndex={0}
      data-navigation-align="start"
      aria-keyshortcuts="ArrowLeft ArrowRight Enter"
      onKeyDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.nativeEvent.isComposing
        )
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setIndex(
            (value) => (value + (event.key === "ArrowLeft" ? 1 : -1) + items.length) % items.length,
          );
        } else if (event.key === "Enter") {
          event.preventDefault();
          navigate(workLink(work.id).slice(1));
        } else navigation?.onKeyDown(event);
      }}
      className="relative isolate flex min-h-160 items-end overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary sm:min-h-180 lg:min-h-home-hero"
      aria-label="أحدث الأعمال"
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocusCapture={() => setPause(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPause(false);
      }}
    >
      <Artwork
        id={work.banner?.id}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        priority
      />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-l from-background/90 via-background/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />
      <div className="relative flex w-full max-w-190 flex-col items-start gap-4 px-4 pt-16 pb-20 sm:w-4/5 sm:gap-5 sm:px-8.5 sm:pt-16 lg:w-3/5 lg:px-12 lg:pb-5">
        {work.logo ? (
          <h1 className="w-full text-4xl leading-normal font-semibold sm:text-5xl lg:text-6xl">
            <Artwork
              id={work.logo.id}
              alt={work.titleAr || work.canonicalTitle}
              className="block h-auto max-h-32 w-64 max-w-full object-contain object-right sm:w-80 lg:w-96"
              priority
            />
          </h1>
        ) : (
          <h1
            className="w-full text-4xl leading-normal font-semibold sm:text-5xl lg:text-6xl"
            dir="auto"
          >
            {work.titleAr || work.canonicalTitle}
          </h1>
        )}
        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/80 sm:gap-4 sm:text-sm">
          <ScoreBadge score={work.score} />
          {work.releaseYear && <span>{work.releaseYear}</span>}
          <span>{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</span>
          <span dir="auto">{work.age}</span>
        </div>
        <p
          className="line-clamp-3 max-w-150 text-sm leading-loose text-foreground sm:text-base"
          dir="auto"
        >
          {work.summary}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="lg"
            onClick={() =>
              requestWatch({
                workId: work.id,
                title: work.titleAr || work.canonicalTitle,
              })
            }
          >
            <Play data-icon="inline-start" />
            المشاهدة
          </Button>
          <a
            className={buttonVariants({ size: "lg", variant: "outline" })}
            href={workLink(work.id)}
          >
            <Info data-icon="inline-start" />
            عرض التفاصيل
          </a>
        </div>
      </div>
      <div
        className="absolute bottom-5 left-4 flex max-w-full items-center gap-2 sm:left-8 lg:left-12"
        role="group"
        dir="ltr"
        aria-label="التنقل بين الأعمال"
      >
        <div className="flex items-center gap-0.5 rounded-full border border-foreground/25 bg-muted/70 px-2 py-1">
          {items.map((item, n) => (
            <div
              key={item.id}
              data-active={n === index % items.length}
              className="w-6 shrink-0 transition-[width] duration-700 ease-in-out data-[active=true]:w-12 motion-reduce:transition-none"
            >
              <Button
                variant="ghost"
                size="icon-xs"
                className="group/dot w-full"
                aria-label={`اعرض ${item.titleAr || item.canonicalTitle}`}
                aria-pressed={n === index % items.length}
                onClick={() => setIndex(n)}
              >
                <span className="block h-1.5 w-3 rounded-full bg-muted-foreground/70 transition-all duration-700 ease-in-out group-aria-pressed/dot:w-9 group-aria-pressed/dot:bg-foreground motion-reduce:transition-none" />
              </Button>
            </div>
          ))}
        </div>
        <div className="rounded-full border border-foreground/25 bg-muted/70 p-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={stopped ? "تشغيل التبديل التلقائي" : "إيقاف التبديل التلقائي"}
            onClick={() => setStopped(!stopped)}
          >
            {stopped ? <Play /> : <Pause />}
          </Button>
        </div>
      </div>
    </section>
  );
}

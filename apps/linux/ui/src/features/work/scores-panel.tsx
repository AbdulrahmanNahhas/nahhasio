import { installmentRating } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";
import { cn } from "cn";
import { CircleHelp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";

import { criteria } from "../catalog/filter-model";
import { Disclosure, FieldList, PanelEmpty } from "./field-list";
import { scoreColor, ScoreFingerprint } from "./score-charts";
import { scoreProfile, scoreValue } from "./score-model";

function ScoreBadge({ score }: { score: number }) {
  const value = Math.round(score * 10);
  return (
    <div
      className={cn(
        "relative isolate flex size-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-current/35",
        scoreColor(score),
      )}
    >
      <span className="absolute inset-0 -z-10 bg-current/10" aria-hidden />
      <strong className="text-2xl leading-none font-bold tabular-nums">{value}</strong>
      <span className="text-xs text-muted-foreground">من 100</span>
    </div>
  );
}

function CriterionRows({ rows }: { rows: { key: string; label: string; value: number | null }[] }) {
  return (
    <dl className="min-w-0 divide-y divide-border">
      {rows.map(({ key, label, value }) => (
        <div key={key} className="flex min-h-10 items-center gap-2 py-2 sm:gap-3">
          <dt className="min-w-0 flex-1 leading-snug">{label}</dt>
          <dd className="flex w-1/2 shrink-0 items-center gap-2 sm:gap-3">
            {value === null ? (
              <span className="ms-auto text-xs text-muted-foreground">غير مقيّم</span>
            ) : (
              <>
                <svg
                  width="100%"
                  height={8}
                  className={cn("h-2 min-w-0 flex-1 rounded-full bg-muted", scoreColor(value))}
                  aria-hidden
                >
                  <rect
                    x={`${100 - value * 10}%`}
                    width={`${value * 10}%`}
                    height={8}
                    rx={4}
                    className="fill-current"
                  />
                </svg>
                <bdi dir="ltr" className="w-10 shrink-0 text-end font-semibold tabular-nums">
                  {Number(value.toFixed(2))}
                </bdi>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ScoreCalculation({ profile }: { profile: ReturnType<typeof scoreProfile> }) {
  const mobile = useIsMobile();
  const Root = mobile ? Drawer : Popover;
  const Trigger = mobile ? DrawerTrigger : PopoverTrigger;
  const Title = mobile ? DrawerTitle : PopoverTitle;
  const title = "كيف يُحسب التقييم؟";
  const content = (
    <div className="min-h-0 overflow-y-auto overscroll-contain p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <Title>{title}</Title>
        {mobile && (
          <DrawerClose
            render={<Button variant="ghost" size="icon" aria-label="إغلاق شرح التقييم" />}
          >
            <X aria-hidden />
          </DrawerClose>
        )}
      </div>
      <div className="flex flex-col gap-4 text-sm leading-loose text-muted-foreground">
        <p>
          تُضرب درجة كل معيار في وزنه. تقييم العمل هو متوسط المجاميع الموزونة المكتملة قبل أي تقريب،
          ثم يُقرّب مرة واحدة إلى منزلة عشرية.
        </p>
        <p>
          القصة 25%، الشخصيات 20%، العمق 20%، بناء العالم 10%، الأصالة 10%، والإبداع والتنفيذ 15%. لا
          تُعاد موازنة المعايير الناقصة، ولا تُستخدم درجات الأجزاء المقرّبة لحساب متوسط العمل.
        </p>
      </div>
      <div className="mt-4 border-t border-border">
        <FieldList
          rows={[
            ["عدد الأجزاء المحتسبة", profile.summary.scored],
            ["متوسط المجاميع قبل التقريب", profile.unroundedAverage?.toFixed(4)],
            ["تقييم العمل بعد التقريب", profile.summary.rating?.toFixed(1)],
          ]}
        />
      </div>
    </div>
  );

  return (
    <Root>
      <Trigger render={<Button variant="ghost" size="icon" aria-label={title} title={title} />}>
        <CircleHelp aria-hidden />
      </Trigger>
      {mobile ? (
        <DrawerContent className="max-h-5/6">{content}</DrawerContent>
      ) : (
        <PopoverContent
          align="start"
          sideOffset={8}
          className="max-h-(--available-height) w-96 max-w-(--available-width) overflow-hidden p-0"
        >
          {content}
        </PopoverContent>
      )}
    </Root>
  );
}

function InstallmentScores({ installments }: { installments: WorkDetail["installments"] }) {
  return (
    <section className="min-w-0" aria-label="درجات الأجزاء">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        {installments.map((unit) => {
          const rating = installmentRating(unit.scores ?? {});
          const rows = criteria.map(({ key, label }) => ({
            key,
            label,
            value: scoreValue(unit.scores?.[key]),
          }));
          const label = rows.some(({ value }) => value !== null) ? "غير مكتمل" : "غير مقيّم";
          return (
            <Disclosure
              key={unit.id}
              compact
              lazyContent
              title={
                <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                  <bdi className="min-w-0 wrap-anywhere">{unit.title}</bdi>
                  {rating === null ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
                  ) : (
                    <bdi
                      dir="ltr"
                      className={cn("shrink-0 font-semibold tabular-nums", scoreColor(rating))}
                    >
                      {rating.toFixed(1)}
                      <span className="text-xs font-normal text-muted-foreground"> / 10</span>
                    </bdi>
                  )}
                </span>
              }
            >
              <CriterionRows rows={rows} />
            </Disclosure>
          );
        })}
      </div>
    </section>
  );
}

export function ScoresPanel({ work }: { work: WorkDetail }) {
  const mobile = useIsMobile();
  const profile = scoreProfile(work);
  const { rating, scored, total } = profile.summary;
  const hasScores = work.installments.some((unit) =>
    criteria.some(({ key }) => scoreValue(unit.scores?.[key]) !== null),
  );
  if (!hasScores) {
    return <PanelEmpty title="لم يُقيّم هذا العمل بعد" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex items-center gap-3 pe-10">
        {rating !== null && <ScoreBadge score={rating} />}
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="text-lg font-semibold wrap-anywhere" dir="auto">
              {work.titleAr || work.canonicalTitle}
            </h2>
            <ScoreCalculation profile={profile} />
          </div>
          <p className="text-sm text-muted-foreground">
            {rating === null
              ? "يظهر التقييم الكلي عند اكتمال المعايير الستة في أحد الأجزاء."
              : `الأجزاء المحتسبة ${scored} من ${total}`}
          </p>
        </div>
      </header>
      {rating !== null && (
        <section className="min-w-0 border-t border-border pt-4" aria-label="درجات المعايير من 10">
          <div className="grid min-w-0 items-center gap-2 md:grid-cols-2 md:gap-6">
            <div className="min-w-0">
              <CriterionRows
                rows={profile.criteria.map(({ key, label, average }) => ({
                  key,
                  label,
                  value: average,
                }))}
              />
            </div>
            {!mobile && <ScoreFingerprint profile={profile} />}
          </div>
        </section>
      )}
      {(total > 1 || rating === null) && <InstallmentScores installments={work.installments} />}
    </div>
  );
}

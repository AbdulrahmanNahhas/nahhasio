import { installmentRating, scoreWeights } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";

import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

import { Badge } from "../../components/ui/badge";
import { criteria } from "../catalog/filter-model";
import { Disclosure, FieldList, Section } from "./field-list";
import { episodeNumberLabel } from "./format";
import { CriterionTrend, ScoreFingerprint } from "./score-charts";
import { scoreProfile, scoreValue, weightedValue } from "./score-model";

export function ScoresPanel({ work }: { work: WorkDetail }) {
  const profile = scoreProfile(work);
  const ratedCriteria = criteria.filter((criterion) =>
    work.installments.some((unit) => scoreValue(unit.scores?.[criterion.key]) !== null),
  );
  if (!ratedCriteria.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>لم يُقيّم هذا العمل بعد</EmptyTitle>
          <EmptyDescription>تظهر الدرجات بعد تقييم معايير أحد الأجزاء.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="min-w-0">
      {profile.summary.scored > 0 && (
        <Section title="بصمة التقييم" description="متوسط المعايير الستة للأجزاء المكتملة.">
          <div className="grid min-w-0 gap-8 xl:grid-cols-2">
            <ScoreFingerprint profile={profile} />
            <div className="flex min-w-0 flex-col justify-center gap-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <strong className="text-4xl font-semibold tabular-nums">
                  {profile.summary.rating === null ? "غير مقيّم" : profile.summary.rating.toFixed(1)}
                </strong>
                {profile.summary.rating !== null && (
                  <span className="text-sm text-muted-foreground">من ١٠</span>
                )}
                <Badge variant="outline">
                  {profile.summary.scored} / {profile.summary.total} أجزاء مكتملة
                </Badge>
              </div>
              <FieldList
                rows={profile.criteria.map((criterion) => [
                  criterion.label,
                  <span key={criterion.key} className="inline-flex items-baseline gap-3">
                    <strong className="tabular-nums">
                      {criterion.average === null
                        ? "غير مقيّم"
                        : episodeNumberLabel(criterion.average.toFixed(2))}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      وزن {scoreWeights[criterion.key] * 100}%
                    </span>
                  </span>,
                ])}
              />
            </div>
          </div>
        </Section>
      )}
      <Section
        title="تطوّر المعايير عبر الأجزاء"
        description="الأجزاء من اليمين إلى اليسار. الفجوات تعني غياب الدرجة، لا صفرًا."
      >
        <>
          <div className="grid min-w-0 gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
            {ratedCriteria.map((criterion) => (
              <CriterionTrend key={criterion.key} work={work} criterion={criterion} />
            ))}
          </div>
          <Disclosure title="كل درجات الأجزاء · بديل نصّي للرسوم">
            <div
              className="overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
              tabIndex={0}
              role="region"
              aria-label="جدول درجات الأجزاء"
            >
              <table className="w-full text-start text-sm tabular-nums">
                <caption className="sr-only">
                  جميع المعايير الستة لكل جزء، مع التقييم الموزون. غير مقيّم تعني غياب الدرجة.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-3 text-start">
                      الجزء
                    </th>
                    {criteria.map((criterion) => (
                      <th scope="col" className="p-3 text-start" key={criterion.key}>
                        {criterion.label}
                      </th>
                    ))}
                    <th scope="col" className="p-3 text-start">
                      الموزون
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {work.installments.map((unit, index) => (
                    <tr className="odd:bg-muted/40" key={unit.id}>
                      <th scope="row" className="p-3 text-start font-medium">
                        <span className="text-muted-foreground">{index + 1} · </span>
                        <bdi>{unit.title}</bdi>
                      </th>
                      {criteria.map((criterion) => (
                        <td className="p-3" key={criterion.key}>
                          {scoreValue(unit.scores?.[criterion.key]) ?? "غير مقيّم"}
                        </td>
                      ))}
                      <td className="p-3">
                        {installmentRating(unit.scores ?? {})?.toFixed(1) ?? "غير مقيّم"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Disclosure>
        </>
      </Section>
      <Disclosure title="كيف يُحسب التقييم؟">
        <p className="text-sm leading-loose text-muted-foreground">
          تُضرب درجة كل معيار في وزنه. تقييم العمل هو متوسط المجاميع الموزونة المكتملة قبل أي تقريب،
          ثم يُقرّب مرة واحدة إلى منزلة عشرية.
        </p>
        <p className="text-base leading-loose md:text-lg">
          القصة ٢٥٪ + الشخصيات ٢٠٪ + العمق ٢٠٪ + بناء العالم ١٠٪ + الأصالة ١٠٪ + الإبداع والتنفيذ ١٥٪.
          لا تُعاد موازنة المعايير الناقصة، ولا تُستخدم درجات الأجزاء المقرّبة لحساب متوسط العمل.
        </p>
        <FieldList
          rows={[
            ["عدد الأجزاء المحتسبة", profile.summary.scored],
            ["متوسط المجاميع قبل التقريب", profile.unroundedAverage?.toFixed(4)],
            ["تقييم العمل بعد التقريب", profile.summary.rating?.toFixed(1)],
          ]}
        />
        {work.installments
          .filter((unit) =>
            criteria.some((criterion) => scoreValue(unit.scores?.[criterion.key]) !== null),
          )
          .map((unit) => {
            const raw = weightedValue(unit.scores);
            const rating = installmentRating(unit.scores ?? {});
            return (
              <Disclosure
                key={unit.id}
                title={
                  <>
                    <bdi>{unit.title}</bdi> ·{" "}
                    {rating === null ? "تقييم غير مكتمل" : `${rating.toFixed(1)} / 10`}
                  </>
                }
              >
                <FieldList
                  rows={criteria.map((criterion) => {
                    const value = scoreValue(unit.scores?.[criterion.key]);
                    return [
                      criterion.label,
                      value === null ? (
                        "غير مقيّم · لا مساهمة محسوبة"
                      ) : (
                        <span key={criterion.key} dir="ltr" className="tabular-nums">
                          {value} × {scoreWeights[criterion.key] * 100}% ={" "}
                          {(value * scoreWeights[criterion.key]).toFixed(4)}
                        </span>
                      ),
                    ];
                  })}
                />
                <FieldList
                  rows={[
                    [
                      "المجموع قبل التقريب",
                      raw === null ? "غير مكتمل · مستبعد من متوسط العمل" : raw.toFixed(4),
                    ],
                    ["التقييم بعد التقريب", rating?.toFixed(1)],
                  ]}
                />
              </Disclosure>
            );
          })}
      </Disclosure>
    </div>
  );
}

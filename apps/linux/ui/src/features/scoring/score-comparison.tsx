import type { WorkDocument } from "@arcadia/contracts/work";
import { installmentRating } from "@arcadia/domain";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { scoreDefinitions } from "@/features/scoring/score-model";

export const scoreCriteria = scoreDefinitions;
type Installment = NonNullable<WorkDocument["installments"]>[number];
export function ScoreComparison({
  installments,
  selected,
}: {
  installments: Installment[];
  selected: number;
}) {
  const item = installments[selected];
  if (!item) return null;
  const rating = installmentRating(item.score ?? {});
  const config: ChartConfig = Object.fromEntries(
    installments.map((part, index) => [`part${index}`, { label: part.title }]),
  );
  const data = scoreCriteria.map((criterion) => ({
    criterion: criterion.label,
    ...Object.fromEntries(
      installments.map((part, index) => [`part${index}`, part.score?.[criterion.key] ?? null]),
    ),
  }));
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-wrap justify-between gap-2 text-sm">
        <span className="font-medium">
          تقييم {item.title} · {rating === null ? "غير مكتمل" : `${rating}`}
        </span>
        <span className="text-muted-foreground">المضلعات الباهتة: بقية الأجزاء · من 10</span>
      </figcaption>
      <ChartContainer
        config={config}
        className="mx-auto aspect-square w-full max-w-sm"
        aria-label={`مقارنة تقييم ${item.title} ببقية الأجزاء`}
      >
        <RadarChart data={data} outerRadius="65%" accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          <PolarGrid />
          <PolarAngleAxis dataKey="criterion" />
          <PolarRadiusAxis domain={[0, 10]} tickCount={6} tick={false} axisLine={false} />
          {installments.map(
            (part, index) =>
              index !== selected && (
                <Radar
                  key={part.id ?? part.position}
                  name={part.title}
                  dataKey={`part${index}`}
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.05}
                  strokeOpacity={0.2}
                  isAnimationActive={false}
                />
              ),
          )}
          <Radar
            name={item.title}
            dataKey={`part${selected}`}
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.25}
            strokeWidth={2}
            dot
            isAnimationActive={false}
          />
        </RadarChart>
      </ChartContainer>
      <ul className="sr-only">
        {installments.map((part) => (
          <li key={part.id ?? part.position}>
            {part.title}:{" "}
            {scoreCriteria
              .map(
                (criterion) => `${criterion.label}: ${part.score?.[criterion.key] ?? "بلا تقييم"}`,
              )
              .join("، ")}
          </li>
        ))}
      </ul>
    </figure>
  );
}

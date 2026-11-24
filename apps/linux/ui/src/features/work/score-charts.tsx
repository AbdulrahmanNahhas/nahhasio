import { cn } from "cn";
import { useId } from "react";

import { criteria } from "../catalog/filter-model";
import { episodeNumberLabel } from "./format";
import type { scoreProfile } from "./score-model";

const scoreColors = [
  "text-rating-0",
  "text-rating-1",
  "text-rating-2",
  "text-rating-3",
  "text-rating-4",
  "text-rating-5",
  "text-rating-6",
  "text-rating-7",
  "text-rating-8",
  "text-rating-9",
  "text-rating-10",
];

export function scoreColor(value: number) {
  return scoreColors[Math.floor(value)];
}

function radarPoint(index: number, value: number) {
  const angle = -Math.PI / 2 - (index * Math.PI) / 3;
  return { x: 180 + Math.cos(angle) * value * 11, y: 160 + Math.sin(angle) * value * 11 };
}

export function ScoreFingerprint({ profile }: { profile: ReturnType<typeof scoreProfile> }) {
  const title = useId();
  const description = useId();
  if (profile.summary.rating === null) return null;
  const points = profile.criteria.flatMap((criterion, index) =>
    criterion.average === null
      ? []
      : [{ ...radarPoint(index, criterion.average), key: criterion.key, value: criterion.average }],
  );
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <svg
        className={cn("mx-auto w-full max-w-64 sm:max-w-88", scoreColor(profile.summary.rating))}
        viewBox="0 0 360 320"
        role="img"
        aria-labelledby={`${title} ${description}`}
      >
        <title id={title}>بصمة المعايير الستة</title>
        <desc id={description}>
          {profile.criteria
            .map(
              (criterion) =>
                `${criterion.label}: ${criterion.average === null ? "غير مقيّم" : `${episodeNumberLabel(criterion.average.toFixed(2))} من 10`}`,
            )
            .join("، ")}
          . متوسط معايير الأجزاء المكتملة فقط؛ الحلقة الخارجية تساوي 10.
        </desc>
        {[2, 4, 6, 8, 10].map((level) => (
          <polygon
            key={level}
            points={criteria
              .map((_, index) => {
                const p = radarPoint(index, level);
                return `${p.x},${p.y}`;
              })
              .join(" ")}
            className="fill-none stroke-border"
          />
        ))}
        {profile.criteria.map((criterion, index) => {
          const end = radarPoint(index, 10);
          const label = radarPoint(index, 12);
          return (
            <g key={criterion.key}>
              <line x1={180} y1={160} x2={end.x} y2={end.y} className="stroke-border" />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground/75 text-sm"
              >
                {criterion.key === "story"
                  ? "القصة"
                  : criterion.key === "craft"
                    ? "التنفيذ"
                    : criterion.label}
              </text>
            </g>
          );
        })}
        <polygon
          points={points.map((point) => `${point.x},${point.y}`).join(" ")}
          className="fill-current/15 stroke-current"
          strokeWidth={2}
        />
        {points.map((point) => (
          <circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r={3}
            className={cn("fill-current", scoreColor(point.value))}
          />
        ))}
      </svg>
    </figure>
  );
}

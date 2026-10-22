import type { BrowseFilters } from "@nahhasio/api-contract";
import { RotateCcw, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { criteria, emptyFilters } from "./filter-model";

export function ScoreFilters({
  value,
  onChange,
}: {
  value: BrowseFilters;
  onChange: (value: BrowseFilters) => void;
}) {
  const maximum = value.maximumRating ?? 10;
  const restricted = value.minimumRating > 0 || maximum < 10;
  const active = criteria.filter((criterion) => value.minimumScores[criterion.key] > 0).length;
  return (
    <FieldGroup className="gap-8">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="size-4 text-primary" aria-hidden="true" />
            التقييم العام
          </CardTitle>
          <CardDescription>حدد أقل وأعلى تقييم، أو استخدم اختيارًا سريعًا.</CardDescription>
          <CardAction>
            <Badge variant={restricted ? "default" : "secondary"}>
              {restricted
                ? `${value.minimumRating.toFixed(1)} – ${maximum.toFixed(1)}`
                : "كل التقييمات"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="minimum-rating" className="sr-only">
                نطاق التقييم العام
              </FieldLabel>
              <Slider
                id="minimum-rating"
                aria-label="نطاق التقييم العام"
                min={0}
                max={10}
                step={0.1}
                value={[value.minimumRating, maximum]}
                onValueChange={(next) => {
                  if (Array.isArray(next))
                    onChange({ ...value, minimumRating: next[0], maximumRating: next[1] });
                }}
              />
            </Field>
            <ToggleGroup
              variant="outline"
              spacing={2}
              className="flex-wrap"
              aria-label="اختيارات التقييم السريعة"
              value={maximum === 10 ? [String(value.minimumRating)] : []}
              onValueChange={(next) => {
                if (next.length)
                  onChange({ ...value, minimumRating: Number(next[0]), maximumRating: 10 });
              }}
            >
              {[0, 6, 7, 8, 9].map((score) => (
                <ToggleGroupItem key={score} value={String(score)}>
                  {score ? `${score} فأعلى` : "الكل"}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldGroup>
        </CardContent>
      </Card>
      <FieldSet className="gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <FieldLegend variant="label">
              المعايير التفصيلية {active > 0 && <Badge variant="secondary">{active} مفعّلة</Badge>}
            </FieldLegend>
            <FieldDescription>
              حدود مستقلة من 10؛ يجب تحقيق كل حد تختاره. صفر يلغي الحد.
            </FieldDescription>
          </div>
          {active > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...value, minimumScores: emptyFilters().minimumScores })}
            >
              <RotateCcw data-icon="inline-start" />
              مسح المعايير
            </Button>
          )}
        </div>
        <FieldGroup className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {criteria.map((criterion) => (
            <ScoreThreshold
              key={criterion.key}
              id={`score-${criterion.key}`}
              label={criterion.label}
              value={value.minimumScores[criterion.key]}
              onChange={(score) =>
                onChange({
                  ...value,
                  minimumScores: { ...value.minimumScores, [criterion.key]: score },
                })
              }
            />
          ))}
        </FieldGroup>
      </FieldSet>
    </FieldGroup>
  );
}

function ScoreThreshold({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field className="gap-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-muted-foreground">
            {value ? `${value.toFixed(1)} فأعلى` : "بلا حد"}
          </span>
          {value > 0 && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`إلغاء حد ${label}`}
              onClick={() => onChange(0)}
            >
              <RotateCcw />
            </Button>
          )}
        </div>
      </div>
      <Slider
        id={id}
        aria-label={label}
        min={0}
        max={10}
        step={0.1}
        value={[value]}
        onValueChange={(next) => {
          onChange(Array.isArray(next) ? next[0] : next);
        }}
      />
    </Field>
  );
}

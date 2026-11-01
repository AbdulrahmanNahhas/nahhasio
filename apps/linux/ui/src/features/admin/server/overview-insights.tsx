import type { ServerOverview } from "@nahhasio/api-contract";
import { ChevronDown, ChevronLeft, ImagePlus } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { optionLabel } from "@/features/catalog/filter-model";

import { formatAdminDate as activityDate } from "../format";

export type LibraryInsights = ServerOverview["insights"];
const number = new Intl.NumberFormat("ar");
const labels = {
  animated: "رسوم متحركة",
  "live-action": "تمثيل حي",
  draft: "مسودات",
  in_review: "قيد المراجعة",
  approved: "معتمدة",
  published: "منشورة",
  archived: "مؤرشفة",
  completed: "مكتمل",
  ongoing: "مستمر",
  announced: "قادم",
  unknown: "غير معروف",
  ar: "العربية",
  en: "الإنجليزية الافتراضية",
  poster: "الملصقات",
  banner: "الخلفيات",
  logo: "الشعارات",
  profile: "الصور الشخصية",
  still: "صور الحلقات",
  summary: "الملخصات",
  genres: "الأنواع",
  credits: "المساهمات",
};
const labelFor = (key: string) =>
  Object.entries(labels).find(([value]) => value === key)?.[1] ?? key;
const kindFilters = [
  { key: "animated-series", format: "animated", structure: "series" },
  { key: "animated-movie", format: "animated", structure: "movie" },
  { key: "live-action-series", format: "live-action", structure: "series" },
  { key: "live-action-movie", format: "live-action", structure: "movie" },
] as const;
const releaseStatuses = ["completed", "ongoing", "announced", "unknown"];
function compositionLink(filter: "kind" | "status", key: string) {
  if (filter === "status") return `#/admin/works?status=${encodeURIComponent(key)}`;
  const kind = kindFilters.find((item) => item.key === key);
  return kind ? `#/admin/works?format=${kind.format}&structure=${kind.structure}` : "#/admin/works";
}
const workflow = ["draft", "in_review", "approved", "published", "archived"];
const workflowConfig = {
  draft: { label: "مسودات", color: "var(--chart-1)" },
  in_review: { label: "قيد المراجعة", color: "var(--chart-2)" },
  approved: { label: "معتمدة", color: "var(--chart-3)" },
  published: { label: "منشورة", color: "var(--chart-4)" },
  archived: { label: "مؤرشفة", color: "var(--chart-5)" },
};
const chartConfig = { value: { label: "الأعمال", color: "var(--chart-1)" } };
function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ar", { month: "short", timeZone: "UTC" }).format(date);
}
export function OverviewInsights({ data, works }: { data: LibraryInsights; works: number }) {
  const missing = data.missing.toSorted((a, b) => b.value - a.value);
  const stages = workflow.map((key) => ({
    key,
    label: labelFor(key),
    value: data.workflow.find((row) => row.key === key)?.value ?? 0,
    fill: `var(--color-${key})`,
  }));
  return (
    <>
      {!works && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>ابدأ مكتبتك بأول عمل</EmptyTitle>
            <EmptyDescription>
              أضف بيانات العمل وصوره، ثم راجعها قبل النشر. ستظهر هنا أولويات التحرير ونشاط المكتبة.
            </EmptyDescription>
          </EmptyHeader>
          <Button render={<a href="#/admin/works/new" />}>إضافة أول عمل</Button>
        </Empty>
      )}
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-3">
        <Card size="sm" className="flex h-full min-w-0 flex-col lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <h2>يحتاج إلى استكمال</h2>
            </CardTitle>
            <CardDescription>
              افتح النقص لمراجعة الأعمال المرتبطة به. قد يظهر العمل في أكثر من قائمة.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              {missing.map((row) => (
                <Item
                  key={row.key}
                  size="sm"
                  variant="outline"
                  render={<a href={`#/admin/works?gap=${encodeURIComponent(row.key)}`} />}
                >
                  <ItemContent>
                    <ItemTitle>{labelFor(row.key)}</ItemTitle>
                    <ItemDescription>
                      {row.value
                        ? `${number.format(row.value)} عمل يحتاج إلى استكمال`
                        : "لا توجد نواقص مسجّلة"}
                    </ItemDescription>
                  </ItemContent>
                  <Badge variant={row.value ? "secondary" : "outline"}>
                    {number.format(row.value)}
                  </Badge>
                  <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                </Item>
              ))}
            </div>
            {!missing.length && (
              <p className="text-sm text-muted-foreground">لا توجد نتائج لفحص النواقص.</p>
            )}
            <Item variant="muted" size="sm" render={<a href="#/admin/works?gap=episode-images" />}>
              <ItemMedia variant="icon">
                <ImagePlus />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>صور الحلقات</ItemTitle>
                <ItemDescription>
                  {number.format(data.episodesMissing)} حلقة بلا صورة ·{" "}
                  {number.format(data.episodesEligible)} مؤهلة للمراجعة عبر TMDB
                </ItemDescription>
              </ItemContent>
              <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
            </Item>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button variant="link" size="sm" render={<a href="#/admin/maintenance?tab=actions" />}>
              صور الحلقات وتنظيف المكتبة
              <ChevronLeft data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
        <Card size="sm" className="flex h-full min-w-0 flex-col">
          <CardHeader>
            <CardTitle>
              <h2>مسار التحرير</h2>
            </CardTitle>
            <CardDescription>من المسودة إلى النشر. اختر مرحلة لمتابعة أعمالها.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center gap-3">
            {works > 0 && (
              <ChartContainer
                config={workflowConfig}
                className="mx-auto aspect-square w-full max-w-44"
                dir="ltr"
                aria-label="توزيع مراحل التحرير"
              >
                <PieChart accessibilityLayer>
                  <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
                  <Pie
                    data={stages.filter((row) => row.value > 0)}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="65%"
                    outerRadius="90%"
                    paddingAngle={2}
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    <Label
                      position="center"
                      value={number.format(works)}
                      fill="var(--foreground)"
                      fontSize={24}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
            <div className="flex flex-col gap-1">
              {stages.map((stage) => (
                <Button
                  key={stage.key}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                  render={<a href={`#/admin/works?workflow=${stage.key}`} />}
                >
                  <span>{stage.label}</span>
                  <Badge variant={stage.key === "in_review" ? "secondary" : "outline"}>
                    {number.format(stage.value)}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
          <CardFooter className="mt-auto">
            <p className="text-xs text-muted-foreground">
              يشمل {number.format(works)} عملًا، بما فيها الأعمال الخاصة والمسودات.
            </p>
          </CardFooter>
        </Card>
      </div>
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <Card size="sm" className="flex h-full min-w-0 flex-col">
          <CardHeader>
            <CardTitle>
              <h2>إضافات المكتبة</h2>
            </CardTitle>
            <CardDescription>
              آخر ستة أشهر، حسب إنشاء السجل؛ وليست إحصاءات للمشاهدة.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.additions.length ? (
              <ChartContainer config={chartConfig} className="h-44 w-full" dir="ltr">
                <AreaChart accessibilityLayer data={data.additions} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="key"
                    tickFormatter={monthLabel}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} width={35} />
                  <ChartTooltip
                    content={<ChartTooltipContent labelFormatter={(value) => String(value)} />}
                  />
                  <Area
                    dataKey="value"
                    type="linear"
                    fill="var(--color-value)"
                    fillOpacity={0.18}
                    stroke="var(--color-value)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">لا توجد بيانات عن الإضافات بعد.</p>
            )}
            <dl className="sr-only">
              {data.additions.map((row) => (
                <div key={row.key}>
                  <dt>{row.key}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
          <CardFooter className="mt-auto">
            <Button variant="link" size="sm" render={<a href="#/admin/works?sort=added" />}>
              تصفح أحدث الإضافات
              <ChevronLeft data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
        <Card size="sm" className="flex h-full min-w-0 flex-col">
          <CardHeader>
            <CardTitle>
              <h2>آخر نشاط إداري</h2>
            </CardTitle>
            <CardDescription>آخر ثماني عمليات حفظها الخادم.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center">
            {data.recentActivity.length ? (
              <ol className="flex max-h-44 flex-col divide-y overflow-y-auto">
                {data.recentActivity.map((row) => (
                  <li key={row.key} className="flex min-w-0 flex-col gap-1 py-3">
                    <p className="break-words text-sm">{row.summary || "عملية إدارية مسجّلة"}</p>
                    <time className="text-xs text-muted-foreground" dateTime={row.createdAt}>
                      {activityDate(row.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>لا توجد عمليات مسجّلة</EmptyTitle>
                  <EmptyDescription>
                    ستظهر هنا العمليات التي يسجّلها الخادم عند إجراء التغييرات.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
          <CardFooter className="mt-auto">
            <Button variant="link" size="sm" render={<a href="#/admin/activity?tab=logs" />}>
              سجل العمليات
              <ChevronLeft data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      </div>
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <CompositionChart
          title="نوع الإنتاج"
          description={
            data.kinds
              ? "نفس أنواع صفحة التصفح؛ اختر النوع لعرض أعماله."
              : "يتطلب توزيع الأنواع تحديث الخادم إلى إصدار يدعم أنواع التصفح."
          }
          rows={
            data.kinds
              ? kindFilters.map((kind) => ({
                  key: kind.key,
                  value: data.kinds?.find((row) => row.key === kind.key)?.value ?? 0,
                }))
              : []
          }
          filter="kind"
        />
        <CompositionChart
          title="حالة الإصدار"
          description="مستمر: جزء صادر وآخر قادم، أو جزء يعرض الآن. القادم لم يصدر منه شيء بعد."
          rows={releaseStatuses.map((key) => ({
            key,
            value: data.statuses.find((row) => row.key === key)?.value ?? 0,
          }))}
          filter="status"
        />
      </div>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>استكشف المكتبة</h2>
          </CardTitle>
          <CardDescription>
            {number.format(data.people)} شخص · {number.format(data.studios)} استوديو. التوزيعات تشمل
            المكتبة كاملة.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <nav aria-label="اختصارات إدارة المكتبة" className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" render={<a href="#/admin/people?image=without" />}>
              صور الأشخاص الناقصة
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<a href="#/admin/studios?usage=unlinked" />}
            >
              استوديوهات بلا أعمال
            </Button>
            <Button variant="outline" size="sm" render={<a href="#/admin/images" />}>
              مكتبة الصور
            </Button>
            <Button variant="outline" size="sm" render={<a href="#/admin/json" />}>
              تحرير JSON
            </Button>
          </nav>
          <Collapsible>
            <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
              توزيع محتوى المكتبة
              <ChevronDown data-icon="inline-end" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Distribution title="لغة المشاهدة" rows={data.languages} filter="language" />
                <Distribution
                  title="استخدام الصور"
                  description="صور مختلفة لكل دور؛ قد تخدم الصورة أكثر من دور."
                  rows={data.artworkRoles}
                />
                <Distribution
                  title="الأنواع الأكثر حضورًا"
                  description="أكثر ثمانية أنواع ارتباطًا بالأعمال."
                  rows={data.genres}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </>
  );
}
function Distribution({
  title,
  description,
  rows,
  filter,
}: {
  title: string;
  description?: string;
  rows: LibraryInsights["formats"];
  filter?: string;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {rows.length ? (
        <dl className="flex flex-col divide-y">
          {rows.map((row) => (
            <div key={row.key} className="flex min-w-0 items-center justify-between gap-3 py-2">
              <dt className="min-w-0 break-words text-sm">
                {filter ? (
                  <a
                    className="underline underline-offset-4"
                    href={`#/admin/works?${filter}=${encodeURIComponent(row.key)}`}
                  >
                    {labelFor(row.key)}
                  </a>
                ) : (
                  labelFor(row.key)
                )}
              </dt>
              <dd className="shrink-0 text-sm tabular-nums">{number.format(row.value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
      )}
    </section>
  );
}

function CompositionChart({
  title,
  description,
  rows,
  filter,
}: {
  title: string;
  description: string;
  rows: LibraryInsights["formats"];
  filter: "kind" | "status";
}) {
  const chartRows = rows.map((row) => ({ ...row, label: optionLabel(row.key, labelFor(row.key)) }));
  return (
    <Card size="sm" className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {chartRows.some((row) => row.value > 0) ? (
          <ChartContainer config={chartConfig} className="h-44 w-full" dir="ltr">
            <BarChart
              accessibilityLayer
              data={chartRows}
              layout="vertical"
              margin={{ left: 0, right: 12 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={125}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="value"
                fill="var(--color-value)"
                radius={4}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="py-8 text-sm text-muted-foreground">لا توجد بيانات لهذا التوزيع بعد.</p>
        )}
      </CardContent>
      <CardFooter className="mt-auto flex-wrap gap-2">
        {chartRows.map((row) => (
          <Button
            key={row.key}
            size="sm"
            variant="ghost"
            render={<a href={compositionLink(filter, row.key)} />}
          >
            {row.label}
            <Badge variant="outline">{number.format(row.value)}</Badge>
          </Button>
        ))}
      </CardFooter>
    </Card>
  );
}

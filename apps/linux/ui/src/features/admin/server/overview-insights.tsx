import type { ServerOverview } from "@nahhasio/api-contract";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { Progress } from "@/components/ui/progress";

export type LibraryInsights = ServerOverview["insights"];
const labels = {
  animated: "رسوم متحركة",
  "live-action": "تمثيل حي",
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد",
  published: "منشور",
  archived: "مؤرشف",
  completed: "مكتمل",
  ongoing: "مستمر",
  announced: "قادم",
  unknown: "غير معروف",
  ar: "العربية",
  en: "English",
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
const chartConfig = { value: { label: "العدد", color: "var(--chart-1)" } };
function Distribution({
  title,
  description,
  rows,
  filter,
}: {
  title: string;
  description: string;
  rows: LibraryInsights["formats"];
  filter?: string;
}) {
  const data = rows.map((row) => ({ ...row, label: labelFor(row.key) }));
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.some((row) => row.value > 0) ? (
          <ChartContainer config={chartConfig} className="h-56 w-full" dir="ltr">
            <BarChart
              accessibilityLayer
              data={data}
              layout="vertical"
              margin={{ left: 0, right: 12 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={105}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={4} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
        )}
        <dl className="sr-only">
          {data.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      {filter && (
        <CardFooter className="flex-wrap gap-1">
          {data.map((row) => (
            <Button
              key={row.key}
              size="sm"
              variant="ghost"
              render={<a href={`#/admin/works?${filter}=${encodeURIComponent(row.key)}`} />}
            >
              {row.label}
              <Badge variant="outline">{row.value}</Badge>
            </Button>
          ))}
        </CardFooter>
      )}
    </Card>
  );
}
export function OverviewInsights({ data, works }: { data: LibraryInsights; works: number }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">المكتبة بالأرقام</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            بيانات المكتبة كاملة، بما فيها الأعمال الخاصة والمسودات.
          </p>
        </div>
        <Button variant="outline" render={<a href="#/admin/maintenance?tab=actions" />}>
          إجراءات المكتبة
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="lg:col-span-2" size="sm">
          <CardHeader>
            <CardTitle>إضافات المكتبة</CardTitle>
            <CardDescription>
              الأعمال المضافة في آخر ستة أشهر · حسب تاريخ إنشاء السجل
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full" dir="ltr">
              <AreaChart accessibilityLayer data={data.additions} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="key" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} width={35} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="value"
                  type="monotone"
                  fill="var(--color-value)"
                  fillOpacity={0.18}
                  stroke="var(--color-value)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
            <dl className="sr-only">
              {data.additions.map((row) => (
                <div key={row.key}>
                  <dt>{row.key}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>أولويات التحرير</CardTitle>
            <CardDescription>اضغط على النقص لفتح الأعمال التي تحتاج إلى مراجعة.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.missing.map((row) => (
              <div key={row.key} className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-between"
                  render={<a href={`#/admin/works?gap=${row.key}`} />}
                >
                  <span>{labelFor(row.key)}</span>
                  <Badge variant="outline">{row.value}</Badge>
                </Button>
                <Progress
                  aria-label={`اكتمال ${labelFor(row.key)}`}
                  value={works ? Math.round(((works - row.value) / works) * 100) : 0}
                />
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button variant="link" render={<a href="#/admin/works?gap=episode-images" />}>
              {data.episodesMissing} حلقة بلا صورة
            </Button>
          </CardFooter>
        </Card>
        <Distribution
          title="نوع الإنتاج"
          description="توزيع الأعمال حسب نوع الإنتاج"
          rows={data.formats}
          filter="format"
        />
        <Distribution
          title="حالة الإصدار"
          description="حالة العمل المحسوبة من أجزائه"
          rows={data.statuses}
          filter="status"
        />
        <Distribution
          title="حالة التحرير"
          description="من المسودة إلى النشر والأرشفة"
          rows={data.workflow}
          filter="workflow"
        />
        <Distribution
          title="لغة المشاهدة"
          description="العربية مقابل English الافتراضية"
          rows={data.languages}
          filter="language"
        />
        <Distribution
          title="استخدام الصور"
          description="عدد الصور المختلفة لكل دور؛ قد تخدم الصورة أكثر من دور"
          rows={data.artworkRoles}
        />
        <Distribution
          title="الأنواع الأكثر حضوراً"
          description="أكثر ثمانية أنواع ارتباطاً بالأعمال"
          rows={data.genres}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>ابدأ من هنا</CardTitle>
            <CardDescription>
              {data.people} شخص · {data.studios} استوديو · {data.unattachedImages} صورة غير مرتبطة
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button render={<a href="#/admin/works/new" />}>عمل جديد</Button>
            <Button variant="outline" render={<a href="#/admin/people?image=without" />}>
              صور الأشخاص الناقصة
            </Button>
            <Button variant="outline" render={<a href="#/admin/studios?usage=unlinked" />}>
              استوديوهات بلا أعمال
            </Button>
            <Button variant="outline" render={<a href="#/admin/maintenance?tab=actions" />}>
              صور الحلقات وتنظيف المكتبة
            </Button>
            <Button variant="outline" render={<a href="#/admin/json" />}>
              تحرير JSON
            </Button>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>آخر نشاط إداري</CardTitle>
            <CardDescription>آخر ثماني عمليات مسجلة</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.recentActivity.length ? (
              data.recentActivity.map((row) => (
                <div key={row.key} className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm">{row.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      <bdi>{row.action}</bdi>
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={row.createdAt}>
                    {new Intl.DateTimeFormat("ar", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(row.createdAt))}
                  </time>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد عمليات مسجلة.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="link" render={<a href="#/admin/activity?tab=logs" />}>
              سجل العمليات
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}

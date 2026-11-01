import type { ServerOverview } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, Film, Images, Plus, RefreshCw, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

import { formatAdminBytes as bytes } from "../format";
import { OverviewInsights } from "./overview-insights";
import { serverOverviewQuery } from "./queries";

const number = new Intl.NumberFormat("ar");
const clock = new Intl.DateTimeFormat("ar", { hour: "numeric", minute: "2-digit" });
export function ServerOverviewPage() {
  const overview = useQuery(serverOverviewQuery());
  return (
    <article
      className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-5 p-4 pb-10 sm:p-6"
      aria-label="نظرة عامة على الإدارة"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">نظرة عامة</h1>
          <p className="text-sm text-muted-foreground">تابع مكتبتك، وابدأ بما يحتاج إلى اهتمام.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void overview.refetch()}
            disabled={overview.isFetching}
          >
            <RefreshCw data-icon="inline-start" />
            {overview.isFetching ? "جارٍ التحديث…" : "تحديث الحالة"}
          </Button>
          <Button size="sm" render={<a href="#/admin/works/new" />}>
            <Plus data-icon="inline-start" />
            عمل جديد
          </Button>
        </div>
      </header>
      {overview.isPending ? (
        <div className="flex flex-col gap-4" aria-label="جارٍ تحميل نظرة عامة" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : overview.isError && !overview.data ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل نظرة عامة</AlertTitle>
          <AlertDescription>
            <p>تحقق من الاتصال وصلاحية حساب المدير. يمكنك إعادة المحاولة دون تغيير بيانات المكتبة.</p>
            <Button variant="outline" size="sm" onClick={() => void overview.refetch()}>
              إعادة المحاولة
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        overview.data && (
          <>
            {overview.isError && (
              <Alert variant="destructive">
                <AlertTitle>تعذّر تحديث الحالة</AlertTitle>
                <AlertDescription>
                  البيانات المعروضة من آخر قراءة ناجحة؛ أعد المحاولة للحصول على الحالة الحالية.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span>{overview.data.server.name}</span>
                <Badge variant="outline">{overview.isError ? "بيانات سابقة" : "متصل"}</Badge>
                <span>PostgreSQL · متصلة عند آخر قراءة</span>
              </div>
              <p role="status">
                آخر تحديث{" "}
                <time dateTime={new Date(overview.dataUpdatedAt).toISOString()}>
                  {clock.format(overview.dataUpdatedAt)}
                </time>{" "}
                · يتجدد كل ٣٠ ثانية
              </p>
            </div>
            <Readiness data={overview.data} />
            <section className="grid min-w-0 gap-3 md:grid-cols-3" aria-label="ملخص المكتبة">
              {[
                {
                  label: "الأعمال",
                  value: overview.data.counts.works,
                  description: `${number.format(overview.data.counts.installments)} موسم وفيلم · ${number.format(overview.data.counts.episodes)} حلقة`,
                  icon: Film,
                  href: "#/admin/works",
                },
                {
                  label: "مكتبة الصور",
                  value: overview.data.counts.artwork,
                  description: `${bytes(overview.data.counts.artworkBytes)} مسجلة · ${number.format(overview.data.insights.unattachedImages)} صورة غير مرتبطة`,
                  icon: Images,
                  href: "#/admin/images",
                },
                {
                  label: "الحسابات النشطة",
                  value: overview.data.counts.accounts,
                  description: `${number.format(overview.data.counts.sessions)} جلسة صالحة مسجّلة، وليست حالة اتصال مباشر`,
                  icon: Users,
                  href: "#/admin/accounts",
                },
              ].map(({ label, value, description, icon: Icon, href }) => (
                <Item key={label} variant="outline" render={<a href={href} />}>
                  <ItemMedia variant="icon">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {label}
                      <span className="text-2xl font-semibold tabular-nums">
                        {number.format(value)}
                      </span>
                    </ItemTitle>
                    <ItemDescription>{description}</ItemDescription>
                  </ItemContent>
                  <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                </Item>
              ))}
            </section>
            <OverviewInsights data={overview.data.insights} works={overview.data.counts.works} />
            <ServerDetails data={overview.data} />
          </>
        )
      )}
    </article>
  );
}
function Readiness({ data }: { data: ServerOverview }) {
  const failed = data.checks.filter((check) => !check.ok);
  const attention = !data.schema.compatible || failed.length > 0;
  if (!attention) return null;
  return (
    <Collapsible>
      <Alert variant={data.schema.compatible ? "default" : "destructive"}>
        <AlertTitle>
          <CollapsibleTrigger
            aria-label="فحوص تجهيز الخادم"
            render={<Button variant="ghost" size="sm" className="h-auto w-full justify-between" />}
          >
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span>
                {data.schema.compatible
                  ? "الخادم يحتاج إلى تجهيز"
                  : "قاعدة البيانات تحتاج إلى مراجعة"}
              </span>
              {failed.length > 0 && (
                <Badge variant="outline">{number.format(failed.length)} فحص</Badge>
              )}
            </span>
            <ChevronDown data-icon="inline-end" />
          </CollapsibleTrigger>
        </AlertTitle>
        {!data.schema.compatible && (
          <AlertDescription>توجد مشكلة في المخطط أو ترقيات معلّقة؛ لا تُنفّذ تلقائيًا.</AlertDescription>
        )}
        <CollapsibleContent>
          <Checks data={data} />
        </CollapsibleContent>
      </Alert>
    </Collapsible>
  );
}
function Checks({ data }: { data: ServerOverview }) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-xs text-muted-foreground">
        فحوص قراءة أولية؛ لا تختبر تشغيل الفيديو أو اتصال المصادر أو استعادة النسخ.
      </p>
      <dl className="flex flex-col divide-y">
        {data.checks.map((check) => (
          <div key={check.key} className="flex flex-col gap-2 py-3">
            <dt className="flex flex-wrap items-start justify-between gap-2">
              <span>{check.label}</span>
              <Badge variant={check.ok ? "secondary" : "outline"}>
                {check.ok ? "اجتاز الفحص الأولي" : "يحتاج إلى تجهيز"}
              </Badge>
            </dt>
            <dd className="text-sm text-muted-foreground">{check.detail}</dd>
          </div>
        ))}
      </dl>
      {!data.checks.length && (
        <p className="text-sm text-muted-foreground">لم تُعد الخدمة نتائج فحوص التجهيز.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" render={<a href="#/admin/settings" />}>
          إعدادات الخادم
        </Button>
        <Button size="sm" variant="outline" render={<a href="#/admin/maintenance" />}>
          صيانة الخادم
        </Button>
      </div>
    </div>
  );
}
function ServerDetails({ data }: { data: ServerOverview }) {
  return (
    <Collapsible className="min-w-0">
      <CollapsibleTrigger
        aria-label="تفاصيل الخادم"
        render={<Button variant="outline" className="w-full justify-between" />}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span>الخادم والتشغيل</span>
          <Badge variant="secondary">
            <bdi>{data.version}</bdi>
          </Badge>
        </span>
        <ChevronDown data-icon="inline-end" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pt-4">
        <dl className="grid min-w-0 gap-x-6 sm:grid-cols-2">
          {[
            ["الإصدار", data.version],
            ["واجهة API", number.format(data.apiVersion)],
            [
              "وقت التشغيل",
              `${number.format(Math.floor(data.uptimeSeconds / 3600))} ساعة و${number.format(Math.floor(data.uptimeSeconds / 60) % 60)} دقيقة`,
            ],
            ["حجم قاعدة البيانات", bytes(data.counts.databaseBytes)],
            ["مخطط البيانات", data.schema.compatible ? "متوافق" : "يحتاج إلى مراجعة"],
            [
              "الترقيات المطبّقة",
              data.schema.applied === null ? "تعذّر التحقق" : number.format(data.schema.applied),
            ],
            [
              "الترقيات المعلّقة",
              data.schema.pending === null ? "تعذّر التحقق" : number.format(data.schema.pending),
            ],
            ["هوية الخادم", data.server.id],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b py-2.5"
            >
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-all text-sm">
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        {data.schema.compatible && data.checks.every((check) => check.ok) && <Checks data={data} />}
      </CollapsibleContent>
    </Collapsible>
  );
}

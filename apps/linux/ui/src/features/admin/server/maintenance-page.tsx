import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ChevronDown,
  ClipboardCheck,
  Download,
  Images,
  RefreshCw,
  Server,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

import { WorkspacePage, WorkspaceNavigation } from "../workspace";
import { ClientUpdateCard } from "./client-update-card";
import { LibraryActions } from "./library-actions";
import { ServerMaintenance } from "./maintenance";
import { operationLabel, stateLabel } from "./maintenance-model";
import { serverOperationsQuery, serverOverviewQuery } from "./queries";

const sections = [
  { value: "actions", label: "أدوات المكتبة", icon: Images },
  { value: "backups", label: "النسخ والاستعادة", icon: Archive },
  { value: "updates", label: "التحديثات", icon: Download },
  { value: "validation", label: "الفحوص والسلامة", icon: ClipboardCheck },
] as const;
export function MaintenancePage({ tab }: { tab: string }) {
  const selected = sections.find((section) => section.value === tab)?.value ?? "actions";
  const status = useQuery(serverOperationsQuery());
  const client = useQueryClient();
  const job = status.data?.activeJob ?? status.data?.lastJob;
  return (
    <WorkspacePage
      title="صيانة الخادم"
      description="حافظ على مكتبتك، وراجع كل تغيير قبل تنفيذه."
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={status.isFetching}
          onClick={() => {
            void status.refetch();
            void client.invalidateQueries({ queryKey: serverOverviewQuery().queryKey });
            if (selected === "updates")
              void client.invalidateQueries({ queryKey: ["device", "client-update"] });
          }}
        >
          <RefreshCw data-icon="inline-start" />
          تحديث الحالة
        </Button>
      }
    >
      <WorkspaceNavigation
        section="maintenance"
        label="أقسام الصيانة"
        selected={selected}
        items={sections}
      />
      <div className="flex flex-col gap-2">
        <Item size="sm" variant="muted">
          <ItemMedia variant="icon">
            <Server />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              خدمة صيانة الخادم
              <Badge variant={status.data?.available ? "secondary" : "outline"}>
                {status.isPending
                  ? "جارٍ الفحص…"
                  : status.isError
                    ? "تعذّر الاتصال"
                    : status.data?.available
                      ? "متاحة"
                      : "غير مُعدّة"}
              </Badge>
            </ItemTitle>
            <ItemDescription>
              {status.data?.available
                ? "النسخ والاستعادة والتحديثات تنفّذ على جهاز الخادم، وتستمر بعد إغلاق التطبيق."
                : "تتطلب النسخ والاستعادة والتحديثات خدمة الصيانة. أدوات المكتبة مستقلة عنها."}
            </ItemDescription>
          </ItemContent>
        </Item>
        {status.isError && (
          <p className="text-sm text-muted-foreground">
            تعذّرت قراءة حالة الخدمة؛ أعد تحديث الحالة. لا تبدأ هذه الصفحة عمليات صيانة تلقائيًا.
          </p>
        )}
        {status.data && !status.data.available && (
          <Collapsible>
            <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
              ما المطلوب لتفعيلها؟
              <ChevronDown data-icon="inline-end" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pt-2">
              <p className="text-sm text-muted-foreground">
                تُجهّز خدمة صيانة نحّاسيو على جهاز الخادم مع مجلد نسخ خاص وصلاحيات التشغيل المناسبة. لا
                يلزم تشغيلها لاستخدام أدوات الصور ومراجعة بيانات المكتبة.
              </p>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
      {job && (
        <Alert variant={job.state === "failed" ? "destructive" : "default"}>
          <AlertTitle>
            {status.isError
              ? "آخر حالة مقروءة"
              : status.data?.activeJob
                ? "العملية الحالية"
                : "آخر عملية"}
            : {operationLabel(job.operation)} · {stateLabel(job.state)}
          </AlertTitle>
          <AlertDescription>
            <p>{job.message || "حدّث الحالة لمتابعة نتيجة العملية."}</p>
            {status.data?.activeJob && (
              <p>تستمر العملية على الخادم إذا غادرت الصفحة. تُتاح العمليات الأخرى بعد انتهائها.</p>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div key={selected} className="min-w-0">
        {selected === "actions" && <LibraryActions />}
        {selected === "backups" && <ServerMaintenance view="backups" status={status} />}
        {selected === "updates" && (
          <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
            <ServerMaintenance view="updates" status={status} />
            <ClientUpdateCard />
          </div>
        )}
        {selected === "validation" && <ValidationPanel />}
      </div>
    </WorkspacePage>
  );
}
function ValidationPanel() {
  const overview = useQuery(serverOverviewQuery());
  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>فحوص التجهيز الحالية</h2>
          </CardTitle>
          <CardDescription>
            قراءة إعدادات الخادم وسجل المخطط. لا تفحص كل ملف ولا تنفّذ إصلاحًا.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.isPending ? (
            <Skeleton className="h-32" />
          ) : overview.isError ? (
            <Alert variant="destructive">
              <AlertTitle>تعذّر تحميل الفحوص</AlertTitle>
              <AlertDescription>
                {overview.error.message}
                <Button variant="outline" size="sm" onClick={() => void overview.refetch()}>
                  إعادة المحاولة
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-3">
              <Item size="sm" variant="outline">
                <ItemContent>
                  <ItemTitle>مخطط البيانات</ItemTitle>
                  <ItemDescription>
                    {overview.data.schema.compatible
                      ? "يتوافق السجل مع إصدار الخادم الحالي."
                      : "يتطلب السجل مراجعة؛ لا تُنفّذ ترقية تلقائيًا."}
                  </ItemDescription>
                </ItemContent>
                <Badge variant={overview.data.schema.compatible ? "secondary" : "destructive"}>
                  {overview.data.schema.compatible ? "متوافق" : "يحتاج إلى مراجعة"}
                </Badge>
              </Item>
              <dl className="flex flex-col divide-y">
                {overview.data.checks.map((check) => (
                  <div key={check.key} className="flex flex-col gap-2 py-3">
                    <dt className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm font-medium">{check.label}</span>
                      <Badge variant={check.ok ? "secondary" : "outline"}>
                        {check.ok ? "اجتاز الفحص الأولي" : "يحتاج إلى تجهيز"}
                      </Badge>
                    </dt>
                    <dd className="text-sm text-muted-foreground">{check.detail}</dd>
                  </div>
                ))}
              </dl>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                render={<a href="#/admin/settings" />}
              >
                إعدادات الخادم
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>الفحص المتقدم والإصلاح</h2>
          </CardTitle>
          <CardDescription>الأدوات التالية قادمة؛ لن تغيّر شيئًا في المكتبة الآن.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>
                سلامة ملفات الصور<Badge variant="outline">قريبًا</Badge>
              </ItemTitle>
              <ItemDescription>فحص وجود الملفات وبصماتها وإظهار تقرير بالمشكلات.</ItemDescription>
              {/* TODO(admin-artwork-integrity): Add a bounded, read-only file-integrity job and reviewable report before enabling. */}
              <Button variant="outline" size="sm" disabled>
                فحص الملفات
              </Button>
            </ItemContent>
          </Item>
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>
                مراجعة علاقات البيانات<Badge variant="outline">قريبًا</Badge>
              </ItemTitle>
              <ItemDescription>
                تقرير بالعلاقات غير المتسقة، ثم معاينة الإصلاح قبل تأكيده.
              </ItemDescription>
              {/* TODO(admin-relational-repair): Implement scoped inspection, preview and audited transactional repairs before enabling. */}
              <Button variant="outline" size="sm" disabled>
                معاينة الإصلاح
              </Button>
            </ItemContent>
          </Item>
        </CardContent>
      </Card>
    </div>
  );
}

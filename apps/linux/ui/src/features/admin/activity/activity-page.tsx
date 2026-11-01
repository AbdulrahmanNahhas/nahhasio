import type { DatabasePage } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, Clock3, ListChecks, RefreshCw, Search } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { gateway } from "@/lib/bridge";

import { formatAdminDate } from "../format";
import { operationLabel, stateLabel } from "../server/maintenance-model";
import { serverOperationsQuery } from "../server/queries";
import { Facts, ReadFailure, RecordsPager, WorkspaceNavigation, WorkspacePage } from "../workspace";
import {
  activityOptions,
  actionLabel,
  jobStateLabel,
  jobStates,
  type BackgroundJob,
  type AuditRecord,
} from "./activity-data";

const sections = [
  { value: "jobs", label: "المهام", icon: ListChecks },
  { value: "logs", label: "سجل العمليات", icon: Clock3 },
];
type Selection =
  | { kind: "jobs"; record: BackgroundJob; raw: DatabasePage["rows"][number] }
  | { kind: "logs"; record: AuditRecord; raw: DatabasePage["rows"][number] };
export function ActivityPage({ tab }: { tab: string }) {
  const view = tab === "logs" ? "logs" : "jobs";
  const search = useSearch({ from: "/admin/$section" });
  const navigate = useNavigate({ from: "/admin/$section" });
  const filters = {
    q: search.q ?? "",
    page: Number(search.page ?? 1),
    jobState: search.jobState ?? "all",
    order: search.order ?? "newest",
  };
  const change = (patch: Partial<typeof filters>) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...patch,
        page: String(patch.page ?? filters.page),
      }),
    });
  };
  return (
    <WorkspacePage
      title="نشاط الخادم"
      description="تابع المهام وراجع ما تغيّر في المكتبة، دون تشغيل عمليات من هذه الصفحة."
    >
      <WorkspaceNavigation
        section="activity"
        label="أقسام نشاط الخادم"
        selected={view}
        items={sections}
      />
      {view === "jobs" && <MaintenanceActivity />}
      <ActivityRecords
        key={`${view}:${filters.q}:${filters.page}:${filters.jobState}:${filters.order}`}
        view={view}
        filters={filters}
        onChange={change}
      />
    </WorkspacePage>
  );
}
function MaintenanceActivity() {
  const status = useQuery(serverOperationsQuery());
  const job = status.data?.activeJob ?? status.data?.lastJob;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>صيانة جهاز الخادم</h2>
        </CardTitle>
        <CardDescription>
          النسخ والاستعادة والتحديثات لها سجل مستقل عن مهام قاعدة البيانات أدناه.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status.isPending ? (
          <Skeleton className="h-16" />
        ) : status.error ? (
          <ReadFailure error={status.error} retry={() => void status.refetch()} />
        ) : job ? (
          <Item variant="outline">
            <ItemContent>
              <ItemTitle>
                {operationLabel(job.operation)}
                <Badge variant={job.state === "failed" ? "destructive" : "secondary"}>
                  {stateLabel(job.state)}
                </Badge>
              </ItemTitle>
              <ItemDescription>{job.message || "لا توجد رسالة تفصيلية مسجّلة."}</ItemDescription>
            </ItemContent>
          </Item>
        ) : (
          <p className="text-sm text-muted-foreground">
            {status.data.available
              ? "لا توجد عملية صيانة مسجّلة بعد."
              : "خدمة صيانة الجهاز غير مُعدّة لهذا الخادم."}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          render={<a href="#/admin/maintenance" />}
        >
          فتح صيانة الخادم
          <ChevronLeft data-icon="inline-end" />
        </Button>
      </CardContent>
    </Card>
  );
}
type ActivityFilters = {
  q: string;
  page: number;
  jobState: "all" | "queued" | "running" | "completed" | "failed" | "cancelled";
  order: "newest" | "oldest";
};
function ActivityRecords({
  view,
  filters,
  onChange,
}: {
  view: "jobs" | "logs";
  filters: ActivityFilters;
  onChange: (patch: Partial<ActivityFilters>) => void;
}) {
  const [draft, setDraft] = useState(filters.q);
  const search = filters.q;
  const page = filters.page;
  const state = filters.jobState;
  const descending = filters.order === "newest";
  const [selection, setSelection] = useState<Selection | null>(null);
  const finalFocus = useRef<HTMLElement | null>(null);
  const records = useQuery(activityOptions(view, page, search, state, descending));
  return (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>{view === "jobs" ? "مهام الخلفية المسجّلة" : "سجل العمليات الإدارية"}</h2>
          </CardTitle>
          <CardDescription>
            {view === "jobs"
              ? "حالة المهمة كما سجّلها الخادم؛ وجود سجل لا يثبت أن عامل التنفيذ متصل الآن."
              : "العمليات التي سجّلها الخادم، مرتبة حسب وقتها. لا يشمل السجل كل قراءة أو مشاهدة."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onChange({ q: draft.trim(), page: 1 });
            }}
          >
            <FieldGroup className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="activity-search">
                  {view === "jobs" ? "البحث عن مهمة أو معرّف" : "البحث في سجل العمليات"}
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="activity-search"
                    value={draft}
                    maxLength={200}
                    placeholder={
                      view === "jobs" ? "نوع المهمة أو معرّفها…" : "ملخص العملية أو اسمها أو معرّفها…"
                    }
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <Button variant="outline" type="submit">
                    <Search data-icon="inline-start" />
                    بحث
                  </Button>
                </div>
              </Field>
              {view === "jobs" && (
                <Field>
                  <FieldLabel htmlFor="job-status">حالة المهمة</FieldLabel>
                  <Choice
                    id="job-status"
                    label="حالة المهمة"
                    value={state}
                    options={jobStates}
                    onChange={(value) => {
                      const choice = jobStates.find((item) => item.value === value);
                      if (choice) onChange({ jobState: choice.value, page: 1 });
                    }}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="activity-order">الترتيب</FieldLabel>
                <Choice
                  id="activity-order"
                  label="الترتيب"
                  value={descending ? "newest" : "oldest"}
                  options={[
                    { value: "newest", label: "الأحدث أولًا" },
                    { value: "oldest", label: "الأقدم أولًا" },
                  ]}
                  onChange={(value) => {
                    if (value === "newest" || value === "oldest") {
                      onChange({ order: value, page: 1 });
                    }
                  }}
                />
              </Field>
            </FieldGroup>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-sm text-muted-foreground">
              {records.isFetching
                ? "جارٍ تحديث السجلات…"
                : records.data
                  ? `${records.data.total.toLocaleString("ar")} سجل مطابق`
                  : "تعذّرت قراءة عدد السجلات"}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={records.isFetching}
              onClick={() => void records.refetch()}
            >
              <RefreshCw data-icon="inline-start" />
              تحديث السجلات
            </Button>
          </div>
          {records.isPending && <Skeleton className="h-40" />}
          {records.error && (
            <ReadFailure error={records.error} retry={() => void records.refetch()} />
          )}
          {records.data?.rows.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد سجلات مطابقة</EmptyTitle>
                <EmptyDescription>
                  {search || state !== "all"
                    ? "غيّر البحث أو الحالة لعرض سجلات أخرى."
                    : "ستظهر هنا السجلات عندما يضيفها الخادم."}
                </EmptyDescription>
              </EmptyHeader>
              {(search || state !== "all") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft("");
                    onChange({ q: "", jobState: "all", page: 1 });
                  }}
                >
                  مسح المرشحات
                </Button>
              )}
            </Empty>
          )}
          <div className="flex flex-col gap-2">
            {records.data?.kind === "jobs" &&
              records.data.rows.map(({ record, raw }) => (
                <Item
                  key={record.id}
                  variant="outline"
                  render={<button type="button" />}
                  aria-label={`تفاصيل المهمة ${record.type}`}
                  onClick={(event) => {
                    finalFocus.current = event.currentTarget;
                    setSelection({ kind: "jobs", record, raw });
                  }}
                >
                  <ItemContent>
                    <ItemTitle>
                      {record.type}
                      <Badge variant={record.status === "failed" ? "destructive" : "outline"}>
                        {jobStateLabel(record.status)}
                      </Badge>
                    </ItemTitle>
                    <ItemDescription>
                      {formatAdminDate(record.created_at)} · {record.attempts} من{" "}
                      {record.max_attempts} محاولات مسجّلة
                    </ItemDescription>
                    {(record.status === "running" || record.status === "queued") && (
                      <Progress
                        aria-label={`التقدم المسجّل للمهمة ${record.type}`}
                        value={record.progress}
                      />
                    )}
                  </ItemContent>
                  <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                </Item>
              ))}
            {records.data?.kind === "logs" &&
              records.data.rows.map(({ record, raw }) => (
                <Item
                  key={record.id}
                  variant="outline"
                  render={<button type="button" />}
                  aria-label={`تفاصيل العملية ${record.summary || actionLabel(record.action)}`}
                  onClick={(event) => {
                    finalFocus.current = event.currentTarget;
                    setSelection({ kind: "logs", record, raw });
                  }}
                >
                  <ItemContent>
                    <ItemTitle>{record.summary || actionLabel(record.action)}</ItemTitle>
                    <ItemDescription>
                      {actionLabel(record.action)} · {formatAdminDate(record.created_at)}
                    </ItemDescription>
                  </ItemContent>
                  <ChevronLeft className="size-4 shrink-0" aria-hidden="true" />
                </Item>
              ))}
          </div>
          {records.data && (
            <RecordsPager
              page={page}
              total={records.data.total}
              pageSize={records.data.pageSize}
              pending={records.isFetching}
              onChange={(value) => onChange({ page: value })}
            />
          )}
        </CardContent>
      </Card>
      <Drawer
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open) setSelection(null);
        }}
      >
        <DrawerContent finalFocus={finalFocus} className="mx-auto max-h-11/12 w-full max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>
              {selection?.kind === "jobs" ? "تفاصيل المهمة" : "تفاصيل العملية"}
            </DrawerTitle>
            <DrawerDescription>
              قراءة للسجل الذي فتحته؛ لا تغيّر هذه الصفحة حالته أو بياناته.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 sm:px-6">
            {selection && <RecordDetails selection={selection} />}
          </div>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" />}>إغلاق</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
const accountNameSchema = z.object({ id: z.string(), display_name: z.string() });
function Actor({ id }: { id: string | null }) {
  const account = useQuery({
    queryKey: ["admin", "activity-actor", id],
    enabled: Boolean(id),
    staleTime: 60000,
    retry: false,
    queryFn: async ({ signal }) => {
      const data = await gateway.databaseRows("accounts", 1, "", signal, {
        column: "id",
        value: id ?? "",
      });
      return (
        data.rows.map((row) => accountNameSchema.parse(row)).find((row) => row.id === id)
          ?.display_name ?? null
      );
    },
  });
  return (
    <>
      {!id
        ? "دون حساب مرتبط"
        : account.isPending
          ? "جارٍ قراءة الحساب…"
          : account.error
            ? "تعذّرت قراءة اسم الحساب"
            : (account.data ?? "حساب غير متاح")}
    </>
  );
}
function RecordDetails({ selection }: { selection: Selection }) {
  const record = selection.record;
  return (
    <>
      {selection.kind === "jobs" ? (
        <>
          <Facts
            entries={[
              ["نوع المهمة", selection.record.type],
              ["الحالة", jobStateLabel(selection.record.status)],
              ["التقدم المسجّل", `${selection.record.progress}%`],
              ["المحاولات", `${selection.record.attempts} / ${selection.record.max_attempts}`],
              ["أنشأها", <Actor key="actor" id={selection.record.created_by_account_id} />],
              ["تاريخ التسجيل", formatAdminDate(selection.record.created_at)],
              ["موعد التنفيذ المسجّل", formatAdminDate(selection.record.run_after)],
              [
                "بدأت",
                selection.record.started_at
                  ? formatAdminDate(selection.record.started_at)
                  : "لم يُسجّل بدء",
              ],
              [
                "انتهت",
                selection.record.finished_at
                  ? formatAdminDate(selection.record.finished_at)
                  : "لم يُسجّل انتهاء",
              ],
            ]}
          />
          {selection.record.error && (
            <Alert variant="destructive">
              <AlertTitle>الخطأ المسجّل</AlertTitle>
              <AlertDescription>{selection.record.error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            {/* TODO(admin-job-retry): Add reviewed, idempotent server-authorized retry before enabling. */}
            <Button size="sm" variant="outline" disabled>
              إعادة محاولة المهمة
            </Button>
            {/* TODO(admin-job-cancel): Add authorized cancellation with worker acknowledgement before enabling. */}
            <Button size="sm" variant="outline" disabled>
              طلب إلغاء المهمة
            </Button>
          </div>
        </>
      ) : (
        <Facts
          entries={[
            ["العملية", actionLabel(selection.record.action)],
            ["وصف السجل", selection.record.summary || "دون وصف"],
            ["الحساب", <Actor key="actor" id={selection.record.actor_account_id} />],
            ["نوع الهدف", selection.record.target_type],
            ["معرّف الهدف", selection.record.target_id || "دون معرّف"],
            ["التاريخ", formatAdminDate(selection.record.created_at)],
          ]}
        />
      )}
      <Collapsible className="shrink-0">
        <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
          البيانات المسجّلة كاملة
          <ChevronDown data-icon="inline-end" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <p className="mb-3 text-xs text-muted-foreground">
            الحقول السرية تحجبها خدمة الخادم. قد تكون القيم الكبيرة مختصرة.
          </p>
          <pre dir="ltr" className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(selection.raw, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
      <p className="break-all text-xs text-muted-foreground">
        معرّف السجل: <bdi>{record.id}</bdi>
      </p>
    </>
  );
}

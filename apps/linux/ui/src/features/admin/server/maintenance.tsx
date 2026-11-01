import type {
  ServerBackup,
  ServerOperationRequest,
  ServerOperations,
} from "@nahhasio/api-contract";
import { useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Archive, Download, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldContent,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { gateway } from "@/lib/bridge";

import { formatAdminDate as date, formatAdminBytes as size } from "../format";
import { stateLabel } from "./maintenance-model";
import { serverOperationsQuery } from "./queries";

const operationsKey = serverOperationsQuery().queryKey;
function Failure({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>تعذّرت العملية</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export function ServerMaintenance({
  view,
  status,
}: {
  view: "backups" | "updates";
  status: UseQueryResult<ServerOperations>;
}) {
  const client = useQueryClient();
  const [restore, setRestore] = useState<ServerBackup | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [updateReview, setUpdateReview] = useState(false);
  const action = useMutation({
    mutationFn: (input: Omit<ServerOperationRequest, "id">) =>
      gateway.requestServerOperation({ id: crypto.randomUUID(), ...input }),
    onSuccess: () => {
      setRestore(null);
      setUpdateReview(false);
      setConfirmation("");
      void client.invalidateQueries({ queryKey: operationsKey });
    },
  });
  const busy = action.isPending || Boolean(status.data?.activeJob);
  if (status.isPending) return <Skeleton className="h-64 w-full" aria-busy="true" />;
  if (status.isError)
    return (
      <div className="flex flex-col gap-4">
        <Failure error={status.error} />
        <p className="text-sm text-muted-foreground">
          قد يتوقف الاتصال أثناء الصيانة. تبقى العملية محفوظة على الخادم؛ أعد الاتصال لقراءة نتيجتها.
        </p>
        <Button variant="outline" onClick={() => void status.refetch()}>
          إعادة الاتصال
        </Button>
      </div>
    );
  const data = status.data;
  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      {action.isError && <Failure error={action.error} />}
      {action.isSuccess && (
        <p role="status" className="text-sm text-muted-foreground">
          أُرسل الطلب إلى الخادم؛ تابع نتيجته من حالة العملية. تستمر الصيانة بعد إغلاق التطبيق.
        </p>
      )}
      {view === "backups" ? (
        <Card size="sm">
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>
                <h2>النسخ الاحتياطية</h2>
              </CardTitle>
              <CardDescription>
                قاعدة البيانات والصور والإعدادات الخاصة، محفوظة على جهاز الخادم.
              </CardDescription>
            </div>
            <CardAction>
              <Button
                size="sm"
                disabled={!data.available || busy}
                onClick={() => action.mutate({ operation: "backup" })}
              >
                <Archive data-icon="inline-start" />
                إنشاء نسخة الآن
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">النسخ المتاحة للاستعادة</p>
              <Badge variant="secondary">
                {new Intl.NumberFormat("ar").format(data.backups.length)} نسخة
              </Badge>
            </div>
            {data.backups.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>لا توجد نسخ احتياطية بعد</EmptyTitle>
                  <EmptyDescription>
                    {data.available
                      ? "أنشئ أول نسخة قبل إجراء تغييرات كبيرة على الخادم."
                      : "تظهر النسخ هنا بعد تجهيز خدمة الصيانة وإنشاء أول نسخة."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {data.backups
                  .toSorted(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                  )
                  .map((backup) => (
                    <Collapsible key={backup.id}>
                      <Item variant="outline">
                        <ItemContent>
                          <ItemTitle>
                            <time dateTime={backup.createdAt}>{date(backup.createdAt)}</time>
                          </ItemTitle>
                          <ItemDescription>
                            {size(backup.byteSize)} · الإصدار <bdi>{backup.version}</bdi>
                          </ItemDescription>
                          <CollapsibleTrigger
                            render={<Button variant="ghost" size="sm" className="w-fit" />}
                          >
                            تفاصيل النسخة
                          </CollapsibleTrigger>
                        </ItemContent>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`استعادة نسخة ${date(backup.createdAt)}`}
                          disabled={!data.available || busy}
                          onClick={() => {
                            action.reset();
                            setRestore(backup);
                            setConfirmation("");
                          }}
                        >
                          <RotateCcw data-icon="inline-start" />
                          استعادة
                        </Button>
                      </Item>
                      <CollapsibleContent className="px-4 pt-3">
                        <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                          {[
                            ["معرّف النسخة", backup.id],
                            ["سبب الإنشاء", backup.reason],
                            ["مخطط البيانات", backup.schema],
                          ].map(([label, value]) => (
                            <div key={label} className="flex min-w-0 flex-col gap-1">
                              <dt className="text-muted-foreground">{label}</dt>
                              <dd className="break-all">
                                <bdi>{value}</bdi>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
              </div>
            )}
            <Collapsible>
              <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                خيارات النسخ القادمة
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <FieldGroup>
                  <Field orientation="horizontal" data-disabled>
                    <FieldContent>
                      <FieldLabel htmlFor="scheduled-backups">
                        نسخ احتياطية مجدولة <Badge variant="outline">قريبًا</Badge>
                      </FieldLabel>
                      <FieldDescription>مواعيد دورية دون الحاجة إلى فتح التطبيق.</FieldDescription>
                    </FieldContent>
                    {/* TODO(server-backup-schedule): Add server-owned scheduling, timezone and persisted policy before enabling. */}
                    <Switch id="scheduled-backups" disabled checked={false} />
                  </Field>
                  <Field data-disabled>
                    <FieldLabel htmlFor="backup-retention">
                      عدد النسخ المحتفَظ بها <Badge variant="outline">قريبًا</Badge>
                    </FieldLabel>
                    {/* TODO(server-backup-retention): Add reviewed retention rules that protect recovery and upgrade backups. */}
                    <Input
                      id="backup-retention"
                      type="number"
                      min={1}
                      disabled
                      placeholder="لم تُضبط سياسة احتفاظ"
                    />
                  </Field>
                </FieldGroup>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              حفظ النسخة على الخادم لا يحميها من فقدان الجهاز نفسه. الاستعادة تستبدل البيانات الحالية
              وتحتاج إلى تأكيد منفصل.
            </p>
          </CardFooter>
        </Card>
      ) : (
        <Card size="sm" className="flex h-full flex-col">
          <CardHeader>
            <CardTitle>
              <h2>تحديث الخادم</h2>
            </CardTitle>
            <CardDescription>
              يُتحقق من توقيع الإصدار وتوافق مخطط البيانات قبل استبدال التطبيق.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <dl className="flex flex-col gap-3">
              <div className="flex flex-wrap justify-between gap-2">
                <dt>الإصدار المثبّت</dt>
                <dd>
                  <bdi>{data.update.currentVersion}</bdi>
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt>الحالة</dt>
                <dd>
                  <Badge variant="secondary">{stateLabel(data.update.state)}</Badge>
                </dd>
              </div>
              {data.update.availableVersion && (
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>الإصدار المتاح</dt>
                  <dd>
                    <bdi>{data.update.availableVersion}</bdi>
                  </dd>
                </div>
              )}
            </dl>
            {data.update.message && (
              <p className="mt-4 text-sm text-muted-foreground">{data.update.message}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!data.available || busy}
              onClick={() => action.mutate({ operation: "check-update" })}
            >
              <RefreshCw data-icon="inline-start" />
              فحص التحديثات
            </Button>
            <Button
              disabled={!data.available || busy || data.update.state !== "available"}
              onClick={() => {
                action.reset();
                setUpdateReview(true);
              }}
            >
              <Download data-icon="inline-start" />
              تثبيت التحديث
            </Button>
          </CardFooter>
        </Card>
      )}
      <AlertDialog
        open={restore !== null}
        onOpenChange={(open) => {
          if (!open && !action.isPending) setRestore(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>استعادة نسخة الخادم</AlertDialogTitle>
            <AlertDialogDescription>
              ستعود بيانات المكتبة والصور وإعدادات المزوّدين إلى النسخة المحددة، وتُستبدل التغييرات
              اللاحقة. تُنشأ نسخة للحالة الحالية أولاً. قد تحتاج إلى تسجيل الدخول مجدداً بعد الاستعادة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restore && (
            <FieldGroup>
              <p>
                {date(restore.createdAt)} · <bdi>{restore.version}</bdi> · {size(restore.byteSize)}
              </p>
              <Field>
                <FieldLabel htmlFor="restore-confirmation">
                  اكتب معرّف النسخة للتأكيد: <bdi>{restore.id}</bdi>
                </FieldLabel>
                <Input
                  id="restore-confirmation"
                  dir="ltr"
                  autoComplete="off"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={action.isPending}
                />
              </Field>
            </FieldGroup>
          )}
          {action.isError && <Failure error={action.error} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.isPending}>إلغاء</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={
                !restore ||
                confirmation !== restore.id ||
                busy ||
                !data.available ||
                !data.backups.some((backup) => backup.id === restore.id)
              }
              onClick={() => {
                if (restore)
                  action.mutate({ operation: "restore", backupId: restore.id, confirmation });
              }}
            >
              استعادة النسخة
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={updateReview}
        onOpenChange={(open) => {
          if (!action.isPending) setUpdateReview(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تثبيت تحديث الخادم</AlertDialogTitle>
            <AlertDialogDescription>
              قد يتوقف الاتصال مؤقتًا أثناء التحديث. يتحقق الخادم من توقيع الإصدار وتوافق البيانات،
              وتستمر العملية بعد إغلاق التطبيق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt>الإصدار المثبّت</dt>
              <dd>
                <bdi>{data.update.currentVersion}</bdi>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>الإصدار الجديد</dt>
              <dd>
                <bdi>{data.update.availableVersion ?? "غير متاح"}</bdi>
              </dd>
            </div>
          </dl>
          {action.isError && <Failure error={action.error} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.isPending}>إلغاء</AlertDialogCancel>
            <Button
              disabled={busy || !data.available || data.update.state !== "available"}
              onClick={() => action.mutate({ operation: "update" })}
            >
              تأكيد تثبيت التحديث
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

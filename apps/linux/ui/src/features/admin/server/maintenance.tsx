import type { ServerBackup, ServerOperationRequest } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { gateway } from "@/lib/bridge";

const operationsKey = ["admin", "server", "operations"];
const date = (value: string) => new Date(value).toLocaleString("ar");
const size = (value: number) =>
  `${new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(value / 1048576)} م.ب`;
const stateLabels = new Map<string, string>(
  Object.entries({
    queued: "في الانتظار",
    running: "قيد التنفيذ",
    succeeded: "اكتملت",
    failed: "تعذّرت العملية",
    current: "محدّث",
    available: "تحديث متاح",
    staged: "جاهز لإعادة التشغيل",
    unchecked: "لم يُفحص بعد",
    "maintenance-required": "يتطلب صيانة",
    unavailable: "غير متاح",
    unmanaged: "نسخة تطوير",
    "up-to-date": "محدّث",
  }),
);
function Failure({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>تعذّرت العملية</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

export function ServerMaintenance({ view }: { view: "backups" | "updates" }) {
  const client = useQueryClient();
  const [restore, setRestore] = useState<ServerBackup | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const status = useQuery({
    queryKey: operationsKey,
    queryFn: ({ signal }) => gateway.serverOperations(signal),
    refetchInterval: 5000,
    retry: false,
  });
  const action = useMutation({
    mutationFn: (input: Omit<ServerOperationRequest, "id">) =>
      gateway.requestServerOperation({ id: crypto.randomUUID(), ...input }),
    onSuccess: () => {
      setRestore(null);
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
  const job = data.activeJob ?? data.lastJob;
  return (
    <div className="flex flex-col gap-5">
      {!data.available && (
        <Alert>
          <AlertTitle>الصيانة غير مُعدّة لهذا الخادم</AlertTitle>
          <AlertDescription>
            تُتاح النسخ والاستعادة والتحديثات بعد تثبيت خدمة صيانة نحّاسيو على جهاز الخادم.
          </AlertDescription>
        </Alert>
      )}
      {action.isError && <Failure error={action.error} />}
      {action.isSuccess && (
        <Alert>
          <AlertTitle>أُرسل الطلب إلى الخادم</AlertTitle>
          <AlertDescription>
            تستمر العملية إذا أغلقت التطبيق. قد ينقطع الاتصال مؤقتاً أثناء الصيانة.
          </AlertDescription>
        </Alert>
      )}
      {job && (
        <Alert variant={job.state === "failed" ? "destructive" : "default"}>
          <AlertTitle>{stateLabels.get(job.state) ?? job.state}</AlertTitle>
          <AlertDescription>
            {job.message || "تابع حالة العملية هنا بعد إعادة الاتصال."}
          </AlertDescription>
        </Alert>
      )}
      {view === "backups" ? (
        <Card>
          <CardHeader>
            <CardTitle>النسخ الاحتياطية</CardTitle>
            <CardDescription>
              قاعدة البيانات والصور وإعدادات الخادم الخاصة. تبقى النسخ على جهاز الخادم.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {data.backups.length === 0 && (
                <p className="text-sm text-muted-foreground">لم تُنشأ نسخة مكتملة بعد.</p>
              )}
              {data.backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p>{date(backup.createdAt)}</p>
                    <p className="text-sm text-muted-foreground">
                      {size(backup.byteSize)} · <bdi>{backup.version}</bdi>
                    </p>
                    <p className="break-all text-xs text-muted-foreground">
                      <bdi>{backup.id}</bdi>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!data.available || busy}
                    onClick={() => {
                      setRestore(backup);
                      setConfirmation("");
                    }}
                  >
                    <RotateCcw data-icon="inline-start" />
                    استعادة
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              disabled={!data.available || busy}
              onClick={() => action.mutate({ operation: "backup" })}
            >
              <Archive data-icon="inline-start" />
              إنشاء نسخة الآن
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>تحديث الخادم</CardTitle>
            <CardDescription>
              يُتحقق من توقيع الإصدار وتوافق مخطط البيانات قبل استبدال التطبيق.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                  <Badge variant="secondary">
                    {stateLabels.get(data.update.state) ?? data.update.state}
                  </Badge>
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
              onClick={() => action.mutate({ operation: "update" })}
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.isPending}>إلغاء</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!restore || confirmation !== restore.id || action.isPending}
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
    </div>
  );
}

export function ClientUpdateCard() {
  const status = useQuery({
    queryKey: ["device", "client-update"],
    queryFn: ({ signal }) => gateway.clientUpdateStatus(signal),
    staleTime: Infinity,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>تحديث تطبيق Linux</CardTitle>
        <CardDescription>تُدار النسخة المثبّتة من خلال نظام البرمجيات على هذا الجهاز.</CardDescription>
      </CardHeader>
      <CardContent>
        {status.isPending ? (
          <Skeleton className="h-12 w-full" />
        ) : status.isError ? (
          <Failure error={status.error} />
        ) : (
          <div className="flex flex-col gap-2">
            <p>
              الإصدار <bdi>{status.data.currentVersion}</bdi>
            </p>
            <p className="text-sm text-muted-foreground">{status.data.message}</p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          افتح تطبيق «البرمجيات» في النظام ثم صفحة التحديثات لإدارة إصدار نحّاسيو.
        </p>
      </CardFooter>
    </Card>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { gateway } from "@/lib/bridge";

import { stateLabel } from "./maintenance-model";

const updateKey = ["device", "client-update"];

export function ClientUpdateCard() {
  const client = useQueryClient();
  const status = useQuery({
    queryKey: updateKey,
    queryFn: ({ signal }) => gateway.clientUpdateStatus(signal),
    refetchInterval: (query) => (query.state.data?.state === "running" ? 2000 : false),
  });
  const install = useMutation({
    mutationFn: gateway.installClientUpdate,
    onSuccess: async (data) => {
      await client.cancelQueries({ queryKey: updateKey });
      client.setQueryData(updateKey, data);
    },
  });
  const flatpak = status.data?.manager === "flatpak";
  const running = install.isPending || status.data?.state === "running";
  const openManager = useMutation({ mutationFn: () => gateway.openClientUpdateManager() });
  return (
    <Card size="sm" className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>
          <h2>تحديث تطبيق Linux</h2>
        </CardTitle>
        <CardDescription>
          يتولّى Flatpak التحقق من تحديثات التطبيق وتثبيتها على هذا الجهاز.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {status.isPending ? (
          <Skeleton className="h-12 w-full" />
        ) : status.isError ? (
          <Alert variant="destructive">
            <AlertTitle>تعذّرت قراءة حالة التطبيق</AlertTitle>
            <AlertDescription>
              {status.error.message}
              <Button size="sm" variant="outline" onClick={() => void status.refetch()}>
                إعادة المحاولة
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-2" role="status">
            <Badge variant="outline">{stateLabel(status.data.state)}</Badge>
            <p>
              الإصدار <bdi>{status.data.currentVersion}</bdi>
            </p>
            <p className="text-sm text-muted-foreground">{status.data.message}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3">
        {flatpak && (
          <div className="flex flex-wrap gap-2">
            {status.data?.state !== "external-managed" && (
              <Button
                disabled={running || status.data?.state === "staged" || openManager.isPending}
                onClick={() => install.mutate()}
              >
                {running ? "جارٍ تحديث التطبيق…" : "فحص تحديث التطبيق وتثبيته"}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={running || openManager.isPending}
              onClick={() => openManager.mutate()}
            >
              فتح البرمجيات للتحديث
            </Button>
          </div>
        )}
        {install.isError && (
          <Alert variant="destructive">
            <AlertTitle>تعذّر بدء تحديث التطبيق</AlertTitle>
            <AlertDescription>{install.error.message}</AlertDescription>
          </Alert>
        )}
        {openManager.isError && (
          <Alert variant="destructive">
            <AlertTitle>تعذّر فتح مدير التحديث</AlertTitle>
            <AlertDescription>{openManager.error.message}</AlertDescription>
          </Alert>
        )}
        {openManager.isSuccess && (
          <p role="status" className="text-sm text-muted-foreground">
            أُرسل طلب فتح البرمجيات. أكمل التحديث هناك ثم أغلق نحّاسيو وأعد فتحه لبدء الإصدار الجديد.
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {status.data?.manager === "development"
            ? "تُحدّث نسخة التطوير من المشروع المحلي."
            : status.data?.manager === "external"
              ? "حدّث التطبيق من المصدر الذي ثبّتّه منه على هذا الجهاز."
              : "افتح تطبيق «البرمجيات» في النظام ثم صفحة التحديثات لإدارة إصدار نحّاسيو."}
        </p>
      </CardFooter>
    </Card>
  );
}

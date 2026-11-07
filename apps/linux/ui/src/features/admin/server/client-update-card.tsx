import { useMutation, useQuery } from "@tanstack/react-query";

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

export function ClientUpdateCard() {
  const status = useQuery({
    queryKey: ["device", "client-update"],
    queryFn: ({ signal }) => gateway.clientUpdateStatus(signal),
    staleTime: Infinity,
  });
  const openManager = useMutation({ mutationFn: () => gateway.openClientUpdateManager() });
  return (
    <Card size="sm" className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>
          <h2>تحديث تطبيق Linux</h2>
        </CardTitle>
        <CardDescription>تُدار النسخة المثبّتة من خلال نظام البرمجيات على هذا الجهاز.</CardDescription>
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
          <div className="flex flex-col gap-2">
            <Badge variant="outline">{stateLabel(status.data.state)}</Badge>
            <p>
              الإصدار <bdi>{status.data.currentVersion}</bdi>
            </p>
            <p className="text-sm text-muted-foreground">{status.data.message}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3">
        {status.data?.manager === "flatpak" && (
          <Button
            variant="outline"
            disabled={openManager.isPending}
            onClick={() => openManager.mutate()}
          >
            فتح البرمجيات للتحديث
          </Button>
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

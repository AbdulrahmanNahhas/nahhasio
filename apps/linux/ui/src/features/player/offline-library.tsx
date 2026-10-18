import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, HardDrive, WifiOff } from "lucide-react";
import { lazy, Suspense } from "react";
import { z } from "zod";

import { CardNavigationProvider } from "@/components/card-navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { nativeAvailable, nativeCall } from "@/lib/bridge";

import { connectionsOptions } from "../auth/connections";
import { navigate, useViewerRoute } from "../shell/navigation";
import { changeOfflineMode } from "./saved-works-data";

const WorkPage = lazy(() =>
  import("../work/work-page").then((module) => ({ default: module.WorkPage })),
);
const DownloadsPage = lazy(() =>
  import("./downloads-page").then((module) => ({ default: module.DownloadsPage })),
);

export function OfflineProfiles() {
  const client = useQueryClient();
  const connections = useQuery(connectionsOptions());
  const profiles = useQuery({
    queryKey: ["offline", "profiles", connections.data?.selected],
    queryFn: async ({ signal }) =>
      z
        .array(z.object({ account: z.string().uuid(), name: z.string() }))
        .max(32)
        .parse(await nativeCall("offline.profiles", {}, signal)),
    enabled: nativeAvailable() && Boolean(connections.data),
    networkMode: "always",
    retry: false,
  });
  const open = useMutation({
    networkMode: "always",
    mutationFn: (accountId: string) => changeOfflineMode(client, accountId),
  });
  if (profiles.error || connections.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>{profiles.error?.message ?? connections.error?.message}</AlertDescription>
      </Alert>
    );
  if (profiles.isPending) return <Skeleton className="h-20" />;
  if (!profiles.data?.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>لا توجد أعمال محفوظة بعد</EmptyTitle>
          <EmptyDescription>اتصل بمكتبتك واحفظ عملًا على الجهاز لفتحه هنا لاحقًا.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="flex flex-col gap-3">
      {profiles.data.map((profile) => (
        <Button
          key={profile.account}
          variant="outline"
          disabled={open.isPending}
          onClick={() => open.mutate(profile.account)}
        >
          {open.isPending && open.variables === profile.account ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <HardDrive data-icon="inline-start" />
          )}
          {profile.name}
          <ArrowRight data-icon="inline-end" />
        </Button>
      ))}
      {open.error && (
        <Alert variant="destructive">
          <AlertDescription>{open.error.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function OfflineLibrary({ name, pending }: { name: string; pending: number }) {
  const client = useQueryClient();
  const route = useViewerRoute();
  const match = /^\/titles\/([a-fA-F0-9-]{36})$/.exec(route.path);
  const close = useMutation({ networkMode: "always", mutationFn: () => changeOfflineMode(client) });
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">
            <WifiOff /> مكتبة الجهاز
          </Badge>
          <span className="text-sm">{name}</span>
          {pending > 0 && <Badge variant="outline">{pending} تغيير ينتظر الاتصال</Badge>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate("/downloads")}>
            <HardDrive data-icon="inline-start" /> المحفوظات والتنزيلات
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={close.isPending}
            onClick={() => close.mutate()}
          >
            <ArrowRight data-icon="inline-start" /> الاتصال بالخادم
          </Button>
        </div>
        {close.error && (
          <p role="alert" className="w-full text-sm text-destructive">
            {close.error.message}
          </p>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Suspense
          fallback={
            <p role="status" className="p-6">
              جارٍ فتح مكتبة الجهاز…
            </p>
          }
        >
          <CardNavigationProvider key={route.path}>
            {match ? (
              <WorkPage
                id={match[1]}
                installmentId={route.params.get("installment") ?? undefined}
              />
            ) : (
              <DownloadsPage />
            )}
          </CardNavigationProvider>
        </Suspense>
      </main>
    </div>
  );
}

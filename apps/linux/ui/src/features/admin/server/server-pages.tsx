import type { ProviderSettings, ServerIdentity, ServerSettings } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { KeyRound } from "lucide-react";
import { useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { gateway } from "@/lib/bridge";

import { serverOverviewQuery, serverSettingsQuery } from "./queries";

function Failure({ retry }: { retry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>تعذّر الاتصال بخدمات الخادم</AlertTitle>
      <AlertDescription>
        <p>تحقق من الاتصال وصلاحية حساب المدير ثم أعد المحاولة.</p>
        <Button variant="outline" onClick={retry}>
          إعادة المحاولة
        </Button>
      </AlertDescription>
    </Alert>
  );
}
export { ServerOverviewPage } from "./overview-page";

export function ServerSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const settings = useQuery(serverSettingsQuery());
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-5", !embedded && "mx-auto max-w-6xl p-6")}>
      {!embedded && (
        <header>
          <h1 className="text-2xl font-semibold">إعدادات الخادم</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            هوية مكتبة العائلة ومفاتيح مصادر الصور والبيانات.
          </p>
        </header>
      )}
      {settings.isPending ? (
        <Skeleton className="h-64 w-full" aria-busy="true" />
      ) : settings.isError ? (
        <Failure retry={() => void settings.refetch()} />
      ) : (
        <>
          <IdentityForm key={settings.data.server.revision} server={settings.data.server} />
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound aria-hidden="true" />
              مفاتيح المصادر
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              تُدار مفاتيح المصادر من بيئة الخادم. يعرض هذا القسم حالة الإعداد.
            </p>
          </div>
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
            {(["tmdb", "fanart"] as const).map((provider) => (
              <ProviderStatus
                key={provider}
                provider={provider}
                settings={settings.data.providers}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
function IdentityForm({ server }: { server: ServerIdentity }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const save = useMutation({
    mutationFn: gateway.renameServer,
    onSuccess: (identity) => {
      client.setQueryData(serverSettingsQuery().queryKey, (old: ServerSettings | undefined) =>
        old ? { ...old, server: identity } : old,
      );
      void client.invalidateQueries({ queryKey: serverOverviewQuery().queryKey });
    },
  });
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>هوية الخادم</h2>
        </CardTitle>
        <CardDescription>الاسم الذي تراه العائلة عند الاتصال بالمكتبة.</CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({
            name: input.current?.value.trim() ?? "",
            expectedRevision: server.revision,
          });
        }}
      >
        <CardContent>
          <FieldGroup>
            <Field orientation="responsive">
              <FieldContent>
                <FieldLabel htmlFor="server-name">اسم الخادم</FieldLabel>
                <FieldDescription>يظهر عند الاتصال بالمكتبة.</FieldDescription>
              </FieldContent>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <Input
                  ref={input}
                  id="server-name"
                  defaultValue={server.name}
                  required
                  maxLength={100}
                  disabled={save.isPending}
                  className="min-w-0 flex-1 basis-64"
                />
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "جارٍ الحفظ…" : "حفظ الاسم"}
                </Button>
              </div>
            </Field>
            {save.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  <p>تعذّر الحفظ. أعد تحميل الإعدادات إذا تغيّرت على جهاز آخر.</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      void client.invalidateQueries({ queryKey: serverSettingsQuery().queryKey })
                    }
                  >
                    إعادة تحميل الإعدادات
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </CardContent>
      </form>
    </Card>
  );
}
function ProviderStatus({
  provider,
  settings,
}: {
  provider: "tmdb" | "fanart";
  settings: ProviderSettings;
}) {
  const status = settings[provider];
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <h3>{provider === "tmdb" ? "TMDB" : "Fanart"}</h3>
          <Badge variant={status.configured ? "secondary" : "outline"}>
            {status.configured ? "مفتاح مضبوط" : "غير مفعّل"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {status.source === "server"
            ? "يستخدم مفتاحًا محفوظًا في إعدادات الخادم."
            : status.source === "disabled"
              ? "المصدر معطّل."
              : "يستخدم إعداد بيئة الخادم."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

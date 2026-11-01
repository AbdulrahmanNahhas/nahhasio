import type {
  ProviderSettings,
  ProviderUpdate,
  ServerIdentity,
  ServerSettings,
} from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { KeyRound } from "lucide-react";
import { useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
              مفاتيح مشتركة تُحفظ على الخادم ولا تُعرض قيمتها. الحفظ لا يختبر اتصال المزود.
            </p>
          </div>
          {!settings.data.providers.editable && (
            <Alert>
              <AlertTitle>مجلد الإعدادات الخاص غير مجهّز</AlertTitle>
              <AlertDescription>
                جهّز تخزين الإعدادات الآمن على الخادم لتفعيل إدارة المفاتيح. يمكن الاستمرار باستخدام
                مفاتيح بيئة الخادم.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
            {(["tmdb", "fanart"] as const).map((provider) => (
              <ProviderForm key={provider} provider={provider} settings={settings.data.providers} />
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
function ProviderForm({
  provider,
  settings,
}: {
  provider: "tmdb" | "fanart";
  settings: ProviderSettings;
}) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const status = settings[provider];
  const name = provider === "tmdb" ? "TMDB" : "Fanart";
  const save = useMutation({
    gcTime: 0,
    // Mutation variables contain only the action. Never retain a key in Query's cache.
    mutationFn: async (action: ProviderUpdate["action"]) => {
      const key = action === "set" ? input.current?.value : undefined;
      if (input.current) input.current.value = "";
      return gateway.updateProviders({
        provider,
        action,
        expectedRevision: settings.revision,
        key,
      });
    },
    onSuccess: (providers) =>
      client.setQueryData(serverSettingsQuery().queryKey, (old: ServerSettings | undefined) =>
        old ? { ...old, providers } : old,
      ),
    onError: () => {
      void client.invalidateQueries({ queryKey: serverSettingsQuery().queryKey });
    },
  });
  const disabled = !settings.editable || save.isPending;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <h3>{name}</h3>
          <Badge variant={status.configured ? "secondary" : "outline"}>
            {status.configured ? "مفتاح مضبوط" : "غير مفعّل"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {status.source === "server"
            ? "مفتاح محفوظ في إعدادات الخادم الخاصة."
            : status.source === "disabled"
              ? "المصدر معطّل، بما في ذلك مفتاح البيئة."
              : "يستخدم إعداد بيئة الخادم إن وُجد."}
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate("set");
        }}
      >
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`provider-${provider}`}>
                {provider === "tmdb" ? "رمز الوصول للقراءة من TMDB" : "مفتاح Fanart"}
              </FieldLabel>
              <Input
                ref={input}
                id={`provider-${provider}`}
                type="password"
                autoComplete="off"
                dir="ltr"
                minLength={8}
                maxLength={4096}
                required
                disabled={disabled}
              />
              <FieldDescription>
                أدخل مفتاحًا لاستبدال الحالي؛ تبقى القيمة مخفية بعد الحفظ.
              </FieldDescription>
            </Field>
            {save.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  تعذّر الحفظ؛ تحقق من الإعدادات وحاول مجدداً. أُفرغ حقل المفتاح لحماية قيمته.
                </AlertDescription>
              </Alert>
            )}
            {save.isSuccess && (
              <p role="status" className="text-sm text-muted-foreground">
                حُفظت إعدادات {name}.
              </p>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" type="submit" disabled={disabled}>
            {save.isPending ? "جارٍ الحفظ…" : "حفظ المفتاح"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => save.mutate("disable")}
            disabled={disabled || status.source === "disabled"}
          >
            تعطيل المصدر
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => save.mutate("environment")}
            disabled={disabled || status.source === "environment"}
          >
            استخدام إعداد البيئة
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

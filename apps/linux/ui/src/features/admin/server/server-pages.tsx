import type {
  ProviderSettings,
  ProviderUpdate,
  ServerIdentity,
  ServerSettings,
} from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Database, Film, Images, KeyRound, RefreshCw, Server, Settings, Users } from "lucide-react";
import { useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

import { OverviewInsights } from "./overview-insights";
import { serverOverviewQuery, serverSettingsQuery } from "./queries";

const number = new Intl.NumberFormat("ar");
function bytes(value: number) {
  return `${number.format(Math.round(value / 1024 / 1024))} م.ب`;
}
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
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  );
}
export function ServerOverviewPage() {
  const overview = useQuery(serverOverviewQuery());
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-400 flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">نظرة عامة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            حالة الخادم ومكتبة العائلة، مباشرة من خدمات نحّاسيو.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void overview.refetch()}
          disabled={overview.isFetching}
        >
          <RefreshCw data-icon="inline-start" />
          تحديث الحالة
        </Button>
      </header>
      {overview.isPending ? (
        <Skeleton className="h-64 w-full" aria-busy="true" />
      ) : overview.isError ? (
        <Failure retry={() => void overview.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "الأعمال",
                value: number.format(overview.data.counts.works),
                detail: `${number.format(overview.data.counts.installments)} موسم وفيلم · ${number.format(overview.data.counts.episodes)} حلقة`,
                icon: Film,
              },
              {
                label: "مكتبة الصور",
                value: number.format(overview.data.counts.artwork),
                detail: `${bytes(overview.data.counts.artworkBytes)} مسجلة في المكتبة`,
                icon: Images,
              },
              {
                label: "الحسابات النشطة",
                value: number.format(overview.data.counts.accounts),
                detail: `${number.format(overview.data.counts.sessions)} جلسة صالحة مسجلة`,
                icon: Users,
              },
              {
                label: "قاعدة البيانات",
                value: bytes(overview.data.counts.databaseBytes),
                detail: "PostgreSQL · متصلة",
                icon: Database,
              },
            ].map(({ label, value, detail, icon: Icon }) => (
              <Card key={label} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon aria-hidden="true" />
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tabular-nums">{value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <OverviewInsights data={overview.data.insights} works={overview.data.counts.works} />
          <Card>
            <CardHeader>
              <CardTitle>فحوص تجهيز الخادم</CardTitle>
              <CardDescription>
                فحوص قراءة أولية. لا تستبدل اختبار التثبيت أو النسخ والاستعادة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-4">
                {overview.data.checks.map((check) => (
                  <div key={check.key} className="flex flex-col gap-2">
                    <dt className="flex flex-wrap items-center justify-between gap-3">
                      <span>{check.label}</span>
                      <Badge variant={check.ok ? "secondary" : "outline"}>
                        {check.ok ? "اجتاز الفحص الأولي" : "يحتاج إلى تجهيز"}
                      </Badge>
                    </dt>
                    <dd className="text-sm text-muted-foreground">{check.detail}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          {!overview.data.schema.compatible && (
            <Alert variant="destructive">
              <AlertTitle>قاعدة البيانات تحتاج إلى مراجعة</AlertTitle>
              <AlertDescription>
                سجل المخطط غير متوافق مع هذا الإصدار أو توجد ترقية معلّقة. لا تُنفّذ الترقية تلقائياً.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server aria-hidden="true" />
                  {overview.data.server.name}
                </CardTitle>
                <CardDescription>
                  خادم Rust · واجهة API {number.format(overview.data.apiVersion)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl>
                  <Detail label="الإصدار">
                    <bdi>{overview.data.version}</bdi>
                  </Detail>
                  <Detail label="وقت التشغيل">
                    {number.format(Math.floor(overview.data.uptimeSeconds / 60))} دقيقة
                  </Detail>
                  <Detail label="مخطط البيانات">
                    <Badge variant={overview.data.schema.compatible ? "secondary" : "destructive"}>
                      {overview.data.schema.compatible ? "متوافق" : "يحتاج إلى مراجعة"}
                    </Badge>
                  </Detail>
                  <Detail label="الترقيات المطبّقة">
                    {overview.data.schema.applied === null
                      ? "تعذّر التحقق"
                      : number.format(overview.data.schema.applied)}
                  </Detail>
                  <Detail label="هوية الخادم">
                    <bdi>{overview.data.server.id}</bdi>
                  </Detail>
                </dl>
              </CardContent>
              <CardFooter>
                <a href="#/admin/settings" className={buttonVariants({ variant: "outline" })}>
                  <Settings data-icon="inline-start" />
                  إعدادات الخادم
                </a>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>الخدمات والتشغيل</CardTitle>
                <CardDescription>نحّاسيو يملك بيانات المكتبة والصور وتتبع المشاهدة.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl>
                  <Detail label="نحّاسيو">
                    <Badge variant="secondary">متصل</Badge>
                  </Detail>
                  <Detail label="PostgreSQL">
                    <Badge variant="secondary">متصلة</Badge>
                  </Detail>
                  <Detail label="Jellyfin">
                    <Badge variant="outline">التشغيل والبث — لاحقاً</Badge>
                  </Detail>
                </dl>
                <p className="mt-4 text-sm text-muted-foreground">
                  ربط الفيديو عبر Jellyfin، النسخ المجدولة والتحديث التلقائي تحتاج إلى خدماتها قبل
                  تفعيل أدواتها.
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <a href="#/admin/accounts" className={buttonVariants({ variant: "outline" })}>
                  فحص الحسابات
                </a>
                <a href="#/admin/logs" className={buttonVariants({ variant: "outline" })}>
                  سجل الإدارة
                </a>
              </CardFooter>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">
            تتجدد الحالة كل 30 ثانية. أحجام الصور من السجلات؛ لا يُجرى فحص ملفات أو اختبار اتصال
            بالمصادر هنا. الجلسة الصالحة لا تعني أن الجهاز متصل الآن.
          </p>
        </>
      )}
    </div>
  );
}
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
        <CardTitle>هوية الخادم</CardTitle>
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
          {name}
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

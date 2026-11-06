import { SessionSchema, type User } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowRight,
  Blocks,
  Captions,
  Check,
  ChevronLeft,
  CircleHelp,
  CloudOff,
  Copy,
  HardDrive,
  Palette,
  Plug,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { gateway, nativeCall } from "@/lib/bridge";

import { AccountAvatar } from "../account/account-avatar";
import { PasswordDialog } from "../account/password-card";
import { ClientUpdateCard } from "../admin/server/client-update-card";
import { connectionsOptions } from "../auth/connections";
import { loginAccountsOptions } from "../auth/login-accounts";
import { switchAccount } from "../auth/remembered-accounts";
import { ServerConnections } from "../auth/server-connections";
import { CacheControl } from "../player/cache-control";
import { OpenSubtitlesSettings } from "../player/opensubtitles";
import { navigate, useViewerRoute } from "../shell/navigation";
import { AppearanceSettings } from "./appearance-settings";
import { PlaybackPreferences } from "./playback-preferences";
import { SettingsCard } from "./settings-card";
import {
  artworkCacheOptions,
  artworkCacheSchema,
  clientInfoOptions,
  diagnosticReport,
  sections,
  sectionSchema,
} from "./settings-data";
import { UpcomingSettings } from "./upcoming-settings";

const sectionIcons = {
  account: UserRound,
  appearance: Palette,
  playback: Video,
  subtitles: Captions,
  sources: Plug,
  extensions: Blocks,
  storage: HardDrive,
  offline: CloudOff,
  connection: Server,
  administration: ShieldCheck,
  help: CircleHelp,
} satisfies Record<(typeof sections)[number]["id"], typeof Settings>;
const navigationGroups = [
  ["account", "appearance"],
  ["playback", "subtitles", "sources", "extensions"],
  ["storage", "offline"],
  ["connection", "help"],
  ["administration"],
] as const;

function AccountSettings({ user }: { user: User }) {
  const client = useQueryClient();
  const connections = useQuery(connectionsOptions());
  const accounts = useQuery(loginAccountsOptions(connections.data?.selected));
  const [forgetId, setForgetId] = useState<string | null>(null);
  const action = useMutation({
    networkMode: "always",
    mutationFn: async (id?: string) => {
      if (id) {
        const session = SessionSchema.nullable().parse(
          await nativeCall("accounts.forget", { accountId: id }),
        );
        await client.cancelQueries();
        client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
        window.dispatchEvent(new Event("nahhasio:session-changed"));
        client.setQueryData(["session"], session);
        return session;
      }
      return switchAccount(client);
    },
    onSuccess: (session) => {
      setForgetId(null);
      if (!session) navigate("/home");
    },
  });
  return (
    <>
      <SettingsCard
        title="حسابك على هذا الجهاز"
        description="تبديل الحساب يحتفظ بجلساته المحفوظة. تسجيل الخروج يلغي جلسة الحساب الحالي."
      >
        <div className="flex items-center gap-3">
          <AccountAvatar name={user.name} avatarKey={user.avatarKey} className="size-12" />
          <div className="flex min-w-0 flex-col gap-1">
            <span>{user.name}</span>
            <span className="break-all text-sm text-muted-foreground" dir="auto">
              {user.email}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            render={<a href={`#/profiles/${user.accountId}?edit=profile`} />}
          >
            تعديل الملف الشخصي
          </Button>
          <PasswordDialog />
          <Button
            variant="outline"
            disabled={action.isPending}
            onClick={() => action.mutate(undefined)}
          >
            <Users data-icon="inline-start" />
            تبديل الحساب أو إضافة حساب
          </Button>
        </div>
        {accounts.isPending && <Skeleton className="h-16" />}
        {accounts.error && (
          <Alert variant="destructive">
            <AlertDescription>{accounts.error.message}</AlertDescription>
          </Alert>
        )}
        {Boolean(accounts.data?.length) && (
          <h3 className="text-sm font-medium">حسابات محفوظة على هذا الجهاز</h3>
        )}
        {accounts.data?.map((account) => (
          <Item key={account.id} variant="outline" size="sm">
            <ItemMedia>
              <AccountAvatar name={account.name} avatarKey={account.avatarKey} className="size-8" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {account.name}
                {account.id === user.accountId && <Badge variant="secondary">الحالي</Badge>}
              </ItemTitle>
            </ItemContent>
            <ItemActions>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={action.isPending}
                aria-label={`نسيان ${account.name} من الجهاز`}
                onClick={() => setForgetId(account.id)}
              >
                <Trash2 />
              </Button>
            </ItemActions>
          </Item>
        ))}
        {forgetId && (
          <Alert>
            <AlertDescription>
              <p>
                يُلغي النسيان جلسة الحساب ويزيل اتصالاته الخاصة من الجهاز. تبقى ملفات الفيديو
                المحفوظة.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  disabled={action.isPending}
                  onClick={() => action.mutate(forgetId)}
                >
                  تأكيد نسيان الحساب
                </Button>
                <Button
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() => setForgetId(null)}
                >
                  إلغاء
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {action.error && (
          <Alert variant="destructive">
            <AlertDescription>{action.error.message}</AlertDescription>
          </Alert>
        )}
      </SettingsCard>
    </>
  );
}
function StorageSettings() {
  const client = useQueryClient();
  const info = useQuery(clientInfoOptions());
  const cache = useQuery(artworkCacheOptions());
  const clear = useMutation({
    mutationFn: async () => artworkCacheSchema.parse(await nativeCall("artworkCache.clear", {})),
    onSuccess: (value) => {
      client.setQueryData(["artwork-cache"], value);
      client.removeQueries({ queryKey: ["artwork"] });
    },
  });
  return (
    <>
      <SettingsCard
        horizontal
        title="صور المكتبة المؤقتة"
        description="ذاكرة قابلة للإخلاء. الصور المحفوظة للعمل دون اتصال والفيديوهات لا تُحذف معها."
      >
        {cache.data && (
          <p>
            {Math.round(cache.data.bytes / 1024 / 1024).toLocaleString("ar")} ميغابايت مستخدمة من{" "}
            {Math.round(cache.data.budgetBytes / 1024 / 1024).toLocaleString("ar")}
          </p>
        )}
        <Button
          variant="outline"
          disabled={clear.isPending || !cache.data}
          onClick={() => clear.mutate()}
        >
          إفراغ ذاكرة الصور المؤقتة
        </Button>
        {(cache.error || clear.error) && (
          <Alert variant="destructive">
            <AlertDescription>{cache.error?.message ?? clear.error?.message}</AlertDescription>
          </Alert>
        )}
      </SettingsCard>
      <SettingsCard
        horizontal
        title="تنزيلات هذا الجهاز"
        description="الملفات المحفوظة مستقلة عن الذاكرة المؤقتة وعن تنزيلات أي جهاز آخر."
      >
        {info.data && (
          <FieldGroup>
            <Field>
              <FieldLabel>مجلد الفيديو</FieldLabel>
              <p className="break-all text-sm" dir="ltr">
                {info.data.videoRoot}
              </p>
            </Field>
          </FieldGroup>
        )}
        <Button nativeButton={false} variant="outline" render={<a href="#/downloads" />}>
          التنزيلات ومكتبة الجهاز
        </Button>
        <div className="w-full">
          <CacheControl />
        </div>
      </SettingsCard>
    </>
  );
}
function ConnectionSettings() {
  return <ServerConnections open inline />;
}
function HelpSettings() {
  const info = useQuery(clientInfoOptions());
  const cache = useQuery(artworkCacheOptions());
  const [preview, setPreview] = useState(false);
  const report = info.data ? diagnosticReport(info.data, cache.data) : "";
  const copy = useMutation({ mutationFn: () => navigator.clipboard.writeText(report) });
  return (
    <>
      <SettingsCard
        title="الإصدارات والتشخيص"
        description="تُنشأ المعلومات على جهازك. لا يُرسل شيء تلقائيًا، ولا يتضمن التقرير الحسابات أو المفاتيح أو عناوين الاتصال أو مسارات الملفات."
      >
        {info.isPending && <Skeleton className="h-24" />}
        {info.data && (
          <dl className="flex w-full flex-col divide-y">
            {[
              ["نحّاسيو", info.data.version],
              ["الخادم", info.data.serverVersion],
              ["واجهة الاتصال", info.data.apiVersion],
              ["المنصة", "Linux"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3">
                <dt>{label}</dt>
                <dd className="text-muted-foreground" dir="ltr">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {info.error && (
          <Alert variant="destructive">
            <AlertDescription>{info.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void info.refetch()}>
            <RefreshCw data-icon="inline-start" />
            تحديث الحالة
          </Button>
          <Button variant="outline" disabled={!info.data} onClick={() => setPreview(!preview)}>
            معاينة تقرير التشخيص
          </Button>
        </div>
        {preview && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="diagnostic-report">تقرير التشخيص</FieldLabel>
              <Textarea id="diagnostic-report" readOnly dir="ltr" rows={12} value={report} />
              <FieldDescription>راجع التقرير قبل مشاركته مع أي شخص.</FieldDescription>
            </Field>
            <Button
              variant="outline"
              disabled={!report || copy.isPending}
              onClick={() => copy.mutate()}
            >
              {copy.isSuccess ? (
                <Check data-icon="inline-start" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copy.isSuccess ? "نُسخ التقرير" : "نسخ التقرير"}
            </Button>
            {copy.error && (
              <Alert variant="destructive">
                <AlertDescription>تعذّر النسخ؛ يمكنك تحديد النص ونسخه يدويًا.</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        )}
      </SettingsCard>
      <ClientUpdateCard />
    </>
  );
}
export function SettingsPage() {
  const route = useViewerRoute();
  const parsed = sectionSchema.safeParse(route.params.get("section"));
  const selected = parsed.success ? parsed.data : undefined;
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });
  const user = session.data?.user;
  const active =
    selected === "administration" && !user?.isAdmin ? "account" : (selected ?? "account");
  const navigationRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastSelected = useRef<string | null>(null);
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    if (selected) {
      lastSelected.current = active;
      detailRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
      headingRef.current?.focus({ preventScroll: true });
    } else if (lastSelected.current) {
      navigationRef.current
        ?.querySelector<HTMLAnchorElement>(`a[href="#/settings?section=${lastSelected.current}"]`)
        ?.focus();
    }
  }, [active, selected, signedIn]);
  if (!user) return null;
  const category = sections.find((section) => section.id === active)!;
  const CategoryIcon = sectionIcons[active];
  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
      <div className="flex min-w-0 flex-col gap-6 md:flex-row md:items-start lg:gap-8">
        <nav
          ref={navigationRef}
          aria-label="أقسام الإعدادات"
          className={cn(
            "flex shrink-0 flex-col gap-3 md:sticky md:top-6 md:w-64",
            selected && "hidden md:flex",
          )}
        >
          <header className="flex items-center gap-2 px-3 py-2">
            <Settings className="size-5 text-muted-foreground" aria-hidden="true" />
            <h1 className="text-lg font-semibold">الإعدادات والمساعدة</h1>
          </header>
          {navigationGroups
            .filter((group) => group[0] !== "administration" || user.isAdmin)
            .map((group) => (
              <div key={group[0]} className="flex flex-col gap-1 rounded-2xl border p-1">
                {group.map((id) => {
                  const section = sections.find((entry) => entry.id === id)!;
                  const Icon = sectionIcons[id];
                  return (
                    <Button
                      key={id}
                      variant={active === id ? "secondary" : "ghost"}
                      className="h-auto justify-start px-3 py-3 md:py-2.5"
                      render={
                        <a
                          href={`#/settings?section=${id}`}
                          aria-current={active === id ? "page" : undefined}
                        />
                      }
                    >
                      <Icon data-icon="inline-start" />
                      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                        <span>{section.label}</span>
                        <span className="text-xs text-muted-foreground md:hidden">
                          {section.description}
                        </span>
                      </span>
                      <ChevronLeft data-icon="inline-end" className="md:hidden" />
                    </Button>
                  );
                })}
              </div>
            ))}
        </nav>
        <section
          ref={detailRef}
          aria-label={category.label}
          className={cn("flex min-w-0 flex-1 flex-col gap-6", !selected && "hidden md:flex")}
        >
          <Button variant="ghost" className="self-start md:hidden" render={<a href="#/settings" />}>
            <ArrowRight data-icon="inline-start" />
            جميع الإعدادات
          </Button>
          <header className="flex items-center gap-3 py-2">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted text-primary">
              <CategoryIcon className="size-6" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="rounded-sm text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {category.label}
              </h2>
              <p className="text-sm text-muted-foreground">{category.description}</p>
              <p className="text-xs text-muted-foreground">الخيارات المعطّلة لم تتوفر بعد.</p>
            </div>
          </header>
          {active === "account" && <AccountSettings user={user} />}
          {active === "appearance" && <AppearanceSettings />}
          {active === "storage" && <StorageSettings />}
          {active === "connection" && <ConnectionSettings />}
          {active === "help" && <HelpSettings />}
          {active === "administration" && user.isAdmin && (
            <Button className="self-start" variant="outline" render={<a href="#/admin/settings" />}>
              <ShieldCheck data-icon="inline-start" />
              فتح إعدادات إدارة الخادم
            </Button>
          )}
          {active === "playback" && <PlaybackPreferences />}
          {active === "subtitles" && (
            <>
              <PlaybackPreferences subtitles />
              <OpenSubtitlesSettings />
            </>
          )}
          <UpcomingSettings section={active} />
        </section>
      </div>
    </div>
  );
}

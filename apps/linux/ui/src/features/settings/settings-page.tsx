import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowRight,
  Blocks,
  Check,
  ChevronLeft,
  CircleHelp,
  Copy,
  Download,
  HardDrive,
  Palette,
  RefreshCw,
  Server,
  ShieldCheck,
  UserRound,
  Video,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Separator } from "@/components/ui-sdk/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { gateway, nativeCall } from "@/lib/bridge";

import { ClientUpdateCard } from "../admin/server/client-update-card";
import { ServerConnections } from "../auth/server-connections";
import { OpenSubtitlesSettings } from "../player/opensubtitles";
import { useViewerRoute } from "../shell/navigation";
import { AccountSettings } from "./account-settings";
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

const navigationGroups = [
  { id: "personal", sections: ["account", "appearance"] },
  { id: "player", sections: ["playback"] },
  { id: "library", sections: ["storage", "connection"] },
  { id: "support", sections: ["help"] },
] as const;
const sectionIcons = {
  account: UserRound,
  appearance: Palette,
  playback: Volume2,
  storage: HardDrive,
  connection: Server,
  help: CircleHelp,
} satisfies Record<(typeof sections)[number]["id"], typeof UserRound>;
const settingsLink = "h-11 w-full justify-start gap-3 rounded-xl px-3";

function StorageSettings() {
  const client = useQueryClient();
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
      <SettingsCard title="مكتبة الجهاز">
        <div className="flex w-full flex-col gap-2">
          {[
            { view: "library", label: "الفيديوهات", icon: Video },
            { view: "queue", label: "النقل", icon: Download },
            { view: "storage", label: "مساحة التخزين", icon: HardDrive },
          ].map(({ view, label, icon: Icon }) => (
            <Item
              key={view}
              size="sm"
              variant="outline"
              render={<a href={`#/downloads?view=${view}`} />}
            >
              <ItemMedia variant="icon">
                <Icon aria-hidden="true" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{label}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </ItemActions>
            </Item>
          ))}
        </div>
      </SettingsCard>
      <Card size="sm" className="py-0">
        <CardContent>
          <Item className="px-0">
            <ItemContent className="min-w-0">
              <ItemTitle>
                <h2>صور المكتبة المؤقتة</h2>
              </ItemTitle>
              {cache.data && (
                <ItemDescription>
                  {Math.round(cache.data.bytes / 1024 / 1024).toLocaleString("ar-u-nu-latn")}{" "}
                  ميغابايت مستخدمة من{" "}
                  {Math.round(cache.data.budgetBytes / 1024 / 1024).toLocaleString("ar-u-nu-latn")}
                </ItemDescription>
              )}
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                disabled={clear.isPending || !cache.data}
                onClick={() => clear.mutate()}
              >
                إفراغ ذاكرة الصور المؤقتة
              </Button>
            </ItemActions>
          </Item>
          {(cache.error || clear.error) && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{cache.error?.message ?? clear.error?.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
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
        footer={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={info.isFetching}
              onClick={() => void info.refetch()}
            >
              <RefreshCw data-icon="inline-start" />
              تحديث الحالة
            </Button>
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
            <Button
              variant="ghost"
              aria-expanded={preview}
              disabled={!report}
              onClick={() => setPreview(!preview)}
            >
              {preview ? "إخفاء تقرير التشخيص" : "معاينة تقرير التشخيص"}
            </Button>
          </div>
        }
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
        {preview && <Separator />}
        {preview && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="diagnostic-report">تقرير التشخيص</FieldLabel>
              <Textarea id="diagnostic-report" readOnly dir="ltr" rows={8} value={report} />
              <FieldDescription>
                يستبعد بيانات الحساب والمفاتيح والعناوين ومسارات الملفات.
              </FieldDescription>
            </Field>
          </FieldGroup>
        )}
        {copy.error && (
          <Alert variant="destructive">
            <AlertDescription>تعذّر النسخ. افتح المعاينة لنسخ النص يدويًا.</AlertDescription>
          </Alert>
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
  const active = selected === "subtitles" ? "playback" : (selected ?? "account");
  const navigationRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subtitleProvider = useRef<HTMLDivElement>(null);
  const lastSelected = useRef<string | null>(null);
  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    if (selected) {
      lastSelected.current = active;
      const target = selected === "subtitles" ? subtitleProvider.current : headingRef.current;
      (selected === "subtitles" ? target : detailRef.current)?.scrollIntoView({
        block: "start",
        inline: "nearest",
      });
      target?.focus({ preventScroll: true });
    } else if (lastSelected.current) {
      navigationRef.current
        ?.querySelector<HTMLAnchorElement>(`a[href="#/settings?section=${lastSelected.current}"]`)
        ?.focus();
    }
  }, [active, selected, signedIn]);
  if (!user) return null;
  const category = sections.find((section) => section.id === active)!;
  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6 lg:p-8">
      <div className="flex min-w-0 flex-col gap-6 md:flex-row md:items-start lg:gap-8">
        <nav
          ref={navigationRef}
          aria-label="أقسام الإعدادات"
          className={cn(
            "flex shrink-0 flex-col gap-3 md:sticky md:top-6 md:w-56",
            selected && "hidden md:flex",
          )}
        >
          {navigationGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-1">
              {group.sections.map((id) => {
                const section = sections.find((entry) => entry.id === id)!;
                const Icon = sectionIcons[id];
                return (
                  <a
                    key={id}
                    href={`#/settings?section=${id}`}
                    aria-current={active === id ? "page" : undefined}
                    className={cn(
                      buttonVariants({ variant: active === id ? "secondary" : "ghost" }),
                      settingsLink,
                      active !== id && "text-muted-foreground",
                    )}
                  >
                    <Icon data-icon="inline-start" aria-hidden="true" />
                    {section.label}
                  </a>
                );
              })}
              {group.id === "player" && (
                <Button variant="ghost" disabled className={settingsLink}>
                  <Blocks data-icon="inline-start" aria-hidden="true" />
                  الإضافات
                  <Badge variant="secondary" className="ms-auto">
                    لاحقًا
                  </Badge>
                </Button>
              )}
              {group.id === "support" && user.isAdmin && (
                <a
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    settingsLink,
                    "text-muted-foreground",
                  )}
                  href="#/admin/settings"
                >
                  <ShieldCheck data-icon="inline-start" aria-hidden="true" />
                  إعدادات الخادم
                </a>
              )}
            </div>
          ))}
        </nav>
        <section
          ref={detailRef}
          aria-labelledby="settings-section-heading"
          className="flex min-w-0 flex-1 flex-col gap-6"
        >
          {selected && (
            <a
              href="#/settings"
              className={cn(buttonVariants({ variant: "ghost" }), "self-start md:hidden")}
            >
              <ArrowRight data-icon="inline-start" aria-hidden="true" />
              جميع الإعدادات
            </a>
          )}
          <h1
            id="settings-section-heading"
            ref={headingRef}
            tabIndex={-1}
            className="rounded-sm py-2 text-xl font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {category.label}
          </h1>
          {active === "account" && <AccountSettings key={user.accountId} user={user} />}
          {active === "appearance" && <AppearanceSettings />}
          {active === "storage" && <StorageSettings />}
          {active === "connection" && <ConnectionSettings />}
          {active === "help" && <HelpSettings />}
          {active === "playback" && (
            <>
              <PlaybackPreferences />
              <div ref={subtitleProvider} tabIndex={-1} role="region" aria-label="OpenSubtitles">
                <OpenSubtitlesSettings />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

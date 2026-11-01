import { Activity, Settings, ShieldCheck, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AccountsPage } from "./accounts/accounts-page";
import { AdminPageHeader } from "./admin-page-header";
import { DatabaseInspector } from "./database-inspector";
import { JellyfinConnection } from "./server/jellyfin-connection";
import { LibraryActions } from "./server/library-actions";
import { ServerMaintenance, ClientUpdateCard } from "./server/maintenance";
import { ServerSettingsPage } from "./server/server-pages";

const workspaces = {
  accounts: {
    title: "الحسابات والوصول",
    description: "الحسابات والأجهزة وبيانات المشاهدة والصلاحيات في مكان واحد.",
    icon: ShieldCheck,
    tabs: [
      { value: "accounts", label: "المستخدمون", description: "الحسابات والجلسات والدعوات" },
      { value: "devices", label: "الأجهزة", description: "الأجهزة المسجلة في الخادم" },
      {
        value: "profiles",
        label: "بيانات المشاهدة",
        description: "التفضيلات والتقدم والقوائم والتفاعلات",
      },
      {
        value: "policies",
        label: "الصلاحيات والسياسات",
        description: "قدرات الحساب وقواعد الوصول إلى المحتوى",
      },
    ],
  },
  activity: {
    title: "نشاط الخادم",
    description: "تابع المهام وراجع سجل العمليات المسجل على الخادم.",
    icon: Activity,
    tabs: [
      { value: "jobs", label: "المهام", description: "المهام الخلفية المسجلة وحالتها" },
      { value: "logs", label: "سجل العمليات", description: "العمليات المسجلة في سجل التدقيق" },
    ],
  },
  settings: {
    title: "الإعدادات والاتصالات",
    description: "إعدادات الخادم ومصادر البيانات والخدمات المتصلة.",
    icon: Settings,
    tabs: [
      {
        value: "general",
        label: "إعدادات الخادم",
        description: "هوية الخادم وإعدادات الاتصال ومزوّدو البيانات",
      },
      {
        value: "integrations",
        label: "الخدمات المتصلة",
        description: "بيانات خوادم Jellyfin المسجلة",
      },
    ],
  },
  maintenance: {
    title: "صيانة الخادم",
    description: "النسخ والاستعادة والتحديثات والتحقق من سلامة الخادم.",
    icon: Wrench,
    tabs: [
      {
        value: "actions",
        label: "إجراءات المكتبة",
        description: "صور الحلقات وتنظيف الصور ومراجعة النواقص",
      },
      {
        value: "backups",
        label: "النسخ والاستعادة",
        description: "إنشاء نسخ الخادم ومراجعتها واستعادتها.",
      },
      { value: "updates", label: "التحديثات", description: "تحديث الخادم وتطبيق Linux." },
      {
        value: "validation",
        label: "التحقق والصيانة",
        description: "أدوات فحص البيانات وإصلاحها لم تُربط بعد.",
      },
    ],
  },
};
export function isAdminWorkspace(section: string): section is keyof typeof workspaces {
  return Object.hasOwn(workspaces, section);
}
export function AdminWorkspacePage({
  section,
  tab,
  onTabChange,
}: {
  section: keyof typeof workspaces;
  tab: string;
  onTabChange: (value: string) => void;
}) {
  const workspace = workspaces[section];
  const selected = workspace.tabs.find((item) => item.value === tab) ?? workspace.tabs[0];
  if (section === "accounts") return <AccountsPage tab={tab} />;
  if (section === "settings")
    return (
      <article className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-4 pb-10 sm:p-6">
        <header className="flex items-start gap-3">
          <Settings className="mt-1 size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold">الإعدادات والاتصالات</h1>
            <p className="text-sm text-muted-foreground">
              هوية المكتبة ومصادر البيانات والاتصالات المشتركة.
            </p>
          </div>
        </header>
        <ServerSettingsPage embedded />
        <JellyfinConnection />
      </article>
    );
  return (
    <article className="mx-auto flex w-full min-w-0 max-w-400 flex-col gap-6 p-4 pb-16 sm:p-6">
      <AdminPageHeader
        title={workspace.title}
        description={workspace.description}
        icon={workspace.icon}
      />
      <Tabs value={selected.value} onValueChange={onTabChange}>
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start">
          {workspace.tabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {workspace.tabs.map((item) => (
          <TabsContent key={item.value} value={item.value}>
            {section === "maintenance" && item.value === "actions" ? (
              <LibraryActions />
            ) : section === "maintenance" && item.value === "backups" ? (
              <ServerMaintenance view="backups" />
            ) : section === "maintenance" && item.value === "updates" ? (
              <div className="flex flex-col gap-5">
                <ServerMaintenance view="updates" />
                <ClientUpdateCard />
              </div>
            ) : section === "maintenance" ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Wrench />
                  </EmptyMedia>
                  <EmptyTitle>{item.label}</EmptyTitle>
                  <EmptyDescription>{item.description}</EmptyDescription>
                </EmptyHeader>
                <Badge variant="outline">غير متاح بعد</Badge>
              </Empty>
            ) : (
              <>
                <p className="py-3 text-sm text-muted-foreground">
                  {item.description} · عرض للقراءة فقط
                </p>
                <DatabaseInspector
                  key={item.value}
                  section={item.value}
                  title={item.label}
                  embedded
                />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </article>
  );
}

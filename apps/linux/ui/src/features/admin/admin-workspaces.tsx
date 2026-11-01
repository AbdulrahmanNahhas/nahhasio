import { AccountsPage } from "./accounts/accounts-page";
import { ActivityPage } from "./activity/activity-page";
import { JellyfinConnection } from "./server/jellyfin-connection";
import { MaintenancePage } from "./server/maintenance-page";
import { ServerSettingsPage } from "./server/server-pages";
import { WorkspacePage } from "./workspace";

const workspaces = ["accounts", "activity", "settings", "maintenance"] as const;
type Workspace = (typeof workspaces)[number];
export function isAdminWorkspace(section: string): section is Workspace {
  return workspaces.some((value) => value === section);
}
export function AdminWorkspacePage({ section, tab }: { section: Workspace; tab: string }) {
  if (section === "accounts") return <AccountsPage tab={tab} />;
  if (section === "maintenance") return <MaintenancePage tab={tab} />;
  if (section === "activity") return <ActivityPage tab={tab} />;
  return (
    <WorkspacePage
      title="الإعدادات والاتصالات"
      description="هوية المكتبة ومصادر البيانات والاتصالات المشتركة."
    >
      <ServerSettingsPage embedded />
      <JellyfinConnection />
    </WorkspacePage>
  );
}

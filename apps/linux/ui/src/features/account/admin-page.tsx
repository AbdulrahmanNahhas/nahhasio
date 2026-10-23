import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { gateway } from "@/lib/bridge";

import { AdminWorkspacePage, isAdminWorkspace } from "../admin/admin-workspaces";
import { DatabaseInspector, inspectionSections } from "../admin/database-inspector";
import { adminSection } from "../admin/navigation";
import { ServerOverviewPage } from "../admin/server/server-pages";

export function AdminPage() {
  const access = useQuery({
    queryKey: ["admin-access"],
    queryFn: ({ signal }) => gateway.adminAccess(signal),
    staleTime: 0,
    refetchInterval: 60_000,
    retry: false,
  });
  if (access.isPending)
    return <Skeleton className="mx-auto mt-16 h-56 w-full max-w-xl" aria-busy="true" />;
  if (access.isError || access.data?.isAdmin !== true)
    return (
      <section className="grid min-h-full place-items-center p-6" aria-label="لوحة الإدارة">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheck />
            </EmptyMedia>
            <EmptyTitle>هذه الصفحة للمدير فقط</EmptyTitle>
            <EmptyDescription>
              لا يمكن فتح أدوات الإدارة بهذا الحساب، أو تعذّر التحقق من الصلاحية.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <a href="#/home" className={buttonVariants({ variant: "outline" })}>
              العودة إلى المكتبة
            </a>
            <Button variant="ghost" onClick={() => void access.refetch()}>
              إعادة التحقق
            </Button>
          </EmptyContent>
        </Empty>
      </section>
    );
  return (
    <section className="flex min-h-full flex-col" aria-label="لوحة الإدارة">
      <Outlet />
    </section>
  );
}
export function AdminSectionPage({
  section = "",
  tab = "",
  onTabChange,
}: {
  section?: string;
  tab?: string;
  onTabChange?: (value: string) => void;
}) {
  if (!section) return <ServerOverviewPage />;
  if (isAdminWorkspace(section))
    return (
      <AdminWorkspacePage
        section={section}
        tab={tab}
        onTabChange={(value) => onTabChange?.(value)}
      />
    );
  const item = adminSection(section);
  const title = section ? (item?.title ?? "صفحة غير موجودة") : "نظرة عامة";
  if (item && section in inspectionSections)
    return <DatabaseInspector key={section} section={section} title={title} />;
  const Icon = item?.icon ?? ShieldCheck;
  return (
    <div className="grid flex-1 place-items-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>
            {section && !item
              ? "اختر قسماً من قائمة الإدارة."
              : section
                ? "هذا القسم قيد التجهيز. أدواته غير متاحة بعد؛ ستنتقل هنا بعد ربطها بالخادم والتحقق منها."
                : "مساحتك لإدارة المكتبة. اختر قسماً من القائمة؛ ستنتقل أدوات الإدارة إلى هنا تدريجياً."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {(!section || item) && <Badge variant="outline">قيد التجهيز</Badge>}
          <a href="#/home" className={buttonVariants({ variant: "outline" })}>
            العودة إلى المكتبة
          </a>
        </EmptyContent>
      </Empty>
    </div>
  );
}

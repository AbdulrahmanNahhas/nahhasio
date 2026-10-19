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

import { DatabaseInspector, inspectionSections } from "../admin/database-inspector";
import { adminSection, adminGroups, isAdminSectionAvailable } from "../admin/navigation";

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
      {/*<header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
        <div>
          <p className="text-sm text-muted-foreground">نحّاسيو</p>
          <h1 className="text-xl font-semibold">لوحة الإدارة</h1>
        </div>
        <Badge variant="secondary">المدير</Badge>
      </header>*/}
      <Outlet />
    </section>
  );
}
export function AdminSectionPage({ section = "" }: { section?: string }) {
  if (!section)
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
        <h1 className="text-2xl font-semibold">أدوات الإدارة</h1>
        <p className="text-sm text-muted-foreground">
          اختر قسماً متاحاً لإدارة المكتبة. إنشاء الأعمال وتحريرها والتحرير الجماعي متاحة داخل صفحة
          الأعمال.
        </p>
        <div className="flex flex-wrap gap-3">
          {adminGroups
            .flatMap((group) => [...group.items])
            .filter((item) => isAdminSectionAvailable(item.slug))
            .map((item) => (
              <a
                key={item.slug}
                href={`#/admin/${item.slug}`}
                className={buttonVariants({ variant: "outline" })}
              >
                <item.icon data-icon="inline-start" />
                {item.title}
              </a>
            ))}
        </div>
      </div>
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

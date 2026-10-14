import { cn } from "cn";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Compass,
  Download,
  Clapperboard,
  Home,
  MonitorPlay,
  Orbit,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useCardNavigation } from "@/components/card-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useIsAdmin } from "../account/use-is-admin";
import { adminGroups, isAdminSectionAvailable } from "../admin/navigation";

type PageLink = {
  href: string;
  title: string;
  description?: string;
  disabled?: boolean;
  icon: LucideIcon;
};
const groups: { title: string; pages: PageLink[] }[] = [
  {
    title: "المكتبة والمشاهدة",
    pages: [
      {
        href: "#/home",
        title: "الرئيسية",
        description: "آخر الإضافات وما يستحق المشاهدة.",
        icon: Home,
      },
      { href: "#/search", title: "البحث", description: "ابحث عن عمل في مكتبتك.", icon: Search },
      {
        href: "#/browse",
        title: "تصفّح المكتبة",
        description: "الأعمال والمواسم مع مرشحات المكتبة.",
        icon: Compass,
      },
      {
        href: "#/watch",
        title: "مشاهدة مباشرة",
        description: "افتح عملًا للمشاهدة أو التنزيل.",
        icon: MonitorPlay,
      },
      {
        href: "#/releases",
        title: "التقويم",
        description: "مواعيد إصدار الأفلام والمواسم والحلقات.",
        icon: CalendarDays,
      },
    ],
  },
  {
    title: "اكتشف",
    pages: [
      {
        href: "#/episodes",
        title: "الحلقات",
        description: "أحدث الحلقات الصادرة في المكتبة.",
        icon: Clapperboard,
      },
      {
        href: "#/planets",
        title: "الكواكب",
        description: "عوالم المكتبة والأعمال التي تنتمي إليها.",
        icon: Orbit,
      },
      {
        href: "#/people",
        title: "الصنّاع",
        description: "الأشخاص وأعمالهم وأدوارهم فيها.",
        icon: Users,
      },
      {
        href: "#/studios",
        title: "الاستوديوهات",
        description: "الاستوديوهات وإنتاجاتها ومساهماتها.",
        icon: Building2,
      },
    ],
  },
  {
    title: "حسابك وجهازك",
    pages: [
      {
        href: "#/profile",
        title: "الملف الشخصي",
        description: "صورتك وبيانات حسابك وكلمة المرور.",
        icon: UserRound,
      },
      {
        href: "#/downloads",
        title: "التنزيلات",
        description: "التنزيلات المحفوظة على هذا الجهاز وحالتها.",
        icon: Download,
      },
    ],
  },
];

function PageCards({ title, pages }: { title: string; pages: PageLink[] }) {
  const navigation = useCardNavigation();
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-3 gap-4 max-[1050px]:grid-cols-2 max-[520px]:grid-cols-1">
        {pages.map((page) => (
          <a
            {...(page.disabled ? {} : navigation)}
            key={page.href}
            href={page.disabled ? undefined : page.href}
            role={page.disabled ? "link" : undefined}
            aria-disabled={page.disabled || undefined}
            tabIndex={page.disabled ? -1 : undefined}
            className={cn(
              "group/page min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              page.disabled && "cursor-not-allowed opacity-45",
            )}
          >
            <Card className="h-full gap-4">
              <CardContent className="flex items-center justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
                  <page.icon className="size-5" aria-hidden="true" />
                </span>
                <ArrowLeft
                  className="size-4 text-muted-foreground group-hover/page:text-primary group-focus-visible/page:text-primary"
                  aria-hidden="true"
                />
              </CardContent>
              <CardHeader>
                <CardTitle>{page.title}</CardTitle>
                {(page.description || page.disabled) && (
                  <CardDescription>
                    {page.disabled ? "غير متاح بعد" : page.description}
                  </CardDescription>
                )}
              </CardHeader>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}

export function MorePage() {
  const isAdmin = useIsAdmin();
  return (
    <div className="mx-auto flex max-w-380 flex-col gap-9 px-10 py-10 max-[720px]:px-5 max-[720px]:py-7">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold">المزيد</h1>
        <p className="text-sm text-muted-foreground">كل صفحات نحّاسيو، في مكان واحد.</p>
      </header>
      {groups.map((group) => (
        <PageCards key={group.title} {...group} />
      ))}
      {isAdmin && (
        <>
          <PageCards
            title="الإدارة"
            pages={[
              {
                href: "#/admin",
                title: "لوحة الإدارة",
                description: "نظرة عامة وأقسام إدارة المكتبة والخادم.",
                icon: ShieldCheck,
              },
            ]}
          />
          {adminGroups.map((group) => (
            <PageCards
              key={group.title}
              title={group.title}
              pages={group.items.map((item) => ({
                href: `#/admin/${item.slug}`,
                title: item.title,
                icon: item.icon,
                disabled: !isAdminSectionAvailable(item.slug),
              }))}
            />
          ))}
        </>
      )}
    </div>
  );
}

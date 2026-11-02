import {
  Building2,
  CalendarDays,
  Clapperboard,
  Compass,
  Home,
  MonitorPlay,
  Orbit,
  Search,
  Users,
  Film,
} from "lucide-react";
import { Download, Settings, ShieldCheck, UserRound } from "lucide-react";

import { adminGroups, isAdminSectionAvailable } from "../admin/navigation";

export const libraryPages = [
  { path: "home", label: "الرئيسية", description: "آخر الإضافات ومختارات المكتبة", icon: Home },
  { path: "search", label: "البحث", description: "ابحث عن عمل أو اسم في المكتبة", icon: Search },
  {
    path: "browse",
    label: "تصفّح المكتبة",
    description: "الأعمال والمرشحات وعروض التصفح",
    icon: Compass,
  },
  {
    path: "releases",
    label: "التقويم",
    description: "مواعيد الأفلام والمواسم والحلقات",
    icon: CalendarDays,
  },
  {
    path: "planets",
    label: "الكواكب",
    description: "العوالم والأعمال التي تنتمي إليها",
    icon: Orbit,
  },
  {
    path: "episodes",
    label: "الحلقات",
    description: "أحدث الحلقات في المكتبة",
    icon: Clapperboard,
  },
  {
    path: "watch",
    label: "مشاهدة مباشرة",
    description: "افتح عملًا للمشاهدة أو التنزيل",
    icon: MonitorPlay,
  },
  {
    path: "trailers",
    label: "الإعلانات التشويقية",
    description: "شاهد إعلانات الأعمال على YouTube",
    icon: Film,
  },
  {
    path: "studios",
    label: "الاستوديوهات",
    description: "الاستوديوهات وإنتاجاتها ومساهماتها",
    icon: Building2,
  },
  { path: "people", label: "الصنّاع", description: "الأشخاص وأعمالهم وأدوارهم", icon: Users },
];

export function pageDirectory(isAdmin: boolean) {
  const viewer = [
    ...libraryPages.map((page) => ({ ...page, href: `#/${page.path}`, group: "المكتبة" })),
    {
      path: "downloads",
      href: "#/downloads",
      label: "التنزيلات",
      description: "تنزيلات الجهاز والأعمال المحفوظة",
      icon: Download,
      group: "حسابي والجهاز",
    },
    {
      path: "profile",
      href: "#/profile",
      label: "الملف الشخصي",
      description: "حسابك ونشاطك",
      icon: UserRound,
      group: "حسابي والجهاز",
    },
    {
      path: "settings",
      href: "#/settings",
      label: "الإعدادات والمساعدة",
      description: "المظهر والتشغيل والاتصال",
      icon: Settings,
      group: "حسابي والجهاز",
    },
  ];
  if (!isAdmin) return viewer;
  return [
    ...viewer,
    {
      path: "admin",
      href: "#/admin",
      label: "لوحة الإدارة",
      description: "نظرة عامة على المكتبة والخادم",
      icon: ShieldCheck,
      group: "الإدارة",
    },
    ...adminGroups.flatMap((group) =>
      group.items
        .filter((item) => isAdminSectionAvailable(item.slug))
        .map((item) => ({
          path: `admin/${item.slug}`,
          href: `#/admin/${item.slug}`,
          label: item.title,
          description: group.title,
          icon: item.icon,
          group: "الإدارة",
        })),
    ),
  ];
}

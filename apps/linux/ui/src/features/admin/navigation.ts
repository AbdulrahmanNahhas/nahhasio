import {
  Activity,
  Award,
  Braces,
  Building2,
  Download,
  Film,
  Globe,
  HardDrive,
  Images,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  TableProperties,
  Tags,
  Users,
  Wrench,
} from "lucide-react";

export const adminGroups = [
  {
    title: "المكتبة والتحرير",
    items: [
      { slug: "works", title: "الأعمال", icon: Film },
      { slug: "people", title: "الأشخاص", icon: Users },
      { slug: "studios", title: "الاستوديوهات", icon: Building2 },
      { slug: "planets", title: "العوالم", icon: Globe },
      { slug: "awards", title: "الجوائز", icon: Award },
      { slug: "images", title: "مكتبة الصور", icon: Images },
    ],
  },
  {
    title: "تنظيم البيانات",
    items: [
      { slug: "vocabularies", title: "المفردات والترجمات", icon: Tags },
      { slug: "json", title: "محرر JSON", icon: Braces },
      { slug: "revisions", title: "سجل التعديلات", icon: ScrollText },
      { slug: "tables", title: "جميع الجداول", icon: TableProperties },
    ],
  },
  {
    title: "إدارة الخادم",
    items: [
      { slug: "library", title: "مكتبة الملفات", icon: HardDrive },
      { slug: "downloads", title: "تنزيلات الخادم", icon: Download },
      { slug: "accounts", title: "الحسابات والوصول", icon: ShieldCheck },
      { slug: "activity", title: "نشاط الخادم", icon: Activity },
      { slug: "maintenance", title: "صيانة الخادم", icon: Wrench },
      { slug: "settings", title: "الإعدادات والاتصالات", icon: Settings },
    ],
  },
] as const;
export const overview = { slug: "", title: "نظرة عامة", icon: LayoutDashboard };
export function adminSection(slug: string) {
  return adminGroups.flatMap((group) => [...group.items]).find((item) => item.slug === slug);
}

const implementedAdminSections: ReadonlySet<string> = new Set(
  adminGroups.flatMap((group) => group.items.map((item) => item.slug)),
);
export function isAdminSectionAvailable(slug: string) {
  return implementedAdminSections.has(slug);
}

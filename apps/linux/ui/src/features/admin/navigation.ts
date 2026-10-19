import {
  Activity,
  Archive,
  Award,
  BookOpen,
  Braces,
  Building2,
  Clapperboard,
  Download,
  Film,
  GitBranch,
  Globe,
  HardDrive,
  Images,
  LayoutDashboard,
  Layers,
  ListChecks,
  ListVideo,
  Monitor,
  Plug,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  TableProperties,
  Tags,
  Users,
  WandSparkles,
  Waypoints,
} from "lucide-react";

export const adminGroups = [
  {
    title: "المحتوى والتحرير",
    items: [
      { slug: "works", title: "الأعمال", icon: Film },
      { slug: "installments", title: "المواسم والأفلام", icon: Clapperboard },
      { slug: "episodes", title: "الحلقات", icon: ListVideo },
      { slug: "people", title: "الأشخاص", icon: Users },
      { slug: "studios", title: "الاستوديوهات", icon: Building2 },
      { slug: "planets", title: "العوالم", icon: Globe },
      { slug: "relationships", title: "العلاقات", icon: GitBranch },
      { slug: "scores", title: "التقييمات والتحليل", icon: WandSparkles },
      { slug: "awards", title: "الجوائز", icon: Award },
      { slug: "vocabularies", title: "المفردات والترجمات", icon: Tags },
      { slug: "credits", title: "المساهمات", icon: BookOpen },
      { slug: "evidence", title: "المراجع والملاحظات", icon: ScrollText },
    ],
  },
  {
    title: "أدوات البيانات",
    items: [
      { slug: "images", title: "مكتبة الصور", icon: Images },
      { slug: "json", title: "محرر JSON", icon: Braces },
      { slug: "validation", title: "التحقق والصيانة", icon: ListChecks },
      { slug: "revisions", title: "السجل وسلة المحذوفات", icon: ScrollText },
      { slug: "graph", title: "مخطط العلاقات", icon: Waypoints },
      { slug: "tables", title: "جميع الجداول", icon: TableProperties },
    ],
  },
  {
    title: "الخادم والمكتبة",
    items: [
      { slug: "downloads", title: "تنزيلات الخادم", icon: Download },
      { slug: "library", title: "مكتبة الملفات", icon: HardDrive },
      { slug: "accounts", title: "المستخدمون", icon: Users },
      { slug: "profiles", title: "ملفات المشاهدة", icon: Layers },
      { slug: "policies", title: "السياسات والصلاحيات", icon: ShieldCheck },
      { slug: "devices", title: "الأجهزة", icon: Monitor },
      { slug: "jobs", title: "المهام", icon: ListChecks },
      { slug: "logs", title: "السجلات", icon: ScrollText },
      { slug: "backups", title: "النسخ والاستعادة", icon: Archive },
      { slug: "updates", title: "التحديثات", icon: RefreshCw },
      { slug: "integrations", title: "الخدمات المتصلة", icon: Plug },
      { slug: "statistics", title: "الإحصاءات", icon: Activity },
      { slug: "settings", title: "الإعدادات", icon: Settings },
    ],
  },
] as const;
export const overview = { slug: "", title: "أدوات الإدارة", icon: LayoutDashboard };
export function adminSection(slug: string) {
  return adminGroups.flatMap((group) => [...group.items]).find((item) => item.slug === slug);
}

import { inspectionSections } from "./inspection-sections";

// Keep every navigation surface honest: editor subpages live under Works, not separate links.
const implementedAdminSections: ReadonlySet<string> = new Set([
  "works",
  "images",
  "json",
  "people",
  "studios",
  "planets",
]);
export function isAdminSectionAvailable(slug: string) {
  return implementedAdminSections.has(slug) || slug in inspectionSections;
}

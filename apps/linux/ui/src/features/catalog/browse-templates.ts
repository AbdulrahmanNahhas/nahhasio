import type { BrowseFilters } from "@nahhasio/api-contract";
import { BookOpen, Clock3, Compass, Heart, Library, Orbit, Star, Tags } from "lucide-react";

import type { BrowseGroup, SortOrder } from "./browse-refinements";
import { displayDefaults, type DisplayPreferences } from "./display-preferences";
import { emptyFilters } from "./filter-model";

type Template = {
  id: string;
  title: string;
  description: string;
  section: "watch" | "explore";
  icon: typeof Library;
  sort: SortOrder;
  group?: BrowseGroup;
  facet?: { key: string; value: string };
  facets?: BrowseFilters["facets"];
  minimumRating?: number;
  display?: Partial<DisplayPreferences>;
};

// Product-owned shortcuts. Applying a template never changes its definition.
export const browseTemplates: readonly Template[] = [
  {
    id: "continue",
    title: "أكمل المشاهدة",
    description: "الأعمال التي بدأتَها، حسب آخر تحديث.",
    section: "watch",
    icon: Clock3,
    sort: "updated-desc",
    facet: { key: "watchStates", value: "in-progress" },
  },
  {
    id: "next",
    title: "ماذا أشاهد؟",
    description: "لم تشاهدها بعد، بتقييم 7 فأعلى؛ الأفضل أولًا.",
    section: "watch",
    icon: Compass,
    sort: "score-desc",
    facet: { key: "watchStates", value: "unwatched" },
    minimumRating: 7,
  },
  {
    id: "favorites",
    title: "المفضلة",
    description: "أعمالك المفضلة، مرتبة حسب التقييم.",
    section: "watch",
    icon: Heart,
    sort: "score-desc",
    facet: { key: "favoriteStates", value: "favorite" },
    display: { layout: "banner" },
  },
  {
    id: "latest",
    title: "أحدث الإصدارات",
    description: "أحدث موسم أو إصدار متاح لكل عمل.",
    section: "watch",
    icon: BookOpen,
    sort: "latest-released-desc",
    facet: { key: "releaseStates", value: "released" },
    display: { layout: "banner" },
  },
  {
    id: "all",
    title: "كل المكتبة",
    description: "بلا مرشحات، مع أحدث الأعمال المضافة أولًا.",
    section: "explore",
    icon: Library,
    sort: "added-desc",
  },
  {
    id: "arabic-cartoon",
    title: "كرتون عربي",
    description: "كل أفلام ومسلسلات الرسوم المتحركة المدبلجة بالعربية، القديمة والجديدة.",
    section: "explore",
    icon: Library,
    sort: "year-desc",
    facets: [
      { key: "dubLanguages", include: ["ar"], exclude: [] },
      { key: "kinds", include: ["animated-series", "animated-movie"], exclude: [] },
    ],
  },
  {
    id: "anime",
    title: "أنمي",
    description: "مسلسلات الأنمي بلا كلاسيكيات الطفولة والأنمي الرومانسي، بملصقات صغيرة وصور فقط.",
    section: "explore",
    icon: BookOpen,
    sort: "year-desc",
    facets: [
      {
        key: "tags",
        include: ["anime-series"],
        exclude: ["childhood-classic", "romance-focused-anime"],
      },
    ],
    display: {
      layout: "poster",
      size: "compact",
      minimal: true,
      showScore: false,
      showStatus: false,
    },
  },
  {
    id: "top",
    title: "الأعلى تقييمًا",
    description: "تقييم 8 فأعلى، من الأعلى إلى الأقل.",
    section: "explore",
    icon: Star,
    sort: "score-desc",
    minimumRating: 8,
  },
  {
    id: "worlds",
    title: "بين الكواكب",
    description: "أعمال كل كوكب معًا، بأسمائها وشعاراتها.",
    section: "explore",
    icon: Orbit,
    sort: "title",
    group: "planet",
    display: { layout: "logo", borderless: true },
  },
  {
    id: "timeline",
    title: "عبر السنوات",
    description: "جدول زمني مجمّع بالسنة، من الأقدم إلى الأحدث.",
    section: "explore",
    icon: Clock3,
    sort: "year-asc",
    group: "year",
    display: {
      layout: "table",
      tableColumns: ["release", "status", "score", "watchState"],
      tableDensity: "compact",
      tableTitle: "both",
    },
  },
  {
    id: "unrated",
    title: "بانتظار التقييم",
    description: "الأعمال غير المقيّمة في جدول مختصر.",
    section: "explore",
    icon: Tags,
    sort: "updated-desc",
    facet: { key: "ratingStates", value: "unrated" },
    display: {
      layout: "table",
      tableColumns: ["release", "status", "audience"],
      tableDensity: "compact",
    },
  },
];

export function templateSettings(template: Template, privacy: string | null) {
  const filters: BrowseFilters = emptyFilters();
  if (template.facet)
    filters.facets.push({ key: template.facet.key, include: [template.facet.value], exclude: [] });
  for (const facet of template.facets ?? [])
    filters.facets.push({ ...facet, include: [...facet.include], exclude: [...facet.exclude] });
  filters.minimumRating = template.minimumRating ?? 0;
  const params = new URLSearchParams({
    view: "works",
    sort: template.sort,
    group: template.group ?? "none",
    filters: JSON.stringify(filters),
  });
  if (privacy === "all" || privacy === "private") params.set("privacy", privacy);
  return { search: params.toString(), display: { ...displayDefaults, ...template.display } };
}

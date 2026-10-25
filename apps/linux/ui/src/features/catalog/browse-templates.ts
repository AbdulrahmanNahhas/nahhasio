import type { BrowseFilters } from "@nahhasio/api-contract";

import { displayDefaults } from "./display-preferences";
import { emptyFilters } from "./filter-model";

function facet(key: string, include: string[] = [], exclude: string[] = []) {
  return { key, include, exclude };
}

type Template = {
  id: string;
  title: string;
  description: string;
  facets: BrowseFilters["facets"];
};

// Product-owned categories use explicit catalog facets, without watch/rating restrictions.
export const browseTemplates: readonly Template[] = [
  {
    id: "anime",
    title: "كرتون حديث (شرقي وغربي)",
    description: "مسلسلات الأنمي او الكرتون الغربي، باستثناء الأعمال الموسومة بكلاسيكيات الطفولة.",
    facets: [facet("kinds", ["animated-series"]), facet("tags", ["childhood-classic"])],
  },
  {
    id: "arabic-cartoon",
    title: "كرتون عربي",
    description: "مسلسلات الرسوم المتحركة التي سُجّلت لها دبلجة عربية.",
    facets: [facet("kinds", ["animated-series"]), facet("dubLanguages", ["ar"])],
  },
  {
    id: "eastern-animation-movies",
    title: "أفلام أنميشن شرقي",
    description: "أفلام الأنمي حسب تصنيف المكتبة، من كل السنوات.",
    facets: [facet("kinds", ["animated-movie"]), facet("tags", ["anime-movie"])],
  },
  {
    id: "western-animation-movies",
    title: "أفلام أنميشن غربي",
    description: "بقية أفلام الرسوم المتحركة، بما فيها المدبلجة بالعربية.",
    facets: [facet("kinds", ["animated-movie"]), facet("tags", [], ["anime-movie"])],
  },
  {
    id: "live-action-movies",
    title: "أفلام تمثيل حي",
    description: "جميع أفلام التمثيل الحي، العربية والأجنبية.",
    facets: [facet("kinds", ["live-action-movie"])],
  },
  {
    id: "western-series",
    title: "مسلسلات غربية",
    description: "مسلسلات التمثيل الحي التي لم تُسجّل لها دبلجة عربية.",
    facets: [facet("kinds", ["live-action-series"]), facet("dubLanguages", [], ["ar"])],
  },
  {
    id: "arabic-series",
    title: "مسلسلات عربية",
    description: "مسلسلات التمثيل الحي التي سُجّلت لها دبلجة عربية.",
    facets: [facet("kinds", ["live-action-series"]), facet("dubLanguages", ["ar"])],
  },
];

export function templateSettings(template: Template, privacy: string | null) {
  const filters: BrowseFilters = emptyFilters();
  filters.facets = template.facets.map((item) => ({
    ...item,
    include: [...item.include],
    exclude: [...item.exclude],
  }));
  const params = new URLSearchParams({
    view: "works",
    sort: "year-desc",
    group: "none",
    filters: JSON.stringify(filters),
  });
  if (privacy === "all" || privacy === "private") params.set("privacy", privacy);
  return {
    search: params.toString(),
    display: {
      ...displayDefaults,
      size: "compact" as const,
      minimal: true,
      showScore: false,
      showStatus: false,
    },
  };
}

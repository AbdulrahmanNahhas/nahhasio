import type { BrowseFilters } from "@nahhasio/api-contract";

import { emptyFilters, parseFilters } from "./filter-model";

function templateFacet(key: string, include: string[] = [], exclude: string[] = []) {
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
    title: "كرتون حديث",
    description: "مسلسلات الأنمي او الكرتون الغربي، باستثناء الأعمال الموسومة بكلاسيكيات الطفولة.",
    facets: [
      templateFacet("kinds", ["animated-series"]),
      templateFacet("tags", [], ["childhood-classic"]),
    ],
  },
  {
    id: "arabic-cartoon",
    title: "كرتون عربي",
    description: "مسلسلات الرسوم المتحركة التي سُجّلت لها دبلجة عربية.",
    facets: [templateFacet("kinds", ["animated-series"]), templateFacet("dubLanguages", ["ar"])],
  },
  {
    id: "eastern-animation-movies",
    title: "أفلام أنميشن شرقي",
    description: "أفلام الأنمي حسب تصنيف المكتبة، من كل السنوات.",
    facets: [templateFacet("kinds", ["animated-movie"]), templateFacet("tags", ["anime-movie"])],
  },
  {
    id: "western-animation-movies",
    title: "أفلام أنميشن غربي",
    description: "بقية أفلام الرسوم المتحركة، بما فيها المدبلجة بالعربية.",
    facets: [
      templateFacet("kinds", ["animated-movie"]),
      templateFacet("tags", [], ["anime-movie"]),
    ],
  },
  {
    id: "live-action-movies",
    title: "أفلام تمثيل حي",
    description: "جميع أفلام التمثيل الحي، العربية والأجنبية.",
    facets: [templateFacet("kinds", ["live-action-movie"])],
  },
  {
    id: "western-series",
    title: "مسلسلات غربية",
    description: "مسلسلات التمثيل الحي التي لم تُسجّل لها دبلجة عربية.",
    facets: [
      templateFacet("kinds", ["live-action-series"]),
      templateFacet("dubLanguages", [], ["ar"]),
    ],
  },
  {
    id: "arabic-series",
    title: "مسلسلات عربية",
    description: "مسلسلات التمثيل الحي التي سُجّلت لها دبلجة عربية.",
    facets: [templateFacet("kinds", ["live-action-series"]), templateFacet("dubLanguages", ["ar"])],
  },
];

/** Old category links remain readable; new links store the library separately from refinements. */
export function browseLibrary(params: URLSearchParams) {
  const filters = parseFilters(params.get("filters"));
  const explicit = params.get("library");
  const template = explicit
    ? browseTemplates.find((item) => item.id === explicit)
    : browseTemplates.find(
        (item) =>
          item.facets.length === filters.facets.length &&
          item.facets.every((base) =>
            filters.facets.some(
              (facet) =>
                facet.key === base.key &&
                JSON.stringify(facet.include) === JSON.stringify(base.include) &&
                JSON.stringify(facet.exclude) === JSON.stringify(base.exclude),
            ),
          ),
      );
  return {
    template,
    filters: !explicit && template ? { ...filters, facets: [] } : filters,
  };
}

export function libraryFilters(filters: BrowseFilters, library?: string): BrowseFilters {
  const template = browseTemplates.find((item) => item.id === library);
  if (!template) return filters;
  return {
    ...filters,
    facets: [
      ...filters.facets.filter((facet) => !template.facets.some((base) => base.key === facet.key)),
      ...template.facets,
    ],
  };
}

export function selectLibrary(params: URLSearchParams, library: string) {
  const next = new URLSearchParams(params);
  next.set("library", browseTemplates.some((item) => item.id === library) ? library : "all");
  // Extra filters belong to the library being left. Presentation and sort stay shared.
  next.set("filters", JSON.stringify(emptyFilters()));
  next.delete("from");
  next.delete("to");
  next.delete("q");
  return next;
}

import type { FacetCatalog } from "@nahhasio/api-contract";
import { Building2, Orbit, Users } from "lucide-react";

import { facetMatches } from "../catalog/filter-model";
import type { SearchType } from "./search-model";

const entityTypes = [
  { key: "contributors", type: "people", label: "الصنّاع", icon: Users },
  { key: "studios", type: "studios", label: "الاستوديوهات", icon: Building2 },
  { key: "planets", type: "planets", label: "الكواكب", icon: Orbit },
] as const;
export function matchingEntities(data: FacetCatalog | undefined, q: string, type: SearchType) {
  if (!q) return [];
  return entityTypes
    .filter((group) => type === "all" || type === group.type)
    .flatMap((group) =>
      (data?.groups.find((facet) => facet.key === group.key)?.options ?? [])
        .filter((item) => facetMatches(item, q))
        .map((item) => ({ ...item, group })),
    );
}

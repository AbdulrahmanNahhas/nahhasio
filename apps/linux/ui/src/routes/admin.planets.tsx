import { createFileRoute } from "@tanstack/react-router";

import { PlanetMovementPage } from "@/features/admin/planets/planet-movement-page";
import { planetSearchSchema } from "@/features/admin/planets/planets.queries";

export const Route = createFileRoute("/admin/planets")({
  validateSearch: planetSearchSchema,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PlanetMovementPage
      key={search.source}
      search={search}
      onChange={(patch) =>
        void navigate({
          search: (previous) => ({ ...previous, ...patch, page: patch.page ?? "1" }),
          resetScroll: false,
        })
      }
    />
  );
}

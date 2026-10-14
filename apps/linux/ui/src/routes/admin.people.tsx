import { createFileRoute } from "@tanstack/react-router";

import { EntitiesPage } from "../features/admin/entities/entities-page";
import { entitySearchSchema } from "../features/admin/entities/entities.queries";
export const Route = createFileRoute("/admin/people")({
  validateSearch: entitySearchSchema,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <EntitiesPage
      kind="person"
      search={search}
      onChange={(patch, resetPage = true) =>
        void navigate({
          search: (previous) => ({
            ...previous,
            ...patch,
            page: resetPage ? "1" : (patch.page ?? previous.page),
          }),
          resetScroll: resetPage,
        })
      }
    />
  );
}

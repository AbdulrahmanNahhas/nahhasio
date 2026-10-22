import { createFileRoute } from "@tanstack/react-router";

import { AwardsPage } from "@/features/admin/awards/awards-page";
import { awardSearchSchema } from "@/features/admin/awards/awards.queries";
export const Route = createFileRoute("/admin/awards")({
  validateSearch: awardSearchSchema,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AwardsPage
      search={search}
      onChange={(patch) => void navigate({ search: (previous) => ({ ...previous, ...patch }) })}
    />
  );
}

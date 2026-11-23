import { createFileRoute } from "@tanstack/react-router";

import { AwardsDirectory } from "@/features/awards/award-pages";
import { awardsSearch } from "@/features/awards/awards.queries";

export const Route = createFileRoute("/awards")({
  validateSearch: awardsSearch,
  component: Page,
});

function Page() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AwardsDirectory
      page={Number(page)}
      onPage={(next) => void navigate({ search: { page: String(next) } })}
    />
  );
}

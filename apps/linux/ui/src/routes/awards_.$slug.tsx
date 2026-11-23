import { createFileRoute } from "@tanstack/react-router";

import { AwardArchive } from "@/features/awards/award-pages";
import { awardSearch } from "@/features/awards/awards.queries";

export const Route = createFileRoute("/awards_/$slug")({
  validateSearch: awardSearch,
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const { year, page } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AwardArchive
      key={slug}
      slug={slug}
      year={year || undefined}
      page={Number(page)}
      onYear={(next) => void navigate({ search: { year: next, page: "1" } })}
      onPage={(next) => void navigate({ search: { year, page: String(next) } })}
    />
  );
}

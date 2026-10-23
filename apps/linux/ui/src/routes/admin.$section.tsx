import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { AdminSectionPage } from "../features/account/admin-page";
import { adminSection } from "../features/admin/navigation";

export const Route = createFileRoute("/admin/$section")({
  validateSearch: z.object({ tab: z.string().max(40).catch("").default("") }),
  beforeLoad: ({ params }) => {
    const section = params.section;
    if (["episodes", "relationships", "credits", "evidence", "graph"].includes(section))
      throw notFound();
    if (section === "installments" || section === "scores") throw redirect({ to: "/admin/works" });
    if (section === "statistics") throw redirect({ to: "/admin" });
    const destination = ["devices", "profiles", "policies"].includes(section)
      ? "accounts"
      : ["jobs", "logs"].includes(section)
        ? "activity"
        : ["backups", "updates", "validation"].includes(section)
          ? "maintenance"
          : section === "integrations"
            ? "settings"
            : null;
    if (destination)
      throw redirect({
        to: "/admin/$section",
        params: { section: destination },
        search: { tab: section },
      });
    if (!adminSection(section)) throw notFound();
  },
  component: Section,
});
function Section() {
  const { section } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminSectionPage
      section={section}
      tab={tab}
      onTabChange={(value) => void navigate({ search: { tab: value } })}
    />
  );
}

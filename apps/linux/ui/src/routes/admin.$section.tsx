import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { AdminSectionPage } from "../features/account/admin-page";
import { adminSection } from "../features/admin/navigation";

export const Route = createFileRoute("/admin/$section")({
  validateSearch: z.object({
    tab: z.string().max(40).catch("").default(""),
    q: z.string().max(200).catch("").default(""),
    workId: z
      .union([z.string().uuid(), z.literal("")])
      .catch("")
      .default(""),
    mediaView: z.enum(["files", "works", "missing"]).catch("works").default("works"),
    mediaState: z.enum(["all", "present", "needs-review", "trash"]).catch("all").default("all"),
    mediaSource: z.enum(["all", "server-folder", "youtube", "upload"]).catch("all").default("all"),
    page: z
      .string()
      .regex(/^[1-9][0-9]{0,5}$/)
      .refine((value) => Number(value) <= 100000)
      .catch("1")
      .default("1"),
    jobState: z
      .enum(["all", "queued", "running", "completed", "failed", "cancelled"])
      .catch("all")
      .default("all"),
    order: z.enum(["newest", "oldest"]).catch("newest").default("newest"),
  }),
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
  return <AdminSectionPage section={section} tab={tab} />;
}

import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminSectionPage } from "../features/account/admin-page";
export const Route = createFileRoute("/admin/$section")({
  beforeLoad: ({ params }) => {
    if (params.section === "installments" || params.section === "scores")
      throw redirect({ to: "/admin/works" });
  },
  component: Section,
});
function Section() {
  const { section } = Route.useParams();
  return <AdminSectionPage section={section} />;
}

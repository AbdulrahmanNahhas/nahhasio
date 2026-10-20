import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ProfilePage } from "../features/account/profile-page";
export const Route = createFileRoute("/profiles/$id")({
  validateSearch: z.object({
    edit: z.enum(["profile", "security", "device"]).optional().catch(undefined),
  }),
  component: Page,
});
function Page() {
  const { id } = Route.useParams();
  return <ProfilePage id={id} />;
}

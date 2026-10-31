import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { sectionSchema } from "@/features/settings/settings-data";
import { SettingsPage } from "@/features/settings/settings-page";

export const Route = createFileRoute("/settings")({
  validateSearch: z.object({ section: sectionSchema.optional().catch(undefined) }),
  component: SettingsPage,
});

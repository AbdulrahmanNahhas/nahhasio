import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { DownloadsPage } from "../features/player/downloads-page";

export const Route = createFileRoute("/downloads")({
  validateSearch: z.object({
    view: z.enum(["saved", "library", "queue", "storage"]).catch("saved"),
  }),
  component: DownloadsPage,
});

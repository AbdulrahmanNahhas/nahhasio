import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "../features/home/home-page";

// Older links open the shared search dialog over Home through ViewerShell.
export const Route = createFileRoute("/search")({ component: HomePage });

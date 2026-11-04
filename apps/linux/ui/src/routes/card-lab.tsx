import { createFileRoute, lazyRouteComponent, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/card-lab")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: import.meta.env.DEV
    ? lazyRouteComponent(() => import("../features/card-lab/card-lab-page"), "CardLabPage")
    : () => null,
});

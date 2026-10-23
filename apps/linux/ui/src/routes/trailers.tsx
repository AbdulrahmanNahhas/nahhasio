import { createFileRoute } from "@tanstack/react-router";

import { useViewerRoute } from "../features/shell/navigation";
import { TrailersPage } from "../features/trailers/trailers-page";

function Page() {
  const route = useViewerRoute();
  return <TrailersPage params={route.params} />;
}
export const Route = createFileRoute("/trailers")({ component: Page });

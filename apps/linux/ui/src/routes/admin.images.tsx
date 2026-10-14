import { createFileRoute } from "@tanstack/react-router";

import { imageSearchSchema } from "../features/admin/images/images-model";
import { ImagesPage } from "../features/admin/images/images-page";
export const Route = createFileRoute("/admin/images")({
  validateSearch: imageSearchSchema,
  component: Page,
});
function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <ImagesPage
      search={search}
      onChange={(patch, resetPage = true) =>
        void navigate({
          search: (previous) => ({
            ...previous,
            ...patch,
            page: resetPage ? "1" : (patch.page ?? previous.page),
          }),
          resetScroll: resetPage,
        })
      }
    />
  );
}

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { useCatalogSelection } from "../features/admin/catalog-selection";
import { editorSearchSchema } from "../features/admin/editor-search";
import { EntityJsonEditor } from "../features/editor/json/adapters/entity-json-editor";
import { JsonEditorPage } from "../features/editor/json/document/json-editor-page";
import { SelectedWorksEditor } from "../features/editor/work/selected-works-editor";
import { gateway } from "../lib/bridge";
export const Route = createFileRoute("/admin/json")({
  validateSearch: editorSearchSchema,
  component: Page,
});
function Page() {
  const { ids, target, selection } = Route.useSearch();
  if (target === "works" && selection === "works") return <SelectedWorksEditor />;
  const selected = ids
    .split(",")
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
  if (target !== "works")
    return selection === target ? (
      <SelectedEntitiesEditor target={target} />
    ) : (
      <EntityJsonEditor target={target} ids={selected} />
    );
  return (
    <JsonEditorPage
      ids={ids
        .split(",")
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))}
    />
  );
}

function SelectedEntitiesEditor({ target }: { target: "people" | "studios" }) {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });
  const selection = useCatalogSelection(session.data?.user.id ?? "signed-out", target);
  return <EntityJsonEditor target={target} ids={selection.selected.map((record) => record.id)} />;
}

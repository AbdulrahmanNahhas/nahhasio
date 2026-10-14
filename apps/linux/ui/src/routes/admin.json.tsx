import { createFileRoute } from "@tanstack/react-router";

import { editorSearchSchema } from "../features/admin/editor-search";
import { EntityJsonEditor } from "../features/editor/json/adapters/entity-json-editor";
import { JsonEditorPage } from "../features/editor/json/document/json-editor-page";
export const Route = createFileRoute("/admin/json")({
  validateSearch: editorSearchSchema,
  component: Page,
});
function Page() {
  const { ids, target } = Route.useSearch();
  const selected = ids
    .split(",")
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    .slice(0, 30);
  if (target !== "works") return <EntityJsonEditor target={target} ids={selected} />;
  return (
    <JsonEditorPage
      ids={ids
        .split(",")
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        .slice(0, 30)}
    />
  );
}

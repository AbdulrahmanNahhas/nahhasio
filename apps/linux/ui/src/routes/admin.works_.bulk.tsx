import { createFileRoute } from "@tanstack/react-router";

import { editorSearchSchema } from "../features/admin/editor-search";
import { JsonEditorPage } from "../features/editor/json/document/json-editor-page";
import { SelectedWorksEditor } from "../features/editor/work/selected-works-editor";
export const Route = createFileRoute("/admin/works_/bulk")({
  validateSearch: editorSearchSchema,
  component: Page,
});
function Page() {
  const { ids, selection } = Route.useSearch();
  if (selection === "works") return <SelectedWorksEditor bulk />;
  return (
    <JsonEditorPage
      ids={ids
        .split(",")
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))}
      bulk
    />
  );
}

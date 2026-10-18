import { useQuery } from "@tanstack/react-query";

import { useCatalogSelection } from "@/features/admin/catalog-selection";
import { gateway } from "@/lib/bridge";

import { JsonEditorPage } from "../json/document/json-editor-page";

/** The editor reads the explicit session selection, avoiding long/truncated UUID URLs. */
export function SelectedWorksEditor({ bulk = false }: { bulk?: boolean }) {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });
  const selection = useCatalogSelection(session.data?.user.id ?? "signed-out");
  return <JsonEditorPage ids={selection.selected.map((record) => record.id)} bulk={bulk} />;
}

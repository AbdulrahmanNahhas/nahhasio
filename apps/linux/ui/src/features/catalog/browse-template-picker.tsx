import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { browseTemplates, templateSettings } from "./browse-templates";
import { displayDefaults, type DisplayPreferences } from "./display-preferences";
import { emptyFilters, parseFilters } from "./filter-model";

export function BrowseTemplatePicker({
  search,
  onApply,
}: {
  search: string;
  onApply: (search: string, display: DisplayPreferences) => void;
}) {
  const current = new URLSearchParams(search);
  const filters = parseFilters(current.get("filters"));
  const active =
    (current.get("view") ?? "works") === "works"
      ? browseTemplates.find((template) => {
          const next = new URLSearchParams(templateSettings(template, null).search);
          return JSON.stringify(filters) === JSON.stringify(parseFilters(next.get("filters")));
        })
      : undefined;

  const allActive =
    (current.get("view") ?? "works") === "works" &&
    !current.get("q") &&
    !current.get("from") &&
    !current.get("to") &&
    JSON.stringify(filters) === JSON.stringify(parseFilters(null));

  return (
    <section className="mb-3 min-w-0 overflow-x-auto p-1" aria-label="فئات المكتبة">
      <ToggleGroup
        variant="outline"
        spacing={0}
        value={active ? [active.id] : allActive ? ["all"] : []}
        className="w-full min-w-max"
        aria-label="عروض التصفح"
        onValueChange={(values) => {
          if (values[0] === "all") {
            const params = new URLSearchParams({
              view: "works",
              sort: "year-desc",
              filters: JSON.stringify(emptyFilters()),
            });
            const privacy = current.get("privacy");
            if (privacy === "all" || privacy === "private") params.set("privacy", privacy);
            onApply(params.toString(), { ...displayDefaults });
            return;
          }
          const template = browseTemplates.find((item) => item.id === values[0]);
          if (!template) return;
          const next = templateSettings(template, current.get("privacy"));
          onApply(next.search, next.display);
        }}
      >
        <ToggleGroupItem value="all" className="flex-1" title="كل المكتبة بلا مرشحات">
          <span>كل المكتبة</span>
        </ToggleGroupItem>
        {browseTemplates.map((template) => (
          <ToggleGroupItem
            key={template.id}
            value={template.id}
            className="flex-1"
            title={template.description}
          >
            <span>{template.title}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </section>
  );
}

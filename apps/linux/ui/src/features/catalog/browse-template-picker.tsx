import { Choice } from "@/components/choice";

import { browseTemplates } from "./browse-templates";

const libraries = [
  { value: "all", label: "كل المكتبة" },
  ...browseTemplates.map(({ id, title }) => ({ value: id, label: title })),
];

export function BrowseTemplatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Choice
      animatePopup
      label="فئة المكتبة"
      options={libraries}
      value={value}
      onChange={onChange}
    />
  );
}

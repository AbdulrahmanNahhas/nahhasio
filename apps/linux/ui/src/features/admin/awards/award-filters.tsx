import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Choice } from "@/components/choice";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ReferenceField } from "@/features/editor/references/reference-field";

import { type AwardSearch } from "./awards.queries";
export function AwardFilters({
  search,
  onChange,
}: {
  search: AwardSearch;
  onChange: (patch: Partial<AwardSearch>) => void;
}) {
  const [open, setOpen] = useState(false);
  const filters = Object.fromEntries(
    search.organization ? [["organization_id", search.organization]] : [],
  );
  const active = !!(
    search.category ||
    search.ceremony ||
    search.year ||
    search.featured ||
    search.source !== "all" ||
    search.result !== "all" ||
    search.q
  );
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0 flex-1">
      <CollapsibleTrigger render={<Button variant="outline" className="justify-between" />}>
        <SlidersHorizontal data-icon="inline-start" />
        المرشحات{active ? " · نشطة" : ""}
        <ChevronDown data-icon="inline-end" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
          <FieldGroup className="grid sm:grid-cols-2 lg:grid-cols-3">
            <ReferenceField
              table="award_categories"
              label="فئة الجائزة"
              value={search.category}
              useIdValue
              filters={filters}
              onChange={(category) => onChange({ category, page: "1" })}
            />
            <ReferenceField
              table="award_ceremonies"
              label="الدورة"
              value={search.ceremony}
              useIdValue
              filters={filters}
              onChange={(ceremony) => onChange({ ceremony, page: "1" })}
              onPick={(option) =>
                onChange({
                  ceremony: option.id,
                  organization: option.organizationId ?? search.organization,
                  year: option.year ? String(option.year) : "",
                  page: "1",
                })
              }
            />
            <YearFilter
              key={search.year}
              year={search.year}
              onChange={(year) => onChange({ year, ceremony: "", page: "1" })}
            />
          </FieldGroup>
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-full sm:w-48">
              <FieldLabel>التوثيق</FieldLabel>
              <Choice
                label="التوثيق"
                value={search.source}
                options={[
                  { value: "all", label: "كل المصادر" },
                  { value: "documented", label: "موثّقة بمصدر" },
                  { value: "missing", label: "تحتاج إلى مصدر" },
                ]}
                onChange={(source) => {
                  if (source === "all" || source === "documented" || source === "missing")
                    onChange({ source, page: "1" });
                }}
              />
            </Field>
            <Field orientation="horizontal" className="w-auto">
              <Switch
                id="award-featured-filter"
                checked={search.featured === "yes"}
                onCheckedChange={(checked) =>
                  onChange({ featured: checked ? "yes" : "", page: "1" })
                }
              />
              <FieldLabel htmlFor="award-featured-filter">الجوائز البارزة فقط</FieldLabel>
            </Field>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
function YearFilter({ year, onChange }: { year: string; onChange: (year: string) => void }) {
  const [draft, setDraft] = useState(year);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onChange(draft);
      }}
    >
      <Field>
        <FieldLabel htmlFor="award-year-filter">سنة الجائزة</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="award-year-filter"
            type="number"
            min={1900}
            max={2100}
            placeholder="كل السنوات"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="outline">
            عرض السنة
          </Button>
        </div>
      </Field>
    </form>
  );
}

import { SlidersHorizontal, X } from "lucide-react";

import { Choice } from "@/components/choice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { entitySearchSchema, type EntityOptions, type EntitySearch } from "./entities.queries";

const choices = [
  {
    key: "image",
    label: "الصورة",
    items: [
      { value: "all", label: "الكل" },
      { value: "with", label: "بصورة" },
      { value: "without", label: "بدون صورة" },
    ],
  },
  {
    key: "usage",
    label: "الأعمال المرتبطة",
    items: [
      { value: "all", label: "الكل" },
      { value: "linked", label: "لها أعمال" },
      { value: "one", label: "عمل واحد" },
      { value: "unlinked", label: "بدون أعمال" },
    ],
  },
  {
    key: "language",
    label: "لغة المساهمة",
    items: [
      { value: "", label: "الكل" },
      { value: "ar", label: "العربية" },
      { value: "en", label: "English" },
      { value: "es", label: "الإسبانية" },
      { value: "ja", label: "اليابانية" },
    ],
  },
] as const;

export function EntityFilters({
  title,
  search,
  roles,
  onChange,
}: {
  title: string;
  search: EntitySearch;
  roles: EntityOptions["roles"] | undefined;
  onChange: (patch: Partial<EntitySearch>) => void;
}) {
  const active =
    Number(search.image !== "all") +
    Number(search.usage !== "all") +
    Number(!!search.role) +
    Number(!!search.language);
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        <SlidersHorizontal data-icon="inline-start" />
        المرشحات
        {active > 0 && <Badge variant="secondary">{active}</Badge>}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-120 w-xl max-w-[calc(100vw-2rem)] overflow-y-auto scroll-fade-y"
      >
        <PopoverHeader>
          <div className="flex items-center justify-between gap-3">
            <PopoverTitle>مرشحات {title}</PopoverTitle>
            <Button
              variant="ghost"
              size="sm"
              disabled={!active}
              onClick={() => onChange({ image: "all", usage: "all", role: "", language: "" })}
            >
              <X data-icon="inline-start" />
              مسح
            </Button>
          </div>
        </PopoverHeader>
        <FieldGroup className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="entity-filter-role">دور المساهمة</FieldLabel>
            <Choice
              id="entity-filter-role"
              label="دور المساهمة"
              value={search.role}
              options={[
                { value: "", label: "كل الأدوار" },
                ...(roles ?? []).map((role) => ({ value: role.slug, label: role.label })),
              ]}
              onChange={(role) => onChange({ role })}
            />
          </Field>
          {choices.map((group) => (
            <Field key={group.key}>
              <FieldLabel id={`entity-filter-${group.key}-label`}>{group.label}</FieldLabel>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={1}
                className="flex-wrap"
                aria-labelledby={`entity-filter-${group.key}-label`}
                value={[search[group.key]]}
                onValueChange={(values) => {
                  const next = entitySearchSchema.parse({
                    ...search,
                    [group.key]: values[0] ?? (group.key === "language" ? "" : "all"),
                  });
                  onChange({ [group.key]: next[group.key] });
                }}
              >
                {group.items.map((item) => (
                  <ToggleGroupItem key={item.value} value={item.value}>
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          ))}
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}

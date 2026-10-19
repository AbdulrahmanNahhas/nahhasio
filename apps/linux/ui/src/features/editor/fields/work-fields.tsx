import { PlusIcon, XIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ReferencePicker } from "@/features/editor/references/reference-picker";
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";

export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  min,
  max,
  step,
}: {
  label: ReactNode;
  value: string | number | null | undefined;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: "text" | "number" | "date";
  min?: number;
  max?: number;
  step?: string;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea
          dir="auto"
          id={id}
          rows={5}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          dir={type === "text" ? "auto" : "ltr"}
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}
export function SelectField<T extends string>({
  alignItemWithTrigger = true,
  hideLabel = false,
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  alignItemWithTrigger?: boolean;
  hideLabel?: boolean;
  items: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          const item = items.find((choice) => choice.value === next);
          if (item) onChange(item.value);
        }}
      >
        <SelectTrigger id={id} aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={alignItemWithTrigger}>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}
export function StringListField({
  label,
  values,
  onChange,
  table,
  ordered = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  table?: string;
  ordered?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const rows = useEditorRows(values);
  function add(value: string) {
    const text = value.trim();
    if (text && !values.includes(text)) onChange([...values, text]);
    setDraft("");
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex flex-col gap-3">
        {ordered ? (
          rows.map(({ key, value }, index) => (
            <div key={key} className="flex items-start gap-2">
              <Textarea
                aria-label={`${label} ${index + 1}`}
                rows={2}
                value={value}
                onChange={(event) =>
                  onChange(
                    values.map((item, position) =>
                      position === index ? event.target.value : item,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`حذف ${label} ${index + 1}`}
                onClick={() => onChange(values.filter((_, position) => position !== index))}
              >
                <XIcon data-icon="inline-start" />
              </Button>
            </div>
          ))
        ) : (
          <div className="flex flex-wrap gap-2">
            {values.map((value) => (
              <Button
                key={value}
                type="button"
                variant="secondary"
                size="sm"
                aria-label={`إزالة ${value}`}
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                <span dir="auto">{value}</span>
                <XIcon data-icon="inline-end" />
              </Button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            id={id}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="أضف قيمة…"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add(draft);
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`إضافة ${label}`}
            onClick={() => add(draft)}
          >
            <PlusIcon data-icon="inline-start" />
          </Button>
          {table && <ReferencePicker table={table} title={`اختيار ${label}`} onPick={add} />}
        </div>
      </div>
    </Field>
  );
}

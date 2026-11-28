import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-sdk/select";
import { Field, FieldLabel } from "@/components/ui/field";

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
        items={[...items]}
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

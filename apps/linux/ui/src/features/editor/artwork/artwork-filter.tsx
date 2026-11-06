import { useId } from "react";

import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxValue,
  ComboboxContent,
  ComboboxList,
  ComboboxGroup,
  ComboboxItem,
  ComboboxEmpty,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";

export function ArtworkFilter({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const id = useId();
  const anchor = useComboboxAnchor();
  const name = (key: string) => options.find((option) => option.value === key)?.label ?? key;
  return (
    <Field className="min-w-48 flex-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        multiple
        items={options.map((option) => option.value)}
        value={value}
        onValueChange={onChange}
        itemToStringLabel={name}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {value.map((key) => (
              <ComboboxChip key={key}>{name(key)}</ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput
            id={id}
            aria-label={label}
            placeholder={value.length ? "إضافة…" : placeholder}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>لا توجد خيارات مطابقة.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              {options.map((option) => (
                <ComboboxItem key={option.value} value={option.value}>
                  {option.label}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

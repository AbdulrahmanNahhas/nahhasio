import { useId, useState } from "react";

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
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { languageName } from "@/lib/languages";

const commonLanguages = [
  "ar",
  "en",
  "ja",
  "ko",
  "fr",
  "es",
  "de",
  "it",
  "pt",
  "pt-BR",
  "zh",
  "tr",
  "hi",
  "ru",
];
export function LanguagesField({
  label,
  values,
  onChange,
  description = "شارات وصفية في الفهرس؛ لا تغيّر مصادر التشغيل أو تفضيلات الصوت.",
}: {
  label: string;
  description?: string | null;
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState("");
  const custom = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(query.trim()) ? [query.trim()] : [];
  const options = [...new Set([...commonLanguages, ...values, ...custom])];
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        multiple
        items={options}
        value={[...values]}
        onValueChange={(next) => {
          if (next.length <= 30) onChange(next);
        }}
        onInputValueChange={setQuery}
        itemToStringLabel={languageName}
        itemToStringValue={(code) => `${languageName(code)} (${code})`}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {values.map((code) => (
              <ComboboxChip key={code}>{languageName(code)}</ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput
            id={id}
            aria-label={label}
            placeholder="ابحث أو أدخل رمز لغة…"
            maxLength={35}
          />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>لا توجد لغة مطابقة؛ يمكن إدخال رمز مثل pt-BR.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              {options.map((code) => (
                <ComboboxItem
                  key={code}
                  value={code}
                  disabled={values.length >= 30 && !values.includes(code)}
                >
                  {languageName(code)} <bdi>{code}</bdi>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}

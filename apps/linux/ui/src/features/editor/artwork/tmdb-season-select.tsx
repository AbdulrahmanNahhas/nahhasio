import { useId, useState } from "react";

import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxGroup,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";

export function TmdbSeasonSelect({
  value,
  suggested,
  onChange,
  compact = false,
}: {
  value: string;
  suggested: number;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const custom = /^\d{1,4}$/.test(query.trim()) ? [String(Number(query.trim()))] : [];
  const choices = [
    ...new Set([
      ...Array.from({ length: Math.min(100, Math.max(11, suggested + 1)) }, (_, index) =>
        String(index),
      ),
      value,
      ...custom,
    ]),
  ].filter(Boolean);
  return (
    <Field className={compact ? "w-32" : "w-40"}>
      <FieldLabel htmlFor={id} className={compact ? "sr-only" : undefined}>
        موسم TMDB
      </FieldLabel>
      <Combobox
        items={choices}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
        onInputValueChange={setQuery}
        itemToStringLabel={(season) => (season === "0" ? "العروض الخاصة (0)" : `الموسم ${season}`)}
      >
        <ComboboxInput id={id} aria-label="موسم TMDB" placeholder="اختر الموسم…" />
        <ComboboxContent>
          <ComboboxEmpty>اكتب رقم الموسم لإضافته.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              {choices.map((season) => (
                <ComboboxItem key={season} value={season}>
                  {season === "0" ? "العروض الخاصة (0)" : `الموسم ${season}`}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}

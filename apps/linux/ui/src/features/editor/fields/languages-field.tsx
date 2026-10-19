import { Plus, X } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { languageName } from "@/lib/languages";
export function LanguagesField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const valid = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code.trim());
  function add(value: string) {
    if (!values.includes(value)) onChange([...values, value]);
    setCode("");
  }
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Button
            key={value}
            size="sm"
            variant="secondary"
            type="button"
            aria-label={`إزالة ${languageName(value)}`}
            onClick={() => onChange(values.filter((item) => item !== value))}
          >
            {languageName(value)}
            <X data-icon="inline-end" />
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {["ar", "en", "es", "ja", "fr", "ko"]
          .filter((value) => !values.includes(value))
          .map((value) => (
            <Button
              key={value}
              size="sm"
              variant="outline"
              type="button"
              onClick={() => add(value)}
            >
              {languageName(value)}
              <Plus data-icon="inline-end" />
            </Button>
          ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          dir="ltr"
          placeholder="رمز لغة أخرى، مثل pt-BR"
          maxLength={35}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (valid) add(code.trim());
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="إضافة لغة"
          disabled={!valid || values.length >= 30}
          onClick={() => add(code.trim())}
        >
          <Plus />
        </Button>
      </div>
      <FieldDescription>
        اللغات المسجّلة في بيانات العمل؛ تُحدّد مسارات الصوت أثناء التشغيل.
      </FieldDescription>
    </Field>
  );
}

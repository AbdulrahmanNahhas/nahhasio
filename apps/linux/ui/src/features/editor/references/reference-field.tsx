import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { rowSchema } from "@/features/database/data/database-model";
import {
  findReferences,
  referenceValueFilter,
  vocabularyOptions,
  type ReferenceOption as Option,
  type ReferenceTable,
} from "@/features/editor/references/reference.functions";
import { RegisteredImage } from "@/features/editor/registered-image";
export { findReferences } from "@/features/editor/references/reference.functions";
const emptyFilters = {};

export function ReferenceField({
  label,
  table,
  value,
  onChange,
  filters = emptyFilters,
  disabled = false,
  useIdValue = false,
  onPick,
}: {
  label: string;
  table: ReferenceTable;
  value?: string | null;
  onChange: (value: string) => void;
  filters?: z.infer<typeof rowSchema>;
  disabled?: boolean;
  useIdValue?: boolean;
  onPick?: (option: Option) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [settled, setSettled] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Option | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(search), 150);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["database", "reference-options", table, settled, filters],
    queryFn: ({ signal }) => findReferences({ data: { table, search: settled, filters }, signal }),
    enabled: open && !disabled,
    staleTime: 30000,
  });
  const resolved = useQuery({
    queryKey: ["database", "reference-value", table, value, filters],
    queryFn: ({ signal }) =>
      findReferences({
        data: {
          table,
          search: "",
          filters: { ...filters, ...referenceValueFilter(table, value ?? "") },
        },
        signal,
      }),
    enabled: !!value,
    staleTime: 60000,
  });
  const chosen =
    (picked && (useIdValue ? picked.id : picked.value) === value ? picked : null) ??
    resolved.data?.find((item) => item.id === value || item.value === value) ??
    null;
  const selected =
    chosen ??
    (value
      ? {
          id: value,
          value,
          label: resolved.isPending ? "جارٍ تحميل الاسم…" : value,
          organizationId: null,
          year: null,
          entityKind: null,
          image: null,
        }
      : null);
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox<Option>
        items={search === settled ? (query.data ?? []) : []}
        value={selected}
        filter={null}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
        inputValue={search}
        onInputValueChange={(text, details) => {
          if (details.reason === "input-change") setSearch(text);
        }}
        itemToStringLabel={(item) => item.label}
        itemToStringValue={(item) => item.value}
        isItemEqualToValue={(a, b) => a.value === b.value}
        onValueChange={(item) => {
          if (!item) return;
          setPicked(item);
          onChange(useIdValue ? item.id : item.value);
          onPick?.(item);
          setSearch("");
          setOpen(false);
        }}
      >
        <ComboboxInput
          id={id}
          placeholder={
            chosen?.label ||
            (value && resolved.isPending ? "جارٍ تحميل الاسم…" : value) ||
            "اكتب للبحث واختر من النتائج…"
          }
          aria-label={label}
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {query.isFetching || search !== settled
              ? "جارٍ البحث…"
              : query.isError
                ? "تعذّر البحث، أعد فتح القائمة للمحاولة"
                : "لا توجد نتائج"}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: Option) => (
              <ComboboxItem key={item.id} value={item}>
                {item.image && (
                  <RegisteredImage
                    src={item.image}
                    alt=""
                    className="size-9 shrink-0 rounded-md bg-muted"
                  />
                )}
                <span dir="auto">{item.label}</span>
                {item.label !== item.value && (
                  <span dir="auto" className="text-xs text-muted-foreground">
                    {item.value}
                  </span>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {query.isError && <FieldDescription>{query.error.message}</FieldDescription>}
    </Field>
  );
}
export function ReferenceListField({
  label,
  table,
  values,
  onChange,
}: {
  label: string;
  table: ReferenceTable;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const vocabulary = useQuery(vocabularyOptions());
  const labels = vocabulary.data?.find((item) => item.table === table)?.options;
  return (
    <Field>
      <ReferenceField
        label={label}
        table={table}
        onChange={(value) => {
          if (!values.includes(value)) onChange([...values, value]);
        }}
      />
      {!!values.length && (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <ReferenceChip
              key={value}
              table={table}
              value={value}
              resolvedLabel={labels?.find((item) => item.value === value)?.label}
              loading={vocabulary.isPending}
              onRemove={() => onChange(values.filter((item) => item !== value))}
            />
          ))}
        </div>
      )}
    </Field>
  );
}

function ReferenceChip({
  table,
  value,
  onRemove,
  resolvedLabel,
  loading,
}: {
  table: ReferenceTable;
  value: string;
  onRemove: () => void;
  resolvedLabel?: string;
  loading: boolean;
}) {
  const query = useQuery({
    queryKey: ["database", "reference-value", table, value, emptyFilters],
    queryFn: ({ signal }) =>
      findReferences({
        data: { table, search: "", filters: referenceValueFilter(table, value) },
        signal,
      }),
    enabled: !loading && !resolvedLabel,
    staleTime: 60000,
  });
  if (loading || (!resolvedLabel && query.isPending))
    return <Skeleton className="h-8 w-24 rounded-xl" />;
  const label =
    resolvedLabel ??
    query.data?.find((item) => item.value === value || item.id === value)?.label ??
    value;
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={onRemove}
      aria-label={`إزالة ${label}`}
    >
      <span dir="auto">{label}</span>
      <XIcon data-icon="inline-end" />
    </Button>
  );
}

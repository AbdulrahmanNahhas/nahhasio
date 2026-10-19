import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxGroup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";

import type { EntityOptions } from "./entities.queries";

type Work = EntityOptions["works"][number];
export function normalizeWorkSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}|ـ/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLocaleLowerCase()
    .trim();
}
export function matchesWork(work: Work | undefined, title: string, search: string) {
  const text = normalizeWorkSearch(
    [title, work?.titleAr, ...(work?.aliases ?? [])].filter(Boolean).join(" "),
  );
  return normalizeWorkSearch(search)
    .split(/\s+/)
    .every((word) => text.includes(word));
}
export function EntityWorkPicker({
  works,
  value,
  onPick,
  disabled,
}: {
  works: Work[];
  value: string | null;
  onPick: (id: string) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const selected = works.find((work) => work.id === value) ?? null;
  const visible = works.filter((work) => matchesWork(work, work.title, search)).slice(0, 10);
  return (
    <Combobox
      items={visible}
      value={selected}
      filter={null}
      itemToStringValue={(work) => work.titleAr || work.title}
      onInputValueChange={setSearch}
      onValueChange={(work) => {
        if (work) onPick(work.id);
      }}
      disabled={disabled}
    >
      <ComboboxInput aria-label="إضافة عمل" placeholder="ابحث بالعربية أو الإنجليزية…" />
      <ComboboxContent>
        <ComboboxEmpty>لا توجد أعمال مطابقة</ComboboxEmpty>
        <ComboboxList>
          <ComboboxGroup>
            {visible.map((work) => (
              <ComboboxItem key={work.id} value={work}>
                <Artwork
                  id={work.posterId}
                  alt=""
                  className="h-18 w-12 shrink-0 rounded-md object-cover"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-2" dir="auto">
                    {work.titleAr || work.title}
                  </span>
                  {work.titleAr && (
                    <span className="truncate text-xs text-muted-foreground" dir="auto">
                      {work.title}
                    </span>
                  )}
                </span>
                {work.year && <Badge variant="outline">{work.year}</Badge>}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

import { useMutation } from "@tanstack/react-query";
import { Bookmark, RotateCcw, Trash2, Check } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

import type { BrowsePreferences } from "./browse-preferences";
import { groupChoices, parseGroup, parseSort, sortChoices } from "./browse-refinements";
import { filterCount, parseFilters } from "./filter-model";

function describeView(search: string, display: BrowsePreferences["display"]) {
  const params = new URLSearchParams(search);
  const layout = { poster: "ملصقات", banner: "لافتات", logo: "شعارات", table: "جدول" }[
    display.layout
  ];
  const sort = sortChoices.find((item) => item.value === parseSort(params.get("sort")))?.label;
  const group = groupChoices.find((item) => item.value === parseGroup(params.get("group")))?.label;
  const filters = filterCount(parseFilters(params.get("filters")));
  return [layout, sort, group, filters ? `${filters} مرشح` : "كل الأعمال"].join(" · ");
}
export function BrowsePresets({
  value,
  onSave,
  onApply,
  onReset,
}: {
  value: BrowsePreferences;
  onSave: (value: BrowsePreferences) => Promise<void>;
  onApply: (search: string, display: BrowsePreferences["display"]) => void;
  onReset: () => void;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const existing = value.presets.find((preset) => preset.name === name.trim());
  const save = useMutation({
    mutationFn: ({ next }: { next: BrowsePreferences; removing?: boolean }) => onSave(next),
    onSuccess: (_, input) => {
      if (!input.removing) setName("");
      toast.add({
        type: "success",
        title: input.removing ? "أُزيل العرض المحفوظ" : "حُفظ عرض التصفح",
      });
    },
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) save.reset();
        }}
      >
        <DialogTrigger render={<Button variant="ghost" size="sm" />}>
          <Bookmark data-icon="inline-start" /> العروض المحفوظة{" "}
          {value.presets.length ? `(${value.presets.length})` : ""}
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>عروض التصفح</DialogTitle>
            <DialogDescription>
              انتقل إلى عرض محفوظ، أو احفظ اختياراتك الحالية باسم لتعود إليها لاحقًا.
            </DialogDescription>
          </DialogHeader>
          {!value.presets.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لم تحفظ عرضًا بعد</EmptyTitle>
                <EmptyDescription>اختر مرشحاتك وطريقة العرض، ثم سمّها أدناه.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {value.presets.map((preset) => (
                <div key={preset.id} className="flex min-w-0 items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-auto min-w-0 flex-1 justify-start py-3"
                    disabled={save.isPending}
                    onClick={() => {
                      onApply(preset.search, preset.display);
                      setOpen(false);
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1 text-start">
                      <span className="truncate">{preset.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {describeView(preset.search, preset.display)}
                      </span>
                    </span>
                    {preset.search === value.search &&
                      JSON.stringify(preset.display) === JSON.stringify(value.display) && (
                        <Check data-icon="inline-end" />
                      )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={save.isPending}
                    aria-label={`إزالة العرض ${preset.name}`}
                    onClick={() =>
                      save.mutate({
                        removing: true,
                        next: {
                          ...value,
                          presets: value.presets.filter((item) => item.id !== preset.id),
                        },
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim() || save.isPending || (!existing && value.presets.length >= 8))
                return;
              const preset = {
                id: existing?.id ?? crypto.randomUUID(),
                name: name.trim(),
                search: value.search,
                display: value.display,
              };
              save.mutate({
                next: {
                  ...value,
                  presets: existing
                    ? value.presets.map((item) => (item.id === existing.id ? preset : item))
                    : [...value.presets, preset],
                },
              });
            }}
          >
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="browse-preset-name">حفظ الاختيارات الحالية</FieldLabel>
                <FieldDescription>{describeView(value.search, value.display)}</FieldDescription>
                <Input
                  id="browse-preset-name"
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="مثل: أنمي قيد المشاهدة"
                  disabled={save.isPending}
                />
                <FieldDescription>
                  {existing
                    ? "يوجد عرض بهذا الاسم؛ سيُحدّث باختياراتك الحالية."
                    : `${value.presets.length} من 8 عروض. آخر اختياراتك تُحفظ تلقائيًا أيضًا.`}
                </FieldDescription>
              </Field>
              {save.error && (
                <Alert variant="destructive">
                  <AlertDescription>{save.error.message}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                disabled={
                  !name.trim() || save.isPending || (!existing && value.presets.length >= 8)
                }
              >
                {save.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Bookmark data-icon="inline-start" />
                )}
                {existing ? "تحديث العرض المحفوظ" : "حفظ عرض جديد"}
              </Button>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw data-icon="inline-start" /> استعادة الافتراضي
      </Button>
    </div>
  );
}

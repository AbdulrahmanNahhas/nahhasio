import { ArrowDownWideNarrow } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SelectField } from "@/features/editor/fields/work-fields";

import type { EntityDraft, EntityOptions } from "./entities.queries";

export function EntityCreditsSort({
  credits,
  works,
  disabled,
  onChange,
}: {
  credits: EntityDraft["credits"];
  works: EntityOptions["works"];
  disabled: boolean;
  onChange: (credits: EntityDraft["credits"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"score" | "year">("score");
  const byId = new Map(works.map((work) => [work.id, work]));
  const proposed = credits.toSorted((a, b) => {
    const left = byId.get(a.workId)?.[mode] ?? null;
    const right = byId.get(b.workId)?.[mode] ?? null;
    if (left === null) return right === null ? 0 : 1;
    return right === null ? -1 : right - left;
  });
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || credits.length < 2}
        onClick={() => setOpen(true)}
      >
        <ArrowDownWideNarrow data-icon="inline-start" />
        ترتيب جميع الأعمال
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>تأكيد ترتيب جميع الأعمال</DialogTitle>
            <DialogDescription>
              يشمل الترتيب كل المساهمات، حتى المخفية بالبحث. الأعمال بلا تقييم أو سنة تأتي أخيراً،
              ويحافظ التعادل على ترتيبها الحالي. تُحدّث أرقام ترتيب المساهمات، وتبقى التغييرات في
              المسودة حتى المراجعة والحفظ.
            </DialogDescription>
          </DialogHeader>
          <SelectField
            label="الترتيب حسب"
            value={mode}
            onChange={setMode}
            items={[
              { value: "score", label: "التقييم: الأعلى أولاً" },
              { value: "year", label: "السنة: الأحدث إلى الأقدم" },
            ]}
          />
          <ol
            className="flex max-h-72 flex-col gap-3 overflow-y-auto"
            aria-label="معاينة الترتيب الجديد"
          >
            {proposed.map((credit, index) => {
              const work = byId.get(credit.workId);
              return (
                <li key={`${credit.workId}:${credit.roleId}`} className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-sm text-muted-foreground">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span dir="auto">{work?.titleAr || credit.workTitle}</span>
                    <span className="block text-xs text-muted-foreground">{credit.roleLabel}</span>
                  </span>
                  <Badge variant="outline">{work?.[mode] ?? "—"}</Badge>
                </li>
              );
            })}
          </ol>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                onChange(
                  proposed.map((credit, position) => ({ ...credit, position: position + 1 })),
                );
                setOpen(false);
              }}
            >
              تأكيد الترتيب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

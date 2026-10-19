import { episodeDocument } from "@arcadia/contracts/work";
import type { WorkDocument } from "@arcadia/contracts/work";
import { useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { TextField } from "@/features/editor/fields/work-fields";

export type Episode = NonNullable<
  NonNullable<WorkDocument["installments"]>[number]["episodes"]
>[number];
export function EpisodeEditor({
  initial,
  creating,
  onApply,
  onClose,
}: {
  initial: Episode;
  creating: boolean;
  onApply: (episode: Episode) => string | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  function patch(value: Partial<Episode>) {
    setDraft((current) => ({ ...current, ...value }));
    setError(null);
  }
  return (
    <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{creating ? "إضافة حلقة" : `تحرير الحلقة ${initial.number}`}</DialogTitle>
        <DialogDescription>
          تبقى التغييرات في مسودة العمل. تُحفظ مع المراجعة المعتادة.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <FieldGroup className="grid sm:grid-cols-2">
          <TextField
            label="رقم الحلقة"
            type="number"
            min={0}
            step="any"
            value={draft.number}
            onChange={(value) => patch({ number: Number(value) })}
          />
          <TextField
            label="عنوان الحلقة"
            value={draft.title}
            onChange={(title) => patch({ title: title || null })}
          />
          <TextField
            label="تاريخ العرض"
            type="date"
            value={draft.releaseDate}
            onChange={(releaseDate) => patch({ releaseDate: releaseDate || null })}
          />
          <TextField
            label="المدة بالدقائق"
            type="number"
            min={0}
            value={draft.runtimeMinutes}
            onChange={(value) => patch({ runtimeMinutes: value ? Number(value) : null })}
          />
        </FieldGroup>
        <TextField
          label="ملخص الحلقة"
          multiline
          value={draft.summary}
          onChange={(summary) => patch({ summary })}
        />
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          onClick={() => {
            const parsed = episodeDocument.safeParse(draft);
            if (!parsed.success) {
              setError("أدخل رقماً موجباً للحلقة ومدة وتاريخاً صالحين.");
              return;
            }
            const message = onApply(parsed.data);
            if (message) setError(message);
          }}
        >
          تطبيق على المسودة
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

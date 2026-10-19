import { Languages } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LanguagesField } from "@/features/editor/fields/languages-field";
import { languageName } from "@/lib/languages";

export function ContributionLanguages({
  title,
  values,
  disabled,
  onChange,
}: {
  title: string;
  values: string[];
  disabled: boolean;
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="max-w-full self-start"
        disabled={disabled}
        aria-label={`لغات المساهمة في ${title}`}
        onClick={() => setOpen(true)}
      >
        <Languages data-icon="inline-start" />
        <span className="truncate">
          {values.length ? values.map(languageName).join(" · ") : "تحديد اللغات"}
        </span>
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>لغات المساهمة</DialogTitle>
          <DialogDescription>
            {title} — اللغات التي قدّمت بها هذه الجهة أو هذا الشخص مساهمته.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <LanguageDraft
            key={title}
            values={values}
            disabled={disabled}
            onCancel={() => setOpen(false)}
            onApply={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function LanguageDraft({
  values,
  disabled,
  onCancel,
  onApply,
}: {
  values: string[];
  disabled: boolean;
  onCancel: () => void;
  onApply: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState(values);
  return (
    <>
      <fieldset disabled={disabled}>
        <LanguagesField
          label="اللغات"
          values={draft}
          onChange={setDraft}
          description="تخص هذه المساهمة فقط؛ لا تغيّر لغات العمل أو مسارات الصوت."
        />
      </fieldset>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button disabled={disabled} onClick={() => onApply(draft)}>
          تطبيق على المسودة
        </Button>
      </DialogFooter>
    </>
  );
}

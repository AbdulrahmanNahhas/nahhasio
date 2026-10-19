import type { WorkDocument } from "@arcadia/contracts/work";
import { useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { LanguagesField } from "@/features/editor/fields/languages-field";
import { SelectField } from "@/features/editor/fields/work-fields";

import { ReferenceField } from "./reference-field";

type Credit = NonNullable<WorkDocument["credits"]>[number];
export function WorkCreditEditor({
  initial,
  initialKind,
  onSave,
  onClose,
}: {
  initial: Credit | null;
  initialKind: "person" | "organization" | null;
  onSave: (credit: Credit) => string | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Credit>(
    initial ?? { entity: "", role: "", languages: [], isPrimary: false },
  );
  const [kind, setKind] = useState<"person" | "organization">(initialKind ?? "person");
  const [error, setError] = useState<string | null>(null);
  function patch(value: Partial<Credit>) {
    setDraft((current) => ({ ...current, ...value }));
    setError(null);
  }
  return (
    <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{initial ? "تحرير المساهمة" : "إضافة مساهمة"}</DialogTitle>
        <DialogDescription>
          اختر المساهم ودوره ولغات مساهمته. تُطبَّق التغييرات على مسودة العمل حتى المراجعة والحفظ.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <SelectField
          label="نوع المساهم"
          value={kind}
          items={[
            { value: "person", label: "شخص" },
            { value: "organization", label: "استوديو أو جهة" },
          ]}
          onChange={(value) => {
            setKind(value);
            patch({ entity: "", role: "" });
          }}
        />
        <ReferenceField
          key={`entity-${kind}`}
          label={kind === "person" ? "الشخص" : "الاستوديو أو الجهة"}
          table="entities"
          filters={{ kind }}
          value={draft.entity}
          useIdValue
          onChange={(entity) => patch({ entity })}
        />
        <ReferenceField
          key={`role-${kind}`}
          label="الدور"
          table="roles"
          filters={{ entity_kind: kind }}
          value={draft.role}
          onChange={(role) => patch({ role })}
        />
        <Field orientation="horizontal">
          <Checkbox
            id="work-credit-primary"
            checked={draft.isPrimary ?? false}
            onCheckedChange={(value) => patch({ isPrimary: value === true })}
          />
          <FieldLabel htmlFor="work-credit-primary">مساهم رئيسي</FieldLabel>
        </Field>
        <LanguagesField
          label="لغات المساهمة"
          values={draft.languages ?? []}
          onChange={(languages) => patch({ languages })}
          description="لغات هذه المساهمة فقط؛ لا تغيّر لغات العمل أو مسارات الصوت."
        />
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          disabled={!draft.entity || !draft.role}
          onClick={() => {
            const message = onSave(draft);
            if (message) setError(message);
          }}
        >
          تطبيق على المسودة
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

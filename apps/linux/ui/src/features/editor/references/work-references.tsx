import type { WorkDocument } from "@arcadia/contracts/work";
import { PlusIcon, TrashIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { hasSeries, seriesIdentityKeys } from "@/features/editor/artwork/artwork-model";
import { IdentityFields } from "@/features/editor/fields/identity-fields";
import { SelectField, TextField } from "@/features/editor/fields/work-fields";
import { ReferenceField } from "@/features/editor/references/reference-field";
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";

import { WorkCredits } from "./work-credits";

type Update = <K extends keyof WorkDocument>(key: K, value: WorkDocument[K]) => void;
const relationChoices = [
  { value: "sequel", label: "تكملة" },
  { value: "adaptation", label: "اقتباس" },
  { value: "spin-off", label: "عمل مشتق" },
  { value: "side-story", label: "قصة جانبية" },
  { value: "compilation", label: "تجميع" },
  { value: "alternative", label: "نسخة بديلة" },
  { value: "related", label: "مرتبط" },
] as const;
export function WorkReferences({
  draft,
  update,
  creditsOnly = false,
}: {
  draft: WorkDocument;
  update: Update;
  creditsOnly?: boolean;
}) {
  const identityRows = useEditorRows(draft.externalIds ?? []);
  const relationRows = useEditorRows(draft.relations ?? []);
  if (creditsOnly)
    return (
      <WorkCredits
        credits={draft.credits ?? []}
        onChange={(credits) => update("credits", credits)}
      />
    );
  const identities = draft.externalIds ?? [];
  const relations = draft.relations ?? [];
  return (
    <FieldGroup>
      {hasSeries(draft) ? (
        <IdentityFields
          ids={draft}
          keys={seriesIdentityKeys}
          series={draft.installments?.some((item) => item.kind === "season") === true}
          onChange={(key, value) => {
            if (key === "imdbId") update(key, value === null ? null : String(value));
            else update(key, value === null ? null : Number(value));
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          معرّفات الأفلام تُحرّر لكل فيلم في قسم صور الأجزاء.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">المعرّفات الخارجية</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            update("externalIds", [...identities, { provider: "", externalId: "", url: null }])
          }
        >
          <PlusIcon data-icon="inline-start" />
          إضافة مرجع
        </Button>
      </div>
      {identityRows.map(({ key, value: item }, index) => (
        <div key={key} className="rounded-lg border border-border p-4">
          <FieldGroup>
            <FieldGroup className="grid md:grid-cols-3">
              <TextField
                label={`المصدر ${index + 1}`}
                value={item.provider}
                onChange={(value) =>
                  update(
                    "externalIds",
                    identities.map((record, position) =>
                      position === index ? { ...record, provider: value } : record,
                    ),
                  )
                }
              />
              <TextField
                label={`المعرّف ${index + 1}`}
                value={item.externalId}
                onChange={(value) =>
                  update(
                    "externalIds",
                    identities.map((record, position) =>
                      position === index ? { ...record, externalId: value } : record,
                    ),
                  )
                }
              />
              <TextField
                label={`رابط المرجع ${index + 1}`}
                value={item.url}
                onChange={(value) =>
                  update(
                    "externalIds",
                    identities.map((record, position) =>
                      position === index ? { ...record, url: value || null } : record,
                    ),
                  )
                }
              />
            </FieldGroup>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                update(
                  "externalIds",
                  identities.filter((_, position) => index !== position),
                )
              }
            >
              <TrashIcon data-icon="inline-start" />
              إزالة المرجع
            </Button>
          </FieldGroup>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">الأعمال المرتبطة</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            update("relations", [...relations, { target: "", kind: "related", notes: "" }])
          }
        >
          <PlusIcon data-icon="inline-start" />
          إضافة علاقة
        </Button>
      </div>
      {relationRows.map(({ key, value: item }, index) => (
        <div key={key} className="rounded-lg border border-border p-4">
          <FieldGroup>
            <FieldGroup className="grid md:grid-cols-2">
              <ReferenceField
                table="titles"
                label={`العمل المرتبط ${index + 1}`}
                value={item.target}
                onChange={(value) =>
                  update(
                    "relations",
                    relations.map((record, position) =>
                      position === index ? { ...record, target: value } : record,
                    ),
                  )
                }
              />
              <SelectField
                label={`نوع العلاقة ${index + 1}`}
                value={item.kind}
                items={relationChoices}
                onChange={(value) =>
                  update(
                    "relations",
                    relations.map((record, position) =>
                      position === index ? { ...record, kind: value } : record,
                    ),
                  )
                }
              />
              <TextField
                label={`ملاحظات العلاقة ${index + 1}`}
                value={item.notes}
                onChange={(value) =>
                  update(
                    "relations",
                    relations.map((record, position) =>
                      position === index ? { ...record, notes: value } : record,
                    ),
                  )
                }
              />
            </FieldGroup>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  update(
                    "relations",
                    relations.filter((_, position) => index !== position),
                  )
                }
              >
                <TrashIcon data-icon="inline-start" />
                إزالة العلاقة
              </Button>
            </div>
          </FieldGroup>
        </div>
      ))}
    </FieldGroup>
  );
}

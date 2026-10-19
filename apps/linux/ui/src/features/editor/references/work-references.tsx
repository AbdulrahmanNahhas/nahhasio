import type { WorkDocument } from "@arcadia/contracts/work";
import { useQuery } from "@tanstack/react-query";
import { BuildingIcon, PlusIcon, TrashIcon, UserIcon } from "lucide-react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { hasSeries, seriesIdentityKeys } from "@/features/editor/artwork/artwork-model";
import { IdentityFields } from "@/features/editor/fields/identity-fields";
import { LanguagesField } from "@/features/editor/fields/languages-field";
import { SelectField, TextField } from "@/features/editor/fields/work-fields";
import { findReferences, ReferenceField } from "@/features/editor/references/reference-field";
import { RegisteredImage } from "@/features/editor/registered-image";
import { OrderActions } from "@/features/editor/structure/order-actions";
import { moveOrderedRow, withPositions } from "@/features/editor/structure/ordered-rows";
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";

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
  const credits = draft.credits ?? [];
  const identityRows = useEditorRows(draft.externalIds ?? []);
  const relationRows = useEditorRows(draft.relations ?? []);
  if (creditsOnly)
    return (
      <FieldGroup>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">المساهمون والاستوديوهات</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={credits.some((item) => !item.entity || !item.role)}
            onClick={() =>
              update(
                "credits",
                withPositions([
                  ...credits,
                  { entity: "", role: "", isPrimary: false, position: credits.length },
                ]),
              )
            }
          >
            <PlusIcon data-icon="inline-start" />
            إضافة مساهمة
          </Button>
        </div>
        {credits.map((item, index) => (
          <CreditRow
            key={`${item.entity}/${item.role}`}
            item={item}
            index={index}
            count={credits.length}
            onMove={(direction) => update("credits", moveOrderedRow(credits, index, direction))}
            onChange={(patch) =>
              update(
                "credits",
                credits.map((value, position) =>
                  position === index ? { ...value, ...patch } : value,
                ),
              )
            }
            onRemove={() =>
              update("credits", withPositions(credits.filter((_, position) => position !== index)))
            }
          />
        ))}
      </FieldGroup>
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

function CreditRow({
  item,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  item: NonNullable<WorkDocument["credits"]>[number];
  index: number;
  count: number;
  onChange: (patch: Partial<NonNullable<WorkDocument["credits"]>[number]>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const role = useQuery({
    queryKey: ["database", "credit-role", item.role],
    queryFn: ({ signal }) =>
      findReferences({
        data: { table: "roles", search: "", filters: { slug: item.role } },
        signal,
      }),
    enabled: !!item.role,
  });
  const kind =
    role.data?.[0]?.entityKind ??
    ([
      "animation_studio",
      "production_company",
      "distributor",
      "publisher",
      "dubbing_studio",
    ].includes(item.role)
      ? "organization"
      : "person");
  const entity = useQuery({
    queryKey: ["database", "credit-entity", kind, item.entity],
    queryFn: ({ signal }) =>
      findReferences({
        data: {
          table: "entities",
          search: "",
          filters: {
            kind,
            ...(z.string().uuid().safeParse(item.entity).success
              ? { id: item.entity }
              : { name: item.entity }),
          },
        },
        signal,
      }),
    enabled: !!item.entity,
    staleTime: 60000,
  });
  const image = entity.data?.[0]?.image;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
          {image ? (
            <RegisteredImage
              src={image}
              alt={entity.data?.[0]?.label ?? item.entity}
              className="size-full p-1"
              fit={kind === "person" ? "cover" : "contain"}
            />
          ) : kind === "person" ? (
            <UserIcon className="size-6 text-muted-foreground" />
          ) : (
            <BuildingIcon className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {entity.data?.[0] && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold" dir="auto">
                {entity.data[0].label}
              </span>
              <Badge variant="secondary">
                {role.data?.[0]?.label ?? (kind === "organization" ? "استوديو أو جهة" : "مساهم")}
              </Badge>
            </div>
          )}
          <FieldGroup className="grid sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label={`نوع المساهم ${index + 1}`}
              value={kind}
              items={[
                { value: "person", label: "شخص" },
                { value: "organization", label: "استوديو أو جهة" },
              ]}
              onChange={(value) =>
                onChange({
                  entity: "",
                  role: value === "organization" ? "animation_studio" : "director",
                })
              }
            />
            <ReferenceField
              label={`المساهم ${index + 1}`}
              table="entities"
              filters={{ kind }}
              value={item.entity}
              useIdValue
              onChange={(value) => onChange({ entity: value })}
            />
            <ReferenceField
              label={`الدور ${index + 1}`}
              table="roles"
              filters={{ entity_kind: kind }}
              value={item.role}
              onChange={(value) => onChange({ role: value })}
            />
          </FieldGroup>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              لغات المساهمة{item.languages?.length ? ` · ${item.languages.join("، ")}` : ""}
            </summary>
            <div className="pt-3">
              <LanguagesField
                label="لغات المساهمة"
                values={item.languages ?? []}
                onChange={(languages) => onChange({ languages })}
              />
            </div>
          </details>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Field orientation="horizontal" className="w-auto">
          <Checkbox
            id={`credit-primary-${index}`}
            aria-label="مساهم رئيسي"
            checked={item.isPrimary ?? false}
            onCheckedChange={(value) => onChange({ isPrimary: value })}
          />
          <FieldLabel htmlFor={`credit-primary-${index}`}>رئيسي</FieldLabel>
        </Field>
        <OrderActions label={`المساهم ${index + 1}`} index={index} count={count} onMove={onMove} />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`إزالة المساهمة ${index + 1}`}
          onClick={onRemove}
        >
          <TrashIcon data-icon="inline-start" />
        </Button>
      </div>
    </div>
  );
}

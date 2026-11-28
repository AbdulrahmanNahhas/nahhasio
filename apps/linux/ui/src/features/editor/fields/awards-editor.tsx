import type { WorkDocument } from "@arcadia/contracts/work";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, TrashIcon } from "lucide-react";
import { z } from "zod";

import { SelectField } from "@/components/select-field";
import { Checkbox } from "@/components/ui-sdk/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { TextField } from "@/features/editor/fields/work-fields";
import { findReferences, ReferenceField } from "@/features/editor/references/reference-field";
import { OrderActions } from "@/features/editor/structure/order-actions";
import { moveOrderedRow, withPositions } from "@/features/editor/structure/ordered-rows";

type Award = NonNullable<WorkDocument["awards"]>[number];
export function AwardsEditor({
  draft,
  onChange,
}: {
  draft: WorkDocument;
  onChange: (value: Award[]) => void;
}) {
  const awards = draft.awards ?? [];
  return (
    <div className="flex flex-col gap-4">
      {!awards.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد جوائز مسجلة</EmptyTitle>
            <EmptyDescription>
              أضف فوزاً أو ترشيحاً من الجهات والفئات المسجلة في قاعدة الجوائز.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {awards.map((award, index) => (
        <AwardRow
          key={award.id ?? index}
          award={award}
          index={index}
          count={awards.length}
          onMove={(direction) => onChange(moveOrderedRow(awards, index, direction))}
          installments={draft.installments ?? []}
          onChange={(patch) =>
            onChange(
              awards.map((value, position) =>
                position === index ? { ...value, ...patch } : value,
              ),
            )
          }
          onRemove={() =>
            onChange(withPositions(awards.filter((_, position) => position !== index)))
          }
        />
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...awards,
            {
              organization: "",
              category: "",
              result: "nominee",
              year: null,
              installment: null,
              ceremonyId: null,
              position: Math.max(-1, ...awards.map((award) => award.position ?? 0)) + 1,
              isFeatured: false,
              sourceUrl: null,
              notes: null,
            },
          ])
        }
      >
        <PlusIcon data-icon="inline-start" />
        إضافة جائزة
      </Button>
    </div>
  );
}
function AwardRow({
  award,
  index,
  installments,
  onChange,
  onRemove,
  onMove,
  count,
}: {
  award: Award;
  index: number;
  installments: NonNullable<WorkDocument["installments"]>;
  onChange: (patch: Partial<Award>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  count: number;
}) {
  const organization = useQuery({
    queryKey: ["database", "award-organization", award.organization],
    queryFn: ({ signal }) =>
      findReferences({
        data: {
          table: "award_organizations",
          search: "",
          filters: z.string().uuid().safeParse(award.organization).success
            ? { id: award.organization }
            : { slug: award.organization },
        },
        signal,
      }),
    enabled: !!award.organization,
  });
  const organizationId = organization.data?.[0]?.id;
  const filters = { organization_id: organizationId ?? "00000000-0000-0000-0000-000000000000" };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>الجائزة {index + 1}</CardTitle>
          <OrderActions
            label={`الجائزة ${index + 1}`}
            index={index}
            count={count}
            onMove={onMove}
          />
        </div>
        <CardDescription>الجهة والفئة والدورة، مع إمكانية تخصيصها لجزء معين.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <FieldGroup className="grid md:grid-cols-2 lg:grid-cols-3">
            <ReferenceField
              label={`جهة الجائزة ${index + 1}`}
              table="award_organizations"
              value={award.organization}
              onChange={(value) =>
                onChange({ organization: value, category: "", ceremonyId: null })
              }
            />
            <ReferenceField
              label={`فئة الجائزة ${index + 1}`}
              table="award_categories"
              disabled={!organizationId}
              filters={filters}
              value={award.category}
              onChange={(value) => onChange({ category: value })}
            />
            <SelectField
              label={`النتيجة ${index + 1}`}
              value={award.result}
              items={[
                { value: "winner", label: "فائز" },
                { value: "nominee", label: "مرشح" },
              ]}
              onChange={(value) => onChange({ result: value })}
            />
            <TextField
              label={`سنة الجائزة ${index + 1}`}
              type="number"
              min={1900}
              max={2100}
              value={award.year}
              onChange={(value) =>
                onChange({ year: value ? Number(value) : null, ceremonyId: null })
              }
            />
            <ReferenceField
              label={`دورة الجائزة ${index + 1}`}
              table="award_ceremonies"
              disabled={!organizationId}
              filters={award.year ? { ...filters, year: award.year } : filters}
              useIdValue
              value={award.ceremonyId}
              onChange={(value) => onChange({ ceremonyId: value })}
              onPick={(value) => onChange({ ceremonyId: value.id, year: value.year })}
            />
            <SelectField
              label={`نطاق الجائزة ${index + 1}`}
              value={award.installment == null ? "work" : String(award.installment)}
              items={[
                { value: "work", label: "العمل كاملاً" },
                ...installments.map((part) => ({
                  value: String(part.position),
                  label: part.title,
                })),
              ]}
              onChange={(value) =>
                onChange({ installment: value === "work" ? null : Number(value) })
              }
            />
            <TextField
              label={`مصدر الجائزة ${index + 1}`}
              value={award.sourceUrl}
              onChange={(value) => onChange({ sourceUrl: value || null })}
            />
          </FieldGroup>
          <TextField
            label={`ملاحظات الجائزة ${index + 1}`}
            multiline
            value={award.notes}
            onChange={(value) => onChange({ notes: value || null })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                id={`award-featured-${index}`}
                checked={award.isFeatured ?? false}
                onCheckedChange={(value) => onChange({ isFeatured: value })}
              />
              <FieldLabel htmlFor={`award-featured-${index}`}>جائزة بارزة</FieldLabel>
            </Field>
            <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
              <TrashIcon data-icon="inline-start" />
              إزالة الجائزة من المسودة
            </Button>
            {award.ceremonyId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ceremonyId: null })}
              >
                إلغاء ربط الدورة
              </Button>
            )}
          </div>
          {organization.isError && (
            <p role="alert" className="text-sm text-destructive">
              تعذّر تحميل جهة الجائزة. {organization.error.message}
            </p>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

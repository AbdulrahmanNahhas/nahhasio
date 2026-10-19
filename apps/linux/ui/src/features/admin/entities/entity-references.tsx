import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField, SelectField } from "@/features/editor/fields/work-fields";
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";

import { entityListOptions, entitySearchSchema, type EntityDraft } from "./entities.queries";

type Props = {
  draft: EntityDraft;
  update: (patch: Partial<EntityDraft>) => void;
  disabled: boolean;
};
export function EntityLinks({ draft, update, disabled }: Props) {
  const links = draft.urls ?? [];
  const rows = useEditorRows(links);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>الروابط</CardTitle>
        <CardDescription>
          الموقع الرسمي وويكيبيديا والحسابات الاجتماعية والمراجع الأخرى.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={disabled}>
          <FieldGroup>
            {!links.length && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>لا توجد روابط</EmptyTitle>
                  <EmptyDescription>
                    أضف كل رابط باسم واضح، واترك الوصف للتعريف بالجهة.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {rows.map(({ key, value: link }, index) => (
              <div key={key} className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor={`entity-link-label-${key}`}>اسم الرابط</FieldLabel>
                    <Input
                      id={`entity-link-label-${key}`}
                      value={link.label}
                      placeholder="الموقع الرسمي"
                      onChange={(event) =>
                        update({
                          urls: links.map((item, i) =>
                            i === index ? { ...item, label: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`entity-link-url-${key}`}>الرابط</FieldLabel>
                    <Input
                      id={`entity-link-url-${key}`}
                      type="url"
                      dir="ltr"
                      value={link.url}
                      placeholder="https://"
                      onChange={(event) =>
                        update({
                          urls: links.map((item, i) =>
                            i === index ? { ...item, url: event.target.value } : item,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`إزالة الرابط ${index + 1}`}
                  onClick={() => update({ urls: links.filter((_, i) => i !== index) })}
                >
                  <X data-icon="inline-start" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={links.length >= 30}
              onClick={() => update({ urls: [...links, { label: "", url: "" }] })}
            >
              <Plus data-icon="inline-start" />
              إضافة رابط
            </Button>
          </FieldGroup>
        </fieldset>
      </CardContent>
    </Card>
  );
}
function OrganizationPicker({
  currentId,
  onPick,
  disabled,
}: {
  currentId: string | null;
  onPick: (id: string, name: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    ...entityListOptions(
      "organization",
      entitySearchSchema.parse({ q: search, page: String(page), sort: "name" }),
    ),
    enabled: open,
  });
  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        إضافة علاقة
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>اختيار جهة مرتبطة</DialogTitle>
            <DialogDescription>ابحث في الاستوديوهات والجهات المسجلة.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="بحث عن جهة"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {query.isPending && <Skeleton className="h-40" />}
          {query.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر تحميل الجهات</AlertTitle>
              <Button variant="outline" onClick={() => void query.refetch()}>
                إعادة المحاولة
              </Button>
            </Alert>
          )}
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {query.data?.items
              .filter((item) => item.id !== currentId)
              .map((item) => (
                <Button
                  variant="ghost"
                  key={item.id}
                  onClick={() => {
                    onPick(item.id, item.name);
                    setOpen(false);
                  }}
                >
                  {item.name}
                </Button>
              ))}
          </div>
          {query.data?.total === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد نتائج</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
              السابق
            </Button>
            <span>{page}</span>
            <Button
              variant="outline"
              disabled={!query.data || page * 24 >= query.data.total}
              onClick={() => setPage(page + 1)}
            >
              التالي
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function EntityRelations({ draft, update, disabled, id }: Props & { id: string | null }) {
  const relations = draft.relations ?? [];
  const rows = useEditorRows(relations);
  function patch(index: number, value: Partial<(typeof relations)[number]>) {
    update({ relations: relations.map((item, i) => (i === index ? { ...item, ...value } : item)) });
  }
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>علاقات الجهات</CardTitle>
        <CardDescription>
          حدّد اتجاه العلاقة ونوعها. تظهر العلاقة لدى الجهتين وتُحفظ مع المسودة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {!relations.length && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد علاقات</EmptyTitle>
                <EmptyDescription>
                  اربط الجهة بجهة أم أو تابعة أو شريك، مع توضيح نوع العلاقة.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {rows.map(({ key, value: relation }, index) => (
            <Card key={key} size="sm">
              <CardHeader>
                <CardTitle>{relation.entityName}</CardTitle>
                <CardDescription>
                  {relation.direction === "outgoing"
                    ? `${draft.name || "هذه الجهة"} ← ${relation.entityName}`
                    : `${relation.entityName} ← ${draft.name || "هذه الجهة"}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <fieldset disabled={disabled}>
                  <FieldGroup>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label="اتجاه العلاقة"
                        value={relation.direction}
                        items={[
                          { value: "outgoing", label: "من هذه الجهة إلى الجهة المختارة" },
                          { value: "incoming", label: "من الجهة المختارة إلى هذه الجهة" },
                        ]}
                        onChange={(direction) => patch(index, { direction })}
                      />
                      <TextField
                        label="نوع العلاقة"
                        value={relation.relationType}
                        onChange={(relationType) => patch(index, { relationType })}
                      />
                    </div>
                    <Field>
                      <FieldLabel htmlFor={`relation-date-${key}`}>التاريخ (اختياري)</FieldLabel>
                      <Input
                        id={`relation-date-${key}`}
                        type="date"
                        value={relation.occurredOn ?? ""}
                        onChange={(e) => patch(index, { occurredOn: e.target.value || null })}
                      />
                    </Field>
                    <TextField
                      label="ملاحظات العلاقة"
                      multiline
                      value={relation.description}
                      onChange={(description) => patch(index, { description })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => update({ relations: relations.filter((_, i) => i !== index) })}
                    >
                      <X data-icon="inline-start" />
                      إزالة العلاقة
                    </Button>
                  </FieldGroup>
                </fieldset>
              </CardContent>
            </Card>
          ))}
          <OrganizationPicker
            currentId={id}
            disabled={disabled || relations.length >= 200}
            onPick={(entityId, entityName) =>
              update({
                relations: [
                  ...relations,
                  {
                    id: null,
                    entityId,
                    entityName,
                    direction: "outgoing",
                    relationType: "",
                    occurredOn: null,
                    description: "",
                  },
                ],
              })
            }
          />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

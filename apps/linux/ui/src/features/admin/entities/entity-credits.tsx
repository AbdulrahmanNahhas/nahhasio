import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxGroup,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { LanguagesField } from "@/features/editor/fields/languages-field";
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";

import {
  entityOptionsQuery,
  entityKeys,
  createRole,
  type EntityKind,
  type EntityDraft,
} from "./entities.queries";

type NamedOption = { id: string; label: string };
export function NamedReferencePicker({
  items,
  value,
  onPick,
  label,
  disabled = false,
}: {
  items: NamedOption[];
  value: string | null;
  onPick: (id: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const selected = items.find((item) => item.id === value) ?? null;
  const visible = items
    .filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 60);
  return (
    <Combobox
      items={visible}
      value={selected}
      itemToStringValue={(item) => item.label}
      onInputValueChange={setSearch}
      onValueChange={(item) => {
        if (item) onPick(item.id);
      }}
      disabled={disabled}
    >
      <ComboboxInput aria-label={label} placeholder={label} />
      <ComboboxContent>
        <ComboboxEmpty>لا توجد نتائج</ComboboxEmpty>
        <ComboboxList>
          <ComboboxGroup>
            {visible.map((item) => (
              <ComboboxItem key={item.id} value={item}>
                <span dir="auto">{item.label}</span>
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
export function EntityCredits({
  kind,
  credits,
  onChange,
  disabled,
}: {
  kind: EntityKind;
  credits: EntityDraft["credits"];
  onChange: (credits: EntityDraft["credits"]) => void;
  disabled: boolean;
}) {
  const options = useQuery(entityOptionsQuery(kind));
  const rows = useEditorRows(credits);
  const [limit, setLimit] = useState(20);
  const [workId, setWorkId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  function move(index: number, direction: -1 | 1) {
    const next = [...credits];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((credit, position) => ({ ...credit, position: position + 1 })));
  }
  function add() {
    const work = options.data?.works.find((item) => item.id === workId);
    const role = options.data?.roles.find((item) => item.id === roleId);
    if (!work || !role) return;
    if (credits.some((credit) => credit.workId === work.id && credit.roleId === role.id)) {
      toast.add({ type: "info", title: "هذا العمل والدور موجودان بالفعل" });
      return;
    }
    onChange([
      ...credits,
      {
        workId: work.id,
        workTitle: work.title,
        roleId: role.id,
        roleName: role.name,
        roleLabel: role.label,
        position: Math.max(0, ...credits.map((credit) => credit.position)) + 1,
        isPrimary: false,
      },
    ]);
    setWorkId(null);
  }
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="الأعمال والأدوار">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          الأعمال والأدوار <Badge variant="secondary">{credits.length}</Badge>
        </h2>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setCreatingRole(true)}
        >
          <Plus data-icon="inline-start" />
          دور جديد
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        اختر العمل بعنوانه الإنجليزي، وحدد الدور. جميع التغييرات تبقى في المسودة حتى الحفظ.
      </p>
      <p className="text-xs text-muted-foreground">
        الأسهم ترتّب بطاقات المساهمات وتحدّث أرقام الترتيب. يُستخدم الرقم أيضاً لترتيب الصنّاع داخل العمل.
      </p>
      {options.isPending ? (
        <Skeleton className="h-12" />
      ) : options.isError ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل الأعمال والأدوار</AlertTitle>
          <AlertDescription>{options.error.message}</AlertDescription>
        </Alert>
      ) : (
        <FieldGroup className="grid items-end gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>إضافة عمل</FieldLabel>
            <NamedReferencePicker
              items={options.data.works.map((work) => ({
                id: work.id,
                label: `${work.title}${work.year ? ` · ${work.year}` : ""}`,
              }))}
              value={workId}
              label="ابحث عن عمل بالإنجليزية…"
              disabled={disabled}
              onPick={setWorkId}
            />
          </Field>
          <Field>
            <FieldLabel>الدور</FieldLabel>
            <div className="flex items-center gap-2">
              <NamedReferencePicker
                items={options.data.roles
                  .filter((role) => role.active)
                  .map((role) => ({ id: role.id, label: `${role.label} · ${role.name}` }))}
                value={roleId}
                label="اختر الدور…"
                disabled={disabled}
                onPick={setRoleId}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="إضافة المساهمة"
                disabled={!workId || !roleId || disabled || credits.length >= 500}
                onClick={add}
              >
                <Plus data-icon="inline-start" />
              </Button>
            </div>
          </Field>
        </FieldGroup>
      )}
      {!credits.length && (
        <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
          لا توجد مساهمات. أضف العمل والدور من الأعلى.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {rows.slice(0, limit).map(({ key, value: credit }, index) => (
          <div
            key={key}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <details className="mb-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  لغات المساهمة{credit.languages?.length ? ` · ${credit.languages.join("، ")}` : ""}
                </summary>
                <div className="pt-3">
                  <LanguagesField
                    label={`اللغات في ${credit.workTitle}`}
                    values={credit.languages ?? []}
                    onChange={(languages) =>
                      onChange(
                        credits.map((item, i) => (i === index ? { ...item, languages } : item)),
                      )
                    }
                  />
                </div>
              </details>
              <a
                href={`#/admin/works/${credit.workId}?section=indexing`}
                className="font-medium underline-offset-4 hover:underline"
                dir="ltr"
              >
                {credit.workTitle}
              </a>
              <div className="mt-2">
                {options.data ? (
                  <NamedReferencePicker
                    items={options.data.roles
                      .filter((role) => role.active || role.id === credit.roleId)
                      .map((role) => ({ id: role.id, label: `${role.label} · ${role.name}` }))}
                    value={credit.roleId}
                    label={`الدور في ${credit.workTitle}`}
                    disabled={disabled}
                    onPick={(id) => {
                      const role = options.data.roles.find((value) => value.id === id);
                      if (!role) return;
                      if (
                        credits.some(
                          (other, position) =>
                            position !== index &&
                            other.workId === credit.workId &&
                            other.roleId === id,
                        )
                      ) {
                        toast.add({ type: "info", title: "هذا العمل والدور موجودان بالفعل" });
                        return;
                      }
                      onChange(
                        credits.map((value, position) =>
                          position === index
                            ? {
                                ...value,
                                roleId: role.id,
                                roleName: role.name,
                                roleLabel: role.label,
                              }
                            : value,
                        ),
                      );
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {credit.roleLabel} · {credit.roleName}
                  </p>
                )}
              </div>
            </div>
            <Field className="w-20">
              <FieldLabel className="text-xs">الترتيب</FieldLabel>
              <Input
                type="number"
                aria-label={`ترتيب ${credit.workTitle} ${credit.roleName}`}
                min={0}
                max={1000000}
                disabled={disabled}
                value={credit.position}
                onChange={(event) =>
                  onChange(
                    credits
                      .map((item, position) =>
                        position === index
                          ? {
                              ...item,
                              position: Math.max(0, Math.min(1000000, Number(event.target.value))),
                            }
                          : item,
                      )
                      .toSorted((a, b) => a.position - b.position),
                  )
                }
              />
            </Field>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`رفع ${credit.workTitle}`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp data-icon="inline-start" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`خفض ${credit.workTitle}`}
                disabled={disabled || index === credits.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown data-icon="inline-start" />
              </Button>
            </div>
            <Field orientation="horizontal" className="w-auto">
              <Checkbox
                id={`credit-primary-${index}`}
                disabled={disabled}
                checked={credit.isPrimary}
                onCheckedChange={(checked) =>
                  onChange(
                    credits.map((item, position) =>
                      position === index ? { ...item, isPrimary: checked === true } : item,
                    ),
                  )
                }
              />
              <FieldLabel htmlFor={`credit-primary-${index}`}>أساسي</FieldLabel>
            </Field>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`إزالة ${credit.roleName} من ${credit.workTitle}`}
              disabled={disabled}
              onClick={() => onChange(credits.filter((_, position) => position !== index))}
            >
              <X data-icon="inline-start" />
            </Button>
          </div>
        ))}
      </div>
      {credits.length > limit && (
        <Button variant="outline" onClick={() => setLimit(limit + 20)}>
          عرض المزيد من المساهمات ({limit} / {credits.length})
        </Button>
      )}
      <RoleCreator
        kind={kind}
        open={creatingRole}
        onOpenChange={setCreatingRole}
        onCreated={(id) => setRoleId(id)}
      />
    </section>
  );
}
function RoleCreator({
  kind,
  open,
  onOpenChange,
  onCreated,
}: {
  kind: EntityKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: () => createRole({ kind, name, label, slug }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: [...entityKeys.all, "options", kind] });
      onCreated(result.id);
      onOpenChange(false);
      setName("");
      setLabel("");
      setSlug("");
      toast.add({ type: "success", title: "أُضيف الدور للمكتبة" });
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!create.isPending) onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!create.isPending}>
        <DialogHeader>
          <DialogTitle>إضافة دور جديد</DialogTitle>
          <DialogDescription>
            يُضاف الدور لقائمة المكتبة ويمكن استخدامه مع{" "}
            {kind === "person" ? "الأشخاص" : "الاستوديوهات"} الآخرين، حتى إن لم تحفظ هذه المسودة.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={create.isPending}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-role-name">الاسم الإنجليزي</FieldLabel>
              <Input
                id="new-role-name"
                dir="ltr"
                value={name}
                maxLength={300}
                onChange={(event) => {
                  setName(event.target.value);
                  setSlug(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "_")
                      .replace(/^_+|_+$/g, ""),
                  );
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-role-ar">الاسم العربي</FieldLabel>
              <Input
                id="new-role-ar"
                value={label}
                maxLength={300}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-role-slug">الرمز</FieldLabel>
              <Input
                id="new-role-slug"
                dir="ltr"
                value={slug}
                maxLength={80}
                onChange={(event) => setSlug(event.target.value)}
              />
            </Field>
          </FieldGroup>
        </fieldset>
        {create.isError && (
          <Alert variant="destructive">
            <AlertTitle>لم يضف الدور</AlertTitle>
            <AlertDescription>{create.error.message}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={create.isPending} onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            disabled={create.isPending || !name.trim() || !/^[a-z][a-z0-9_-]{0,79}$/.test(slug)}
            onClick={() => create.mutate()}
          >
            إضافة الدور
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

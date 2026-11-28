import { CheckCheckIcon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { SelectField } from "@/components/select-field";
import { Checkbox } from "@/components/ui-sdk/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  episodeFields,
  installmentFields,
  fullStructureScope,
  type StructureScope,
} from "../tree/json-projection";
import { fieldKeys, workFields, type WorkField } from "./document-model";

const groups = [...new Set(workFields.map((field) => field.group))];
const identityFields: WorkField[] = ["canonicalTitle", "titleAr", "aliases", "trivia", "summary"];

export function useScopeControls() {
  const [fieldSearch, setFieldSearch] = useState("");
  const [preset, setPreset] = useState("all");
  return { fieldSearch, setFieldSearch, preset, setPreset };
}

export function WorkDocumentScope({
  visibleFields,
  scope,
  busy,
  canChoose,
  controls,
  onChoose: choose,
}: {
  visibleFields: WorkField[];
  scope: StructureScope;
  busy: boolean;
  canChoose: boolean;
  controls: ReturnType<typeof useScopeControls>;
  onChoose: (fields: WorkField[], scope?: StructureScope) => void;
}) {
  const { fieldSearch, setFieldSearch, preset, setPreset } = controls;
  return (
    <Card size="sm" className="min-w-0 xl:sticky xl:top-4 xl:order-last">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>محتوى JSON</CardTitle>
          <Badge variant="secondary">
            {visibleFields.length} / {fieldKeys.length}
          </Badge>
        </div>
        <CardDescription>اختر ما يظهر في النص. إخفاء الحقول يحفظ قيمها وتعديلاتها.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <SelectField
            label="قالب الحقول"
            value={
              preset !== "custom" && sameFields(visibleFields, presetFields(preset))
                ? preset
                : "custom"
            }
            items={[
              { value: "all", label: "كل الحقول" },
              { value: "identity", label: "هوية العمل" },
              { value: "indexing", label: "الفهرسة والعلاقات" },
              { value: "editorial", label: "التحرير" },
              { value: "structure", label: "الأجزاء والحلقات والتقييمات" },
              { value: "custom", label: "اختيار مخصص" },
            ]}
            onChange={(value) => {
              if (!canChoose || value === "custom") return;
              choose(presetFields(value));
              setPreset(value);
            }}
          />
          <Field>
            <FieldLabel htmlFor="json-field-search" className="sr-only">
              بحث في الحقول والتفاصيل
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="json-field-search"
                value={fieldSearch}
                onChange={(event) => setFieldSearch(event.target.value)}
                placeholder="بحث بالاسم أو المفتاح…"
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              {fieldSearch && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="مسح بحث الحقول"
                    onClick={() => setFieldSearch("")}
                  >
                    <XIcon data-icon="inline-start" />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </Field>
          <Tabs defaultValue="fields">
            <TabsList className="w-full">
              <TabsTrigger value="fields">الحقول</TabsTrigger>
              <TabsTrigger value="structure">الأجزاء</TabsTrigger>
              <TabsTrigger value="episodes">الحلقات</TabsTrigger>
            </TabsList>
            <TabsContent value="fields">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Field orientation="horizontal">
                    <Checkbox
                      id="json-select-all"
                      checked={visibleFields.length === fieldKeys.length}
                      indeterminate={
                        visibleFields.length > 0 && visibleFields.length < fieldKeys.length
                      }
                      disabled={busy}
                      onCheckedChange={(checked) => {
                        choose(checked === true ? fieldKeys : ["canonicalTitle"]);
                        if (checked === true) setPreset("all");
                      }}
                    />
                    <FieldLabel htmlFor="json-select-all">تحديد الكل</FieldLabel>
                  </Field>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => choose(["canonicalTitle"])}
                  >
                    العنوان فقط
                  </Button>
                </div>
                <ScrollArea className="h-80">
                  <div className="pe-3">
                    <FieldGroup>
                      {groups.map((group) => {
                        const all = workFields.filter((field) => field.group === group);
                        const items = all.filter((field) => matchesFieldSearch(field, fieldSearch));
                        if (!items.length) return null;
                        return (
                          <JsonScopeGroup
                            key={group}
                            prefix={`json-${group.replace(/\s+/g, "-")}`}
                            label={group}
                            items={items}
                            allItems={all}
                            selected={visibleFields}
                            disabled={busy}
                            onChange={(next) => {
                              const keys = new Set(all.map(({ key }) => key));
                              choose([...visibleFields.filter((key) => !keys.has(key)), ...next]);
                            }}
                          />
                        );
                      })}
                      {!workFields.some((field) => matchesFieldSearch(field, fieldSearch)) && (
                        <Empty>
                          <EmptyHeader>
                            <EmptyTitle>لا توجد حقول مطابقة</EmptyTitle>
                            <EmptyDescription>جرّب اسم الحقل بالعربية أو مفتاحه.</EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      )}
                    </FieldGroup>
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
            <TabsContent value="structure">
              {visibleFields.includes("installments") ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      المعرّف والعنوان ثابتان في النص.
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        choose(visibleFields, {
                          ...scope,
                          installments: fullStructureScope.installments,
                        })
                      }
                    >
                      <CheckCheckIcon data-icon="inline-start" />
                      كل التفاصيل
                    </Button>
                  </div>
                  <ScrollArea className="h-80">
                    <div className="pe-3">
                      <FieldGroup>
                        {installmentGroups.map((group) => {
                          const all = installmentFields.filter((field) =>
                            group.keys.some((key) => key === field.key),
                          );
                          const items = all.filter((field) =>
                            matchesFieldSearch(field, fieldSearch),
                          );
                          if (!items.length) return null;
                          return (
                            <JsonScopeGroup
                              key={group.label}
                              prefix={`json-part-${group.keys[0]}`}
                              label={group.label}
                              items={items}
                              allItems={all}
                              selected={scope.installments}
                              disabled={busy}
                              onChange={(next) => {
                                const keys = all.map(({ key }) => key);
                                choose(visibleFields, {
                                  ...scope,
                                  installments: [
                                    ...scope.installments.filter(
                                      (key) => !keys.some((value) => value === key),
                                    ),
                                    ...next,
                                  ],
                                });
                              }}
                            />
                          );
                        })}
                        {!installmentFields.some((field) =>
                          matchesFieldSearch(field, fieldSearch),
                        ) && (
                          <Empty>
                            <EmptyHeader>
                              <EmptyTitle>لا توجد تفاصيل مطابقة</EmptyTitle>
                            </EmptyHeader>
                          </Empty>
                        )}
                      </FieldGroup>
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>الأجزاء مخفية في النص</EmptyTitle>
                    <EmptyDescription>
                      أظهر الأجزاء لتحديد الحلقات والتقييمات وبقية التفاصيل.
                    </EmptyDescription>
                  </EmptyHeader>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => choose([...visibleFields, "installments"])}
                  >
                    إظهار الأجزاء
                  </Button>
                </Empty>
              )}
            </TabsContent>
            <TabsContent value="episodes">
              <FieldGroup>
                <Field orientation="horizontal">
                  <Checkbox
                    id="json-include-episodes"
                    checked={
                      visibleFields.includes("installments") &&
                      scope.installments.includes("episodes")
                    }
                    disabled={busy}
                    onCheckedChange={(checked) =>
                      choose(
                        visibleFields.includes("installments")
                          ? visibleFields
                          : [...visibleFields, "installments"],
                        {
                          ...scope,
                          installments:
                            checked === true
                              ? [...new Set([...scope.installments, "episodes"])]
                              : scope.installments.filter((key) => key !== "episodes"),
                        },
                      )
                    }
                  />
                  <FieldLabel htmlFor="json-include-episodes">إظهار الحلقات في JSON</FieldLabel>
                </Field>
                {visibleFields.includes("installments") &&
                scope.installments.includes("episodes") ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      رقم الحلقة ومعرّفها يظهران دائماً. اختر التفاصيل الإضافية.
                    </p>
                    <JsonScopeGroup
                      prefix="json-episodes"
                      label="تفاصيل الحلقات"
                      items={episodeFields.filter((field) =>
                        matchesFieldSearch(field, fieldSearch),
                      )}
                      allItems={episodeFields}
                      selected={scope.episodes}
                      disabled={busy}
                      onChange={(episodes) => choose(visibleFields, { ...scope, episodes })}
                    />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    الحلقات المخفية محفوظة ولا تتأثر بتعديل بقية العمل.
                  </p>
                )}
              </FieldGroup>
            </TabsContent>
          </Tabs>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

const installmentGroups = [
  {
    label: "الهوية والعرض",
    keys: ["kind", "position", "summary", "status", "releaseDate", "runtimeMinutes"],
  },
  {
    label: "التصنيف والمخاطر",
    keys: [
      "audienceOverride",
      "ageOverride",
      "sexualityRiskOverride",
      "behavioralRiskOverride",
      "theologyRiskOverride",
    ],
  },
  { label: "التقييمات والصور والحلقات", keys: ["score", "media", "episodes"] },
  { label: "المعرّفات الخارجية", keys: ["tmdbId", "imdbId", "anilistId", "malId"] },
] as const;
function matchesFieldSearch(field: { key: string; label: string }, search: string) {
  return `${field.label} ${field.key}`.toLowerCase().includes(search.trim().toLowerCase());
}
function JsonScopeGroup<Key extends string>({
  prefix,
  label,
  items,
  allItems,
  selected,
  disabled,
  onChange,
}: {
  prefix: string;
  label: string;
  items: readonly { key: Key; label: string }[];
  allItems: readonly { key: Key; label: string }[];
  selected: readonly Key[];
  disabled: boolean;
  onChange: (keys: Key[]) => void;
}) {
  const keys = allItems.map(({ key }) => key);
  const count = keys.filter((key) => selected.includes(key)).length;
  return (
    <FieldSet>
      <FieldLegend variant="label" className="sr-only">
        {label}
      </FieldLegend>
      <FieldGroup data-slot="checkbox-group">
        <Field orientation="horizontal">
          <Checkbox
            id={`${prefix}-all`}
            checked={count === keys.length}
            indeterminate={count > 0 && count < keys.length}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked === true ? keys : [])}
          />
          <FieldLabel htmlFor={`${prefix}-all`}>{label}</FieldLabel>
          <Badge variant="outline">
            {count}/{keys.length}
          </Badge>
        </Field>
        <div className="ps-6">
          <FieldGroup data-slot="checkbox-group">
            {items.map((field) => (
              <Field key={field.key} orientation="horizontal">
                <Checkbox
                  id={`${prefix}-${field.key}`}
                  checked={selected.includes(field.key)}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...keys.filter((key) => selected.includes(key)), field.key]
                        : keys.filter((key) => selected.includes(key) && key !== field.key),
                    )
                  }
                />
                <FieldLabel htmlFor={`${prefix}-${field.key}`}>
                  <span>
                    {field.label}
                    <span
                      dir="ltr"
                      className="block break-all font-utility text-xs text-muted-foreground"
                    >
                      {field.key}
                    </span>
                  </span>
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
        </div>
      </FieldGroup>
    </FieldSet>
  );
}

function presetFields(value: string): WorkField[] {
  if (value === "all") return [...fieldKeys];
  if (value === "identity") return [...identityFields];
  if (value === "structure") return ["canonicalTitle", "installments", "awards"];
  return workFields
    .filter((field) => field.group === (value === "indexing" ? "الفهرسة" : "التحرير"))
    .map((field) => field.key);
}

function sameFields(left: readonly WorkField[], right: readonly WorkField[]) {
  return left.length === right.length && right.every((key) => left.includes(key));
}

import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useId, useState } from "react";

import { SelectField } from "@/components/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  isJsonObject,
  isJsonString,
  isJsonNumber,
  isJsonBoolean,
  isIdentifiedJson,
  workFields,
  type JsonValue,
} from "@/features/editor/json/document/document-model";
import { ReferencePicker } from "@/features/editor/references/reference-picker";

const labels = {
  ...Object.fromEntries(workFields.map(({ key, label }) => [key, label])),
  id: "المعرّف الثابت",
  kind: "النوع",
  title: "العنوان",
  number: "رقم الحلقة",
  position: "الترتيب",
  status: "حالة العرض",
  releaseDate: "تاريخ الإصدار",
  runtimeMinutes: "المدة بالدقائق",
  episodes: "الحلقات",
  score: "التقييمات",
  story: "القصة",
  characters: "الشخصيات",
  depth: "العمق",
  worldBuilding: "بناء العالم",
  originality: "الأصالة",
  craft: "الصنعة",
  entity: "الشخص / الاستوديو",
  role: "الدور",
  isPrimary: "مساهمة رئيسية",
  target: "العمل المرتبط",
  notes: "ملاحظات",
  organization: "جهة الجائزة",
  category: "الفئة",
  year: "السنة",
  result: "النتيجة",
  isFeatured: "جائزة بارزة",
  sourceUrl: "المصدر",
  installment: "الجزء",
  poster: "الملصق",
  banner: "الغلاف",
  logo: "الشعار",
  audienceOverride: "جمهور الجزء",
  ageOverride: "سن الجزء",
  sexualityRiskOverride: "مخاطر الجزء الجنسية",
  behavioralRiskOverride: "مخاطر الجزء السلوكية",
  theologyRiskOverride: "مخاطر الجزء العقدية",
};
const choices = {
  format: ["animated", "live-action"],
  workflowStatus: ["draft", "in_review", "approved", "published", "archived"],
  audience: ["general", "teen", "young-adult", "adult"],
  audienceOverride: ["general", "teen", "young-adult", "adult"],
  age: ["all", "7+", "10+", "13+", "16+", "18+"],
  ageOverride: ["all", "7+", "10+", "13+", "16+", "18+"],
  status: ["announced", "airing", "completed", "unknown"],
  result: ["winner", "nominee"],
};
const references = {
  planets: "planets",
  genres: "genres",
  tones: "tones",
  tags: "tags",
  countries: "countries",
  entity: "entities",
  role: "roles",
  target: "titles",
  organization: "award_organizations",
};
function newItem(key: string, index: number): JsonValue {
  if (key === "installments")
    return {
      kind: "season",
      title: "جزء جديد",
      position: index + 1,
      episodes: [],
      score: {
        story: null,
        characters: null,
        depth: null,
        worldBuilding: null,
        originality: null,
        craft: null,
      },
    };
  if (key === "episodes")
    return {
      number: index + 1,
      position: index + 1,
      title: null,
      summary: "",
      releaseDate: null,
      runtimeMinutes: null,
    };
  if (key === "credits") return { entity: "", role: "", isPrimary: false, position: index + 1 };
  if (key === "relations") return { target: "", kind: "related", notes: "" };
  if (key === "awards")
    return {
      organization: "",
      category: "",
      year: null,
      result: "nominee",
      installment: null,
      isFeatured: false,
      notes: "",
    };
  if (key === "externalIds") return { provider: "", externalId: "", url: null };
  return "";
}
const types = [
  { value: "string", label: "نص" },
  { value: "number", label: "رقم" },
  { value: "boolean", label: "نعم / لا" },
  { value: "null", label: "فارغ" },
  { value: "object", label: "حقول" },
  { value: "array", label: "قائمة" },
];
function defaultValue(type: string): JsonValue {
  if (type === "number") return 0;
  if (type === "boolean") return false;
  if (type === "null") return null;
  if (type === "object") return {};
  if (type === "array") return [];
  return "";
}
export function JsonTreeEditor({
  value,
  onChange,
  label = "المستند",
  readOnly = false,
  profile = "generic",
}: {
  value: JsonValue;
  onChange: (value: JsonValue) => void;
  label?: string;
  readOnly?: boolean;
  profile?: "generic" | "work";
}) {
  return (
    <JsonNode
      value={value}
      onChange={onChange}
      name={label}
      path=""
      depth={0}
      readOnly={readOnly}
      profile={profile}
    />
  );
}
function JsonNode({
  value,
  onChange,
  name,
  path,
  depth,
  readOnly,
  profile,
}: {
  value: JsonValue;
  onChange: (value: JsonValue) => void;
  name: string;
  path: string;
  depth: number;
  readOnly: boolean;
  profile: "generic" | "work";
}) {
  const id = useId();
  const [open, setOpen] = useState(depth < 2 && !Array.isArray(value));
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState("string");
  const title = Object.entries(labels).find(([key]) => key === name)?.[1] ?? name;
  const reference = Object.entries(references).find(([key]) => key === name)?.[1];
  const immutable = readOnly || name === "id";
  const numeric = [
    "number",
    "position",
    "runtimeMinutes",
    "releaseYear",
    "year",
    "tmdbId",
    "anilistId",
    "malId",
    "qualityScore",
    "story",
    "characters",
    "depth",
    "worldBuilding",
    "originality",
    "craft",
  ].includes(name);
  const date = name === "releaseDate" || name.endsWith("_date");
  if (!Array.isArray(value) && !isJsonObject(value)) {
    const values =
      profile === "generic"
        ? undefined
        : (Object.entries(choices).find(([key]) => key === name)?.[1] ??
          (name.toLowerCase().includes("risk")
            ? ["none", "low", "medium", "high"]
            : name === "kind" && path.includes("installments")
              ? ["season", "movie", "special"]
              : name === "kind" && path.includes("relations")
                ? [
                    "sequel",
                    "adaptation",
                    "spin-off",
                    "side-story",
                    "compilation",
                    "alternative",
                    "related",
                  ]
                : undefined));
    return (
      <Field>
        <FieldLabel htmlFor={id}>
          {title}{" "}
          <span dir="ltr" className="font-utility text-xs text-muted-foreground">
            {name}
          </span>
        </FieldLabel>
        {immutable ? (
          <Input id={id} value={value === null ? "null" : String(value)} readOnly />
        ) : values ? (
          <SelectField
            label={title}
            value={isJsonString(value) ? value : "__null__"}
            items={[
              { value: "__null__", label: "توريث / فارغ" },
              ...values.map((item) => ({ value: item, label: item })),
            ]}
            onChange={(next) => onChange(next === "__null__" ? null : next)}
          />
        ) : date ? (
          <Input
            id={id}
            type="date"
            value={isJsonString(value) ? value : ""}
            onChange={(event) => onChange(event.target.value || null)}
          />
        ) : isJsonBoolean(value) ? (
          <SelectField
            label={title}
            value={value ? "true" : "false"}
            items={[
              { value: "true", label: "نعم" },
              { value: "false", label: "لا" },
            ]}
            onChange={(next) => {
              if (!immutable) onChange(next === "true");
            }}
          />
        ) : isJsonNumber(value) || (value === null && numeric) ? (
          <Input
            id={id}
            type="number"
            step="any"
            value={value ?? ""}
            min={path.includes("score") ? 0 : undefined}
            max={path.includes("score") ? 10 : undefined}
            disabled={immutable}
            onChange={(event) => {
              if (event.target.value === "") onChange(null);
              else if (Number.isFinite(Number(event.target.value)))
                onChange(Number(event.target.value));
            }}
          />
        ) : value === null ? (
          <SelectField
            label={`${title}: قيمة فارغة`}
            value="null"
            items={types}
            onChange={(next) => {
              if (!immutable) onChange(defaultValue(next));
            }}
          />
        ) : String(value).length > 100 ||
          ["summary", "notes", "contentWarnings", "analysisNotes", "curatorNotes"].includes(name) ||
          path.includes("trivia.") ? (
          <Textarea
            id={id}
            rows={3}
            value={String(value)}
            disabled={immutable}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <Input
            id={id}
            value={String(value)}
            disabled={immutable}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        {!immutable && (
          <div className="flex flex-wrap gap-2">
            {profile === "work" && reference && (
              <ReferencePicker table={reference} title={`اختيار ${title}`} onPick={onChange} />
            )}
            {profile === "work" && ["poster", "banner", "logo", "profile"].includes(name) && (
              <ReferencePicker
                table="media_assets"
                images
                title={`اختيار ${title}`}
                onPick={onChange}
              />
            )}
            {value !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                تعيين فارغ
              </Button>
            )}
          </div>
        )}
      </Field>
    );
  }
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            {open ? (
              <ChevronDownIcon data-icon="inline-start" />
            ) : (
              <ChevronRightIcon data-icon="inline-start" />
            )}
            {title}
            <Badge variant="outline">{entries.length}</Badge>
          </Button>
        </CardTitle>
        <CardDescription>
          <span dir="ltr">{path || "JSON"}</span>
          {!open && " · افتح لعرض التفاصيل وتحريرها"}
        </CardDescription>
      </CardHeader>
      {open && (
        <CardContent>
          <FieldGroup>
            {entries.map(([key, item], index) => (
              <div
                key={isIdentifiedJson(item) ? item.id : key}
                className="flex min-w-0 flex-col gap-2"
              >
                <JsonNode
                  value={item}
                  onChange={(next) =>
                    onChange(
                      Array.isArray(value)
                        ? value.map((entry, position) => (position === index ? next : entry))
                        : { ...value, [key]: next },
                    )
                  }
                  name={
                    Array.isArray(value)
                      ? isJsonObject(item)
                        ? String(
                            item.titleAr ||
                              item.canonicalTitle ||
                              item.title ||
                              item.name ||
                              item.entity ||
                              item.target ||
                              item.organization ||
                              `${title} ${index + 1}`,
                          )
                        : `${title} ${index + 1}`
                      : key
                  }
                  path={path ? `${path}.${key}` : key}
                  depth={depth + 1}
                  readOnly={readOnly}
                  profile={profile}
                />
                {!readOnly && key !== "id" && (
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(value) && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`نقل ${index + 1} للأعلى`}
                          disabled={!index}
                          onClick={() => {
                            const next = [...value];
                            [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                            onChange(
                              next.map((entry, position) =>
                                isJsonObject(entry) && Object.hasOwn(entry, "position")
                                  ? { ...entry, position: position + 1 }
                                  : entry,
                              ),
                            );
                          }}
                        >
                          <ArrowUpIcon data-icon="inline-start" />
                          للأعلى
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`نقل ${index + 1} للأسفل`}
                          disabled={index === entries.length - 1}
                          onClick={() => {
                            const next = [...value];
                            [next[index + 1], next[index]] = [next[index]!, next[index + 1]!];
                            onChange(
                              next.map((entry, position) =>
                                isJsonObject(entry) && Object.hasOwn(entry, "position")
                                  ? { ...entry, position: position + 1 }
                                  : entry,
                              ),
                            );
                          }}
                        >
                          <ArrowDownIcon data-icon="inline-start" />
                          للأسفل
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (Array.isArray(value))
                          onChange(value.filter((_, position) => position !== index));
                        else
                          onChange(
                            Object.fromEntries(
                              Object.entries(value).filter(([entry]) => entry !== key),
                            ),
                          );
                      }}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      إزالة من المسودة
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {!readOnly &&
              (Array.isArray(value) ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onChange([...value, profile === "work" ? newItem(name, value.length) : ""])
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    إضافة {title}
                  </Button>
                  {profile === "work" && reference && (
                    <ReferencePicker
                      table={reference}
                      title={`إضافة ${title}`}
                      onPick={(next) => {
                        if (!value.includes(next)) onChange([...value, next]);
                      }}
                    />
                  )}
                </div>
              ) : (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={`${id}-key`}>إضافة حقل إلى {title}</FieldLabel>
                    <Input
                      id={`${id}-key`}
                      dir="ltr"
                      placeholder="fieldName"
                      value={newKey}
                      onChange={(event) => setNewKey(event.target.value)}
                    />
                  </Field>
                  <SelectField
                    label="نوع الحقل الجديد"
                    value={newType}
                    items={types}
                    onChange={setNewType}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      !newKey.trim() ||
                      Object.hasOwn(value, newKey.trim()) ||
                      newKey.trim() === "id" ||
                      ["__proto__", "constructor", "prototype"].includes(newKey.trim())
                    }
                    onClick={() => {
                      onChange({ ...value, [newKey.trim()]: defaultValue(newType) });
                      setNewKey("");
                    }}
                  >
                    <PlusIcon data-icon="inline-start" />
                    إضافة الحقل
                  </Button>
                </FieldGroup>
              ))}
          </FieldGroup>
        </CardContent>
      )}
    </Card>
  );
}

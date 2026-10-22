import {
  Check,
  List,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Settings2,
  Type,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Choice } from "@/components/choice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { groupChoices, parseGroup, type BrowseGroup } from "./browse-refinements";
import {
  defaultTableColumns,
  tableColumns,
  displayDefaults,
  type DisplayPreferences,
} from "./display-preferences";
export { displayDefaults, type DisplayPreferences } from "./display-preferences";

const layouts = [
  { value: "poster", label: "ملصقات", icon: RectangleVertical },
  { value: "banner", label: "لافتات", icon: RectangleHorizontal },
  { value: "logo", label: "شعارات", icon: Type },
  { value: "table", label: "جدول", icon: List },
] as const;
type DisplayProps = { value: DisplayPreferences; onChange: (value: DisplayPreferences) => void };

export function DisplaySettings({
  value,
  onChange,
  group,
  onGroup,
}: DisplayProps & {
  group?: BrowseGroup;
  onGroup?: (group: BrowseGroup) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" aria-label="خيارات العرض" />}>
        <Settings2 data-icon="inline-start" /> العرض
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-lg max-w-(--available-width) max-h-(--available-height) gap-4 overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <PopoverHeader>
            <PopoverTitle>العرض</PopoverTitle>
            <PopoverDescription>اختياراتك تُطبّق وتُحفظ مباشرة.</PopoverDescription>
          </PopoverHeader>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="استعادة العرض الافتراضي"
              title="استعادة العرض الافتراضي"
              onClick={() => onChange(displayDefaults)}
            >
              <RotateCcw />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="إغلاق خيارات العرض"
              onClick={() => setOpen(false)}
            >
              <X />
            </Button>
          </div>
        </div>
        <ToggleGroup
          variant="outline"
          spacing={2}
          className="grid w-full grid-cols-4"
          value={[value.layout]}
          aria-label="طريقة العرض"
          onValueChange={(values) => {
            const layout = layouts.find((item) => item.value === values[0]);
            if (layout) onChange({ ...value, layout: layout.value });
          }}
        >
          {layouts.map((layout) => (
            <ToggleGroupItem
              key={layout.value}
              value={layout.value}
              className="h-auto min-w-0 flex-col gap-2 px-2 py-3"
              aria-label={layout.label}
            >
              <layout.icon />
              <span>{layout.label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Separator />
        {value.layout === "table" ? (
          <TableOptions value={value} onChange={onChange} />
        ) : (
          <CardOptions value={value} onChange={onChange} />
        )}
        {group && onGroup && (
          <>
            <Separator />
            <SettingRow label="تجميع النتائج">
              <div className="w-56 max-w-full">
                <Choice
                  label="تجميع النتائج"
                  value={group}
                  options={groupChoices.map((item) => ({ value: item.value, label: item.label }))}
                  onChange={(next) => onGroup(parseGroup(next))}
                />
              </div>
            </SettingRow>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TableOptions({ value, onChange }: DisplayProps) {
  const columns = value.tableColumns ?? defaultTableColumns;
  const title = value.tableTitle ?? (value.showOriginalTitle === false ? "arabic" : "both");
  const preset = tableColumns.every((column) => columns.includes(column.key))
    ? "all"
    : columns.length === 3 &&
        ["release", "score", "watchState"].every((column) => columns.some((key) => key === column))
      ? "brief"
      : "custom";
  return (
    <FieldGroup className="gap-4">
      <SettingRow label="لغة العنوان">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[title]}
          aria-label="لغة عنوان الجدول"
          onValueChange={(next) => {
            if (next[0] === "arabic" || next[0] === "english" || next[0] === "both")
              onChange({ ...value, tableTitle: next[0] });
          }}
        >
          <ToggleGroupItem value="arabic">العربية</ToggleGroupItem>
          <ToggleGroupItem value="english">English</ToggleGroupItem>
          <ToggleGroupItem value="both">كلاهما</ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      <SettingRow label="الصفوف">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[value.tableDensity ?? "normal"]}
          aria-label="كثافة الصفوف"
          onValueChange={(next) => {
            if (next[0] === "normal" || next[0] === "compact")
              onChange({ ...value, tableDensity: next[0] });
          }}
        >
          <ToggleGroupItem value="normal">مريحة</ToggleGroupItem>
          <ToggleGroupItem value="compact">مكثّفة</ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      <DisplaySwitch
        id="table-posters"
        label="صور مصغرة"
        checked={value.tablePosters ?? true}
        onChange={(tablePosters) => onChange({ ...value, tablePosters })}
      />
      <Separator />
      <FieldSet className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLegend variant="label">
            الأعمدة <Badge variant="secondary">{columns.length}</Badge>
          </FieldLegend>
          <ToggleGroup
            size="sm"
            spacing={0}
            value={preset === "custom" ? [] : [preset]}
            aria-label="اختيارات الأعمدة"
            onValueChange={(next) => {
              if (next[0] === "brief")
                onChange({ ...value, tableColumns: ["release", "score", "watchState"] });
              if (next[0] === "all")
                onChange({ ...value, tableColumns: tableColumns.map((column) => column.key) });
            }}
          >
            <ToggleGroupItem value="brief">مختصر</ToggleGroupItem>
            <ToggleGroupItem value="all">الكل</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={2}
          className="grid w-full grid-cols-2"
          value={columns}
          aria-label="أعمدة الجدول"
          onValueChange={(next) =>
            onChange({
              ...value,
              tableColumns: tableColumns
                .filter((column) => next.includes(column.key))
                .map((column) => column.key),
            })
          }
        >
          {tableColumns.map((column) => (
            <ToggleGroupItem key={column.key} value={column.key} className="justify-between gap-2">
              {column.label}
              {columns.includes(column.key) && <Check data-icon="inline-end" />}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          العنوان ثابت؛ اضغط أي عمود لإظهاره أو إخفائه.
        </p>
      </FieldSet>
    </FieldGroup>
  );
}

function CardOptions({ value, onChange }: DisplayProps) {
  return (
    <FieldGroup className="gap-4">
      <SettingRow
        label={
          value.layout === "logo"
            ? "حجم الشعارات"
            : value.layout === "banner"
              ? "حجم اللافتات"
              : "حجم الملصقات"
        }
      >
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[value.size]}
          aria-label="حجم البطاقات"
          onValueChange={(next) => {
            if (next[0] === "compact" || next[0] === "normal" || next[0] === "comfortable")
              onChange({ ...value, size: next[0] });
          }}
        >
          <ToggleGroupItem value="compact">صغير</ToggleGroupItem>
          <ToggleGroupItem value="normal">وسط</ToggleGroupItem>
          <ToggleGroupItem value="comfortable">كبير</ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      <SettingRow label="محتوى البطاقة">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[value.minimal ? "image" : "details"]}
          aria-label="محتوى البطاقة"
          onValueChange={(next) => {
            if (next[0]) onChange({ ...value, minimal: next[0] === "image" });
          }}
        >
          <ToggleGroupItem value="details">صورة ومعلومات</ToggleGroupItem>
          <ToggleGroupItem value="image">
            {value.layout === "logo" ? "شعار فقط" : "صورة فقط"}
          </ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      {value.layout === "logo" && (
        <DisplaySwitch
          id="display-borderless"
          label="شعارات دون إطار"
          checked={value.borderless}
          onChange={(borderless) => onChange({ ...value, borderless })}
        />
      )}
      {!value.minimal && (
        <>
          <Separator />
          <DisplaySwitch
            id="display-score"
            label="التقييم"
            checked={value.showScore}
            onChange={(showScore) => onChange({ ...value, showScore })}
          />
          <DisplaySwitch
            id="display-status"
            label="حالة الإصدار"
            checked={value.showStatus}
            onChange={(showStatus) => onChange({ ...value, showStatus })}
          />
          <DisplaySwitch
            id="display-metadata"
            label="السنة ومعلومات العمل"
            checked={value.showMetadata ?? true}
            onChange={(showMetadata) => onChange({ ...value, showMetadata })}
          />
          <DisplaySwitch
            id="display-original"
            label="العنوان الأصلي"
            checked={value.showOriginalTitle ?? false}
            onChange={(showOriginalTitle) => onChange({ ...value, showOriginalTitle })}
          />
        </>
      )}
    </FieldGroup>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Field orientation="horizontal" className="flex-wrap items-center justify-between gap-2">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </Field>
  );
}

function DisplaySwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="items-center justify-between gap-3">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  );
}

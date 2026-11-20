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
import { useRef, type KeyboardEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  defaultTableColumns,
  tableColumns,
  displayDefaults,
  selectBrowseLayout,
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

function moveDrawerFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.key !== "ArrowUp" && event.key !== "ArrowDown")
  )
    return;

  // Horizontal choices keep Base UI's RTL navigation. Vertical arrows move between tab stops.
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("button, [role='switch']"),
  ).filter(
    (control) => control.tabIndex >= 0 && !control.matches(":disabled, [aria-disabled='true']"),
  );
  const focused = controls.findIndex((control) => control === event.target);
  if (focused === -1) return;
  event.preventDefault();
  event.stopPropagation();
  controls[focused + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
}

export function DisplaySettings({ value, onChange }: DisplayProps) {
  const selectedLayout = useRef<HTMLButtonElement>(null);
  return (
    <Drawer swipeDirection="down" showSwipeHandle>
      <DrawerTrigger render={<Button variant="outline" aria-label="خيارات العرض" />}>
        <Settings2 data-icon="inline-start" /> العرض
      </DrawerTrigger>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-lg motion-reduce:transition-none"
        initialFocus={selectedLayout}
        onKeyDownCapture={moveDrawerFocus}
      >
        <DrawerHeader className="flex-row items-center justify-between gap-3 px-5 py-3 text-start">
          <div>
            <DrawerTitle>العرض</DrawerTitle>
            <DrawerDescription className="sr-only">تُحفظ خيارات العرض تلقائيًا.</DrawerDescription>
          </div>
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
            <DrawerClose
              render={<Button variant="ghost" size="icon-sm" aria-label="إغلاق خيارات العرض" />}
            >
              <X />
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">
          <ToggleGroup
            variant="outline"
            spacing={2}
            className="grid w-full grid-cols-4"
            value={[value.layout]}
            aria-label="طريقة العرض"
            onValueChange={(values) => {
              const layout = layouts.find((item) => item.value === values[0]);
              if (layout && layout.value !== value.layout)
                onChange(selectBrowseLayout(value, layout.value));
            }}
          >
            {layouts.map((layout) => (
              <ToggleGroupItem
                key={layout.value}
                value={layout.value}
                ref={layout.value === value.layout ? selectedLayout : undefined}
                className="h-auto min-w-0 flex-col gap-1.5 rounded-xl px-1 py-2"
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function TableOptions({ value, onChange }: DisplayProps) {
  const columns = value.tableColumns ?? defaultTableColumns;
  const title = value.tableTitle === "english" ? "english" : "arabic";
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
            if (next[0] === "arabic" || next[0] === "english")
              onChange({ ...value, tableTitle: next[0] });
          }}
        >
          <ToggleGroupItem value="arabic">العربية</ToggleGroupItem>
          <ToggleGroupItem value="english">English</ToggleGroupItem>
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
      {value.layout === "logo" && (
        <DisplaySwitch
          id="display-borderless"
          label="شعارات دون إطار"
          checked={value.borderless}
          onChange={(borderless) => onChange({ ...value, borderless })}
        />
      )}
      <FieldSet className="gap-3 rounded-xl border border-border px-3 py-2">
        <FieldLegend>معلومات البطاقة</FieldLegend>
        <DisplaySwitch
          id="display-title"
          label="العناوين"
          checked={value.showTitle ?? true}
          onChange={(showTitle) => onChange({ ...value, showTitle })}
        />
        {value.showTitle && (
          <SettingRow label="لغة العنوان">
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[value.cardTitle ?? "arabic"]}
              aria-label="لغة عنوان البطاقة"
              onValueChange={([cardTitle]) => {
                if (cardTitle === "arabic" || cardTitle === "english")
                  onChange({ ...value, cardTitle });
              }}
            >
              <ToggleGroupItem value="arabic">العربية</ToggleGroupItem>
              <ToggleGroupItem value="english">English</ToggleGroupItem>
            </ToggleGroup>
          </SettingRow>
        )}
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
          id="display-watch-status"
          label="حالة المشاهدة"
          checked={value.showWatchStatus ?? true}
          onChange={(showWatchStatus) => onChange({ ...value, showWatchStatus })}
        />
        <DisplaySwitch
          id="display-metadata"
          label="السنة ومعلومات العمل"
          checked={value.showMetadata ?? true}
          onChange={(showMetadata) => onChange({ ...value, showMetadata })}
        />
      </FieldSet>
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

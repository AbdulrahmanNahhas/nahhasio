import {
  List,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Settings2,
  Type,
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../../components/ui/popover";
import { Separator } from "../../components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { displayDefaults, type DisplayPreferences } from "./display-preferences";
export { displayDefaults, type DisplayPreferences } from "./display-preferences";

const layouts = [
  { value: "poster", label: "ملصقات", icon: RectangleVertical },
  { value: "banner", label: "لافتات", icon: RectangleHorizontal },
  { value: "logo", label: "شعارات", icon: Type },
  { value: "table", label: "جدول", icon: List },
] as const;
const sizes = [
  { value: "comfortable", label: "5 بطاقات في الصف", columns: 5 },
  { value: "normal", label: "6 بطاقات في الصف", columns: 6 },
  { value: "compact", label: "7 بطاقات في الصف", columns: 7 },
] as const;
const bannerSizes = [
  { value: "compact", label: "5 بطاقات في الصف", columns: 5 },
  { value: "normal", label: "4 بطاقات في الصف", columns: 4 },
  { value: "comfortable", label: "3 بطاقات في الصف", columns: 3 },
] as const;

export function DisplaySettings({
  value,
  onChange,
}: {
  value: DisplayPreferences;
  onChange: (value: DisplayPreferences) => void;
}) {
  const table = value.layout === "table";
  const sizeChoices = value.layout === "banner" ? bannerSizes : sizes;
  return (
    <TooltipProvider delay={350}>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[value.layout]}
          aria-label="طريقة العرض"
          onValueChange={(values) => {
            const next = layouts.find((item) => item.value === values[0]);
            if (next) onChange({ ...value, layout: next.value });
          }}
        >
          {layouts.map((item) => (
            <Tooltip key={item.value}>
              <TooltipTrigger
                render={<ToggleGroupItem value={item.value} aria-label={item.label} />}
              >
                <item.icon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[value.size]}
          disabled={table}
          aria-label="حجم البطاقات"
          onValueChange={(values) => {
            const next = sizeChoices.find((item) => item.value === values[0]);
            if (next) onChange({ ...value, size: next.value });
          }}
        >
          {sizeChoices.map((item) => (
            <Tooltip key={item.value}>
              <TooltipTrigger
                render={<ToggleGroupItem value={item.value} aria-label={item.label} />}
              >
                {item.columns}
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" aria-label="تخصيص العرض" />}>
            <Settings2 data-icon="inline-start" aria-hidden="true" />
            تخصيص
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 max-w-full gap-3">
            <PopoverHeader>
              <PopoverTitle>تفاصيل البطاقات</PopoverTitle>
              <PopoverDescription>
                {table
                  ? "اختر عرض البطاقات لتخصيص تفاصيلها."
                  : value.minimal
                    ? "أوقف الصور فقط لإظهار التفاصيل."
                    : "اختر التفاصيل التي تظهر على البطاقة."}
              </PopoverDescription>
            </PopoverHeader>
            <FieldGroup className="gap-3">
              {(
                [
                  { key: "minimal", label: "صور فقط", disabled: table },
                  { key: "showScore", label: "التقييم المحسوب", disabled: table || value.minimal },
                  {
                    key: "showStatus",
                    label: "حالة الإصدار",
                    disabled: table || value.minimal,
                  },
                  {
                    key: "borderless",
                    label: "الشعار دون إطار أو خلفية",
                    disabled: value.layout !== "logo",
                  },
                ] as const
              )
                .filter((item) => item.key !== "borderless" || value.layout === "logo")
                .map((item) => (
                  <Field key={item.key} orientation="horizontal" data-disabled={item.disabled}>
                    <Checkbox
                      id={`display-${item.key}`}
                      checked={value[item.key]}
                      disabled={item.disabled}
                      onCheckedChange={(checked) =>
                        onChange({ ...value, [item.key]: checked === true })
                      }
                    />
                    <FieldLabel htmlFor={`display-${item.key}`}>{item.label}</FieldLabel>
                  </Field>
                ))}
            </FieldGroup>
            <Separator />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => onChange(displayDefaults)}
            >
              <RotateCcw data-icon="inline-start" /> استعادة الافتراضي
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}

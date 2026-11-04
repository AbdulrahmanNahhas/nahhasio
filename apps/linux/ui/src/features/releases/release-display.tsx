import { Grid3X3, LayoutGrid, RectangleVertical, Type } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import type { ReleaseLayout, ReleaseSize } from "./release-feed";

const layouts = [
  { value: "poster", label: "ملصقات", icon: RectangleVertical },
  { value: "logo", label: "شعارات", icon: Type },
] as const;
const sizes = [
  { value: "medium", label: "كبير · 4 بطاقات", icon: LayoutGrid },
  { value: "small", label: "صغير · 5 بطاقات", icon: Grid3X3 },
] as const;
export function ReleaseDisplay({
  layout,
  size,
  onLayout,
  onSize,
}: {
  layout: ReleaseLayout;
  size: ReleaseSize;
  onLayout: (value: ReleaseLayout) => void;
  onSize: (value: ReleaseSize) => void;
}) {
  return (
    <TooltipProvider delay={350}>
      <div className="flex items-center gap-3">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[layout]}
          aria-label="طريقة عرض البطاقات"
          onValueChange={(values) => {
            const next = layouts.find((item) => item.value === values[0]);
            if (next) onLayout(next.value);
          }}
        >
          {layouts.map(({ value, label, icon: Icon }) => (
            <Tooltip key={value}>
              <TooltipTrigger render={<ToggleGroupItem value={value} aria-label={label} />}>
                <Icon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[size]}
          aria-label="حجم البطاقات"
          onValueChange={(values) => {
            const next = sizes.find((item) => item.value === values[0]);
            if (next) onSize(next.value);
          }}
        >
          {sizes.map(({ value, label, icon: Icon }) => (
            <Tooltip key={value}>
              <TooltipTrigger render={<ToggleGroupItem value={value} aria-label={label} />}>
                <Icon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      </div>
    </TooltipProvider>
  );
}

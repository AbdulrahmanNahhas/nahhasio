import { MenuContent, MenuItemIndicator } from "@ui-sdk/react/menu";
import { cn } from "cn";
import { Check } from "lucide-react";
import type { ComponentProps } from "react";

export const sdkMenuItemClassName =
  "relative flex min-w-0 cursor-default items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none select-none data-highlighted:bg-foreground/10 data-disabled:opacity-50";

export const sdkMenuContentClassName =
  "max-h-(--available-height) w-48 max-w-(--available-width) overflow-x-hidden overflow-y-auto rounded-2xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl";

export function SdkMenuContent({ className, ...props }: ComponentProps<typeof MenuContent>) {
  return <MenuContent {...props} className={cn(sdkMenuContentClassName, className)} />;
}

export function SdkMenuIndicator() {
  return (
    <MenuItemIndicator className="ms-auto shrink-0">
      <Check className="size-4" aria-hidden />
    </MenuItemIndicator>
  );
}

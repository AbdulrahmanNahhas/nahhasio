import { Checkbox as SdkCheckbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import { cn } from "cn";
import { CheckIcon, MinusIcon } from "lucide-react";
import type { ComponentProps } from "react";

export function Checkbox({
  className,
  checked,
  indeterminate,
  onCheckedChange,
  ...props
}: Omit<ComponentProps<typeof SdkCheckbox>, "checked" | "onCheckedChange"> & {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <SdkCheckbox
      data-slot="checkbox"
      checked={indeterminate ? "indeterminate" : checked}
      onCheckedChange={(next) => onCheckedChange?.(next === true)}
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[6px] border border-input transition-shadow outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxIndicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        {indeterminate ? <MinusIcon aria-hidden /> : <CheckIcon aria-hidden />}
      </CheckboxIndicator>
    </SdkCheckbox>
  );
}

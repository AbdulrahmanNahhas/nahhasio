import {
  Select,
  SelectContent as SdkSelectContent,
  SelectGroup as SdkSelectGroup,
  SelectItem as SdkSelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectTrigger as SdkSelectTrigger,
  SelectValue as SdkSelectValue,
  type SelectItemProps,
} from "@ui-sdk/react/select";
import { cn } from "cn";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export { Select };

export function SelectGroup({ className, ...props }: ComponentProps<typeof SdkSelectGroup>) {
  return <SdkSelectGroup className={cn("scroll-my-1 p-1", className)} {...props} />;
}

export function SelectValue({ className, ...props }: ComponentProps<typeof SdkSelectValue>) {
  return <SdkSelectValue className={cn("flex flex-1 truncate text-start", className)} {...props} />;
}

export function SelectTrigger({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof SdkSelectTrigger>, "children"> & { children?: ReactNode }) {
  return (
    <SdkSelectTrigger
      className={cn(
        "flex h-9 w-fit items-center justify-between gap-1.5 rounded-4xl border border-input bg-input/30 px-3 py-2 text-sm whitespace-nowrap outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive data-placeholder:text-muted-foreground dark:hover:bg-input/50",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon
        className="pointer-events-none size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </SdkSelectTrigger>
  );
}

export function SelectContent({
  className,
  align = "center",
  sideOffset = 4,
  alignItemWithTrigger = true,
  ...props
}: ComponentProps<typeof SdkSelectContent>) {
  return (
    <SdkSelectContent
      align={align}
      sideOffset={sideOffset}
      alignItemWithTrigger={alignItemWithTrigger}
      className={cn(
        "isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-2xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5 outline-none dark:ring-foreground/10",
        className,
      )}
      {...props}
    />
  );
}

export function SelectItem<T>({
  className,
  children,
  ...props
}: SelectItemProps<T> & { className?: string; children?: ReactNode }) {
  return (
    <SdkSelectItem
      className={cn(
        "relative flex w-full cursor-default items-center gap-2.5 rounded-xl py-2 pe-8 ps-3 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectItemText>
      <SelectItemIndicator className="pointer-events-none absolute end-2 flex size-4 items-center justify-center">
        <CheckIcon className="size-4" aria-hidden />
      </SelectItemIndicator>
    </SdkSelectItem>
  );
}

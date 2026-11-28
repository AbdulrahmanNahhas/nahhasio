import { Separator as SdkSeparator } from "@ui-sdk/react/separator";
import { cn } from "cn";
import type { ComponentProps } from "react";

export function Separator({ className, ...props }: ComponentProps<typeof SdkSeparator>) {
  return (
    <SdkSeparator
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

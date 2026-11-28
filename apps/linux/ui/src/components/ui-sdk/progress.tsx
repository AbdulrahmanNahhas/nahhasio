import { Progress as SdkProgress, ProgressIndicator, ProgressTrack } from "@ui-sdk/react/progress";
import { cn } from "cn";
import type { ComponentProps, ReactNode } from "react";

export function Progress({
  className,
  children,
  trackClassName,
  indicatorClassName,
  ...props
}: Omit<ComponentProps<typeof SdkProgress>, "className" | "children"> & {
  className?: string;
  children?: ReactNode;
  trackClassName?: string;
  indicatorClassName?: string;
}) {
  return (
    <SdkProgress data-slot="progress" className={cn("flex flex-wrap gap-3", className)} {...props}>
      {children}
      <ProgressTrack
        data-slot="progress-track"
        className={cn(
          "relative flex h-3 w-full items-center overflow-x-hidden rounded-4xl bg-muted",
          trackClassName,
        )}
      >
        <ProgressIndicator
          data-slot="progress-indicator"
          className={cn("h-full bg-primary transition-all", indicatorClassName)}
        />
      </ProgressTrack>
    </SdkProgress>
  );
}

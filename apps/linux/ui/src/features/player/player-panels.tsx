import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "cn";
import { X } from "lucide-react";
import { useId, type ComponentProps, type ReactNode, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverTitle } from "@/components/ui/popover";

/** Larger transport targets belong to the viewing client, not dashboard button variants. */
export function PlayerControl({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("player-control relative shrink-0 motion-reduce:transition-none", className)}
      {...props}
    />
  );
}

/** The episode shelf anchors to the entire footer; other panels anchor to their own trigger. */
export function PlayerPopover({
  title,
  icon,
  open,
  onOpenChange,
  children,
  anchor,
  boundary,
  wide = false,
  triggerRef,
  returnFocus,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  anchor?: RefObject<HTMLElement | null>;
  boundary?: RefObject<HTMLElement | null>;
  wide?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  returnFocus?: RefObject<HTMLButtonElement | null>;
}) {
  const triggerId = useId();
  return (
    <Popover open={open} onOpenChange={onOpenChange} triggerId={triggerId}>
      <PopoverTrigger
        id={triggerId}
        render={<PlayerControl ref={triggerRef} aria-label={title} title={title} />}
      >
        {icon}
      </PopoverTrigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          collisionBoundary={boundary?.current ?? undefined}
          side="top"
          align={wide ? "center" : "end"}
          sideOffset={12}
          collisionPadding={10}
          collisionAvoidance={{ side: "shift", align: "shift" }}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            finalFocus={returnFocus}
            className={cn(
              "player-panel flex w-88 max-w-(--available-width) max-h-[min(28rem,var(--available-height))] flex-col overflow-hidden rounded-2xl border border-border bg-player-panel text-foreground shadow-xl outline-none font-sans transition-opacity duration-150 [&[data-starting-style]]:opacity-0 [&[data-ending-style]]:opacity-0 motion-reduce:transition-none",
              wide &&
                "player-panel-wide w-(--available-width) max-h-[min(28rem,var(--available-height))] [&_.player-panel-body]:px-4 [&_.player-panel-body]:pb-4",
            )}
            dir="rtl"
          >
            <div className="player-panel-heading flex shrink-0 items-center justify-between gap-3 px-4 py-2">
              <PopoverTitle className="player-panel-title m-0 text-base font-semibold">
                {title}
              </PopoverTitle>
              <PopoverPrimitive.Close
                render={<PlayerControl aria-label={`إغلاق ${title}`} title={`إغلاق ${title}`} />}
              >
                <X data-icon="inline-start" />
              </PopoverPrimitive.Close>
            </div>
            <div className="player-panel-body min-h-0 overflow-y-auto scroll-fade-y overscroll-contain px-3 pb-3">
              {children}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}

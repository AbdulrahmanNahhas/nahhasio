import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { ReactNode } from "react";

import { ScrollBar } from "./ui/scroll-area";

/** Intrinsic-height drawers need a shrinking grid track, rather than a percentage-height viewport. */
export function ContentScrollArea({ children }: { children: ReactNode }) {
  return (
    <ScrollAreaPrimitive.Root dir="rtl" className="relative grid min-h-0 min-w-0 grid-rows-1">
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="min-h-0 min-w-0 overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

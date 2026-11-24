import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@ui-sdk/react/drawer";
import { X } from "lucide-react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { type Button, buttonVariants } from "@/components/ui/button";

export function MobileDrawer({
  title,
  description,
  showTitle = false,
  trigger,
  children,
  open,
  onOpenChange,
}: {
  title: string;
  description?: string;
  showTitle?: boolean;
  trigger?: ReactElement<ComponentProps<typeof Button>>;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Drawer side="bottom" container={document.body} open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerBackdrop className="bg-black/80" />
      <DrawerContent
        initialFocus="content"
        className="flex max-h-svh min-h-0 w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-popover text-sm text-popover-foreground outline-none"
      >
        <div
          className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/35"
          aria-hidden
        />
        {showTitle ? (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 pb-2">
            <div className="min-w-0">
              <DrawerTitle className="text-lg font-semibold wrap-anywhere">{title}</DrawerTitle>
              {description && (
                <DrawerDescription className="text-sm text-muted-foreground">
                  {description}
                </DrawerDescription>
              )}
            </div>
            <DrawerClose
              aria-label="إغلاق"
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <X aria-hidden />
            </DrawerClose>
          </div>
        ) : (
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
        )}
        <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

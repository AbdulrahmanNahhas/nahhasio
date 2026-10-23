import { cn } from "cn";
import { Children, type ReactNode } from "react";

/** Native horizontal scrolling keeps every card reachable without pagination. */
export function ScrollShelf<T>({
  items,
  render,
  layout = "poster",
}: {
  items: T[];
  render: (item: T) => ReactNode;
  layout?: "poster" | "banner";
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 scroll-fade-x grid-flow-col auto-rows-auto snap-x snap-proximity scroll-px-1 scrollbar-thin gap-4 overflow-x-auto overscroll-x-contain px-1 pt-1 pb-3",
        layout === "banner"
          ? "auto-cols-72 sm:auto-cols-80"
          : "auto-cols-40 sm:auto-cols-44 xl:auto-cols-48",
      )}
    >
      {Children.map(items.map(render), (child) => (
        <div className="min-w-0 snap-start">{child}</div>
      ))}
    </div>
  );
}

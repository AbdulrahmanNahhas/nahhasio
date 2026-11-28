import { cn } from "cn";
import { Children, type ReactNode } from "react";

/** Native horizontal scrolling keeps every card reachable without pagination. */
export function ScrollShelf<T>({
  items,
  render,
  layout = "poster",
  label,
  itemClassName,
}: {
  items: T[];
  render: (item: T) => ReactNode;
  layout?: "poster" | "banner" | "logo" | "compact";
  label?: string;
  itemClassName?: (item: T) => string;
}) {
  return (
    <div
      data-home-shelf
      role={label ? "list" : undefined}
      aria-label={label}
      className={cn(
        "-mx-4 grid min-w-0 scroll-fade-x sm:-mx-6 md:-mx-8 grid-flow-col auto-rows-auto snap-x snap-proximity scroll-px-12 scrollbar-thin gap-4 overflow-x-auto overscroll-x-contain px-12 py-3",
        itemClassName
          ? "auto-cols-max"
          : layout === "banner"
            ? "auto-cols-72 sm:auto-cols-80"
            : layout === "logo"
              ? "auto-cols-48 sm:auto-cols-56"
              : layout === "compact"
                ? "auto-cols-32 sm:auto-cols-36"
                : "auto-cols-40 sm:auto-cols-44 xl:auto-cols-48",
      )}
    >
      {Children.map(items.map(render), (child, index) => (
        <div
          data-home-shelf-item
          role={label ? "listitem" : undefined}
          className={cn("min-w-0 snap-start", itemClassName?.(items[index]))}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

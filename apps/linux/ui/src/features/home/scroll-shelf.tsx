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
  layout?: "poster" | "banner" | "logo";
}) {
  return (
    <div
      data-home-shelf
      className={cn(
        "-mx-4 grid min-w-0 scroll-fade-x sm:-mx-8 grid-flow-col auto-rows-auto snap-x snap-proximity scroll-px-12 scrollbar-thin gap-4 overflow-x-auto overscroll-x-contain px-12 py-3",
        layout === "banner"
          ? "auto-cols-72 sm:auto-cols-80"
          : layout === "logo"
            ? "auto-cols-48 sm:auto-cols-56"
            : "auto-cols-40 sm:auto-cols-44 xl:auto-cols-48",
      )}
    >
      {Children.map(items.map(render), (child) => (
        <div data-home-shelf-item className="min-w-0 snap-start">
          {child}
        </div>
      ))}
    </div>
  );
}

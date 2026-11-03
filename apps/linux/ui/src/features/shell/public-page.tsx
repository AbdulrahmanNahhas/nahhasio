import { cn } from "cn";
import type { HTMLAttributes, ReactNode } from "react";

/** Shared page rhythm; artwork heroes and work details keep their own compositions. */
export function PublicPage({
  as: Element = "section",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "section" | "article" | "div" }) {
  return (
    <Element
      className={cn(
        "mx-auto w-full min-w-0 max-w-400 px-4 py-6 sm:px-8 sm:py-8 lg:px-10",
        className,
      )}
      {...props}
    />
  );
}
export function PublicPageHeader({
  title,
  description,
  actions,
  count,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  count?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl leading-relaxed font-semibold sm:text-3xl">
            {title}
          </h1>
          {count}
        </div>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions}
    </header>
  );
}

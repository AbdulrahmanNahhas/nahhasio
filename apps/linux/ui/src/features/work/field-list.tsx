import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

import { useCardNavigation } from "../../components/card-navigation";
import { Separator } from "../../components/ui-sdk/separator";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../../components/ui/empty";

export function FieldList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="flex min-w-0 flex-col text-sm leading-relaxed">
      {rows.map(([label, value]) => (
        <div
          className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5"
          key={label}
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 max-w-full text-end whitespace-pre-line wrap-anywhere">
            {value === null || value === undefined || value === "" ? "غير مسجّل" : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const heading = useId();
  return (
    <section className="mb-8 flex min-w-0 flex-col gap-5" aria-labelledby={heading}>
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold md:text-2xl" id={heading}>
          {title}
        </h2>
        {description && (
          <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
        )}
      </header>
      <Separator />
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export function Disclosure({
  title,
  children,
  defaultExpanded,
  lazyContent = false,
  compact = false,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  lazyContent?: boolean;
  compact?: boolean;
}) {
  const navigation = useCardNavigation();
  const [opened, setOpened] = useState(defaultExpanded ?? false);
  return (
    <details
      open={defaultExpanded}
      onToggle={
        lazyContent
          ? (event) => {
              if (event.currentTarget.open) setOpened(true);
            }
          : undefined
      }
      className={cn(
        "min-w-0",
        compact
          ? "group/disclosure border-b border-border last:border-b-0"
          : "rounded-xl border border-border bg-card",
      )}
    >
      <summary
        {...navigation}
        className={cn(
          "cursor-pointer px-4 py-3 text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          compact
            ? "flex min-h-11 list-none items-center justify-between gap-3 font-medium group-first/disclosure:rounded-t-xl group-last/disclosure:group-not-open/disclosure:rounded-b-xl hover:bg-muted/60 focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden"
            : "rounded-xl",
        )}
      >
        {title}
        {compact && (
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground group-open/disclosure:rotate-180"
            aria-hidden
          />
        )}
      </summary>
      <div className="flex min-w-0 flex-col gap-4 px-4 pt-1 pb-4">
        {(!lazyContent || opened) && children}
      </div>
    </details>
  );
}

export function PanelEmpty({ title, description }: { title: string; description?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}

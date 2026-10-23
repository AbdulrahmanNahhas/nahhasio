import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const number = new Intl.NumberFormat("ar-u-nu-latn");

export function AdminPageHeader({
  title,
  description,
  icon: Icon,
  count,
  unit = "سجل",
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  count?: number;
  unit?: string;
  children: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-5">
      <div className="flex min-w-0 items-start gap-4">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"
          aria-hidden="true"
        >
          <Icon className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold">{title}</h1>
            {count !== undefined && (
              <Badge variant="secondary">
                {number.format(count)} {unit}
              </Badge>
            )}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{children}</div>
    </header>
  );
}

export type AdminFilterChip = { key: string; label: string; clear: () => void };
export function AdminFilterChips({
  filters,
  reset,
}: {
  filters: AdminFilterChip[];
  reset: () => void;
}) {
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="المرشحات المطبقة">
      {filters.map((filter) => (
        <Button
          key={filter.key}
          variant="secondary"
          size="sm"
          aria-label={`إزالة مرشح ${filter.label}`}
          onClick={filter.clear}
          className="max-w-full"
        >
          <span className="max-w-64 truncate">{filter.label}</span>
          <X data-icon="inline-end" />
        </Button>
      ))}
      {filters.length > 1 && (
        <Button variant="ghost" size="sm" onClick={reset}>
          مسح الكل
        </Button>
      )}
    </div>
  );
}

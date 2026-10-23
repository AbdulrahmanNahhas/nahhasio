import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const number = new Intl.NumberFormat("ar-u-nu-latn");

export function CatalogWorkspaceHeader({
  title,
  count,
  unit,
  filtered,
  actions,
  children,
}: {
  title: string;
  count: number | undefined;
  unit: string;
  filtered: boolean;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="flex min-w-0 flex-col gap-4 border-b border-border pb-4"
      aria-label={`أدوات ${title}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          <div role="status" aria-live="polite" className="flex items-center gap-2">
            {count === undefined ? (
              <Skeleton className="h-5 w-16" aria-label="جارٍ تحميل العدد" />
            ) : (
              <Badge variant="secondary">
                {number.format(count)} {unit}
              </Badge>
            )}
            {filtered && <Badge variant="outline">نتائج مطابقة</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </header>
      {children}
    </section>
  );
}

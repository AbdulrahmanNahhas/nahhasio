import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function WorkspacePage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-4 pb-10 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </article>
  );
}
// These are route destinations, so retain links and browser back/new-tab semantics.
export function WorkspaceNavigation({
  section,
  label,
  selected,
  items,
}: {
  section: "accounts" | "maintenance" | "activity";
  label: string;
  selected: string;
  items: ReadonlyArray<{ value: string; label: string; icon: LucideIcon }>;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Button
          key={item.value}
          variant={selected === item.value ? "secondary" : "outline"}
          size="sm"
          render={
            <a
              href={`#/admin/${section}?tab=${item.value}`}
              aria-current={selected === item.value ? "page" : undefined}
            />
          }
        >
          <item.icon data-icon="inline-start" />
          {item.label}
        </Button>
      ))}
    </nav>
  );
}

export function ReadFailure({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        <p>
          {error.name === "ZodError"
            ? "تعذّر قراءة استجابة الخادم. حدّث التطبيق والخادم أو أعد المحاولة."
            : error.message}
        </p>
        <Button variant="outline" size="sm" onClick={retry}>
          إعادة المحاولة
        </Button>
      </AlertDescription>
    </Alert>
  );
}
export function RecordsPager({
  page,
  total,
  pageSize,
  pending,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  pending: boolean;
  onChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  return (
    <nav aria-label="صفحات النتائج" className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">
        صفحة {page.toLocaleString("ar")} من {Math.ceil(total / pageSize).toLocaleString("ar")}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronRight data-icon="inline-start" />
          السابق
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          التالي
          <ChevronLeft data-icon="inline-end" />
        </Button>
      </div>
    </nav>
  );
}
export function Facts({ entries }: { entries: ReadonlyArray<readonly [string, ReactNode]> }) {
  return (
    <dl className="flex flex-col divide-y">
      {entries.map(([label, value]) => (
        <div
          key={label}
          className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-2.5"
        >
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

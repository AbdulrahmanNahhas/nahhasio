import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function AccountPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card size="sm" className="shrink-0">
      <CardHeader>
        <CardTitle>
          <h3>{title}</h3>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function NoRecords({ title, description }: { title: string; description: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function ReadFailure({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>
        <p>{error.message}</p>
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

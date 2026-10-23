import type { DatabasePage } from "@nahhasio/api-contract";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Database, ChevronLeft, ChevronRight, RefreshCw, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { gateway } from "@/lib/bridge";

import { inspectionSections } from "./inspection-sections";
export { inspectionSections } from "./inspection-sections";

type DatabaseRecord = DatabasePage["rows"][number];
function display(value: DatabaseRecord[string] | undefined) {
  const text = z.string().safeParse(value);
  return text.success ? text.data : (JSON.stringify(value) ?? "—");
}
export function DatabaseInspector({
  section,
  title,
  embedded = false,
}: {
  section: string;
  title: string;
  embedded?: boolean;
}) {
  const schema = useQuery({
    queryKey: ["admin", "database", "schema"],
    queryFn: ({ signal }) => gateway.databaseSchema(signal),
    staleTime: 60000,
  });
  const [choice, setChoice] = useState("");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [row, setRow] = useState<DatabaseRecord | null>(null);
  const allowed = Object.entries(inspectionSections).find(([key]) => key === section)?.[1] ?? [];
  const tables =
    schema.data?.tables.filter((table) => section === "tables" || allowed.includes(table.name)) ??
    [];
  const table = tables.find((item) => item.name === choice) ?? tables[0];
  const rows = useQuery({
    queryKey: ["admin", "database", "rows", table?.name, page, q],
    queryFn: ({ signal }) => gateway.databaseRows(table?.name ?? "", page, q, signal),
    enabled: !!table,
    placeholderData: keepPreviousData,
    staleTime: 15000,
  });
  const error = schema.error ?? rows.error;
  return (
    <article
      className={cn(
        "flex w-full min-w-0 flex-col gap-5",
        !embedded && "mx-auto max-w-7xl p-4 sm:p-6",
      )}
      aria-label={title}
    >
      {!embedded && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              عرض بيانات الخادم وتعريف الحقول. افتح السجل لعرض جميع قيمه؛ التعديل متاح في المحررات
              المخصصة.
            </p>
          </div>
          <Badge variant="secondary">للقراءة فقط</Badge>
        </header>
      )}
      {error && (
        <Alert variant="destructive" className="border-border">
          <AlertTitle>تعذّر قراءة البيانات</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
          <Button
            variant="outline"
            onClick={() => {
              void schema.refetch();
              void rows.refetch();
            }}
          >
            إعادة المحاولة
          </Button>
        </Alert>
      )}
      {schema.isPending ? (
        <Skeleton className="h-72" />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-full sm:w-80">
              <FieldLabel htmlFor="inspection-table">الجدول · {tables.length}</FieldLabel>
              <Choice
                id="inspection-table"
                label="الجدول"
                value={table?.name ?? ""}
                options={tables.map((item) => ({ value: item.name, label: item.name }))}
                onChange={(value) => {
                  setChoice(value);
                  setPage(1);
                  setRow(null);
                }}
              />
            </Field>
            <form
              className="flex flex-1 items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setQ(draft.trim());
                setPage(1);
              }}
            >
              <Field>
                <FieldLabel htmlFor="inspection-search">
                  البحث في الحقول النصية والمعرّفات
                </FieldLabel>
                <Input
                  id="inspection-search"
                  maxLength={200}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="ابحث في هذا الجدول…"
                />
              </Field>
              <Button variant="outline" type="submit">
                بحث
              </Button>
            </form>
            <Button
              variant="ghost"
              size="icon"
              aria-label="تحديث البيانات"
              onClick={() => void rows.refetch()}
            >
              <RefreshCw />
            </Button>
          </div>
          {table && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database data-icon="inline-start" />
                  <span dir="ltr">{table.name}</span>
                  <Badge variant="outline">{rows.data?.total ?? "…"} سجل</Badge>
                </CardTitle>
                <CardDescription>
                  {table.columns.length} حقل · القيم السرية محجوبة على الخادم.
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                {rows.isPending ? (
                  <Skeleton className="h-56" />
                ) : (
                  <Table>
                    <TableCaption>
                      اختر سجلاً لعرض جميع الحقول. {rows.isPlaceholderData ? "جارٍ التحديث…" : ""}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        {table.columns.slice(0, 7).map((column) => (
                          <TableHead key={column.name}>
                            <span dir="ltr">{column.name}</span>
                          </TableHead>
                        ))}
                        <TableHead>التفاصيل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.data?.rows.map((record) => (
                        <TableRow key={JSON.stringify(record)}>
                          {table.columns.slice(0, 7).map((column) => (
                            <TableCell key={column.name}>
                              <span dir="auto" className="block max-w-64 truncate">
                                {display(record[column.name])}
                              </span>
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={rows.isPlaceholderData}
                              onClick={() => setRow(record)}
                            >
                              فتح السجل
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!rows.data?.rows.length && (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="py-10 text-center text-muted-foreground"
                          >
                            لا توجد سجلات مطابقة.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || rows.isFetching}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronRight data-icon="inline-start" />
                    السابق
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {page} / {Math.max(1, Math.ceil((rows.data?.total ?? 0) / 25))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * 25 >= (rows.data?.total ?? 0) || rows.isFetching}
                    onClick={() => setPage(page + 1)}
                  >
                    التالي
                    <ChevronLeft data-icon="inline-end" />
                  </Button>
                </div>
                <details className="mt-5">
                  <summary className="cursor-pointer text-sm font-medium">
                    تعريف جميع الحقول
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {table.columns.map((column) => (
                      <div
                        className="flex flex-col gap-2 rounded-xl border border-border p-3"
                        key={column.name}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <strong dir="ltr" className="text-sm">
                            {column.name}
                          </strong>
                          {column.protected && (
                            <LockKeyhole className="size-4" aria-label="حقل محمي" />
                          )}
                          {column.primary && <Badge variant="outline">مفتاح</Badge>}
                        </div>
                        <p dir="ltr" className="break-words text-xs text-muted-foreground">
                          {column.dataType} · {column.nullable ? "nullable" : "required"}
                          {column.generated ? " · generated" : ""}
                        </p>
                        {column.defaultValue && (
                          <code dir="ltr" className="break-all text-xs">
                            {column.defaultValue}
                          </code>
                        )}
                        {column.enumValues.length > 0 && (
                          <p dir="ltr" className="break-words text-xs">
                            {column.enumValues.join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          )}
        </>
      )}
      <Drawer
        open={row !== null}
        onOpenChange={(open) => {
          if (!open) setRow(null);
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>تفاصيل السجل</DrawerTitle>
            <DrawerDescription>{table?.name} · جميع الحقول المسجلة على الخادم</DrawerDescription>
          </DrawerHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3">
            {table?.columns.map((column) => (
              <div className="flex min-w-0 flex-col gap-2" key={column.name}>
                <h3 dir="ltr" className="text-sm font-medium">
                  {column.name}
                </h3>
                <pre
                  dir="auto"
                  className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-3 text-sm"
                >
                  {display(row?.[column.name])}
                </pre>
              </div>
            ))}
          </div>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" />}>إغلاق</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </article>
  );
}

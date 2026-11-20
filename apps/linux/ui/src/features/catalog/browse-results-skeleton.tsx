import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { defaultTableColumns, tableColumns, type DisplayPreferences } from "./display-preferences";

/** Results and placeholders share their column rules, including narrow-window breakpoints. */
export function browseGridClass({ layout, size, showTitle, showMetadata }: DisplayPreferences) {
  return cn(
    "grid my-7 gap-x-5 gap-y-7 max-[600px]:gap-x-3 max-[600px]:gap-y-5",
    layout === "poster" &&
      showTitle === false &&
      showMetadata === false &&
      "gap-y-5 max-[600px]:gap-y-3",
    layout === "banner"
      ? cn(
          "grid-cols-1 sm:grid-cols-2",
          size === "compact"
            ? "lg:grid-cols-3 2xl:grid-cols-4"
            : size === "normal"
              ? "xl:grid-cols-3"
              : undefined,
        )
      : cn(
          "max-[1100px]:grid-cols-5 max-[800px]:grid-cols-4 max-[600px]:grid-cols-3 max-[450px]:grid-cols-2",
          size === "compact"
            ? "grid-cols-7"
            : size === "comfortable"
              ? "grid-cols-5"
              : "grid-cols-6",
        ),
  );
}
export function BrowseResultsSkeleton({
  display,
  singleRow = false,
}: {
  display: DisplayPreferences;
  singleRow?: boolean;
}) {
  const visibleColumns = tableColumns.filter(({ key }) =>
    (display.tableColumns ?? defaultTableColumns).includes(key),
  );
  const columns =
    display.layout === "banner"
      ? display.size === "compact"
        ? 4
        : display.size === "comfortable"
          ? 2
          : 3
      : display.size === "compact"
        ? 7
        : display.size === "comfortable"
          ? 5
          : 6;
  return (
    <div role="status" aria-label="جارٍ تحميل نتائج المكتبة" aria-busy="true">
      <span className="sr-only">جارٍ تحميل نتائج المكتبة…</span>
      {display.layout === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العمل</TableHead>
              {visibleColumns.map(({ key, label }) => (
                <TableHead key={key}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: singleRow ? 3 : 8 }, (_, row) => (
              <TableRow key={row}>
                <TableCell>
                  <Skeleton className="h-5 w-4/5 motion-reduce:animate-none" />
                </TableCell>
                {visibleColumns.map(({ key }) => (
                  <TableCell key={key}>
                    <Skeleton className="h-5 w-4/5 motion-reduce:animate-none" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className={browseGridClass(display)} aria-hidden="true">
          {Array.from({ length: columns * (singleRow ? 1 : 2) }, (_, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-3">
              <Skeleton
                className={cn(
                  "w-full rounded-2xl motion-reduce:animate-none",
                  display.layout === "poster" ? "aspect-2/3" : "aspect-video",
                )}
              />
              {display.layout !== "banner" &&
                (display.showTitle !== false || display.showMetadata !== false) && (
                  <div className="flex flex-col gap-2">
                    {display.showTitle !== false && (
                      <Skeleton className="h-5 w-4/5 motion-reduce:animate-none" />
                    )}
                    {display.showMetadata !== false && (
                      <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
                    )}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

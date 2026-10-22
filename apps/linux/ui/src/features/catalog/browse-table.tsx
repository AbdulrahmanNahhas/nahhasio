import type { CatalogEntry } from "@nahhasio/api-contract";
import { cn } from "cn";
import type { ReactNode } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { ScoreBadge } from "@/components/media-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { workLink } from "@/features/shell/navigation";

import {
  defaultTableColumns,
  tableColumns,
  type DisplayPreferences,
  type TableColumn,
} from "./display-preferences";
import { optionLabel } from "./filter-model";

export function BrowseTable({
  entries,
  display,
}: {
  entries: CatalogEntry[];
  display: DisplayPreferences;
}) {
  const navigation = useCardNavigation();
  const columns = tableColumns.filter((column) =>
    (display.tableColumns ?? defaultTableColumns).includes(column.key),
  );
  const titleLanguage =
    display.tableTitle ?? (display.showOriginalTitle === false ? "arabic" : "both");
  const compact = display.tableDensity === "compact";
  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>العمل</TableHead>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((item) => (
            <TableRow key={item.installment?.id ?? item.work.id}>
              <TableCell className={compact ? "py-2" : "py-3"}>
                <a
                  {...navigation}
                  href={workLink(item.work.id, item.installment?.id)}
                  className="flex min-w-56 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {(display.tablePosters ?? true) && (
                    <Artwork
                      id={(item.installment?.poster ?? item.work.poster)?.id}
                      alt=""
                      className={cn(
                        "shrink-0 rounded-lg object-cover",
                        compact ? "h-12 w-8" : "h-20 w-14",
                      )}
                    />
                  )}
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold" dir="auto">
                      {titleLanguage === "english"
                        ? item.work.canonicalTitle
                        : item.work.titleAr || item.work.canonicalTitle}
                    </span>
                    {titleLanguage === "both" &&
                      item.work.titleAr &&
                      item.work.titleAr !== item.work.canonicalTitle && (
                        <span className="text-xs text-muted-foreground" dir="auto">
                          {item.work.canonicalTitle}
                        </span>
                      )}
                    {item.installment && (
                      <span className="text-xs text-muted-foreground" dir="auto">
                        {item.installment.title}
                      </span>
                    )}
                  </span>
                </a>
              </TableCell>
              {columns.map((column) => (
                <TableCell key={column.key} className={compact ? "py-2" : "py-3"}>
                  {columnValue(item, column.key)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function columnValue(item: CatalogEntry, column: TableColumn): ReactNode {
  switch (column) {
    case "release":
      return item.installment?.releaseDate ?? item.work.releaseYear ?? "—";
    case "status":
      return <Badge variant="outline">{optionLabel(item.status, item.status)}</Badge>;
    case "score":
      return <ScoreBadge score={item.installment?.score ?? item.work.score} />;
    case "audience":
      return optionLabel(item.classification.audience, item.classification.audience);
    case "age":
      return optionLabel(item.classification.age, item.classification.age);
    case "watchState":
      return <Badge variant="secondary">{optionLabel(item.watchState, item.watchState)}</Badge>;
    case "format":
      return item.work.format === "animated" ? "رسوم متحركة" : "تمثيل حي";
  }
}

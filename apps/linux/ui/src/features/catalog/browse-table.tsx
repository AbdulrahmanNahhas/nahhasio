import type { CatalogEntry } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { CatalogStateBadge } from "@/components/catalog-state-badge";
import { ScoreBadge } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { workLink } from "@/features/shell/navigation";

import type { SortOrder } from "./browse-refinements";
import { BrowseWatchButton } from "./browse-watch-button";
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
  sort,
  sorting,
  onSort,
}: {
  entries: CatalogEntry[];
  display: DisplayPreferences;
  sort: SortOrder;
  sorting: boolean;
  onSort: (sort: SortOrder) => void;
}) {
  const navigation = useCardNavigation();
  const columns = tableColumns.filter((column) =>
    (display.tableColumns ?? defaultTableColumns).includes(column.key),
  );
  const english = display.tableTitle === "english";
  const compact = display.tableDensity === "compact";
  return (
    <div className="my-5 overflow-hidden rounded-2xl border border-border">
      <Table aria-busy={sorting}>
        <TableHeader>
          <TableRow>
            <SortableHead
              label="العمل"
              order={["title", "title-desc"]}
              sort={sort}
              onSort={onSort}
            />
            {columns.map((column) => {
              const order = columnSort.get(column.key);
              return order ? (
                <SortableHead
                  key={column.key}
                  label={column.label}
                  order={order}
                  sort={sort}
                  onSort={onSort}
                />
              ) : (
                <TableHead key={column.key}>{column.label}</TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((item) => (
            <TableRow key={item.installment?.id ?? item.work.id}>
              <TableCell className={compact ? "py-2" : "py-3"}>
                <a
                  {...navigation}
                  href={workLink(item.work.id, item.installment?.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2",
                    item.watchState === "watched"
                      ? "focus-visible:ring-success hover:text-success"
                      : item.watchState === "in-progress"
                        ? "focus-visible:ring-warning hover:text-warning"
                        : "focus-visible:ring-ring hover:text-primary",
                    columns.length > 0 && "min-w-56",
                  )}
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
                      {english
                        ? item.work.canonicalTitle
                        : item.work.titleAr || item.work.canonicalTitle}
                    </span>
                    {!english &&
                      item.installment &&
                      item.installment.title !== item.work.titleAr && (
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

type ColumnSort = readonly [
  ascending: SortOrder,
  descending: SortOrder,
  startsDescending?: boolean,
];

const columnSort = new Map<TableColumn, ColumnSort>([
  ["release", ["year-asc", "year-desc", true]],
  ["score", ["score-asc", "score-desc", true]],
]);

function SortableHead({
  label,
  order: [ascending, descending, startsDescending],
  sort,
  onSort,
}: {
  label: string;
  order: ColumnSort;
  sort: SortOrder;
  onSort: (sort: SortOrder) => void;
}) {
  const direction =
    sort === ascending ? "ascending" : sort === descending ? "descending" : undefined;
  const Icon =
    direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowDownUp;
  const next =
    direction === "ascending" || (!direction && startsDescending) ? descending : ascending;
  return (
    <TableHead aria-sort={direction}>
      <Button variant="ghost" size="sm" onClick={() => onSort(next)}>
        {label}
        <Icon data-icon="inline-end" aria-hidden="true" />
      </Button>
    </TableHead>
  );
}

function columnValue(item: CatalogEntry, column: TableColumn): ReactNode {
  switch (column) {
    case "release":
      return item.installment?.releaseDate ?? item.work.releaseYear ?? "—";
    case "status":
      return <CatalogStateBadge value={item.status} />;
    case "score":
      return <ScoreBadge score={item.installment?.score ?? item.work.score} />;
    case "audience":
      return optionLabel(item.classification.audience, item.classification.audience);
    case "age":
      return optionLabel(item.classification.age, item.classification.age);
    case "watchState":
      return <BrowseWatchButton entry={item} labeled />;
    case "format":
      return item.work.format === "animated" ? "رسوم متحركة" : "تمثيل حي";
  }
}

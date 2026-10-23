import { CalendarDays, Pencil, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  awardLabel,
  resetAwardFilters,
  text,
  type AwardRow,
  type AwardSearch,
  type DefinitionTable,
} from "./awards.queries";

export function AwardDefinitions({
  rows,
  table,
  onBrowse,
  onEdit,
  onDetail,
}: {
  rows: AwardRow[];
  table: DefinitionTable;
  onBrowse: (patch: Partial<AwardSearch>) => void;
  onEdit: (table: DefinitionTable, id: string) => void;
  onDetail: (row: AwardRow) => void;
}) {
  const browse = (row: AwardRow, wholeYear = false) =>
    onBrowse({
      ...resetAwardFilters,
      tab: "award_recognitions",
      organization:
        table === "award_organizations" ? text(row, "id") : text(row, "organization_id"),
      category: table === "award_categories" ? text(row, "id") : "",
      ceremony: table === "award_ceremonies" && !wholeYear ? text(row, "id") : "",
      year: table === "award_ceremonies" ? String(row.year ?? "") : "",
    });
  const actions = (row: AwardRow) => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => onEdit(table, text(row, "id"))}>
        <Pencil data-icon="inline-start" />
        تحرير
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onDetail(row)}>
        البيانات
      </Button>
    </div>
  );
  if (table === "award_categories")
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>فئة الجائزة</TableHead>
            <TableHead>الحضور في المكتبة</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={text(row, "id")}>
              <TableCell>
                <div className="flex max-w-80 flex-col gap-1">
                  <Button
                    variant="link"
                    className="h-auto justify-start whitespace-normal text-start"
                    onClick={() => browse(row)}
                  >
                    {awardLabel(row)}
                  </Button>
                  <span className="text-sm text-muted-foreground" dir="auto">
                    {text(row, "name_en") || text(row, "slug")}
                  </span>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {text(row, "description")}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {String(row.recognition_count ?? 0)} جائزة وترشيح
                  </Badge>
                  <Badge variant="outline">{String(row.work_count ?? 0)} عمل</Badge>
                  <Badge variant="outline">{String(row.winner_count ?? 0)} فوز</Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{row.is_active ? "نشطة" : "غير نشطة"}</Badge>
              </TableCell>
              <TableCell>{actions(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {rows.map((row) => (
        <Card key={text(row, "id")} size="sm">
          <CardHeader>
            {table === "award_ceremonies" ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
                  <Badge variant="outline">
                    {row.edition ? `الدورة ${row.edition}` : "دورة سنوية"}
                  </Badge>
                </div>
                <CardTitle>
                  <Button
                    variant="link"
                    className="h-auto justify-start"
                    onClick={() => browse(row, true)}
                  >
                    <span className="text-3xl font-semibold tabular-nums">
                      {String(row.year ?? "—")}
                    </span>
                  </Button>
                </CardTitle>
                <CardDescription>
                  {text(row, "label") || text(row, "held_on") || "لم يُحدد موعد الدورة"}
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle>
                  <Button
                    variant="link"
                    className="h-auto justify-start whitespace-normal text-start"
                    onClick={() => browse(row)}
                  >
                    {awardLabel(row)}
                  </Button>
                </CardTitle>
                <CardDescription dir="auto">
                  {text(row, "name_en") || text(row, "slug")}
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {text(row, "description") && (
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {text(row, "description")}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <Trophy data-icon="inline-start" />
                {String(row.recognition_count ?? 0)}
              </Badge>
              <Badge variant="outline">{String(row.work_count ?? 0)} عمل</Badge>
              <Badge variant="outline">{String(row.winner_count ?? 0)} فوز</Badge>
            </div>
            <Button variant="outline" onClick={() => browse(row)}>
              {table === "award_ceremonies" ? "جوائز هذه الدورة" : "استعراض الجوائز"}
            </Button>
            {table === "award_ceremonies" && (
              <Button variant="ghost" size="sm" onClick={() => browse(row, true)}>
                كل جوائز سنة {String(row.year ?? "")}
              </Button>
            )}
          </CardContent>
          <CardFooter>{actions(row)}</CardFooter>
        </Card>
      ))}
    </div>
  );
}

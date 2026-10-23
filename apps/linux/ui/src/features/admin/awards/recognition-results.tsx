import { ExternalLink, Star, Trophy } from "lucide-react";
import { z } from "zod";

import { Artwork } from "@/components/artwork";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

import { text, type AwardRow, type AwardSearch } from "./awards.queries";

export function RecognitionResults({
  rows,
  view,
  onDetail,
  onFilter,
}: {
  rows: AwardRow[];
  view: AwardSearch["view"];
  onDetail: (row: AwardRow) => void;
  onFilter: (patch: Partial<AwardSearch>) => void;
}) {
  const category = (row: AwardRow) =>
    onFilter({
      category: text(row, "category_id"),
      organization: text(row, "organization_id"),
      page: "1",
    });
  const year = (row: AwardRow) =>
    onFilter({ year: String(row.year ?? ""), ceremony: "", page: "1" });
  if (view === "table")
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>العمل</TableHead>
            <TableHead>الجائزة والفئة</TableHead>
            <TableHead>السنة والنتيجة</TableHead>
            <TableHead>التوثيق</TableHead>
            <TableHead>الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={text(row, "id")}>
              <TableCell>
                <div className="flex min-w-48 items-center gap-3">
                  <Artwork
                    id={text(row, "poster_id") || null}
                    alt={text(row, "work_name")}
                    className="h-24 w-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">{text(row, "work_name")}</span>
                    <span className="text-xs text-muted-foreground" dir="auto">
                      {text(row, "work_english_name")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {String(row.work_year ?? "")} ·{" "}
                      {text(row, "installment_name") || "العمل كاملاً"}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Button variant="link" onClick={() => category(row)}>
                  {text(row, "category")}
                </Button>
                <p className="text-xs text-muted-foreground">{text(row, "organization_name")}</p>
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" disabled={!row.year} onClick={() => year(row)}>
                  {String(row.year ?? "بدون سنة")}
                </Button>
                <Outcome row={row} />
              </TableCell>
              <TableCell>
                <Source row={row} />
              </TableCell>
              <TableCell>
                <Actions row={row} onDetail={onDetail} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {rows.map((row) => (
        <Card key={text(row, "id")} size="sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <a
                href={`#/titles/${text(row, "title_id")}`}
                className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`صفحة ${text(row, "work_name")}`}
              >
                <Artwork
                  id={text(row, "poster_id") || null}
                  alt={text(row, "work_name")}
                  className="h-28 w-20 rounded-lg object-cover"
                />
              </a>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Outcome row={row} />
                  {row.is_featured && (
                    <Badge variant="outline">
                      <Star data-icon="inline-start" />
                      بارزة
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" disabled={!row.year} onClick={() => year(row)}>
                    {String(row.year ?? "بدون سنة")}
                  </Button>
                </div>
                <CardTitle>
                  <a
                    href={`#/titles/${text(row, "title_id")}`}
                    className="line-clamp-2 underline-offset-4 hover:underline"
                  >
                    {text(row, "work_name")}
                  </a>
                </CardTitle>
                <CardDescription>
                  <bdi>{text(row, "work_english_name")}</bdi>
                </CardDescription>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {text(row, "installment_name") || "العمل كاملاً"}
                  {row.work_year ? ` · ${row.work_year}` : ""}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <Button
              variant="link"
              className="h-auto justify-start whitespace-normal text-start"
              onClick={() => category(row)}
            >
              {text(row, "category") || "فئة غير محددة"}
            </Button>
            <p className="text-xs text-muted-foreground">{text(row, "organization_name")}</p>
            {text(row, "notes") && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{text(row, "notes")}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-2">
            <Actions row={row} onDetail={onDetail} />
            <Source row={row} />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function Outcome({ row }: { row: AwardRow }) {
  return (
    <Badge variant={row.result === "winner" ? "default" : "secondary"}>
      {row.result === "winner" && <Trophy data-icon="inline-start" />}
      {row.result === "winner" ? "فائز" : "مرشح"}
    </Badge>
  );
}
function Source({ row }: { row: AwardRow }) {
  const url = z
    .string()
    .url()
    .regex(/^https?:\/\//)
    .safeParse(row.source_url).data;
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={buttonVariants({ variant: "link", size: "sm" })}
    >
      <ExternalLink data-icon="inline-start" />
      مصدر الجائزة
    </a>
  ) : (
    <Badge variant="outline">بلا مصدر</Badge>
  );
}
function Actions({ row, onDetail }: { row: AwardRow; onDetail: (row: AwardRow) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => onDetail(row)}>
        التفاصيل
      </Button>
      <a
        href={`#/admin/works/${text(row, "title_id")}?section=awards`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        تحرير الجوائز
      </a>
    </div>
  );
}

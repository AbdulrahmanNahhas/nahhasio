import type { AdminWork } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ArrowUpLeft, LayoutGrid, List, LockKeyhole } from "lucide-react";

import { Artwork } from "@/components/artwork";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const editLink = (id: string) => `#/admin/works/${id}`;
import { selectedWork, type SelectedRecord } from "./catalog-selection-model";
import { workflowLabels } from "./works-model";

const date = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium" });
function updatedDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : date.format(parsed);
}
export type WorksView = "table" | "posters";
const views = [
  { value: "posters", label: "ملصقات مصغّرة", icon: LayoutGrid },
  { value: "table", label: "جدول", icon: List },
] as const;

export function WorksResults({
  works,
  view,
  busy,
  selection,
  onSelection,
}: {
  works: AdminWork[];
  view: WorksView;
  busy: boolean;
  selection: SelectedRecord[];
  onSelection: (records: SelectedRecord[], checked: boolean) => void;
}) {
  const selected = new Set(selection.map((record) => record.id));
  const toggle = (id: string, checked: boolean) => {
    const work = works.find((record) => record.id === id);
    if (work) onSelection([selectedWork(work)], checked);
  };
  return (
    <section
      className="flex min-w-0 flex-col gap-3 transition-opacity data-[pending=true]:opacity-60 motion-reduce:transition-none"
      data-pending={busy}
      aria-label="نتائج الأعمال"
      aria-busy={busy}
    >
      {view === "table" ? (
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableCaption className="sr-only">أعمال المكتبة وحالتها التحريرية</TableCaption>
            <TableHeader className="bg-muted/40 [&_tr]:border-border">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-12">
                  <span className="sr-only">تحديد العمل</span>
                </TableHead>
                <TableHead>العمل</TableHead>
                <TableHead>حالة التحرير</TableHead>
                <TableHead>الظهور</TableHead>
                <TableHead>الأجزاء والحلقات</TableHead>
                <TableHead>آخر تعديل</TableHead>
                <TableHead>
                  <span className="sr-only">فتح العمل</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {works.map((work) => {
                const name = work.titleAr?.trim() || work.canonicalTitle;
                return (
                  <TableRow
                    key={work.id}
                    data-state={selected.has(work.id) ? "selected" : undefined}
                    className="border-border"
                  >
                    <TableCell className="w-12">
                      <Checkbox
                        checked={selected.has(work.id)}
                        disabled={busy}
                        onCheckedChange={(checked) => toggle(work.id, checked)}
                        aria-label={`تحديد ${name}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <a
                        href={editLink(work.id)}
                        className="flex min-w-64 max-w-96 items-center gap-3 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                        aria-label={`تحرير ${name}`}
                      >
                        <Artwork
                          id={work.posterId}
                          alt=""
                          className="h-16 w-11 shrink-0 rounded-md object-cover"
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="line-clamp-1 text-sm font-semibold" dir="auto">
                            {name}
                          </span>
                          {work.titleAr && work.canonicalTitle !== name && (
                            <span className="line-clamp-1 text-xs text-muted-foreground" dir="auto">
                              {work.canonicalTitle}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {work.releaseYear ?? "—"} ·{" "}
                            {work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"} ·{" "}
                            {work.installmentCount === 0
                              ? "بلا أجزاء"
                              : work.isSeries
                                ? "مسلسل"
                                : "فيلم"}
                          </span>
                        </div>
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant={work.workflow === "published" ? "secondary" : "outline"}>
                        {workflowLabels[work.workflow]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {work.isPrivate && <LockKeyhole className="size-3.5" aria-hidden="true" />}
                        {work.isPrivate ? "خاص" : "عام"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium tabular-nums">{work.installmentCount}</span>
                        <span className="text-muted-foreground">جزء</span>
                        <span className="text-muted-foreground" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-medium tabular-nums">{work.episodeCount}</span>
                        <span className="text-muted-foreground">حلقة</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <time className="text-xs text-muted-foreground" dateTime={work.updatedAt}>
                        {updatedDate(work.updatedAt)}
                      </time>
                    </TableCell>
                    <TableCell>
                      <a
                        href={editLink(work.id)}
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                        aria-label={`تحرير ${name}`}
                        title={`تحرير ${name}`}
                      >
                        <ArrowUpLeft />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
          {works.map((work) => {
            const name = work.titleAr?.trim() || work.canonicalTitle;
            return (
              <article key={work.id} className="flex min-w-0 flex-col gap-2">
                <div
                  className={cn(
                    "relative overflow-hidden rounded-lg border border-border",
                    selected.has(work.id) && "ring-2 ring-primary",
                  )}
                >
                  <a
                    href={editLink(work.id)}
                    className="block aspect-2/3 focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`تحرير ${name}`}
                  >
                    <Artwork id={work.posterId} alt="" className="size-full object-cover" />
                  </a>
                  <div className="absolute start-2 top-2 rounded-md bg-background p-2">
                    <Checkbox
                      checked={selected.has(work.id)}
                      disabled={busy}
                      onCheckedChange={(checked) => toggle(work.id, checked)}
                      aria-label={`تحديد ${name}`}
                    />
                  </div>
                  {work.isPrivate && (
                    <span className="absolute end-2 top-2 rounded-md bg-background p-1.5">
                      <LockKeyhole className="size-3.5 text-muted-foreground" aria-label="خاص" />
                    </span>
                  )}
                </div>
                <a
                  href={editLink(work.id)}
                  className="line-clamp-2 text-xs font-medium hover:text-primary"
                  dir="auto"
                >
                  {name}
                </a>
                <span className="text-xs text-muted-foreground">
                  {work.releaseYear ?? "—"} · {workflowLabels[work.workflow]}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function WorksViewToggle({
  value: currentView,
  onChange,
}: {
  value: WorksView;
  onChange: (value: WorksView) => void;
}) {
  return (
    <TooltipProvider delay={350}>
      <ToggleGroup
        variant="outline"
        spacing={0}
        value={[currentView]}
        aria-label="عرض نتائج الأعمال"
        onValueChange={(values) => {
          const next = views.find((item) => item.value === values[0]);
          if (next) onChange(next.value);
        }}
      >
        {views.map(({ value, label, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger render={<ToggleGroupItem value={value} aria-label={label} />}>
              <Icon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}

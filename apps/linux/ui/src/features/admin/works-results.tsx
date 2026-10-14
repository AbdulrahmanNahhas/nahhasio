import type { AdminWork } from "@nahhasio/api-contract";
import { cn } from "cn";
import {
  ArrowUpLeft,
  Braces,
  CheckCheck,
  Pencil,
  X,
  LayoutGrid,
  List,
  LockKeyhole,
} from "lucide-react";
import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
import { workflowLabels } from "./works-model";

const date = new Intl.DateTimeFormat("ar-u-nu-latn", { dateStyle: "medium" });
function updatedDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : date.format(parsed);
}
export type WorksView = "table" | "posters";
const views = [
  { value: "table", label: "جدول", icon: List },
  { value: "posters", label: "ملصقات مصغّرة", icon: LayoutGrid },
] as const;

export function WorksResults({
  works,
  view,
  onView,
  busy,
}: {
  works: AdminWork[];
  view: WorksView;
  onView: (value: WorksView) => void;
  busy: boolean;
}) {
  // Selection belongs to this result page; editors receive only these selected IDs.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const allSelected = works.length > 0 && works.every((work) => selected.has(work.id));
  const toggle = (id: string, checked: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const selectAll = (checked: boolean) =>
    setSelected(checked ? new Set(works.map((work) => work.id)) : new Set());
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="نتائج الأعمال" aria-busy={busy}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Checkbox
            checked={allSelected}
            indeterminate={selected.size > 0 && !allSelected}
            disabled={busy}
            onCheckedChange={selectAll}
            aria-label="تحديد كل أعمال هذه الصفحة"
          />
          <span className="text-xs text-muted-foreground" role="status">
            {selected.size ? `${selected.size} محدّد` : `${works.length} عمل في هذه الصفحة`}
          </span>
        </div>
        <TooltipProvider delay={350}>
          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[view]}
            aria-label="عرض نتائج الأعمال"
            onValueChange={(values) => {
              const next = views.find((item) => item.value === values[0]);
              if (next) onView(next.value);
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
      </div>
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
      {selected.size > 0 && (
        <div
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-popover p-3 shadow-lg"
          data-slot="work-selection-actions"
          role="region"
          aria-label="إجراءات الأعمال المحددة"
        >
          <Badge variant="secondary" role="status" aria-live="polite">
            {new Intl.NumberFormat("ar").format(selected.size)} محدّد
          </Badge>
          <ButtonGroup aria-label="فتح التحرير">
            <Button
              size="sm"
              disabled={busy}
              render={
                <a href={`#/admin/json?ids=${encodeURIComponent([...selected].join(","))}`} />
              }
            >
              <Braces data-icon="inline-start" />
              JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              render={
                <a href={`#/admin/works/bulk?ids=${encodeURIComponent([...selected].join(","))}`} />
              }
            >
              <Pencil data-icon="inline-start" />
              تحرير جماعي
            </Button>
          </ButtonGroup>
          {!allSelected && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => selectAll(true)}>
              <CheckCheck data-icon="inline-start" />
              تحديد الصفحة
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            aria-label="إلغاء تحديد الأعمال"
            onClick={() => setSelected(new Set())}
          >
            <X data-icon="inline-start" />
          </Button>
        </div>
      )}
    </section>
  );
}

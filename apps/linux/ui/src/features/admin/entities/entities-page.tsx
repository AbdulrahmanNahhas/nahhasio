import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import {
  Users,
  Plus,
  Grid2X2,
  List,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Braces,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { Choice } from "@/components/choice";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";

import {
  entityListOptions,
  entityDetailOptions,
  type EntitySearch,
  type EntityKind,
} from "./entities.queries";
import { EntityDelete } from "./entity-delete";
import { EntityDrawer } from "./entity-editor";

export function EntitiesPage({
  kind,
  search,
  onChange,
}: {
  kind: EntityKind;
  search: EntitySearch;
  onChange: (patch: Partial<EntitySearch>, resetPage?: boolean) => void;
}) {
  const people = kind === "person";
  const path = people ? "people" : "studios";
  const title = people ? "الأشخاص" : "الاستوديوهات";
  const result = useQuery(entityListOptions(kind, search));
  const client = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const pages = Math.max(1, Math.ceil((result.data?.total ?? 0) / 24));
  const items = result.data?.items ?? [];
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const preload = (id: string) => void client.prefetchQuery(entityDetailOptions(kind, id));
  const open = (id: string) => onChange({ person: id }, false);
  function select(id: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked && next.size < 50) next.add(id);
      else if (!checked) next.delete(id);
      return next;
    });
  }
  function selectPage(checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const item of items) {
        if (!checked) next.delete(item.id);
        else if (next.size < 50) next.add(item.id);
      }
      return next;
    });
  }
  async function deleted() {
    setSelected((previous) => new Set([...previous].filter((id) => !deleteIds.includes(id))));
    setDeleteIds([]);
    await invalidateCatalogEdit(client);
  }
  return (
    <article
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-400 flex-col gap-5 p-4 sm:p-6",
        selected.size > 0 && "pb-28 sm:pb-28",
      )}
      aria-label={`إدارة ${title}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            الأسماء والصور والمساهمات. افتح السجل للتحرير أو حدد عدة سجلات لـ JSON والحذف.
          </p>
        </div>
        <Button onClick={() => open("new")}>
          <Plus data-icon="inline-start" />
          {people ? "شخص جديد" : "استوديو جديد"}
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <EntitySearchForm key={search.q} value={search.q} onSearch={(q) => onChange({ q })} />
        <Choice
          label="توفر الصورة"
          value={search.image}
          options={[
            { value: "all", label: "كل الصور" },
            { value: "with", label: "بصورة" },
            { value: "without", label: "بدون صورة" },
          ]}
          onChange={(image) =>
            onChange({ image: image === "with" || image === "without" ? image : "all" })
          }
        />
        <Choice
          label="عدد الأعمال"
          value={search.usage}
          options={[
            { value: "all", label: "كل السجلات" },
            { value: "one", label: "عمل واحد فقط" },
            { value: "linked", label: "لها أعمال" },
            { value: "unlinked", label: "بدون أعمال" },
          ]}
          onChange={(usage) =>
            onChange({
              usage: usage === "linked" || usage === "unlinked" || usage === "one" ? usage : "all",
            })
          }
        />
        <Choice
          label="الترتيب"
          value={search.sort}
          options={[
            { value: "name", label: "الاسم" },
            { value: "works", label: "الأكثر أعمالاً" },
            { value: "updated", label: "آخر تعديل" },
          ]}
          onChange={(sort) =>
            onChange({ sort: sort === "works" || sort === "updated" ? sort : "name" })
          }
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label="تحديث السجلات"
          disabled={result.isFetching}
          onClick={() => void result.refetch()}
        >
          <RefreshCw data-icon="inline-start" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            indeterminate={items.some((item) => selected.has(item.id)) && !allSelected}
            disabled={!items.length || result.isFetching}
            aria-label="تحديد سجلات الصفحة"
            onCheckedChange={(checked) => selectPage(checked === true)}
          />
          <Badge variant="outline">
            {result.data ? new Intl.NumberFormat("ar").format(result.data.total) : "…"} سجل
          </Badge>
          {selected.size > 0 && (
            <span className="text-xs text-muted-foreground">{selected.size} محدد عبر الصفحات</span>
          )}
        </div>
        <ToggleGroup
          variant="outline"
          value={[search.view]}
          aria-label="طريقة العرض"
          onValueChange={(values) => {
            const view = values[0];
            if (view === "grid" || view === "table") onChange({ view }, false);
          }}
        >
          <ToggleGroupItem value="grid" aria-label="بطاقات">
            <Grid2X2 />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="جدول">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {result.isPending ? (
        <Skeleton className="h-96" />
      ) : result.isError ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل السجلات</AlertTitle>
          <AlertDescription>{result.error.message}</AlertDescription>
          <Button variant="outline" onClick={() => void result.refetch()}>
            إعادة المحاولة
          </Button>
        </Alert>
      ) : !items.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>لا توجد سجلات مطابقة</EmptyTitle>
            <EmptyDescription>غيّر البحث أو المرشحات.</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => onChange({ q: "", image: "all", usage: "all" })}>
            مسح المرشحات
          </Button>
        </Empty>
      ) : search.view === "grid" ? (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((item) => (
            <div key={item.id} className="flex min-w-0 flex-col gap-3">
              <div
                className={cn(
                  "relative rounded-xl",
                  selected.has(item.id) && "ring-2 ring-primary",
                )}
              >
                <button
                  type="button"
                  aria-label={`تحرير ${item.name}`}
                  onPointerEnter={() => preload(item.id)}
                  onFocus={() => preload(item.id)}
                  onClick={() => open(item.id)}
                  className="block w-full overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Artwork
                    id={item.artworkId}
                    alt=""
                    studioLogo={!people}
                    className={cn(
                      "w-full rounded-xl border border-border",
                      people ? "aspect-4/5 object-cover object-top" : "aspect-square",
                    )}
                    fallback={
                      <span
                        className={cn(
                          "grid w-full place-items-center rounded-xl border border-border bg-card font-display text-5xl text-muted-foreground",
                          people ? "aspect-4/5" : "aspect-square",
                        )}
                        aria-hidden="true"
                      >
                        {item.name.charAt(0)}
                      </span>
                    }
                  />
                </button>
                <div className="absolute start-2 top-2 rounded-lg bg-background p-2">
                  <Checkbox
                    checked={selected.has(item.id)}
                    disabled={!selected.has(item.id) && selected.size >= 50}
                    aria-label={`تحديد ${item.name}`}
                    onCheckedChange={(checked) => select(item.id, checked === true)}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => open(item.id)}
                className="flex min-w-0 flex-col gap-1 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <h2 className="w-full truncate font-semibold" dir="auto" title={item.name}>
                  {item.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {item.workCount} عمل · {item.roles.slice(0, 2).join("، ") || "بدون مساهمات"}
                </p>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableCaption className="sr-only">{title} ومساهماتهم</TableCaption>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>
                  <span className="sr-only">التحديد</span>
                </TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الأدوار</TableHead>
                <TableHead>الأعمال</TableHead>
                <TableHead>آخر تعديل</TableHead>
                <TableHead>
                  <span className="sr-only">الإجراءات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-state={selected.has(item.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.id)}
                      disabled={!selected.has(item.id) && selected.size >= 50}
                      aria-label={`تحديد ${item.name}`}
                      onCheckedChange={(checked) => select(item.id, checked === true)}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onPointerEnter={() => preload(item.id)}
                      onFocus={() => preload(item.id)}
                      onClick={() => open(item.id)}
                      className="flex items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Artwork
                        id={item.artworkId}
                        alt=""
                        studioLogo={!people}
                        className={cn("rounded-lg", people ? "h-16 w-12 object-cover" : "size-16")}
                      />
                      <span className="flex flex-col gap-1">
                        <span className="font-medium" dir="auto">
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground" dir="auto">
                          {item.sortName}
                        </span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.roles.slice(0, 3).map((role) => (
                        <Badge variant="secondary" key={role}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{item.workCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
                      new Date(item.updatedAt),
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`حذف ${item.name}`}
                      onClick={() => setDeleteIds([item.id])}
                    >
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="صفحات السجلات">
        <Button
          variant="outline"
          disabled={Number(search.page) <= 1 || result.isFetching}
          onClick={() => onChange({ page: String(Number(search.page) - 1) }, false)}
        >
          <ArrowRight data-icon="inline-start" />
          السابق
        </Button>
        <span className="text-sm text-muted-foreground">
          {search.page} / {pages}
        </span>
        <Button
          variant="outline"
          disabled={Number(search.page) >= pages || result.isFetching}
          onClick={() => onChange({ page: String(Number(search.page) + 1) }, false)}
        >
          التالي
          <ArrowLeft data-icon="inline-end" />
        </Button>
      </nav>
      {selected.size > 0 && (
        <div
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-popover p-3 shadow-lg"
          role="region"
          aria-label="إجراءات السجلات المحددة"
        >
          <Badge variant="secondary">{selected.size} محدد</Badge>
          <Button
            disabled={selected.size > 30}
            title={selected.size > 30 ? "حد JSON هو ٣٠ سجلاً في الدفعة" : undefined}
            render={
              <a
                href={`#/admin/json?target=${path}&ids=${encodeURIComponent([...selected].join(","))}`}
              />
            }
          >
            <Braces data-icon="inline-start" />
            JSON
          </Button>
          <Button variant="outline" onClick={() => setDeleteIds([...selected])}>
            <Trash2 data-icon="inline-start" />
            حذف المحدد
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="إلغاء تحديد السجلات"
            onClick={() => setSelected(new Set())}
          >
            <X data-icon="inline-start" />
          </Button>
        </div>
      )}
      <EntityDrawer
        kind={kind}
        id={search.person}
        onClose={() => onChange({ person: "" }, false)}
        onSaved={(id) => onChange({ person: id }, false)}
      />
      <EntityDelete
        kind={kind}
        ids={deleteIds}
        open={deleteIds.length > 0}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteIds([]);
        }}
        onDeleted={deleted}
      />
    </article>
  );
}
function EntitySearchForm({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="w-full sm:max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <Field>
        <FieldLabel htmlFor="entity-admin-search" className="sr-only">
          البحث بالاسم أو الاسم البديل
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="entity-admin-search"
            placeholder="ابحث بالاسم أو أحد أسمائه…"
            maxLength={300}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit">بحث</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </form>
  );
}

import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import {
  Users,
  Plus,
  Grid2X2,
  List,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Trash2,
  X,
  SlidersHorizontal,
  CheckCheck,
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
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
import { gateway } from "@/lib/bridge";

import { useCatalogSelection, CatalogSelectionActions } from "../catalog-selection";
import { useMatchingSelection } from "../use-matching-selection";
import {
  entityListOptions,
  entityOptionsQuery,
  entityDetailOptions,
  type EntitySearch,
  type EntityKind,
} from "./entities.queries";
import { EntityDelete } from "./entity-delete";
import { EntityDrawer } from "./entity-editor";

const number = new Intl.NumberFormat("ar");
const date = new Intl.DateTimeFormat("ar", { dateStyle: "medium" });

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
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });
  const selection = useCatalogSelection(session.data?.user.id ?? "signed-out", path);
  const selected = new Set(selection.selected.map((record) => record.id));
  const result = useQuery({
    ...entityListOptions(kind, search),
    placeholderData: keepPreviousData,
  });
  const options = useQuery(entityOptionsQuery(kind));
  const client = useQueryClient();
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const pages = Math.max(1, Math.ceil((result.data?.total ?? 0) / 24));
  const items = result.data?.items ?? [];
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const preload = (id: string) => void client.prefetchQuery(entityDetailOptions(kind, id));
  const open = (id: string) => onChange({ person: id }, false);
  const matchingQuery = {
    kind,
    q: search.q,
    image: search.image,
    usage: search.usage,
    role: search.role,
    language: search.language,
  };
  const selectAll = useMatchingSelection({
    key: ["admin", "entities", "selection", session.data?.user.id ?? "signed-out", matchingQuery],
    load: async () =>
      rpcResults.entitySelection.parse(
        await gateway.editorCall({ operation: "entitySelection", data: matchingQuery }),
      ),
    selected: selection.selected,
    pageRecords: items.map(({ id, name }) => ({ id, name })),
    total: result.data?.total ?? 0,
    change: selection.change,
  });
  const activeFilters =
    Number(search.image !== "all") +
    Number(search.usage !== "all") +
    Number(search.sort !== "works") +
    Number(!!search.role) +
    Number(!!search.language);
  function select(id: string, checked: boolean) {
    const record = items.find((item) => item.id === id);
    if (record) selection.change([{ id, name: record.name }], checked);
  }
  function selectPage(checked: boolean) {
    selection.change(
      items.map(({ id, name }) => ({ id, name })),
      checked,
    );
  }
  async function deleted() {
    selection.change(
      selection.selected.filter((record) => deleteIds.includes(record.id)),
      false,
    );
    setDeleteIds([]);
    await invalidateCatalogEdit(client);
  }
  return (
    <article
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-5 p-4 sm:p-6",
        selected.size > 0 && "pb-24 sm:pb-24",
      )}
      aria-label={`إدارة ${title}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            الأسماء والصور والمساهمات. افتح سجلاً للتحرير، أو حدّد عدة سجلات لتحريرها معاً.
          </p>
        </div>
        <Button onClick={() => open("new")}>
          <Plus data-icon="inline-start" />
          {people ? "شخص جديد" : "استوديو جديد"}
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <EntitySearchForm key={search.q} value={search.q} onSearch={(q) => onChange({ q })} />
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}>
            <SlidersHorizontal data-icon="inline-start" /> المرشحات
            {activeFilters > 0 && <Badge variant="secondary">{activeFilters}</Badge>}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
            <PopoverHeader>
              <PopoverTitle>مرشحات {title}</PopoverTitle>
              <PopoverDescription>تُطبّق اختياراتك مباشرة على النتائج.</PopoverDescription>
            </PopoverHeader>
            <FieldGroup className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="entity-role">الدور</FieldLabel>
                <Choice
                  id="entity-role"
                  label="الدور"
                  value={search.role}
                  options={[
                    { value: "", label: "جميع الأدوار" },
                    ...(options.data?.roles ?? []).map((role) => ({
                      value: role.slug,
                      label: role.label,
                    })),
                  ]}
                  onChange={(role) => onChange({ role })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="entity-language">لغة المساهمة</FieldLabel>
                <Choice
                  id="entity-language"
                  label="لغة المساهمة"
                  value={search.language}
                  options={[
                    { value: "", label: "جميع اللغات" },
                    { value: "ar", label: "العربية" },
                    { value: "en", label: "الإنجليزية" },
                    { value: "es", label: "الإسبانية" },
                    { value: "ja", label: "اليابانية" },
                  ]}
                  onChange={(language) => onChange({ language })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="entity-filter-image">توفر الصورة</FieldLabel>
                <Choice
                  id="entity-filter-image"
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
              </Field>
              <Field>
                <FieldLabel htmlFor="entity-filter-usage">عدد الأعمال</FieldLabel>
                <Choice
                  id="entity-filter-usage"
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
                      usage:
                        usage === "linked" || usage === "unlinked" || usage === "one"
                          ? usage
                          : "all",
                    })
                  }
                />
              </Field>
              <Field className="col-span-2">
                <FieldLabel htmlFor="entity-filter-sort">الترتيب</FieldLabel>
                <Choice
                  id="entity-filter-sort"
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
              </Field>
            </FieldGroup>
            <Button
              variant="ghost"
              size="sm"
              disabled={!activeFilters}
              onClick={() =>
                onChange({ image: "all", usage: "all", sort: "works", role: "", language: "" })
              }
            >
              <X data-icon="inline-start" /> إعادة ضبط المرشحات
            </Button>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          aria-label="تحديث السجلات"
          disabled={result.isFetching}
          onClick={() => void result.refetch()}
        >
          {result.isFetching ? <Spinner /> : <RefreshCw />}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox
            checked={allSelected}
            indeterminate={items.some((item) => selected.has(item.id)) && !allSelected}
            disabled={!items.length || result.isFetching}
            aria-label="تحديد سجلات الصفحة"
            onCheckedChange={(checked) => selectPage(checked === true)}
          />
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {result.data ? number.format(result.data.total) : "…"} سجل
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={!result.data?.total || result.isFetching || selectAll.pending}
            onClick={selectAll.toggle}
          >
            {selectAll.pending ? (
              <Spinner data-icon="inline-start" />
            ) : selectAll.allSelected ? (
              <X data-icon="inline-start" />
            ) : (
              <CheckCheck data-icon="inline-start" />
            )}
            {selectAll.allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
          </Button>
        </div>
        <ToggleGroup
          variant="outline"
          spacing={0}
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
      {selectAll.error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحديد السجلات</AlertTitle>
          <AlertDescription>{selectAll.error.message}</AlertDescription>
        </Alert>
      )}
      {result.isPending ? (
        <EntityListSkeleton kind={kind} view={search.view} />
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
                    disabled={result.isFetching}
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
                      disabled={result.isFetching}
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
                    {date.format(new Date(item.updatedAt))}
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
      <CatalogSelectionActions
        target={path}
        selected={selection.selected}
        visible={result.isPlaceholderData || result.isError ? [] : items.map((item) => item.id)}
        onClear={selection.clear}
        onRemove={(record) => selection.change([record], false)}
        onDelete={() => setDeleteIds(selection.selected.map((record) => record.id))}
      />
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
      className="min-w-0 flex-1 basis-full sm:basis-auto"
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
            {draft && (
              <InputGroupButton
                aria-label="مسح البحث"
                onClick={() => {
                  setDraft("");
                  onSearch("");
                }}
              >
                <X />
              </InputGroupButton>
            )}
            <InputGroupButton type="submit">بحث</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </form>
  );
}

function EntityListSkeleton({ kind, view }: { kind: EntityKind; view: EntitySearch["view"] }) {
  return (
    <div
      role="status"
      aria-label="جارٍ تحميل السجلات"
      className={
        view === "grid"
          ? "grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          : "flex flex-col gap-3"
      }
    >
      {Array.from({ length: view === "grid" ? 12 : 8 }, (_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <Skeleton
            className={
              view === "table"
                ? "h-20 w-full"
                : kind === "person"
                  ? "aspect-4/5 w-full"
                  : "aspect-square w-full"
            }
          />
          {view === "grid" && (
            <>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

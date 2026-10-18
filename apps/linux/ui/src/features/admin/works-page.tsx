import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  X,
  CheckCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { gateway } from "@/lib/bridge";

import { useCatalogSelection, CatalogSelectionActions } from "./catalog-selection";
import { selectedWork } from "./catalog-selection-model";
import { useMatchingSelection } from "./use-matching-selection";
import {
  adminWorksQuery,
  adminWorksOptions,
  worksFilterChoices,
  worksSearchSchema,
  type WorksSearch,
} from "./works-model";
import { WorksResults, WorksViewToggle } from "./works-results";

const number = new Intl.NumberFormat("ar");
function SearchForm({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto">
      <Field>
        <FieldLabel htmlFor="admin-works-search" className="sr-only">
          البحث في الأعمال
        </FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            id="admin-works-search"
            value={draft}
            maxLength={200}
            placeholder="ابحث بالعنوان أو أحد أسمائه…"
            onChange={(event) => setDraft(event.target.value)}
          />
          {draft && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="مسح البحث"
                onClick={() => {
                  setDraft("");
                  onSearch("");
                }}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </Field>
      <Button type="submit" variant="outline">
        بحث
      </Button>
    </form>
  );
}
export function AdminWorksPage({
  search,
  onChange,
}: {
  search: WorksSearch;
  onChange: (patch: Partial<WorksSearch>) => void;
}) {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });
  const selection = useCatalogSelection(session.data?.user.id ?? "signed-out");
  const result = useQuery({
    ...adminWorksOptions(session.data?.user.id ?? "signed-out", search),
    enabled: session.data?.user.isAdmin === true,
    placeholderData: keepPreviousData,
  });
  const page = Number(search.page);
  const pages = Math.max(1, Math.ceil((result.data?.total ?? 0) / 30));
  const filtered = Boolean(
    search.q ||
    search.format !== "all" ||
    search.structure !== "all" ||
    search.workflow !== "all" ||
    search.visibility !== "all" ||
    search.gap !== "all",
  );
  const activeFilters = worksFilterChoices.filter(
    (filter) => search[filter.key] !== (filter.key === "sort" ? "updated" : "all"),
  ).length;
  const pageWorks = result.data?.items ?? [];
  const selectedIds = new Set(selection.selected.map((work) => work.id));
  const pageSelected = pageWorks.filter((work) => selectedIds.has(work.id)).length;
  const allPageSelected = pageWorks.length > 0 && pageSelected === pageWorks.length;
  const matchingQuery = { ...adminWorksQuery(search), page: 1, sort: undefined };
  const selectAll = useMatchingSelection({
    key: ["admin", "works", session.data?.user.id ?? "signed-out", "selection", matchingQuery],
    load: () => gateway.adminWorksSelection(matchingQuery),
    selected: selection.selected,
    pageRecords: pageWorks.map(selectedWork),
    total: result.data?.total ?? 0,
    change: selection.change,
  });
  return (
    <article
      className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-5 p-4 sm:p-6 has-data-[slot=work-selection-actions]:pb-24"
      aria-label="إدارة الأعمال"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">الأعمال</h2>
          <p className="text-sm text-muted-foreground">
            راجع بيانات أعمال المكتبة، أو حدّد عدة أعمال لتحريرها معاً.
          </p>
        </div>
        <Button render={<a href="#/admin/works/new" />}>
          <Plus data-icon="inline-start" />
          عمل جديد
        </Button>
      </header>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchForm key={search.q} value={search.q} onSearch={(q) => onChange({ q })} />
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>
              <SlidersHorizontal data-icon="inline-start" /> المرشحات
              {activeFilters > 0 && (
                <Badge variant="secondary">{number.format(activeFilters)}</Badge>
              )}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="max-h-120 w-96 max-w-[calc(100vw-2rem)] overflow-y-auto"
            >
              <PopoverHeader>
                <PopoverTitle>مرشحات الأعمال</PopoverTitle>
                <PopoverDescription>تُطبّق اختياراتك مباشرة على النتائج.</PopoverDescription>
              </PopoverHeader>
              <FieldGroup className="grid grid-cols-2 gap-3">
                {worksFilterChoices.map((filter) => (
                  <Field key={filter.key}>
                    <FieldLabel htmlFor={`admin-works-${filter.key}`}>{filter.label}</FieldLabel>
                    <Select
                      items={[...filter.items]}
                      value={search[filter.key]}
                      onValueChange={(value) => {
                        if (value !== null) {
                          const next = worksSearchSchema.parse({ ...search, [filter.key]: value });
                          onChange({ [filter.key]: next[filter.key] });
                        }
                      }}
                    >
                      <SelectTrigger
                        id={`admin-works-${filter.key}`}
                        aria-label={filter.label}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {filter.items.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                ))}
              </FieldGroup>

              <Button
                variant="ghost"
                size="sm"
                disabled={!activeFilters}
                onClick={() => onChange({ ...worksSearchSchema.parse({}), q: search.q })}
              >
                <X data-icon="inline-start" /> إعادة ضبط المرشحات
              </Button>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            aria-label="تحديث الأعمال"
            disabled={result.isFetching}
            onClick={() => void result.refetch()}
          >
            {result.isFetching ? <Spinner /> : <RefreshCw />}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Checkbox
              checked={allPageSelected}
              indeterminate={pageSelected > 0 && !allPageSelected}
              disabled={!pageWorks.length || result.isFetching || result.isError}
              onCheckedChange={(checked) => selection.change(pageWorks.map(selectedWork), checked)}
              aria-label="تحديد كل أعمال هذه الصفحة"
            />
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {result.data
                ? `${number.format(result.data.total)} عمل${filtered ? " مطابق" : " في المكتبة"}`
                : "جارٍ تحميل الأعمال…"}
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
          <WorksViewToggle value={selection.view} onChange={selection.setView} />
        </div>
      </div>
      {selectAll.error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحديد الأعمال</AlertTitle>
          <AlertDescription>{selectAll.error.message}</AlertDescription>
        </Alert>
      )}
      {result.isError ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل الأعمال</AlertTitle>
          <AlertDescription>
            {result.error.message}
            <Button variant="outline" onClick={() => void result.refetch()}>
              إعادة المحاولة
            </Button>
          </AlertDescription>
        </Alert>
      ) : result.isPending ? (
        <WorksLoading posters={selection.view === "posters"} />
      ) : result.data.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>
              {page > pages ? "هذه الصفحة لم تعد متاحة" : "لا توجد أعمال مطابقة"}
            </EmptyTitle>
            <EmptyDescription>غيّر البحث أو المرشحات لعرض أعمال المكتبة.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => onChange(worksSearchSchema.parse({}))}>
              عرض جميع الأعمال
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <WorksResults
          works={result.data.items}
          view={selection.view}
          selection={selection.selected}
          onSelection={selection.change}
          busy={result.isPlaceholderData}
        />
      )}
      {result.data && result.data.total > 0 && (
        <nav
          className="flex flex-wrap items-center justify-between gap-3"
          aria-label="صفحات الأعمال"
        >
          <Button
            variant="outline"
            disabled={page <= 1 || result.isPlaceholderData}
            onClick={() => onChange({ page: String(page - 1) })}
          >
            <ChevronRight data-icon="inline-start" />
            السابق
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-xs text-muted-foreground">
              {number.format((page - 1) * 30 + 1)}–
              {number.format(Math.min(page * 30, result.data.total))} من{" "}
              {number.format(result.data.total)}
            </span>
            <PageJump
              key={search.page}
              page={page}
              pages={pages}
              busy={result.isPlaceholderData}
              onPage={(next) => onChange({ page: String(next) })}
            />
          </div>
          <Button
            variant="outline"
            disabled={page >= pages || result.isPlaceholderData}
            onClick={() => onChange({ page: String(page + 1) })}
          >
            التالي
            <ChevronLeft data-icon="inline-end" />
          </Button>
        </nav>
      )}
      <CatalogSelectionActions
        selected={selection.selected}
        visible={
          result.isPlaceholderData || result.isError
            ? []
            : (result.data?.items.map((work) => work.id) ?? [])
        }
        onClear={selection.clear}
        onRemove={(work) => selection.change([work], false)}
      />
    </article>
  );
}

function PageJump({
  page,
  pages,
  busy,
  onPage,
}: {
  page: number;
  pages: number;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  const [value, setValue] = useState(String(page));
  const next = Number(value);
  const valid = Number.isInteger(next) && next >= 1 && next <= pages;
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) onPage(next);
      }}
    >
      <Field orientation="horizontal">
        <FieldLabel htmlFor="works-page-jump">الصفحة</FieldLabel>
        <Input
          id="works-page-jump"
          type="number"
          min={1}
          max={pages}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-20"
          disabled={busy}
        />
      </Field>
      <span className="text-xs text-muted-foreground">من {number.format(pages)}</span>
      <Button type="submit" size="sm" variant="ghost" disabled={!valid || busy || next === page}>
        انتقال
      </Button>
    </form>
  );
}

function WorksLoading({ posters }: { posters: boolean }) {
  return (
    <div
      role="status"
      aria-label="جارٍ تحميل الأعمال"
      aria-busy="true"
      className={
        posters
          ? "grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          : "flex flex-col gap-3"
      }
    >
      {Array.from({ length: posters ? 12 : 6 }, (_, index) =>
        posters ? (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-2/3 w-full motion-reduce:animate-none" />
            <Skeleton className="h-4 w-3/4 motion-reduce:animate-none" />
          </div>
        ) : (
          <div key={index} className="flex items-center gap-4 rounded-xl border border-border p-3">
            <Skeleton className="h-16 w-11 shrink-0 motion-reduce:animate-none" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-4 w-1/2 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-1/3 motion-reduce:animate-none" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

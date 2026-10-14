import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
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

import {
  adminWorksOptions,
  worksFilterChoices,
  worksSearchSchema,
  type WorksSearch,
} from "./works-model";
import { WorksResults, type WorksView } from "./works-results";

const number = new Intl.NumberFormat("ar");
function SearchForm({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2">
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
  const [view, setView] = useState<WorksView>("table");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
  });
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
  return (
    <article
      className="flex min-w-0 flex-col gap-6 p-4 sm:p-6 has-data-[slot=work-selection-actions]:pb-28"
      aria-label="إدارة الأعمال"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold">الأعمال</h2>
          <p className="text-sm text-muted-foreground">
            راجع أعمال المكتبة وحرّر بياناتها، أو حدّد أعمالاً للتحرير الجماعي وJSON.
          </p>
        </div>
        <Button render={<a href="#/admin/works/new" />}>
          <Plus data-icon="inline-start" />
          عمل جديد
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm key={search.q} value={search.q} onSearch={(q) => onChange({ q })} />
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
      <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {worksFilterChoices.map((filter) => (
          <Field key={filter.key}>
            {/*<FieldLabel htmlFor={`admin-works-${filter.key}`}>{filter.label}</FieldLabel>*/}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {result.data
            ? `${number.format(result.data.total)} عمل${filtered ? " مطابق" : " في المكتبة"}`
            : "جارٍ تحميل الأعمال…"}
        </p>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => onChange(worksSearchSchema.parse({}))}>
            <X data-icon="inline-start" />
            مسح المرشحات
          </Button>
        )}
      </div>
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
        <Skeleton className="h-80 w-full" aria-busy="true" />
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
          key={`${session.data?.user.id}:${JSON.stringify(search)}`}
          works={result.data.items}
          view={view}
          onView={setView}
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
          <span className="text-sm text-muted-foreground">
            الصفحة {number.format(page)} من {number.format(pages)}
          </span>
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
    </article>
  );
}

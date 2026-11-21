import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input, InputClear, InputGroup } from "@ui-sdk/react/input";
import { Radio, RadioGroup } from "@ui-sdk/react/radio";
import { cn } from "cn";
import { ArrowLeft, Building2, Search, X } from "lucide-react";
import { useRef } from "react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { Failure, NoResults } from "@/components/status";

import { replaceParams } from "../shell/navigation";
import { PublicPage, PublicPageHeader } from "../shell/public-page";
import { EntityDirectoryPagination } from "./entity-directory-pagination";
import { facetMatches } from "./filter-model";
import { useEntityDirectory } from "./use-entity-directory";

const pageSize = 24;
const number = new Intl.NumberFormat("ar");
const nameOrder = new Intl.Collator("ar");
const sortOptions = [
  { value: "count", label: "الأكثر أعمالًا" },
  { value: "name", label: "أبجديًا" },
];

function directoryParams(search: string, sort: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (sort === "name") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  return params;
}

export function EntityDirectoryPage({
  type,
  params,
}: {
  type: "contributors" | "studios";
  params: URLSearchParams;
}) {
  const people = type === "contributors";
  const path = people ? "people" : "studios";
  const title = people ? "الصنّاع" : "الاستوديوهات";
  const result = useEntityDirectory(type);
  const navigation = useCardNavigation();
  const results = useRef<HTMLElement>(null);
  const search = (params.get("q") ?? "").slice(0, 200);
  const sort = params.get("sort") === "name" ? "name" : "count";
  const matches = result.entities
    .filter((entity) => !search.trim() || facetMatches(entity, search))
    .toSorted(
      (a, b) => (sort === "count" ? b.count - a.count : 0) || nameOrder.compare(a.label, b.label),
    );
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const offset = (page - 1) * pageSize;
  const currentParams = directoryParams(search, sort, page);
  const detailQuery = currentParams.size ? `?${currentParams}` : "";

  const update = (query: string, order: string, nextPage = 1) => {
    replaceParams(`/${path}`, directoryParams(query, order, nextPage));
  };

  return (
    <PublicPage className="flex flex-col gap-6" data-kind={path} aria-label={`صفحة ${title}`}>
      <PublicPageHeader
        title={title}
        description={
          people ? "تصفّح الصنّاع وأعمالهم في المكتبة." : "تصفّح الاستوديوهات وأعمالها في المكتبة."
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <Field className="w-full min-w-0 sm:max-w-sm">
          <FieldLabel className="sr-only">ابحث في {title}</FieldLabel>
          <InputGroup className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-input bg-card px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              maxLength={200}
              placeholder={people ? "ابحث باسم الصانع…" : "ابحث باسم الاستوديو…"}
              value={search}
              onValueChange={(value) => update(value, sort)}
            />
            <InputClear
              aria-label="مسح البحث"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </InputClear>
          </InputGroup>
        </Field>
        <RadioGroup
          aria-label={`ترتيب ${title}`}
          className="inline-flex max-w-full gap-1 rounded-xl border border-border bg-muted p-1 sm:ms-auto"
          value={sort}
          onValueChange={(value) => {
            if (value) update(search, value);
          }}
        >
          {sortOptions.map(({ value, label }) => (
            <Radio
              key={value}
              value={value}
              className="inline-flex min-h-8 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-checked:bg-card data-checked:text-foreground"
            >
              {label}
            </Radio>
          ))}
        </RadioGroup>
      </div>
      {result.error ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : result.isLoading ? (
        <p role="status" className="py-12 text-muted-foreground">
          جارٍ تحميل {title}…
        </p>
      ) : matches.length ? (
        <section
          aria-label={`نتائج ${title}`}
          ref={results}
          tabIndex={-1}
          className="flex scroll-mt-4 flex-col gap-4"
        >
          <p role="status" className="text-sm text-muted-foreground">
            عرض {number.format(offset + 1)}–
            {number.format(Math.min(offset + pageSize, matches.length))} من{" "}
            {number.format(matches.length)}
          </p>
          <ul
            className={cn(
              "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4",
              people && "2xl:grid-cols-6",
            )}
          >
            {matches.slice(offset, offset + pageSize).map((entity) => (
              <li key={entity.value} className="min-w-0">
                <a
                  {...navigation}
                  href={`#/${path}/${encodeURIComponent(entity.value)}${detailQuery}`}
                  className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-ring/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div aria-hidden="true">
                    <Artwork
                      id={entity.artworkId}
                      studioLogo={people ? false : "compact"}
                      alt=""
                      className={cn(
                        "block w-full",
                        people ? "aspect-4/5 object-cover object-top" : "aspect-video",
                      )}
                      fallback={
                        people ? (
                          <span className="font-display text-5xl font-semibold">
                            {entity.label.trim().charAt(0)}
                          </span>
                        ) : (
                          <Building2 className="size-8" />
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-1 items-center justify-between gap-2 border-t border-border p-3 sm:p-4">
                    <div className="min-w-0">
                      <h2 className="text-sm leading-relaxed font-semibold wrap-anywhere sm:text-base">
                        <bdi>{entity.label}</bdi>
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {number.format(entity.count)} عمل في المكتبة
                      </p>
                    </div>
                    <ArrowLeft
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                    />
                  </div>
                </a>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <EntityDirectoryPagination
              page={page}
              pageCount={pageCount}
              onPageChange={(nextPage) => {
                if (nextPage === page) return;
                update(search, sort, nextPage);
                results.current?.focus();
                results.current?.scrollIntoView({ block: "start" });
              }}
            />
          )}
        </section>
      ) : (
        <NoResults
          title={
            search.trim() ? "لا توجد أسماء مطابقة" : people ? "لا يوجد صنّاع" : "لا توجد استوديوهات"
          }
          description={
            search.trim()
              ? "جرّب اسمًا آخر أو امسح البحث لعرض الجميع."
              : "ستظهر هنا الأسماء المرتبطة بأعمال المكتبة."
          }
        />
      )}
    </PublicPage>
  );
}

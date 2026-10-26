import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Orbit, Search, ShieldCheck, Star, Users, X } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import type { RefObject } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { Failure } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  DrawerContent,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../../components/ui/drawer";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "../../components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "../../components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group";
import { Separator } from "../../components/ui/separator";
import { Slider } from "../../components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { gateway } from "../../lib/bridge";
import { useIsAdmin } from "../account/use-is-admin";
import { AppliedFilters } from "./applied-filters";
import {
  refinementCount,
  refinementQuery,
  resetRefinements,
  yearError,
} from "./browse-refinements";
import type { BrowseRefinements, LockedFacet } from "./browse-refinements";
import { browseTemplates, libraryFilters } from "./browse-templates";
import { FilterFacets } from "./filter-facets";
import { completeFacetGroups, facetMatches, normalizeFacetSearch } from "./filter-model";
import { ScoreFilters } from "./score-filters";

const categories = [
  {
    key: "basics",
    icon: CalendarDays,
    label: "الإصدار ومكتبتي",
    description: "الإصدار والمشاهدة والمفضلة ومصادر التشغيل",
    facets: [
      "kinds",
      "releaseStatuses",
      "releaseStates",
      "structureStates",
      "watchStates",
      "favoriteStates",
      "playableStates",
      "dubLanguages",
      "playbackPolicies",
    ],
  },
  {
    key: "story",
    icon: Orbit,
    label: "الحكاية والعالم",
    description: "الكواكب والأنواع والبلدان",
    facets: ["planets", "genres", "tones", "tags", "countries", "formats"],
  },
  {
    key: "family",
    icon: ShieldCheck,
    label: "العائلة والمحتوى",
    description: "الجمهور والعمر ومستويات المحتوى",
    facets: ["audiences", "ages", "sexualityRisks", "behavioralRisks", "theologyRisks"],
  },
  {
    key: "scores",
    icon: Star,
    label: "التقييم",
    description: "التقييم العام والمعايير الستة",
    facets: ["ratingStates"],
  },
  {
    key: "people",
    icon: Users,
    label: "الصنّاع والجوائز",
    description: "الأشخاص والاستوديوهات والتكريمات",
    facets: [
      "studios",
      "contributors",
      "contributionRoles",
      "awardPrograms",
      "awardCategories",
      "awardResults",
    ],
  },
];
const categoryNames = new Map([
  ["basics", "الإصدار ومكتبتي"],
  ["story", "التصنيف"],
  ["family", "المحتوى"],
  ["scores", "التقييم"],
  ["people", "الصنّاع والجوائز"],
]);
const knownFacets = new Set(categories.flatMap((category) => category.facets));
// Mounted on open: the draft has one owner and is discarded on every close.
export function FilterDrawer({
  value,
  view,
  q,
  locked,
  onApply,
  returnFocus,
  library,
}: {
  value: BrowseRefinements;
  library?: string;
  view: "works" | "installments";
  q: string;
  locked?: LockedFacet;
  onApply: (value: BrowseRefinements) => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const isAdmin = useIsAdmin();
  const searchInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [fallbackYear] = useState(() => new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("story");
  const content = useRef<HTMLDivElement>(null);
  const [previewDraft, setPreviewDraft] = useState(draft);
  useEffect(() => {
    const timer = setTimeout(() => setPreviewDraft(draft), 300);
    return () => clearTimeout(timer);
  }, [draft]);
  const previewQuery = refinementQuery(
    { ...previewDraft, filters: libraryFilters(previewDraft.filters, library) },
    view,
    q,
  );
  const invalid = yearError(draft.from, draft.to);
  const options = useQuery({
    queryKey: ["catalog", "facets", view, draft.privacy],
    queryFn: ({ signal }) => gateway.facets({ view, privacy: draft.privacy }, signal),
  });
  const preview = useQuery({
    queryKey: ["catalog", "preview", previewQuery],
    queryFn: ({ signal }) => gateway.browse({ ...previewQuery, page: 1, pageSize: 1 }, signal),
    enabled: !invalid && previewDraft === draft,
  });
  const pending = previewDraft !== draft || preview.isFetching;
  const yearMin = Math.min(options.data?.yearMin ?? 1900, Number(draft.from) || Infinity);
  const yearMax = Math.max(
    options.data?.yearMax ?? fallbackYear,
    Number(draft.to) || 0,
    yearMin + 1,
  );
  const years = [Number(draft.from) || yearMin, Number(draft.to) || yearMax];
  const changeFilters = (filters: BrowseRefinements["filters"]) =>
    setDraft((previous) => ({ ...previous, filters }));

  const searchText = normalizeFacetSearch(search);
  const categoryTerms = new Map([
    ["basics", "release year status privacy kind watch favorite library video"],
    ["story", "planet genre country tone tag format"],
    ["family", "family audience age risk"],
    ["scores", "rating score criteria"],
    ["people", "people studio contributor awards category"],
  ]);
  const categoryMatches = (item: (typeof categories)[number]) =>
    normalizeFacetSearch(
      `${item.label} ${item.description} ${categoryTerms.get(item.key) ?? ""}`,
    ).includes(searchText);
  const libraryFacets = browseTemplates.find((item) => item.id === library)?.facets ?? [];
  const facetGroups = options.data
    ? completeFacetGroups(options.data.groups, view).filter(
        (facet) => !libraryFacets.some((base) => base.key === facet.key),
      )
    : [];
  const categoryGroups = (item: (typeof categories)[number]) =>
    facetGroups.filter(
      (facet) =>
        facet.key !== "warningStates" &&
        (item.facets.includes(facet.key) || (item.key === "basics" && !knownFacets.has(facet.key))),
    ) ?? [];
  const visibleCategories = searchText
    ? categories.filter(
        (item) =>
          categoryMatches(item) ||
          categoryGroups(item).some(
            (facet) =>
              normalizeFacetSearch(facet.label).includes(searchText) ||
              facet.options.some((option) => facetMatches(option, searchText)),
          ),
      )
    : categories;

  const displayed = !searchText
    ? visibleCategories.filter((item) => item.key === category)
    : visibleCategories;

  return (
    <DrawerContent
      dir="rtl"
      className="mx-auto h-5/6 w-full max-w-6xl sm:w-11/12"
      finalFocus={returnFocus}
      initialFocus={searchInput}
    >
      <DrawerHeader className="gap-2 px-5 py-4 text-start">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DrawerTitle>مرشحات المكتبة</DrawerTitle>
            <Badge variant="secondary">{refinementCount(draft, locked)}</Badge>
          </div>
          <DrawerClose render={<Button variant="ghost" size="icon" aria-label="إغلاق المرشحات" />}>
            <X />
          </DrawerClose>
        </div>
        <DrawerDescription className="sr-only">
          ابحث بالاسم العربي أو الإنجليزي. ضمّن ما تريد واستبعد ما لا تريد، ثم اعرض النتائج.
        </DrawerDescription>
      </DrawerHeader>
      <div className="flex shrink-0 flex-col gap-2 px-5 pb-3">
        <Field>
          <FieldLabel htmlFor="facet-search" className="sr-only">
            ابحث في المرشحات
          </FieldLabel>
          <InputGroup className="h-10">
            <InputGroupInput
              ref={searchInput}
              id="facet-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                content.current?.scrollTo({ top: 0 });
              }}
              placeholder="ابحث بالعربية أو الإنجليزية…"
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  aria-label="مسح بحث المرشحات"
                  onClick={() => setSearch("")}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </Field>
      </div>
      <div className="overflow-x-auto px-5 flex">
        <ToggleGroup
          variant="default"
          className={"w-full flex items-center"}
          size="lg"
          spacing={0}
          value={searchText ? [] : [category]}
          aria-label="قسم المرشحات"
          onValueChange={(values) => {
            const next = categories.find((item) => item.key === values[0]);
            if (next) {
              setCategory(next.key);
              setSearch("");
              content.current?.scrollTo({ top: 0 });
            }
          }}
        >
          {categories.map((item) => (
            <ToggleGroupItem
              className={"border flex-1"}
              key={item.key}
              value={item.key}
              aria-label={categoryNames.get(item.key)}
            >
              {categoryNames.get(item.key)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          ref={content}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto scroll-fade-y overscroll-contain px-5 py-5"
        >
          {options.isLoading && (
            <p role="status" className="py-5">
              جارٍ تحميل الخيارات…
            </p>
          )}
          {options.error && <Failure error={options.error} retry={() => void options.refetch()} />}
          {options.data && !visibleCategories.length && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد مرشحات مطابقة</EmptyTitle>
                <EmptyDescription>جرّب اسمًا آخر أو امسح البحث لعرض الأقسام.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <div className="flex flex-col gap-5">
            {displayed.map((item) => (
              <section
                key={item.key}
                id={`filter-section-${item.key}`}
                aria-labelledby={`filter-heading-${item.key}`}
              >
                {searchText && (
                  <header className="mb-3 flex items-start gap-3">
                    <item.icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id={`filter-heading-${item.key}`} className="text-base font-semibold">
                          {item.label}
                        </h2>
                        {categoryCount(item.key, item.facets, draft, locked) > 0 && (
                          <Badge variant="secondary">
                            {categoryCount(item.key, item.facets, draft, locked)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </header>
                )}
                <FieldGroup className="gap-5">
                  {item.key === "basics" && (
                    <FieldGroup className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8">
                      {isAdmin && (
                        <FieldSet className="gap-3 md:flex-1">
                          <FieldLegend variant="label">الخصوصية</FieldLegend>
                          <ToggleGroup
                            variant="outline"
                            spacing={2}
                            value={[draft.privacy]}
                            aria-label="الخصوصية"
                            className="flex-wrap"
                            onValueChange={(values) => {
                              const privacy = values[0];
                              if (
                                privacy === "public" ||
                                privacy === "private" ||
                                privacy === "all"
                              )
                                setDraft({ ...draft, privacy });
                            }}
                          >
                            <ToggleGroupItem value="public">العامة فقط</ToggleGroupItem>
                            <ToggleGroupItem value="all">العامة والخاصة</ToggleGroupItem>
                            <ToggleGroupItem value="private">الخاصة فقط</ToggleGroupItem>
                          </ToggleGroup>
                        </FieldSet>
                      )}
                      <FieldSet className="min-w-0 gap-3 md:flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <FieldLegend variant="label">سنوات الإصدار</FieldLegend>
                          <span className="text-sm text-muted-foreground" dir="ltr">
                            {years[0]} – {years[1]}
                          </span>
                        </div>
                        <Field>
                          <Slider
                            aria-label="سنوات الإصدار"
                            min={yearMin}
                            max={yearMax}
                            step={1}
                            value={years}
                            onValueChange={(next) => {
                              if (!Array.isArray(next)) return;
                              setDraft({
                                ...draft,
                                from: next[0] === yearMin ? "" : String(next[0]),
                                to: next[1] === yearMax ? "" : String(next[1]),
                              });
                            }}
                          />
                        </Field>
                      </FieldSet>
                    </FieldGroup>
                  )}
                  {item.key === "scores" && (
                    <ScoreFilters value={draft.filters} onChange={changeFilters} />
                  )}
                  {options.data && (
                    <FilterFacets
                      groups={categoryGroups(item)}
                      compact={item.key === "basics"}
                      family={item.key === "family"}
                      filters={draft.filters}
                      onChange={changeFilters}
                      search={categoryMatches(item) ? "" : search}
                      locked={locked}
                    />
                  )}
                </FieldGroup>
              </section>
            ))}
          </div>
        </div>
      </div>
      <Separator />
      <DrawerFooter className="gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        {refinementCount(draft, locked) > 0 && (
          <Collapsible>
            <div className="flex items-center justify-center gap-3">
              <CollapsibleTrigger render={<Button variant="secondary" size="sm" />}>
                مراجعة الاختيارات ({refinementCount(draft, locked)})
              </CollapsibleTrigger>
              <div
                className="flex min-w-0 flex-1 flex-col gap-1 text-start"
                role="status"
                aria-live="polite"
              >
                {invalid ? (
                  <p id="year-error">{invalid}</p>
                ) : (
                  <p>
                    {pending || preview.isPending
                      ? "جارٍ حساب النتائج…"
                      : preview.error
                        ? "تعذّرت معاينة العدد؛ يمكنك تطبيق المرشحات."
                        : `${preview.data?.total ?? "…"} نتيجة مطابقة`}
                  </p>
                )}
              </div>
            </div>
            <CollapsibleContent className="max-h-28 overflow-y-auto pt-3">
              <AppliedFilters
                value={draft}
                options={options.data}
                locked={locked}
                onChange={setDraft}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              setDraft({ ...resetRefinements(locked), sort: draft.sort, group: draft.group })
            }
          >
            مسح كل المرشحات
          </Button>

          <DrawerClose render={<Button variant="outline" />}>إلغاء</DrawerClose>
          <Button size="lg" disabled={Boolean(invalid)} onClick={() => onApply(draft)}>
            تطبيق المرشحات
            {!pending && !preview.error && preview.data ? ` · ${preview.data.total}` : ""}
          </Button>
        </div>
      </DrawerFooter>
    </DrawerContent>
  );
}

function categoryCount(
  key: string,
  facets: string[],
  value: BrowseRefinements,
  locked?: LockedFacet,
) {
  const selected = value.filters.facets.filter(
    (facet) => facets.includes(facet.key) || (key === "basics" && !knownFacets.has(facet.key)),
  );
  const count =
    selected.reduce((total, facet) => total + facet.include.length + facet.exclude.length, 0) -
    Number(
      Boolean(
        locked &&
        selected.some((facet) => facet.key === locked.key && facet.include.includes(locked.value)),
      ),
    );
  if (key === "basics")
    return (
      count +
      Number(value.privacy !== "public") +
      Number(Boolean(value.from)) +
      Number(Boolean(value.to))
    );
  if (key === "scores")
    return (
      count +
      Number(value.filters.minimumRating > 0 || (value.filters.maximumRating ?? 10) < 10) +
      Object.values(value.filters.minimumScores).filter((score) => score > 0).length
    );
  return count;
}

import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Eye,
  ListFilter,
  Orbit,
  Play,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

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
    key: "library",
    icon: Eye,
    label: "مكتبتي",
    facets: ["watchStates", "favoriteStates"],
  },
  {
    key: "playback",
    icon: Play,
    label: "الإصدار والتشغيل",
    description: "يُحدَّد صدور العمل أو الإصدار بشكل مستقل عن وجود ملف فيديو على الخادم.",
    facets: ["releaseStates", "playableStates", "playbackPolicies"],
  },
  {
    key: "basics",
    icon: CalendarDays,
    label: "تفاصيل الإصدار",
    description: "النوع وحالة الإصدار واللغة وسنوات الإصدار",
    facets: ["kinds", "releaseStatuses", "structureStates", "languages", "dubLanguages"],
  },
  {
    key: "story",
    icon: Orbit,
    label: "الحكاية والعالم",
    description: "الكواكب والأنواع والطابع والوسوم والبلدان",
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
  ["basics", "تفاصيل الإصدار"],
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
  returnFocus: () => HTMLElement | boolean;
}) {
  const isAdmin = useIsAdmin();
  const searchInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [fallbackYear] = useState(() => new Date().getFullYear());
  const [search, setSearch] = useState("");
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
  const total = pending || preview.error ? undefined : preview.data?.total;
  const selectionCount = refinementCount(draft, locked);
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
    ["library", "watch status favorite library"],
    ["playback", "release video file torrent playback توفر إصدارات وجود فيديو مصادر التشغيل"],
    ["basics", "release year status privacy kind language البنية"],
    ["story", "planet genre country tone tag tags format"],
    ["family", "family audience age risk"],
    ["scores", "rating score criteria"],
    ["people", "people studio contributor awards category"],
  ]);
  const categoryMatches = (item: (typeof categories)[number]) =>
    normalizeFacetSearch(
      `${item.label} ${item.description ?? ""} ${categoryTerms.get(item.key) ?? ""}`,
    ).includes(searchText);
  const template = browseTemplates.find((item) => item.id === library);
  const libraryFacets = template?.facets ?? [];
  const facetGroups = options.data
    ? completeFacetGroups(options.data.groups, view)
        .filter(
          (facet) => facet.key === "tags" || !libraryFacets.some((base) => base.key === facet.key),
        )
        .filter(
          (facet) =>
            facet.key !== "warningStates" &&
            (facet.key !== "structureStates" || view === "installments"),
        )
        .map((facet) =>
          facet.key === "tags"
            ? {
                ...facet,
                options: facet.options.filter(
                  (option) =>
                    !libraryFacets.some(
                      (base) =>
                        base.key === facet.key &&
                        [...base.include, ...base.exclude].includes(option.value),
                    ),
                ),
              }
            : facet.key === "dubLanguages"
              ? { ...facet, label: "لغات الدبلجة" }
              : facet,
        )
    : [];
  const categoryGroups = (item: (typeof categories)[number]) =>
    facetGroups
      .filter(
        (facet) =>
          item.facets.includes(facet.key) || (item.key === "basics" && !knownFacets.has(facet.key)),
      )
      .toSorted((a, b) => item.facets.indexOf(a.key) - item.facets.indexOf(b.key));
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

  return (
    <DrawerContent
      dir="ltr"
      className="w-auto max-w-xl end-2 sm:end-auto sm:w-xl motion-reduce:transition-none"
      finalFocus={returnFocus}
      initialFocus={searchInput}
    >
      <div dir="rtl" className="flex min-h-0 flex-1 flex-col">
        <DrawerHeader className="gap-2 px-5 py-4 text-start">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <DrawerTitle>تصفية النتائج</DrawerTitle>
              <Badge variant="secondary">{selectionCount}</Badge>
            </div>
            <DrawerClose
              render={<Button variant="ghost" size="icon" aria-label="إغلاق تصفية النتائج" />}
            >
              <X />
            </DrawerClose>
          </div>
          {template ? (
            <DrawerDescription>
              {template.title} · {template.description}
            </DrawerDescription>
          ) : (
            <DrawerDescription className="sr-only">
              ابحث بالاسم العربي أو الإنجليزي. ضمّن ما تريد واستبعد ما لا تريد، ثم اعرض النتائج.
            </DrawerDescription>
          )}
        </DrawerHeader>
        <div className="flex shrink-0 flex-col gap-2 px-5 pb-3">
          <Field>
            <FieldLabel htmlFor="facet-search" className="sr-only">
              ابحث في خيارات التصفية
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
                    aria-label="مسح البحث في خيارات التصفية"
                    onClick={() => setSearch("")}
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
          </Field>
        </div>
        {!searchText && (
          <nav aria-label="أقسام التصفية" className="flex flex-wrap gap-1 px-5 pb-3">
            {categories.map((item) => (
              <Button
                key={item.key}
                variant="outline"
                size="xs"
                onClick={() => {
                  const heading = content.current?.querySelector<HTMLElement>(
                    `#filter-heading-${item.key}`,
                  );
                  heading?.focus({ preventScroll: true });
                  heading?.scrollIntoView({ block: "start", inline: "nearest" });
                }}
              >
                {categoryNames.get(item.key) ?? item.label}
              </Button>
            ))}
          </nav>
        )}
        <Separator />
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
            {options.error && (
              <Failure error={options.error} retry={() => void options.refetch()} />
            )}
            {options.data && !visibleCategories.length && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>لا توجد خيارات تصفية مطابقة</EmptyTitle>
                  <EmptyDescription>جرّب اسمًا آخر أو امسح البحث لعرض الأقسام.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <div className="flex flex-col gap-5">
              {visibleCategories.map((item) => (
                <section
                  key={item.key}
                  id={`filter-section-${item.key}`}
                  aria-labelledby={`filter-heading-${item.key}`}
                  className="border-b border-border pb-5 last:border-b-0"
                >
                  <header className="mb-3 flex items-start gap-3">
                    <item.icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          id={`filter-heading-${item.key}`}
                          tabIndex={-1}
                          className="scroll-mt-4 rounded-sm text-base font-semibold focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {item.label}
                        </h2>
                        {categoryCount(item.key, item.facets, draft, locked) > 0 && (
                          <Badge variant="secondary">
                            {categoryCount(item.key, item.facets, draft, locked)}
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                  </header>
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
        <DrawerFooter className="px-4 py-3 sm:px-5">
          <Collapsible className="w-full">
            <p
              role="status"
              className={invalid || preview.error ? "pb-2 text-xs text-destructive" : "sr-only"}
            >
              {invalid ||
                (preview.error
                  ? "تعذّرت معاينة العدد؛ يمكنك تطبيق التصفية."
                  : total === undefined
                    ? "جارٍ حساب النتائج…"
                    : `عدد النتائج المطابقة: ${total}`)}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {selectionCount > 0 && (
                <CollapsibleTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label={`مراجعة الاختيارات (${selectionCount})`}
                      title="مراجعة الاختيارات"
                    />
                  }
                >
                  <ListFilter aria-hidden="true" />
                </CollapsibleTrigger>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDraft({ ...resetRefinements(locked), sort: draft.sort, group: draft.group })
                }
              >
                مسح التصفية
              </Button>
              <DrawerClose render={<Button variant="outline" size="sm" className="ms-auto" />}>
                إلغاء
              </DrawerClose>
              <Button size="sm" disabled={Boolean(invalid)} onClick={() => onApply(draft)}>
                تطبيق التصفية
                {total !== undefined && (
                  <span className="tabular-nums" aria-hidden="true">
                    · {total}
                  </span>
                )}
              </Button>
            </div>
            <CollapsibleContent className="mt-2 max-h-28 overflow-y-auto">
              <AppliedFilters
                value={draft}
                options={options.data}
                locked={locked}
                onChange={setDraft}
              />
            </CollapsibleContent>
          </Collapsible>
        </DrawerFooter>
      </div>
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

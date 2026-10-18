import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  Library,
  Minus,
  Orbit,
  Search,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import type { RefObject } from "react";

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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group";
import { Separator } from "../../components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { gateway } from "../../lib/bridge";
import { useIsAdmin } from "../account/use-is-admin";
import {
  refinementCount,
  refinementQuery,
  resetRefinements,
  yearError,
} from "./browse-refinements";
import type { BrowseRefinements, LockedFacet } from "./browse-refinements";
import { FilterFacets } from "./filter-facets";
import { criteria, optionLabel } from "./filter-model";

const categories = [
  {
    key: "basics",
    icon: CalendarDays,
    label: "الإصدار والنطاق",
    description: "نوع العمل، حالته وسنوات إصداره",
    facets: ["kinds", "releaseStatuses", "releaseStates", "structureStates"],
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
    description: "الجمهور والعمر والتنبيهات",
    facets: [
      "audiences",
      "ages",
      "sexualityRisks",
      "behavioralRisks",
      "theologyRisks",
      "warningStates",
    ],
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
    facets: ["studios", "contributors", "awardPrograms", "awardCategories", "awardResults"],
  },
  {
    key: "library",
    icon: Library,
    label: "مكتبتي",
    description: "المشاهدة والمفضلة والفيديو المسجّل",
    facets: ["watchStates", "favoriteStates", "playableStates"],
  },
];
const knownFacets = new Set(categories.flatMap((category) => category.facets));
// Mounted on open: the draft has one owner and is discarded on every close.
export function FilterDrawer({
  value,
  view,
  q,
  locked,
  onApply,
  returnFocus,
}: {
  value: BrowseRefinements;
  view: "works" | "installments";
  q: string;
  locked?: LockedFacet;
  onApply: (value: BrowseRefinements) => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) {
  const isAdmin = useIsAdmin();
  const searchInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("basics");
  const content = useRef<HTMLDivElement>(null);
  const [previewDraft, setPreviewDraft] = useState(draft);
  useEffect(() => {
    const timer = setTimeout(() => setPreviewDraft(draft), 300);
    return () => clearTimeout(timer);
  }, [draft]);
  const previewQuery = refinementQuery(previewDraft, view, q);
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
  const changeFilters = (filters: BrowseRefinements["filters"]) =>
    setDraft((previous) => ({ ...previous, filters }));

  const searchText = search.trim().toLocaleLowerCase();
  const categoryMatches = (item: (typeof categories)[number]) =>
    `${item.label} ${item.description}`.toLocaleLowerCase().includes(searchText);
  const categoryGroups = (item: (typeof categories)[number]) =>
    options.data?.groups.filter(
      (facet) =>
        item.facets.includes(facet.key) || (item.key === "basics" && !knownFacets.has(facet.key)),
    ) ?? [];
  const visibleCategories = searchText
    ? categories.filter(
        (item) =>
          categoryMatches(item) ||
          categoryGroups(item).some(
            (facet) =>
              facet.label.toLocaleLowerCase().includes(searchText) ||
              facet.options.some((option) =>
                optionLabel(option.value, option.label).toLocaleLowerCase().includes(searchText),
              ),
          ),
      )
    : categories;

  const displayed = !searchText
    ? visibleCategories.filter((item) => item.key === category)
    : visibleCategories;

  return (
    <DrawerContent
      dir="rtl"
      className="h-dvh w-full max-w-4xl sm:w-11/12 data-[swipe-direction=right]:end-auto data-[swipe-direction=right]:right-0"
      finalFocus={returnFocus}
      initialFocus={searchInput}
    >
      <DrawerHeader className="gap-2 p-5 text-start">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DrawerTitle>مرشحات المكتبة</DrawerTitle>
            <Badge variant="secondary">{refinementCount(draft, locked)}</Badge>
          </div>
          <DrawerClose render={<Button variant="ghost" size="icon" aria-label="إغلاق المرشحات" />}>
            <X />
          </DrawerClose>
        </div>
        <DrawerDescription className="w-full text-start">
          اختر مرشحاتك ثم طبّقها. تُحفظ الاختيارات المطبّقة؛ إغلاق اللوحة يلغي التعديلات الجديدة.
        </DrawerDescription>
      </DrawerHeader>
      <Separator />
      <div className="flex shrink-0 flex-col gap-3 px-5 py-4">
        <Field>
          <FieldLabel htmlFor="facet-search" className="sr-only">
            ابحث في المرشحات
          </FieldLabel>
          <InputGroup className="h-10">
            <InputGroupInput
              ref={searchInput}
              id="facet-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث عن مرشح: نوع، كوكب، بلد، صانع…"
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>كل ضغطة تغيّر الاختيار:</span>
          <Badge variant="secondary">
            <Check data-icon="inline-start" />
            تضمين
          </Badge>
          <span aria-hidden="true">←</span>
          <Badge variant="destructive">
            <Minus data-icon="inline-start" />
            استبعاد
          </Badge>
          <span aria-hidden="true">←</span>
          <Badge variant="outline">
            <X data-icon="inline-start" />
            إزالة
          </Badge>
        </div>
      </div>
      <div className="overflow-x-auto px-5 pb-3 lg:hidden">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={2}
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
            <ToggleGroupItem key={item.key} value={item.key} aria-label={item.label}>
              <item.icon data-icon="inline-start" />
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Separator />
      <div className="flex min-h-0 flex-1">
        <div
          ref={content}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5"
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
          <div className="flex flex-col gap-8">
            {displayed.map((item) => (
              <section
                key={item.key}
                id={`filter-section-${item.key}`}
                aria-labelledby={`filter-heading-${item.key}`}
              >
                <header className="mb-5 flex items-start gap-3">
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
                <FieldGroup className="gap-7">
                  {item.key === "basics" && (
                    <>
                      {isAdmin && (
                        <FieldSet>
                          <FieldLegend>الخصوصية</FieldLegend>
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
                          <FieldDescription>الأعمال الخاصة مخفية افتراضيًا.</FieldDescription>
                        </FieldSet>
                      )}
                      <FieldSet>
                        <FieldLegend>سنوات الإصدار</FieldLegend>
                        <FieldGroup className="grid grid-cols-2 gap-4">
                          <Field data-invalid={Boolean(invalid)}>
                            <FieldLabel htmlFor="from-year">من سنة</FieldLabel>
                            <Input
                              id="from-year"
                              type="number"
                              min={1}
                              max={9999}
                              value={draft.from}
                              aria-invalid={Boolean(invalid)}
                              aria-describedby={invalid ? "year-error" : undefined}
                              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                              placeholder={String(options.data?.yearMin ?? "")}
                            />
                          </Field>
                          <Field data-invalid={Boolean(invalid)}>
                            <FieldLabel htmlFor="to-year">إلى سنة</FieldLabel>
                            <Input
                              id="to-year"
                              type="number"
                              min={1}
                              max={9999}
                              value={draft.to}
                              aria-invalid={Boolean(invalid)}
                              aria-describedby={invalid ? "year-error" : undefined}
                              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                              placeholder={String(options.data?.yearMax ?? "")}
                            />
                          </Field>
                        </FieldGroup>
                        <FieldDescription>اترك الحقل فارغًا لعدم تقييد السنة.</FieldDescription>
                      </FieldSet>
                    </>
                  )}
                  {item.key === "scores" && (
                    <>
                      <ScoreInput
                        id="minimum-rating"
                        label="الحد الأدنى للتقييم العام"
                        value={draft.filters.minimumRating}
                        onChange={(minimumRating) =>
                          changeFilters({ ...draft.filters, minimumRating })
                        }
                      />
                      <FieldSet>
                        <FieldLegend>المعايير التفصيلية</FieldLegend>
                        <FieldDescription>
                          كل حد تختاره يجب أن يتحقق. صفر يعني بلا حد أدنى.
                        </FieldDescription>
                        <FieldGroup className="grid gap-5 sm:grid-cols-2">
                          {criteria.map((criterion) => (
                            <ScoreInput
                              key={criterion.key}
                              id={`score-${criterion.key}`}
                              label={criterion.label}
                              value={draft.filters.minimumScores[criterion.key]}
                              onChange={(score) =>
                                changeFilters({
                                  ...draft.filters,
                                  minimumScores: {
                                    ...draft.filters.minimumScores,
                                    [criterion.key]: score,
                                  },
                                })
                              }
                            />
                          ))}
                        </FieldGroup>
                      </FieldSet>
                    </>
                  )}
                  {options.data && (
                    <FilterFacets
                      groups={categoryGroups(item)}
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
        <aside
          className="hidden w-52 shrink-0 flex-col gap-3 overflow-y-auto border-s border-border p-3 lg:flex"
          aria-label="أقسام المرشحات"
        >
          <ToggleGroup
            orientation="vertical"
            variant="outline"
            spacing={2}
            value={searchText ? [] : [category]}
            aria-label="قسم المرشحات"
            className="w-full"
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
                key={item.key}
                value={item.key}
                className="h-auto min-h-11 justify-start gap-2 px-3 py-3"
                aria-label={item.label}
              >
                <item.icon data-icon="inline-start" aria-hidden="true" />
                <span className="flex-1 text-start whitespace-normal">{item.label}</span>
                {categoryCount(item.key, item.facets, draft, locked) > 0 && (
                  <Badge variant="secondary">
                    {categoryCount(item.key, item.facets, draft, locked)}
                  </Badge>
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </aside>
      </div>
      <Separator />
      <DrawerFooter className="gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
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
          <p className="text-xs text-muted-foreground">
            التضمين داخل القسم بدائل؛ الاستبعاد يخفي أي تطابق.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() =>
              setDraft({ ...resetRefinements(locked), sort: draft.sort, group: draft.group })
            }
          >
            مسح كل المرشحات
          </Button>

          <Button size="lg" disabled={Boolean(invalid)} onClick={() => onApply(draft)}>
            تطبيق المرشحات
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
      Number(value.filters.minimumRating > 0) +
      Object.values(value.filters.minimumScores).filter((score) => score > 0).length
    );
  return count;
}

function ScoreInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        min={0}
        max={10}
        step={0.1}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next >= 0 && next <= 10) onChange(next);
        }}
      />
      <FieldDescription>من 0 إلى 10 · صفر يعرض الكل</FieldDescription>
    </Field>
  );
}

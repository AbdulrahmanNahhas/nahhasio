import { cn } from "cn";
import { SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { languageName } from "@/lib/languages";

import { Choice } from "../../components/choice";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "../../components/ui/field";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../../components/ui/popover";
import { Switch } from "../../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { useIsAdmin } from "../account/use-is-admin";
import { replaceParams } from "../shell/navigation";
import { CatalogPage, PublicPageHeader, PublicPageSearch } from "../shell/public-page";
import { EntityCard } from "./entity-card";
import { facetMatches } from "./filter-model";
import { compareEntityWorkCount, useEntityDirectory } from "./use-entity-directory";

const batchSize = 24;

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
  const defaults = {
    role: people ? "all" : "animation_studio",
    image: "all",
    size: "small",
    cardAspect: people ? "portrait" : "square",
    privacy: "public",
    language: "",
    q: "",
    sort: "count",
  };
  const isAdmin = useIsAdmin();
  const privacy = isAdmin && params.get("privacy") === "all" ? "all" : "public";
  const result = useEntityDirectory(type, privacy);
  const search = (params.get("q") ?? "").slice(0, 200);
  const sort = params.get("sort") === "name" ? "name" : "count";
  const [limit, setLimit] = useState(batchSize);
  const size =
    params.get("size") === "large" ? "large" : params.get("size") === "medium" ? "medium" : "small";
  const square = people ? params.get("shape") === "square" : params.get("shape") !== "banner";
  const language = params.get("language") ?? "";
  const languages = [
    ...new Set(result.entities.flatMap((entity) => entity.languages ?? [])),
  ].toSorted();
  const role = params.get("role") || defaults.role;
  const imageParam = params.get("image");
  const image = imageParam === "with" || imageParam === "without" ? imageParam : defaults.image;
  const roles = Array.from(
    new Map(
      result.entities.flatMap((entity) =>
        (entity.roles ?? []).map((item) => [item.value, item] as const),
      ),
    ).values(),
  ).toSorted((a, b) => a.label.localeCompare(b.label, "ar"));
  const changeFilter = (
    key: "role" | "image" | "size" | "shape" | "privacy" | "language" | "q" | "sort",
    value: string,
  ) => {
    const next = new URLSearchParams(params);
    const defaultValue = key === "shape" ? defaults.cardAspect : defaults[key];
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    setLimit(batchSize);
    replaceParams(`/${path}`, next);
  };
  const filtered = Boolean(search.trim()) || role !== "all" || image !== "all" || Boolean(language);
  const clearFilters = () => {
    setLimit(batchSize);
    const next = new URLSearchParams(params);
    next.delete("language");
    next.delete("q");
    if (people) next.delete("role");
    else next.set("role", "all");
    next.delete("image");
    replaceParams(`/${path}`, next);
  };
  const matches = result.entities
    .filter(
      (entity) =>
        facetMatches(entity, search) &&
        (role === "all"
          ? !language || entity.languages?.includes(language)
          : entity.roles?.some(
              (item) => item.value === role && (!language || item.languages?.includes(language)),
            )) &&
        (image === "all" || (image === "with" ? Boolean(entity.artworkId) : !entity.artworkId)),
    )
    .toSorted((a, b) =>
      sort === "name" ? a.label.localeCompare(b.label, "ar") : compareEntityWorkCount(a, b),
    );
  return (
    <CatalogPage
      data-kind={path}
      aria-label={`صفحة ${title}`}
      heading={
        <PublicPageHeader
          title={title}
          count={
            result.data && (
              <Badge variant="secondary">
                {result.entities.length} {people ? "صانع" : "استوديو"}
              </Badge>
            )
          }
          actions={
            <PublicPageSearch
              label={`ابحث في ${title}`}
              placeholder={people ? "ابحث باسم الصانع…" : "ابحث باسم الاستوديو…"}
              value={search}
              maxLength={200}
              onChange={(value) => changeFilter("q", value)}
              clearLabel="مسح بحث الأسماء"
            />
          }
        />
      }
      toolbar={
        <div className="flex flex-col gap-2" role="region" aria-label={`تصفية ${title}`}>
          <FieldGroup className="flex flex-row flex-wrap items-center gap-2">
            <Field className="min-w-32.5 flex-1 basis-32.5 lg:w-44 lg:flex-none">
              <FieldLabel htmlFor="studio-role" className="sr-only">
                {people ? "دور الصانع" : "دور الاستوديو"}
              </FieldLabel>
              <Choice
                id="studio-role"
                label={people ? "دور الصانع" : "دور الاستوديو"}
                value={role}
                options={[{ value: "all", label: "جميع الأدوار" }, ...roles]}
                onChange={(value) => changeFilter("role", value)}
              />
            </Field>
            {languages.length > 0 && (
              <Field className="min-w-32.5 flex-1 basis-32.5 lg:w-44 lg:flex-none">
                <FieldLabel htmlFor="entity-credit-language" className="sr-only">
                  لغة المساهمة
                </FieldLabel>
                <Choice
                  id="entity-credit-language"
                  label="لغة المساهمة"
                  value={language}
                  options={[
                    { value: "", label: "جميع لغات المساهمة" },
                    ...languages.map((value) => ({ value, label: languageName(value) })),
                  ]}
                  onChange={(value) => changeFilter("language", value)}
                />
              </Field>
            )}
            <Field className="min-w-32.5 flex-1 basis-32.5 lg:w-44 lg:flex-none">
              <FieldLabel htmlFor="studio-image" className="sr-only">
                {people ? "الصورة" : "الشعار"}
              </FieldLabel>
              <Choice
                id="studio-image"
                label={people ? "توفر صورة الصانع" : "توفر شعار الاستوديو"}
                value={image}
                options={[
                  { value: "all", label: people ? "كل الصور" : "كل الشعارات" },
                  { value: "with", label: people ? "بصورة" : "بشعار" },
                  { value: "without", label: people ? "بدون صورة" : "بدون شعار" },
                ]}
                onChange={(value) => changeFilter("image", value)}
              />
            </Field>
            <Field className="min-w-32.5 flex-1 basis-32.5 lg:w-44 lg:flex-none">
              <FieldLabel htmlFor="entity-sort" className="sr-only">
                الترتيب
              </FieldLabel>
              <Choice
                id="entity-sort"
                label={`ترتيب ${title}`}
                value={sort}
                options={[
                  { value: "count", label: "الأكثر أعمالًا" },
                  { value: "name", label: "الاسم أبجديًا" },
                ]}
                onChange={(value) => {
                  changeFilter("sort", value);
                }}
              />
            </Field>
            <div className="flex w-full flex-wrap items-center gap-2 lg:ms-auto lg:w-auto">
              <Popover>
                <PopoverTrigger
                  render={<Button variant="outline" aria-label={`خيارات عرض ${title}`} />}
                >
                  <SlidersHorizontal data-icon="inline-start" />
                  العرض
                </PopoverTrigger>
                <PopoverContent align="end">
                  <PopoverTitle>عرض البطاقات</PopoverTitle>
                  <FieldSet className="min-w-0 shrink-0 flex-row items-center gap-2">
                    <FieldLegend className="sr-only">حجم البطاقات</FieldLegend>
                    <span
                      className="whitespace-nowrap text-xs text-muted-foreground"
                      aria-hidden="true"
                    >
                      في الصف
                    </span>
                    <ToggleGroup
                      variant="outline"
                      size="sm"
                      spacing={0}
                      value={[size]}
                      aria-label={`حجم بطاقات ${title}`}
                      onValueChange={(values) => {
                        const next = values[0];
                        if (next === "large" || next === "medium" || next === "small")
                          changeFilter("size", next);
                      }}
                    >
                      <ToggleGroupItem
                        value="large"
                        aria-label="بطاقات كبيرة، 3 في الصف"
                        title="كبير: 3 بطاقات في الصف"
                      >
                        3
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="medium"
                        aria-label="بطاقات متوسطة، 4 في الصف"
                        title="متوسط: 4 بطاقات في الصف"
                      >
                        4
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="small"
                        aria-label="بطاقات صغيرة، 5 في الصف"
                        title="صغير: 5 بطاقات في الصف"
                      >
                        5
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FieldSet>
                  <Field orientation="horizontal" className="w-auto shrink-0">
                    <Switch
                      id="studio-square"
                      size="sm"
                      checked={square}
                      onCheckedChange={(checked) =>
                        changeFilter("shape", checked ? "square" : people ? "portrait" : "banner")
                      }
                    />
                    <FieldLabel htmlFor="studio-square" className="whitespace-nowrap">
                      صور مربعة
                    </FieldLabel>
                  </Field>
                </PopoverContent>
              </Popover>
              {isAdmin && (
                <Field orientation="horizontal" className="w-auto shrink-0">
                  <Switch
                    id="studio-hidden"
                    size="sm"
                    checked={privacy === "all"}
                    onCheckedChange={(checked) =>
                      changeFilter("privacy", checked ? "all" : "public")
                    }
                  />
                  <FieldLabel htmlFor="studio-hidden" className="whitespace-nowrap">
                    الأعمال المخفية
                  </FieldLabel>
                </Field>
              )}
            </div>
          </FieldGroup>
          {(result.isFetching || filtered || privacy === "all") && (
            <div className="flex min-h-8 flex-wrap items-center gap-2">
              <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                {result.isFetching
                  ? `جارٍ تحميل ${title}…`
                  : `${matches.length} من ${result.entities.length} ${people ? "صانع" : "استوديو"}`}
              </p>
              {privacy === "all" && <Badge variant="secondary">تشمل المخفية</Badge>}
              {filtered && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X data-icon="inline-start" />
                  مسح التصفية
                </Button>
              )}
            </div>
          )}
        </div>
      }
    >
      {result.error ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : result.isLoading ? (
        <p role="status" className="py-12 text-muted-foreground">
          جارٍ تحميل {title}…
        </p>
      ) : matches.length ? (
        <>
          <div
            className={cn(
              "entity-directory-grid grid gap-6 max-[1050px]:grid-cols-3 max-[1050px]:gap-4.5 max-[720px]:grid-cols-2",
              size === "large" && "grid-cols-3",
              size === "medium" && "grid-cols-4",
              size === "small" && "grid-cols-5 gap-4",
            )}
          >
            {matches.slice(0, limit).map((entity) => (
              <EntityCard
                key={entity.value}
                entity={entity}
                kind={people ? "person" : "studio"}
                href={`#/${path}/${encodeURIComponent(entity.value)}${params.size ? `?${params}` : ""}`}
                artworkLayout={square ? "square" : people ? "portrait" : "banner"}
                includePrivate={privacy === "all"}
              />
            ))}
          </div>
          <div className="entity-directory-footer flex flex-wrap items-center justify-between gap-4 mt-6 text-muted-foreground text-xs">
            <p role="status">
              {Math.min(limit, matches.length)} من {matches.length} {people ? "صانع" : "استوديو"}
            </p>
            {limit < matches.length && (
              <Button variant="outline" onClick={() => setLimit((value) => value + batchSize)}>
                عرض المزيد
              </Button>
            )}
          </div>
        </>
      ) : (
        <NoResults
          title={people ? "لا توجد أسماء مطابقة" : "لا توجد استوديوهات مطابقة"}
          description="جرّب اسمًا آخر أو امسح التصفية لعرض الجميع."
        />
      )}
    </CatalogPage>
  );
}

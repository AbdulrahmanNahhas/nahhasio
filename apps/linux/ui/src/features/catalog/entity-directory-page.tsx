import { cn } from "cn";
import { ArrowLeft, Building2, Search, Users, X } from "lucide-react";
import { useState } from "react";

import { languageName } from "@/lib/languages";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Choice } from "../../components/choice";
import { Failure, NoResults } from "../../components/status";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "../../components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { Switch } from "../../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { useIsAdmin } from "../account/use-is-admin";
import { replaceParams } from "../shell/navigation";
import { useEntityDirectory } from "./use-entity-directory";

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
  const Icon = people ? Users : Building2;
  const isAdmin = useIsAdmin();
  const privacy = isAdmin && params.get("privacy") === "all" ? "all" : "public";
  const result = useEntityDirectory(type, privacy);
  const navigation = useCardNavigation();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("count");
  const [limit, setLimit] = useState(24);
  const size =
    params.get("size") === "large" ? "large" : params.get("size") === "medium" ? "medium" : "small";
  const square = people ? params.get("shape") === "square" : params.get("shape") !== "banner";
  const language = params.get("language") ?? "";
  const languages = [
    ...new Set(result.entities.flatMap((entity) => entity.languages ?? [])),
  ].toSorted();
  const role = params.get("role") || (people ? "all" : "animation_studio");
  const image = ["all", "with", "without"].includes(params.get("image") ?? "")
    ? params.get("image")!
    : "with";
  const roles = Array.from(
    new Map(
      result.entities.flatMap((entity) =>
        (entity.roles ?? []).map((item) => [item.value, item] as const),
      ),
    ).values(),
  ).toSorted((a, b) => a.label.localeCompare(b.label, "ar"));
  const changeFilter = (
    key: "role" | "image" | "size" | "shape" | "privacy" | "language",
    value: string,
  ) => {
    const next = new URLSearchParams(params);
    const defaults = {
      role: people ? "all" : "animation_studio",
      image: "with",
      size: "small",
      cardAspect: people ? "portrait" : "square",
      privacy: "public",
      language: "",
    };
    const defaultValue = key === "shape" ? defaults.cardAspect : defaults[key];
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    setLimit(24);
    replaceParams(`/${path}`, next);
  };
  const filtered = Boolean(search.trim()) || role !== "all" || image !== "all" || Boolean(language);
  const clearFilters = () => {
    setSearch("");
    setLimit(24);
    const next = new URLSearchParams(params);
    next.delete("language");
    next.set("role", "all");
    next.set("image", "all");
    replaceParams(`/${path}`, next);
  };
  const matches = result.entities
    .filter(
      (entity) =>
        entity.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
        (role === "all"
          ? !language || entity.languages?.includes(language)
          : entity.roles?.some(
              (item) => item.value === role && (!language || item.languages?.includes(language)),
            )) &&
        (image === "all" || (image === "with" ? Boolean(entity.artworkId) : !entity.artworkId)),
    )
    .toSorted((a, b) =>
      sort === "name"
        ? a.label.localeCompare(b.label, "ar")
        : b.count - a.count || a.label.localeCompare(b.label, "ar"),
    );
  return (
    <section
      className="entity-directory max-w-380 mx-auto pt-12 px-10 pb-8 max-[720px]:py-7 max-[720px]:px-5"
      data-kind={path}
      aria-label={`صفحة ${title}`}
    >
      <header className="entity-directory-header flex items-start justify-between gap-5 mb-9 [&_h1]:font-display [&_h1]:text-[42px] [&_h1]:font-semibold [&_h1]:leading-[1.6] [&_h1]:mt-2 [&_p:not(.entity-eyebrow)]:max-w-162.5 [&_p:not(.entity-eyebrow)]:mt-2.5 [&_p:not(.entity-eyebrow)]:text-muted-foreground [&_p:not(.entity-eyebrow)]:text-sm [&_p:not(.entity-eyebrow)]:leading-[1.9] max-[720px]:flex-col max-[720px]:mb-6 max-[720px]:[&_h1]:text-[30px] max-[720px]:[&_p:not(.entity-eyebrow)]:text-xs">
        <div>
          <p className="entity-eyebrow flex items-center gap-2 text-primary text-xs">
            <Icon className="size-4" aria-hidden="true" />
            {people ? "من وراء الحكاية" : "من فكرة إلى الشاشة"}
          </p>
          <h1>{title}</h1>
          <p>
            {people
              ? "وجوه وأسماء تصنع عوالمنا. اكتشف أعمالهم في مكتبتك."
              : "بيوت الحكايات. اكتشف بصمة كل استوديو وأعماله في مكتبتك."}
          </p>
        </div>
        {result.data && (
          <Badge variant="outline">
            {result.entities.length} {people ? "صانع" : "استوديو"}
          </Badge>
        )}
      </header>
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <FieldGroup className="grid grid-cols-2 items-end gap-3 lg:grid-cols-5">
          <Field className="col-span-2">
            <FieldLabel htmlFor="entity-search" className="sr-only">
              ابحث في {title}
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="entity-search"
                aria-label={`ابحث في ${title}`}
                placeholder={people ? "ابحث باسم الصانع…" : "ابحث باسم الاستوديو…"}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setLimit(24);
                }}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
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
            <Field>
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
          <Field>
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
          <Field className="max-[640px]:col-span-2">
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
                setSort(value);
                setLimit(24);
              }}
            />
          </Field>
        </FieldGroup>
        <div className="grid min-w-0 grid-cols-1 items-center gap-x-6 gap-y-3 border-t border-border pt-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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
          <div
            role="group"
            aria-label={`خيارات عرض ${title}`}
            className="flex min-w-0 max-w-full flex-wrap items-center gap-x-5 gap-y-3"
          >
            <FieldSet className="min-w-0 shrink-0 flex-row items-center gap-2">
              <FieldLegend className="sr-only">حجم البطاقات</FieldLegend>
              <span className="whitespace-nowrap text-xs text-muted-foreground" aria-hidden="true">
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
            {isAdmin && (
              <Field orientation="horizontal" className="w-auto shrink-0">
                <Switch
                  id="studio-hidden"
                  size="sm"
                  checked={privacy === "all"}
                  onCheckedChange={(checked) => changeFilter("privacy", checked ? "all" : "public")}
                />
                <FieldLabel htmlFor="studio-hidden" className="whitespace-nowrap">
                  الأعمال المخفية
                </FieldLabel>
              </Field>
            )}
          </div>
        </div>
      </div>
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
              <a
                {...navigation}
                key={entity.value}
                href={`#/${path}/${encodeURIComponent(entity.value)}${params.size ? `?${params}` : ""}`}
                className="entity-directory-card flex flex-col min-w-0 rounded-[18px] [&:hover_.entity-card-copy_>_svg]:[transform:translateX(-3px)] [&:hover_.entity-card-copy_>_svg]:text-primary [&:hover_.entity-image-frame]:border-muted-foreground"
              >
                <div className="entity-image-frame relative overflow-hidden bg-card border border-border rounded-[18px] [&_>_span.entity-directory-image]:flex [&_>_span.entity-directory-image]:text-muted-foreground [&_>_span.entity-directory-image]:bg-card">
                  <Artwork
                    id={entity.artworkId}
                    studioLogo={!people}
                    alt=""
                    className={cn(
                      "entity-directory-image block w-full",
                      people && "object-cover object-top",
                      square ? "aspect-square" : people ? "aspect-[4_/_5]" : "aspect-video",
                    )}
                    fallback={
                      people ? (
                        <span
                          className="entity-monogram font-display text-[72px] font-semibold text-muted-foreground"
                          aria-hidden="true"
                        >
                          {entity.label.charAt(0)}
                        </span>
                      ) : (
                        <Building2 className="size-12" aria-hidden="true" />
                      )
                    }
                  />
                </div>
                <div className="entity-card-copy flex items-center justify-between gap-3 py-4 px-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:leading-[1.6] [&_h2]:wrap-anywhere [&_p]:mt-1.25 [&_p]:text-muted-foreground [&_p]:text-[11px] [&_>_svg]:text-muted-foreground [&_>_svg]:[transition:transform_150ms] max-[720px]:[&_h2]:text-sm motion-reduce:[&_>_svg]:transition-none">
                  <div className="min-w-0">
                    <h2 dir="auto">{entity.label}</h2>
                    <p>
                      {entity.count} {privacy === "all" ? "عمل في المكتبة" : "عمل عام في المكتبة"}
                    </p>
                  </div>
                  <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
          <div className="entity-directory-footer flex flex-wrap items-center justify-between gap-4 mt-6 text-muted-foreground text-xs">
            <p role="status">
              {Math.min(limit, matches.length)} من {matches.length} {people ? "صانع" : "استوديو"}
            </p>
            {limit < matches.length && (
              <Button variant="outline" onClick={() => setLimit((value) => value + 24)}>
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
    </section>
  );
}

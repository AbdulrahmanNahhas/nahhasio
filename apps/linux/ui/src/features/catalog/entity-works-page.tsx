import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowRight,
  Building2,
  Orbit,
  RectangleHorizontal,
  RectangleVertical,
  Users,
  Type,
} from "lucide-react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation, useLoadMoreNavigation } from "@/components/card-navigation";
import { Choice } from "@/components/choice";
import { MediaCard } from "@/components/media-card";
import { Failure, NoResults } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { gateway } from "@/lib/bridge";
import type { CatalogQuery } from "@/lib/bridge";

import { useIsAdmin } from "../account/use-is-admin";
import { replaceParams } from "../shell/navigation";
import { PublicPage } from "../shell/public-page";
import { sortChoices } from "./browse-refinements";
import { emptyFilters } from "./filter-model";
import { useEntityDirectory } from "./use-entity-directory";

/** One works layout for studio/person credits and planet collections. */
export function EntityWorksPage({
  type,
  id,
  params,
}: {
  type: "studios" | "contributors" | "planets";
  id: string;
  params: URLSearchParams;
}) {
  const studio = type === "studios";
  const planet = type === "planets";
  const path = planet ? "planets" : studio ? "studios" : "people";
  const label = planet ? "الكوكب" : studio ? "الاستوديو" : "الصانع";
  const plural = planet ? "الكواكب" : studio ? "الاستوديوهات" : "الصنّاع";
  const Icon = planet ? Orbit : studio ? Building2 : Users;
  const isAdmin = useIsAdmin();
  const privacy = isAdmin && params.get("privacy") === "all" ? "all" : "public";
  // Admin identity remains stable when hiding private-only works from the list.
  const directory = useEntityDirectory(type, isAdmin ? "all" : "public");
  const entity = directory.entities.find((item) => item.value === id);
  const planetInfo = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
    enabled: planet,
  });
  const selectedPlanet = planetInfo.data?.planets.find((item) => item.slug === id);
  const name = planet ? (selectedPlanet?.nameAr ?? label) : (entity?.label ?? label);
  const sort =
    sortChoices.find((item) => item.value === params.get("workSort"))?.value ?? "year-desc";
  const layout =
    params.get("workView") === "logo"
      ? "logo"
      : params.get("workView") === "banner"
        ? "banner"
        : "poster";
  const size =
    params.get("workSize") === "large"
      ? "large"
      : params.get("workSize") === "medium"
        ? "medium"
        : "small";
  const filters = { ...emptyFilters(), facets: [{ key: type, include: [id], exclude: [] }] };
  const query: CatalogQuery = { view: "works", privacy, sort, filters: JSON.stringify(filters) };
  const result = useInfiniteQuery({
    queryKey: ["catalog", "entity-works", type, id, query],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.browse({ ...query, page: pageParam, pageSize: 30 }, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
  });
  const items = result.data?.pages.flatMap((page) => page.items) ?? [];
  const total = result.data?.pages[0]?.total;
  const navigation = useCardNavigation();
  const loadMore = useLoadMoreNavigation();
  const update = (key: "workSort" | "workSize" | "workView" | "privacy", value: string) => {
    const next = new URLSearchParams(params);
    const defaults = {
      workSort: "year-desc",
      workSize: "small",
      workView: "poster",
      privacy: "public",
    };
    if (value === defaults[key]) next.delete(key);
    else next.set(key, value);
    replaceParams(`/${path}/${encodeURIComponent(id)}`, next);
  };
  const back = new URLSearchParams(params);
  for (const key of ["workSort", "workSize", "workView"]) back.delete(key);
  return (
    <PublicPage as="article">
      <a
        href={`#/${path}${back.size ? `?${back}` : ""}`}
        className="mb-6 inline-flex items-center gap-2 rounded-lg py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowRight className="size-4" aria-hidden="true" />
        العودة إلى {plural}
      </a>
      <header className="mb-8 flex items-center gap-6 max-[520px]:items-start max-[520px]:gap-4">
        {planet ? (
          <span
            className="grid size-36 shrink-0 place-items-center rounded-2xl bg-secondary font-emoji text-7xl max-[520px]:size-24 max-[520px]:text-5xl"
            role="img"
            aria-label={`رمز ${name}`}
          >
            {selectedPlanet?.icon || "🪐"}
          </span>
        ) : (
          <Artwork
            id={entity?.artworkId}
            alt={entity?.label ?? (studio ? "شعار الاستوديو" : "صورة الصانع")}
            studioLogo={studio}
            priority
            className={cn(
              "block size-36 shrink-0 rounded-xl max-[520px]:size-24",
              !studio && "object-cover object-top",
            )}
            fallback={<Icon className="size-10" aria-hidden="true" />}
          />
        )}
        <div className="flex min-w-0 flex-col gap-3">
          <h1
            className="font-display text-3xl leading-relaxed font-semibold wrap-anywhere sm:text-4xl"
            dir="auto"
          >
            {directory.isLoading ? "جارٍ التحميل…" : name}
          </h1>
          {!planet && entity?.roles?.length ? (
            <div
              className="flex flex-wrap gap-2"
              aria-label={studio ? "أدوار الاستوديو في المكتبة" : "أدوار الصانع في المكتبة"}
            >
              {entity.roles.map((role) => (
                <Badge key={role.value} variant="secondary">
                  {role.label}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground" role="status">
            {total === undefined
              ? "جارٍ تحميل الأعمال…"
              : `${total} ${privacy === "all" ? "عمل في المكتبة، تشمل الأعمال المخفية" : "عمل عام في المكتبة"}`}
          </p>
        </div>
      </header>
      {planet && planetInfo.error && (
        <Failure error={planetInfo.error} retry={() => void planetInfo.refetch()} />
      )}
      {directory.error && (
        <Failure error={directory.error} retry={() => void directory.refetch()} />
      )}
      <section aria-labelledby="entity-works-heading">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4">
          <h2 id="entity-works-heading" className="text-lg font-semibold">
            الأعمال
          </h2>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Choice
              label="ترتيب الأعمال"
              value={sort}
              options={sortChoices}
              onChange={(value) => update("workSort", value)}
            />
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[layout]}
              aria-label="طريقة عرض الأعمال"
              onValueChange={(values) => {
                if (values[0] === "poster" || values[0] === "banner" || values[0] === "logo")
                  update("workView", values[0]);
              }}
            >
              <ToggleGroupItem value="poster" aria-label="ملصقات" title="ملصقات">
                <RectangleVertical aria-hidden="true" />
              </ToggleGroupItem>
              <ToggleGroupItem value="banner" aria-label="لافتات" title="لافتات">
                <RectangleHorizontal aria-hidden="true" />
              </ToggleGroupItem>
              <ToggleGroupItem value="logo" aria-label="شعارات" title="شعارات">
                <Type aria-hidden="true" />
              </ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[size]}
              aria-label="حجم بطاقات الأعمال"
              onValueChange={(values) => {
                if (values[0] === "large" || values[0] === "medium" || values[0] === "small")
                  update("workSize", values[0]);
              }}
            >
              <ToggleGroupItem
                value="large"
                aria-label="كبير، 3 بطاقات في الصف"
                title="كبير: 3 في الصف"
              >
                3
              </ToggleGroupItem>
              <ToggleGroupItem
                value="medium"
                aria-label="متوسط، 4 بطاقات في الصف"
                title="متوسط: 4 في الصف"
              >
                4
              </ToggleGroupItem>
              <ToggleGroupItem
                value="small"
                aria-label="صغير، 5 بطاقات في الصف"
                title="صغير: 5 في الصف"
              >
                5
              </ToggleGroupItem>
            </ToggleGroup>
            {isAdmin && (
              <Field orientation="horizontal" className="w-auto shrink-0">
                <Switch
                  id="entity-private-works"
                  size="sm"
                  checked={privacy === "all"}
                  onCheckedChange={(checked) => update("privacy", checked ? "all" : "public")}
                />
                <FieldLabel htmlFor="entity-private-works" className="whitespace-nowrap">
                  الأعمال المخفية
                </FieldLabel>
              </Field>
            )}
          </div>
        </div>
        {result.error && <Failure error={result.error} retry={() => void result.refetch()} />}
        {result.isLoading && (
          <p role="status" className="py-10 text-muted-foreground">
            جارٍ تحميل الأعمال…
          </p>
        )}
        {!result.isLoading && !result.error && !items.length && (
          <NoResults
            title="لا توجد أعمال في هذا العرض"
            description={
              isAdmin && privacy === "public"
                ? "يمكنك تضمين الأعمال المخفية من شريط العرض."
                : "لا توجد أعمال متاحة في المكتبة."
            }
          />
        )}
        <div
          className={cn(
            "grid gap-x-5 gap-y-8 max-[1050px]:grid-cols-3 max-[720px]:grid-cols-2 max-[520px]:gap-x-3",
            size === "large" && "grid-cols-3",
            size === "medium" && "grid-cols-4",
            size === "small" && "grid-cols-5",
            layout === "banner" && "max-[720px]:grid-cols-1",
          )}
        >
          {items.map((item) => {
            const roles = planet
              ? []
              : (item.contributionRoles?.filter((role) => role.entityId === id) ?? []);
            return (
              <div key={item.work.id} className="flex min-w-0 flex-col gap-3">
                <MediaCard
                  entry={item}
                  layout={layout}
                  minimal={layout === "logo"}
                  borderless={layout === "logo"}
                />
                {roles.length > 0 && (
                  <div
                    className={layout === "logo" ? "sr-only" : "flex flex-wrap gap-1.5"}
                    aria-label={`دور ${name} في ${item.work.titleAr || item.work.canonicalTitle}`}
                  >
                    {roles.map((role) => (
                      <Badge key={role.value} variant="outline">
                        {role.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {result.hasNextPage && (
          <Button
            {...navigation}
            variant="outline"
            className="mx-auto mt-8 flex"
            aria-disabled={result.isFetchingNextPage}
            onClick={(event) => {
              if (result.isFetchingNextPage) return;
              if (loadMore)
                void loadMore(event.currentTarget, async () => {
                  await result.fetchNextPage();
                });
              else void result.fetchNextPage();
            }}
          >
            {result.isFetchingNextPage ? "جارٍ التحميل…" : "تحميل المزيد"}
          </Button>
        )}
      </section>
    </PublicPage>
  );
}

import { useQueries, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft } from "lucide-react";
import type { MouseEvent } from "react";
import { z } from "zod";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { Failure, NoResults } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gateway, type CatalogQuery } from "@/lib/bridge";

import { EntityCard } from "../catalog/entity-card";
import { compareEntityWorkCount } from "../catalog/use-entity-directory";
import { PlanetCards } from "../planets/planet-cards";
import { entityLink, workLink } from "../shell/navigation";
import type { pageDirectory } from "../shell/page-directory";
import { entityTypes } from "./search-entities";
import { searchCatalogFilters, type SearchType } from "./search-model";

const mediaScopes = ["works", "movies", "series"] as const;
const shelfSize = 6;
const peopleHref = "#/people?size=medium";
const studiosHref = "#/studios?shape=banner&size=medium&image=with&role=all";
const legacyRequestError = z.union([
  z.object({ status: z.literal(400) }),
  z.object({ code: z.literal("bad_request") }),
]);

function recentMediaOptions(scope: (typeof mediaScopes)[number], enabled: boolean) {
  const added = scope === "works";
  const filters = searchCatalogFilters(scope, !added);
  const query: CatalogQuery = {
    view: "works",
    sort: added ? "added-desc" : "latest-released-desc",
    privacy: "public",
    page: 1,
    pageSize: shelfSize,
  };

  return {
    queryKey: ["catalog", "search", "recent", scope],
    enabled,
    staleTime: 60_000,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      let page;
      try {
        page = await gateway.browse(
          {
            ...query,
            filters: JSON.stringify({ ...filters, requireBannerAndLogo: true }),
          },
          signal,
        );
      } catch (error) {
        // Older servers reject the artwork filter. Inspect a bounded page with the same artwork rule.
        if (!(error instanceof Error) || !legacyRequestError.safeParse(error.cause).success)
          throw error;
        page = await gateway.browse(
          { ...query, filters: JSON.stringify(filters), pageSize: 48 },
          signal,
        );
      }
      return page.items
        .flatMap(({ work }) =>
          work.banner && work.logo
            ? [{ work, bannerId: work.banner.id, logoId: work.logo.id }]
            : [],
        )
        .slice(0, shelfSize);
    },
  };
}

function followSearchLink(event: MouseEvent, href: string, choose: (href: string) => void) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  choose(href);
}

const shortcutStyle = cn(
  buttonVariants({ variant: "outline", size: "lg" }),
  "h-auto min-h-14 min-w-0 justify-start gap-3 py-3 pe-4 ps-6 whitespace-normal has-data-[icon=inline-start]:ps-6",
);

export function SearchStart({
  type,
  directory,
  choose,
}: {
  type: SearchType;
  directory: ReturnType<typeof pageDirectory>;
  choose: (href: string) => void;
}) {
  const navigation = useCardNavigation();
  const all = type === "all";
  const entityGroup = entityTypes.find((group) => group.type === type && group.type !== "planets");
  const recentMedia = useQueries({
    queries: mediaScopes.map((scope) => recentMediaOptions(scope, all || scope === type)),
  });
  const recent = recentMedia[mediaScopes.findIndex((scope) => scope === (all ? "works" : type))];
  const studios = type === "studios";
  const facets = useQuery({
    queryKey: studios
      ? ["catalog", "facets", "works", "public"]
      : ["catalog", "facets", "works", "public", "added-desc"],
    enabled: Boolean(entityGroup),
    staleTime: 60_000,
    queryFn: ({ signal }) =>
      gateway.facets(
        { view: "works", privacy: "public", sort: studios ? undefined : "added-desc" },
        signal,
      ),
  });
  const planetCatalog = useQuery({
    queryKey: ["catalog", "filters"],
    enabled: type === "planets",
    staleTime: 30_000,
    queryFn: ({ signal }) => gateway.filters(signal),
  });
  const entities =
    facets.data?.groups.find((group) => group.key === entityGroup?.key)?.options ?? [];
  const newEntities = entities
    .toSorted(
      (a, b) =>
        (Date.parse(b.entityCreatedAt ?? "") || 0) - (Date.parse(a.entityCreatedAt ?? "") || 0),
    )
    .slice(0, 8);
  const shortcuts = all
    ? directory.filter(({ path }) => ["browse", "releases", "downloads", "settings"].includes(path))
    : directory;
  const recentLabel =
    all || type === "works"
      ? "أضيف حديثًا"
      : type === "movies"
        ? "أفلام صدرت حديثًا"
        : "مسلسلات عُرضت حديثًا";

  return (
    <div className="flex flex-col gap-7">
      {recent && (
        <section className="flex flex-col gap-3" aria-label={recentLabel}>
          {all && <h3 className="font-display text-lg font-semibold">{recentLabel}</h3>}
          {recent.error && <Failure error={recent.error} retry={() => void recent.refetch()} />}
          {recent.isLoading && <Skeleton className="h-40" />}
          {recent.data?.length === 0 && (
            <NoResults
              title="لا توجد إضافات بهذه المواصفات"
              description="اكتب اسم العمل للبحث في المكتبة."
            />
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {recent.data?.slice(0, all ? 3 : shelfSize).map(({ work, bannerId, logoId }) => {
              const href = workLink(work.id);
              const title = work.titleAr ?? work.canonicalTitle;
              return (
                <a
                  {...navigation}
                  key={work.id}
                  href={href}
                  onClick={(event) => followSearchLink(event, href, choose)}
                  className="group/start-card flex min-w-0 flex-col gap-1.5 rounded-xl outline-none"
                >
                  <div className="relative isolate flex aspect-video items-end overflow-hidden rounded-xl bg-secondary px-3 pb-2.5 ring-1 ring-border transition-shadow group-hover/start-card:ring-foreground/60 group-focus-visible/start-card:ring-2 group-focus-visible/start-card:ring-ring sm:px-4 sm:pb-3 motion-reduce:transition-none">
                    <Artwork
                      id={bannerId}
                      alt=""
                      width={640}
                      className="absolute inset-0 -z-10 size-full object-cover"
                    />
                    <div className="absolute inset-0 -z-10 bg-linear-to-t from-background/85 to-transparent" />
                    <Artwork
                      id={logoId}
                      alt=""
                      width={320}
                      transparentFallback
                      className="h-8 w-3/5 object-contain object-right sm:h-12"
                    />
                  </div>
                  <span className="line-clamp-1 px-0.5 text-sm font-medium" dir="auto">
                    {title}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      )}
      {studios && (
        <section className="flex flex-col gap-5" aria-label="الاستوديوهات">
          {facets.error && <Failure error={facets.error} retry={() => void facets.refetch()} />}
          {facets.isLoading && <Skeleton className="h-28" />}
          {facets.data && !entities.some(({ artworkId }) => artworkId) && (
            <NoResults
              title="لا توجد استوديوهات بشعار"
              description="افتح دليل الاستوديوهات لرؤية جميع الاستوديوهات."
            />
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            {entities
              .filter(({ artworkId }) => artworkId)
              .toSorted(compareEntityWorkCount)
              .slice(0, 8)
              .map((studio) => {
                const href = entityLink("studios", studio.value);
                return (
                  <EntityCard
                    key={studio.value}
                    entity={studio}
                    kind="studio"
                    href={href}
                    artworkLayout="banner"
                    onClick={(event) => followSearchLink(event, href, choose)}
                  />
                );
              })}
          </div>
          <a
            {...navigation}
            href={studiosHref}
            className={cn(buttonVariants({ variant: "outline" }), "self-center")}
            onClick={(event) => followSearchLink(event, studiosHref, choose)}
          >
            صفحة الاستوديوهات
            <ArrowLeft data-icon="inline-end" />
          </a>
        </section>
      )}
      {entityGroup?.type === "people" && (
        <section className="flex flex-col gap-3" aria-label={entityGroup.label}>
          {facets.error && <Failure error={facets.error} retry={() => void facets.refetch()} />}
          {facets.isLoading && <Skeleton className="h-28" />}
          {facets.data && !newEntities.length && <NoResults title="لا توجد أسماء لعرضها" />}
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
            {newEntities.map((item) => {
              const href = entityLink(entityGroup.key, item.value);
              return (
                <EntityCard
                  key={item.value}
                  entity={item}
                  kind="person"
                  href={href}
                  artworkLayout="portrait"
                  compact
                  onClick={(event) => followSearchLink(event, href, choose)}
                />
              );
            })}
          </div>
          <a
            {...navigation}
            href={peopleHref}
            className={cn(buttonVariants({ variant: "outline" }), "self-center")}
            onClick={(event) => followSearchLink(event, peopleHref, choose)}
          >
            صفحة الصنّاع
            <ArrowLeft data-icon="inline-end" />
          </a>
        </section>
      )}
      {type === "planets" && (
        <section className="flex flex-col gap-3" aria-label="الكواكب">
          {planetCatalog.error && (
            <Failure error={planetCatalog.error} retry={() => void planetCatalog.refetch()} />
          )}
          {planetCatalog.isLoading && <Skeleton className="h-28" />}
          {planetCatalog.data?.planets.length === 0 && <NoResults title="لا توجد كواكب لعرضها" />}
          <PlanetCards planets={planetCatalog.data?.planets ?? []} compact onSelect={choose} />
        </section>
      )}
      {(all || type === "pages") && (
        <section className="flex flex-col gap-3" aria-label="انتقل إلى">
          {all && <h3 className="font-display text-lg font-semibold">انتقل إلى</h3>}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {shortcuts.map(({ href, label, icon: Icon }) => (
              <a
                {...navigation}
                key={href}
                href={href}
                className={shortcutStyle}
                onClick={(event) => followSearchLink(event, href, choose)}
              >
                <Icon data-icon="inline-start" />
                {label}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

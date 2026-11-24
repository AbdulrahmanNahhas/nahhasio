import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowRight, Pencil } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { Artwork } from "@/components/artwork";
import { Failure } from "@/components/status";
import { Button } from "@/components/ui/button";
import { offlineStatusOptions } from "@/features/player/saved-works-data";
import { navigate, replaceParams, useViewerRoute } from "@/features/shell/navigation";
import { gateway } from "@/lib/bridge";

import { CreatorsPanel } from "./creators-panel";
import { InstallmentsPanel } from "./installments-panel";
import { FilmOverview, OverviewPanel, WorkSynopsis } from "./overview-panel";
import { RecommendationsPanel } from "./recommendations-panel";
import { useWorkTracking } from "./use-work-tracking";
import { WorkDiscussion } from "./work-discussion";
import { WorkHero } from "./work-hero";
import { WorkSidebar } from "./work-sidebar";

const WorkEditor = lazy(() =>
  import("@/features/editor/work/work-detail-page").then(({ WorkDetailPage }) => ({
    default: WorkDetailPage,
  })),
);

function onBack() {
  if (window.history.length > 1) window.history.back();
  else navigate("/home");
}

export function WorkPage({ id, installmentId }: { id: string; installmentId?: string }) {
  const offline = useQuery(offlineStatusOptions());
  const result = useQuery({
    queryKey: ["work", id],
    networkMode: "always",
    queryFn: ({ signal }) => gateway.work(id, signal),
  });
  const tracking = useWorkTracking(id);
  const route = useViewerRoute();
  const episodeDetailsOpen = route.params.has("episode");
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
    select: (value) => value?.user,
  });
  const canEdit = session.data?.isAdmin === true && offline.data?.offline === false;
  const editing = canEdit && route.params.get("edit") === "1";
  const installments = useRef<HTMLElement>(null);
  const episodePageHeading = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const discussion = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => ({
    tab: route.params.get("tab"),
    overlays: route.params.has("episode") || route.params.has("panel"),
    installmentId,
  }));
  const didAlign = useRef(false);
  const previousEpisodeView = useRef(false);
  const work = result.data;
  const hasSeasons = work?.installments.some((item) => item.kind === "season") ?? false;
  const hasMovies = work?.installments.some((item) => item.kind === "movie") ?? false;
  const moviesOnly = hasMovies && !hasSeasons;
  const firstInstallment = work?.installments[0];
  const singleMovie =
    work?.installments.length === 1 && firstInstallment?.kind === "movie" ? firstInstallment : null;
  const fullEpisodes = route.params.get("view") === "episodes" && (!work || hasSeasons);
  const creditsSection = !fullEpisodes && work && work.contributions.length > 0 && (
    <div
      ref={credits}
      tabIndex={-1}
      className={cn(
        "min-w-0 scroll-mt-4 border-t border-border pt-8",
        singleMovie ? "xl:col-start-1" : "mt-12",
      )}
    >
      <CreatorsPanel work={work} />
    </div>
  );
  const artworkId = work?.banner?.id ?? work?.poster?.id;
  const workReady = Boolean(work);
  useEffect(() => {
    if (!workReady || editing || didAlign.current) return;
    didAlign.current = true;
    if (fullEpisodes || initial.overlays || initial.tab === "data" || initial.tab === "scores")
      return;
    const target =
      initial.tab === "creators"
        ? credits.current
        : initial.tab === "installments" || (!initial.tab && initial.installmentId)
          ? installments.current
          : null;
    if (target) target.scrollIntoView({ block: "start" });
  }, [workReady, editing, fullEpisodes, initial]);
  useEffect(() => {
    if (!workReady || editing || previousEpisodeView.current === fullEpisodes) return;
    previousEpisodeView.current = fullEpisodes;
    if (episodeDetailsOpen) return;
    const target = fullEpisodes ? episodePageHeading.current : installments.current;
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }, [workReady, editing, fullEpisodes, episodeDetailsOpen]);

  function changeEpisodeView(open: boolean) {
    const params = new URLSearchParams(route.params);
    params.delete("tab");
    params.delete("episode");
    if (open) {
      params.set("view", "episodes");
      navigate(`${route.path}?${params}`);
    } else {
      params.delete("view");
      replaceParams(route.path, params);
    }
  }

  function editMode(open: boolean) {
    const params = new URLSearchParams(route.params);
    if (open) {
      params.delete("view");
      params.delete("panel");
      params.delete("tab");
      params.delete("episode");
      params.set("edit", "1");
      params.set("section", "identity");
    } else {
      params.delete("edit");
      params.delete("section");
    }
    replaceParams(route.path, params);
  }

  if (editing) {
    return (
      <Suspense
        fallback={
          <p className="p-6" role="status">
            جارٍ تحميل المحرر…
          </p>
        }
      >
        <WorkEditor id={id} onExit={() => editMode(false)} />
      </Suspense>
    );
  }

  return (
    <article className="relative isolate min-h-dvh pb-16" aria-label="صفحة العمل">
      {artworkId && (
        <div className="pointer-events-none sticky top-0 -z-10 h-0" aria-hidden>
          <div className="absolute inset-x-0 top-0 h-dvh overflow-hidden">
            <Artwork
              id={artworkId}
              alt=""
              className="size-full scale-110 object-cover opacity-65 blur-3xl"
              transparentFallback
              priority
              width={320}
            />
            <div className="absolute inset-0 bg-linear-to-b from-background/55 to-background/80" />
          </div>
        </div>
      )}
      {!fullEpisodes && (
        <div className="absolute inset-x-5 top-4 z-10 flex flex-wrap justify-between gap-2 sm:inset-x-8 lg:inset-x-14">
          <Button
            variant="outline"
            size="sm"
            className="size-10 sm:h-8 sm:w-auto"
            aria-label="العودة إلى المكتبة"
            onClick={onBack}
          >
            <ArrowRight data-icon="inline-start" />
            <span className="hidden sm:inline">العودة إلى المكتبة</span>
          </Button>
          {canEdit && work && (
            <Button
              variant="outline"
              size="sm"
              className="size-10 sm:h-8 sm:w-auto"
              aria-label="تحرير العمل"
              onClick={() => editMode(true)}
            >
              <Pencil data-icon="inline-start" aria-hidden />
              <span className="hidden sm:inline">تحرير العمل</span>
            </Button>
          )}
        </div>
      )}
      {result.error && (
        <div className="px-6 pt-24">
          <Failure error={result.error} retry={() => void result.refetch()} />
        </div>
      )}
      {result.isLoading && (
        <p className="px-6 pt-24" role="status">
          جارٍ تحميل العمل…
        </p>
      )}
      {work && (
        <>
          {!fullEpisodes && <WorkHero work={work} tracking={tracking} />}
          <div id="work-sections" className="mx-auto max-w-screen-2xl px-6 pt-8 md:px-10 lg:px-14">
            {tracking.state.error && (
              <Failure error={tracking.state.error} retry={() => void tracking.state.refetch()} />
            )}
            {tracking.error && <Failure error={tracking.error} />}
            {fullEpisodes && (
              <div
                ref={episodePageHeading}
                tabIndex={-1}
                className="mb-4 flex scroll-mt-4 flex-col items-start gap-3"
              >
                <Button variant="ghost" size="sm" onClick={() => changeEpisodeView(false)}>
                  <ArrowRight data-icon="inline-start" aria-hidden />
                  العودة إلى العمل
                </Button>
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold sm:text-3xl">الحلقات</h1>
                  <p className="wrap-anywhere text-muted-foreground" dir="auto">
                    {work.titleAr || work.canonicalTitle}
                  </p>
                </div>
              </div>
            )}
            <div
              className={cn(
                "grid min-w-0 items-start gap-8",
                !fullEpisodes && "xl:grid-cols-[minmax(0,1fr)_18rem] xl:gap-8",
                singleMovie && "xl:grid-rows-[auto_1fr]",
              )}
            >
              <div className="flex min-w-0 flex-col gap-10">
                {singleMovie && <FilmOverview work={work} film={singleMovie} />}
                {!fullEpisodes && !singleMovie && <WorkSynopsis work={work} />}
                {!singleMovie && work.installments.length > 0 && (
                  <section
                    ref={installments}
                    tabIndex={-1}
                    aria-label="الأجزاء والإصدارات"
                    className={cn(
                      "min-w-0 scroll-mt-4",
                      !fullEpisodes && "border-t border-foreground/15 pt-6",
                    )}
                  >
                    <InstallmentsPanel
                      work={work}
                      initial={installmentId}
                      tracking={tracking}
                      fullEpisodes={fullEpisodes}
                      onShowAllEpisodes={() => changeEpisodeView(true)}
                    />
                  </section>
                )}
                {!fullEpisodes && <OverviewPanel work={work} />}
              </div>
              {!fullEpisodes && (
                <WorkSidebar
                  work={work}
                  className={
                    singleMovie ? "xl:col-start-2 xl:row-span-2 xl:row-start-1" : undefined
                  }
                  installments={!moviesOnly && work.installments.length ? installments : undefined}
                  credits={!moviesOnly && work.contributions.length ? credits : undefined}
                  discussion={
                    !moviesOnly && offline.data?.offline === false ? discussion : undefined
                  }
                />
              )}
              {singleMovie && creditsSection}
            </div>
            {!singleMovie && creditsSection}
            {!fullEpisodes && <RecommendationsPanel id={work.id} />}
            {!fullEpisodes && offline.isSuccess && (
              <div
                ref={discussion}
                tabIndex={-1}
                className="mt-12 min-w-0 scroll-mt-4 border-t border-border pt-8"
              >
                <div className="max-w-4xl">
                  <WorkDiscussion
                    key={work.id}
                    id={work.id}
                    accountId={session.data?.accountId}
                    offline={offline.data.offline}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}

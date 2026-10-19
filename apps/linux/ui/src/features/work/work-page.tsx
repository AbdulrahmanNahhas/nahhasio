import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Database,
  Film,
  LayoutPanelTop,
  Users,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { usePanelEntry } from "../../components/card-navigation";
import { Failure } from "../../components/status";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { gateway } from "../../lib/bridge";
import { offlineStatusOptions } from "../player/saved-works-data";
import { navigate, replaceParams, useViewerRoute } from "../shell/navigation";
import { ActivityPanel } from "./activity-panel";
import { CreatorsPanel } from "./creators-panel";
import { DataPanel } from "./data-panel";
import { RiskRows } from "./family-panel";
import { FieldList } from "./field-list";
import { audienceLabels, statusLabels } from "./format";
import { InstallmentsPanel } from "./installments-panel";
import { OverviewPanel } from "./overview-panel";
import { RecommendationsPanel } from "./recommendations-panel";
import { ScoresPanel } from "./scores-panel";
import { useWorkTracking } from "./use-work-tracking";
import { releaseStatus, WorkHero } from "./work-hero";

const tabs = [
  { key: "profile", label: "الملف", icon: LayoutPanelTop },
  { key: "installments", label: "الأجزاء", icon: Film },
  { key: "creators", label: "الصنّاع", icon: Users },
  { key: "scores", label: "التقييم", icon: ChartNoAxesCombined },
  { key: "data", label: "البيانات", icon: Database },
];
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
  const focusPanel = usePanelEntry();
  const route = useViewerRoute();
  const active =
    tabs.find((tab) => tab.key === route.params.get("tab"))?.key ??
    (installmentId ? "installments" : "profile");
  const back = useRef<HTMLButtonElement>(null);
  const sections = useRef<HTMLDivElement>(null);
  useEffect(() => {
    back.current?.focus({ preventScroll: true });
  }, []);
  const changeTab = (tab: string) => {
    const params = new URLSearchParams(route.params);
    params.delete("episode");
    if (tab === "profile") {
      params.delete("tab");
      params.delete("installment");
    } else params.set("tab", tab);
    replaceParams(`/titles/${id}`, params);
  };
  const episodes = () => {
    changeTab("installments");
    requestAnimationFrame(() => {
      sections.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      sections.current?.focus({ preventScroll: true });
    });
  };
  const work = result.data;
  return (
    <article className="relative isolate min-h-dvh pb-16" aria-label="صفحة العمل">
      <div className="absolute start-6 top-6 z-10 md:start-10 lg:start-14">
        <Button ref={back} variant="ghost" onClick={onBack}>
          <ArrowRight data-icon="inline-start" />
          العودة إلى المكتبة
        </Button>
      </div>
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
          <WorkHero work={work} tracking={tracking} onEpisodes={episodes} />
          <div
            ref={sections}
            id="work-sections"
            tabIndex={-1}
            className="mx-auto max-w-screen-2xl scroll-mt-6 px-6 outline-none md:px-10 lg:px-14"
          >
            <TabsPrimitive.Root
              data-horizontal=""
              orientation="horizontal"
              value={active}
              onValueChange={(value) => {
                const selected = tabs.find((tab) => tab.key === value);
                if (selected) changeTab(selected.key);
              }}
              className="group/tabs flex min-w-0 flex-col gap-8 md:gap-12"
            >
              <TabsList
                activateOnFocus
                aria-label="أقسام العمل"
                className="h-auto w-full max-w-full shrink-0 flex-wrap justify-start gap-2 rounded-2xl bg-muted/60 p-2 group-data-horizontal/tabs:h-auto"
                onKeyDownCapture={(event) => {
                  if (event.key !== "ArrowDown" || event.altKey || event.ctrlKey || event.metaKey)
                    return;
                  event.preventDefault();
                  event.stopPropagation();
                  requestAnimationFrame(() => focusPanel?.());
                }}
              >
                {tabs.map(({ key, label, icon: Icon }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="min-h-12 flex-1 basis-36 gap-2 px-4 py-3 data-active:bg-background"
                  >
                    <Icon aria-hidden="true" />
                    <span className="text-base md:text-lg">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {tracking.state.error && (
                <Failure error={tracking.state.error} retry={() => void tracking.state.refetch()} />
              )}
              {tracking.error && <Failure error={tracking.error} />}
              <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-10">
                <div className="min-h-dvh min-w-0">
                  <TabsContent value="profile">
                    <OverviewPanel work={work} tracking={tracking} />
                    {!offline.data?.offline && <ActivityPanel id={id} />}
                  </TabsContent>
                  <TabsContent value="installments">
                    <InstallmentsPanel work={work} initial={installmentId} tracking={tracking} />
                  </TabsContent>
                  <TabsContent value="creators">
                    <CreatorsPanel work={work} />
                  </TabsContent>
                  <TabsContent value="scores">
                    <ScoresPanel work={work} />
                  </TabsContent>

                  <TabsContent value="data">
                    <DataPanel work={work} />
                  </TabsContent>
                </div>
                <aside className="flex flex-col gap-6 xl:sticky xl:top-6" aria-label="لمحة العمل">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2 className="text-lg font-semibold">لمحة العمل</h2>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <FieldList
                        rows={[
                          ["الإصدار", work.releaseYear],
                          ["الحالة", statusLabels.get(releaseStatus(work))],
                          ["الأجزاء", work.installmentCount],
                          ["الحلقات", work.episodeCount],
                          ["الجمهور", audienceLabels.get(work.audience)],
                        ]}
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2 className="text-lg font-semibold">دليل الوالدين</h2>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <RiskRows classification={work} />
                    </CardContent>
                  </Card>
                </aside>
              </div>
            </TabsPrimitive.Root>
            <RecommendationsPanel id={work.id} />
          </div>
        </>
      )}
    </article>
  );
}

import { installmentRating } from "@arcadia/domain";
import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Lightbulb } from "lucide-react";

import { languageName } from "@/lib/languages";

import { useCardNavigation } from "../../components/card-navigation";
import { MediaCard } from "../../components/media-card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { gateway } from "../../lib/bridge";
import { workLink } from "../shell/navigation";
import { Disclosure, Section } from "./field-list";
import { pickArtwork, riskLabels } from "./format";
import type { WorkTracking } from "./use-work-tracking";

type Risk = WorkDetail["sexualityRisk"];
const riskRank = new Map<Risk, number>([
  ["none", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
]);
function highestRisk(risks: Risk[]) {
  return risks.toSorted((left, right) => (riskRank.get(right) ?? 0) - (riskRank.get(left) ?? 0))[0];
}
function riskClasses(risk: Risk) {
  if (risk === "low") return "border-success/70 bg-success/5 ring-0";
  if (risk === "medium") return "border-warning/70 bg-warning/5 ring-0";
  if (risk === "high") return "border-destructive/70 bg-destructive/5 ring-0";
  return "border-border";
}
function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto border px-3 py-1 text-sm",
        risk === "low" && "border-success/60 bg-success/10 text-success",
        risk === "medium" && "border-warning/60 bg-warning/10 text-warning",
        risk === "high" && "border-destructive/60 bg-destructive/10 text-destructive",
      )}
    >
      {riskLabels.get(risk)}
    </Badge>
  );
}
function RiskNote({ title, text, risks }: { title: string; text: string; risks: Risk[] }) {
  const severity = highestRisk(risks);
  return (
    <Card className={cn("border", riskClasses(severity))}>
      <CardHeader>
        <CardTitle>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <RiskBadge risk={severity} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className="text-base leading-loose whitespace-pre-line wrap-anywhere md:text-lg"
          dir="auto"
        >
          {text}
        </p>
      </CardContent>
    </Card>
  );
}

export function OverviewPanel({ work, tracking }: { work: WorkDetail; tracking: WorkTracking }) {
  const terms = [...work.genres, ...work.tones, ...work.tags].filter((term) => term.labelAr.trim());
  return (
    <div className="flex min-w-0 flex-col gap-8 md:gap-12">
      {((work.dubLanguages?.length ?? 0) > 0 ||
        work.dubbingNotes ||
        work.playbackPolicy === "files-only") && (
        <Section title="الصوت والدبلجة">
          <div className="flex flex-wrap gap-2">
            {work.playbackPolicy === "files-only" && (
              <Badge variant="outline">التشغيل من الملفات</Badge>
            )}
            {work.dubLanguages?.map((language) => (
              <Badge variant="secondary" key={language}>
                {languageName(language)}
              </Badge>
            ))}
          </div>
          {work.dubbingNotes && (
            <p dir="auto" className="mt-3 whitespace-pre-line text-muted-foreground">
              {work.dubbingNotes}
            </p>
          )}
        </Section>
      )}
      {Boolean(work.trailers?.length) && (
        <Section title="الإعلانات التشويقية">
          <div className="flex flex-wrap gap-3">
            {work.trailers?.map((trailer) => (
              <Button
                key={trailer.id}
                variant="outline"
                render={
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                {trailer.title || "مشاهدة الإعلان"}
                {trailer.language ? ` · ${languageName(trailer.language)}` : ""}
                {trailer.isPrimary ? " · الرئيسي" : ""}
              </Button>
            ))}
          </div>
        </Section>
      )}
      {(work.summary.trim() || terms.length > 0) && (
        <section className="flex min-w-0 flex-col gap-6" aria-label="نبذة العمل">
          {work.summary.trim() && (
            <p
              className="text-lg leading-loose whitespace-pre-line wrap-anywhere lg:text-xl"
              dir="auto"
            >
              {work.summary}
            </p>
          )}
          {terms.length > 0 && (
            <div className="flex flex-wrap gap-3" aria-label="الأنواع والطابع والوسوم">
              {terms.map((term) => (
                <Badge
                  key={term.id}
                  variant="secondary"
                  className="h-auto max-w-full px-4 py-2 text-base whitespace-normal wrap-anywhere"
                >
                  {term.labelAr}
                </Badge>
              ))}
            </div>
          )}
        </section>
      )}
      {(work.contentWarnings?.trim() || work.analysisNotes?.trim()) && (
        <div className="grid gap-6 xl:grid-cols-2">
          {work.contentWarnings?.trim() && (
            <RiskNote
              title="تنبيه المحتوى"
              text={work.contentWarnings}
              risks={[work.sexualityRisk, work.behavioralRisk]}
            />
          )}
          {work.analysisNotes?.trim() && (
            <RiskNote
              title="ملاحظات التحليل"
              text={work.analysisNotes}
              risks={[work.theologyRisk]}
            />
          )}
        </div>
      )}
      {work.curatorNotes?.trim() && (
        <Disclosure title="ملاحظة المحرر">
          <p className="text-base leading-loose whitespace-pre-line wrap-anywhere" dir="auto">
            {work.curatorNotes}
          </p>
        </Disclosure>
      )}
      {work.trivia.length > 0 && (
        <Section title="حقائق ومعلومات">
          <div className="grid gap-5 xl:grid-cols-2">
            {work.trivia.map((fact) => (
              <Card key={fact}>
                <CardHeader>
                  <CardTitle>
                    <Lightbulb aria-label="معلومة" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base leading-loose md:text-lg">{fact}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}
      {work.installments.length > 0 && (
        <Section title="الأجزاء والمواسم">
          <InstallmentTiles work={work} tracking={tracking} />
        </Section>
      )}
      {work.relations.length > 0 && (
        <Section title="الأعمال المرتبطة">
          <RelatedWorks work={work} />
        </Section>
      )}
    </div>
  );
}

export function InstallmentTiles({ work, tracking }: { work: WorkDetail; tracking: WorkTracking }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
      {work.installments.map((unit) => {
        const rating = installmentRating(unit.scores ?? {});
        return (
          <MediaCard
            key={unit.id}
            entry={{
              work,
              installment: {
                id: unit.id,
                workId: work.id,
                workTitle: work.canonicalTitle,
                workTitleAr: work.titleAr,
                title: unit.title,
                kind: unit.kind,
                releaseDate: unit.releaseDate,
                runtimeMinutes: unit.runtimeMinutes,
                episodeCount: unit.episodes.length,
                poster: pickArtwork(unit.artwork, "poster") ?? work.poster,
                score: { rating, scored: rating === null ? 0 : 1, total: 1 },
              },
              classification: unit.classification,
              status: unit.status,
              watchState:
                tracking.state.data?.installments.find((item) => item.installmentId === unit.id)
                  ?.summary.watchState ?? "unknown",
              criteria: {
                story: unit.scores?.story ?? null,
                characters: unit.scores?.characters ?? null,
                depth: unit.scores?.depth ?? null,
                worldBuilding: unit.scores?.worldBuilding ?? null,
                originality: unit.scores?.originality ?? null,
                craft: unit.scores?.craft ?? null,
              },
            }}
          />
        );
      })}
    </div>
  );
}

function RelatedWorks({ work }: { work: WorkDetail }) {
  // Keep metadata requests bounded even for unusually large relation lists.
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {work.relations.map((relation) => (
        <RelatedWork key={relation.id} relation={relation} />
      ))}
    </div>
  );
}
const relationLabels = new Map([
  ["sequel", "تكملة"],
  ["prequel", "عمل سابق"],
  ["adaptation", "اقتباس"],
  ["spin-off", "عمل مشتق"],
  ["side-story", "قصة جانبية"],
  ["alternative", "نسخة بديلة"],
  ["related", "عمل مرتبط"],
  ["compilation", "تجميع"],
]);
function RelatedWork({ relation }: { relation: WorkDetail["relations"][number] }) {
  const navigation = useCardNavigation();
  const related = useQuery({
    queryKey: ["work", relation.workId],
    queryFn: ({ signal }) => gateway.work(relation.workId, signal),
    enabled: false,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <a {...navigation} href={workLink(relation.workId)} className="text-lg" dir="auto">
            {relation.titleAr || relation.canonicalTitle}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Badge variant="outline">{relationLabels.get(relation.kind) ?? "عمل مرتبط"}</Badge>
        {relation.notes && <p className="text-base leading-relaxed">{relation.notes}</p>}
        {related.data ? (
          <MediaCard work={related.data} layout="banner" />
        ) : (
          <Button
            {...navigation}
            variant="ghost"
            onClick={() => void related.refetch()}
            disabled={related.isFetching}
          >
            معاينة العمل
          </Button>
        )}
        {related.error && <p role="alert">تعذّرت المعاينة. افتح صفحة العمل للمحاولة مجددًا.</p>}
      </CardContent>
    </Card>
  );
}

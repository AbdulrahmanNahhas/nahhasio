import type { Installment, WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { LanguageBadges } from "../../components/language-badges";
import { MediaCard } from "../../components/media-card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import { gateway } from "../../lib/bridge";
import { entityLink, workLink } from "../shell/navigation";
import { Disclosure, Section } from "./field-list";
import { dateLabel, pickArtwork } from "./format";

export function WorkSynopsis({ work }: { work: WorkDetail }) {
  const terms = [...work.tones, ...work.tags].filter((term) => term.labelAr.trim());
  if (!work.summary.trim() && terms.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-6" aria-label="نبذة العمل">
      {work.summary.trim() && (
        <p
          className="text-lg leading-loose whitespace-pre-line wrap-anywhere lg:text-xl"
          dir="auto"
        >
          {work.summary}
        </p>
      )}
      <SynopsisTags terms={terms} />
    </section>
  );
}

function SynopsisTags({ terms, compact }: { terms: WorkDetail["tags"]; compact?: boolean }) {
  if (!terms.length) return null;
  return (
    <div className={cn("flex flex-wrap", compact ? "gap-2" : "gap-3")} aria-label="الطابع والوسوم">
      {terms.map((term) => (
        <Badge
          key={term.id}
          variant="secondary"
          className={cn(
            "h-auto max-w-full whitespace-normal wrap-anywhere",
            compact ? "px-3 py-1 text-sm" : "px-4 py-2 text-base",
          )}
        >
          {term.labelAr}
        </Badge>
      ))}
    </div>
  );
}

export function FilmOverview({ work, film }: { work: WorkDetail; film: Installment }) {
  const navigation = useCardNavigation();
  const poster = pickArtwork(film.artwork, "poster") ?? work.poster;
  const synopsis = work.summary.trim() || film.summary.trim();
  const terms = [...work.tones, ...work.tags].filter((term) => term.labelAr.trim());
  const languages = (film.languages?.length ? film.languages : (work.languages ?? [])).filter(
    (language) => language.trim(),
  );
  const directors = new Map(
    work.contributions
      .filter(
        (credit) => credit.kind === "person" && credit.role === "director" && credit.name.trim(),
      )
      .map((credit) => [credit.id, credit.name]),
  );

  return (
    <Card
      role="region"
      aria-label="عن الفيلم"
      className={cn(
        "grid min-w-0 content-start gap-x-0 gap-y-4 bg-card/60",
        poster && "sm:grid-cols-[auto_minmax(0,1fr)]",
      )}
    >
      {poster && (
        <div className="row-span-2 ms-6 hidden w-28 self-start sm:block lg:w-36" aria-hidden>
          <Artwork
            id={poster.id}
            alt=""
            width={320}
            className="aspect-2/3 w-full rounded-xl object-cover"
          />
        </div>
      )}
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl font-semibold sm:text-2xl">عن الفيلم</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {synopsis && (
          <p
            className="max-w-3xl text-base leading-loose whitespace-pre-line wrap-anywhere sm:text-lg"
            dir="auto"
          >
            {synopsis}
          </p>
        )}
        <SynopsisTags terms={terms} compact />
        {(synopsis || terms.length > 0) && <Separator />}
        <dl className="flex min-w-0 flex-wrap gap-x-7 gap-y-3 text-base">
          {film.releaseDate && (
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">تاريخ الإصدار</dt>
              <dd className="mt-1">
                <time dateTime={film.releaseDate}>
                  <bdi>{dateLabel(film.releaseDate, "long")}</bdi>
                </time>
              </dd>
            </div>
          )}
          <div className="min-w-0">
            <dt className="text-sm text-muted-foreground">نوع الفيلم</dt>
            <dd className="mt-1">{work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"}</dd>
          </div>
          {languages.length > 0 && (
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">اللغات</dt>
              <dd className="mt-1">
                <LanguageBadges languages={languages} />
              </dd>
            </div>
          )}
          {directors.size > 0 && (
            <div className="min-w-0">
              <dt className="text-sm text-muted-foreground">الإخراج</dt>
              <dd className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {[...directors].map(([id, name]) => (
                  <a
                    {...navigation}
                    key={id}
                    href={entityLink("contributors", id)}
                    className="rounded-sm wrap-anywhere underline decoration-border underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-ring"
                    dir="auto"
                  >
                    {name}
                  </a>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

export function OverviewPanel({ work }: { work: WorkDetail }) {
  if (!work.dubbingNotes?.trim() && !work.relations.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-8 md:gap-12">
      {work.dubbingNotes?.trim() && (
        <Disclosure title="ملاحظات الدبلجة">
          <p className="text-base leading-loose whitespace-pre-line wrap-anywhere" dir="auto">
            {work.dubbingNotes}
          </p>
        </Disclosure>
      )}
      {work.relations.length > 0 && (
        <Section title="الأعمال المرتبطة">
          <RelatedWorks work={work} />
        </Section>
      )}
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
        <Badge variant="outline">
          {relationLabels.get(
            relation.kind === "sequel" && relation.direction === "incoming"
              ? "prequel"
              : relation.kind,
          ) ?? "عمل مرتبط"}
        </Badge>
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

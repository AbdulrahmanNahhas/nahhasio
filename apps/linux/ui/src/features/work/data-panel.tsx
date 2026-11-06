import type {
  ArtworkAssignment,
  AwardRecognition,
  ExternalReference,
  MediaFile,
  Vocabulary,
  WorkDetail,
} from "@nahhasio/api-contract";
import { ArrowUpLeft, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { planetPalette } from "@/lib/catalog-colors";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Badge } from "../../components/ui/badge";
import { entityLink, workLink } from "../shell/navigation";
import { Disclosure, FieldList, Section } from "./field-list";
import { artworkRoleLabels, dateLabel, safeExternalUrl } from "./format";

function RecordedFields({ rows }: { rows: Array<[string, ReactNode]> }) {
  const recorded = rows.filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );
  return recorded.length ? <FieldList rows={recorded} /> : null;
}

function SourceLink({ url, label }: { url: string | null | undefined; label?: string }) {
  if (!url) return null;
  const safe = safeExternalUrl(url);
  if (!safe) return <bdi>{url}</bdi>;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm text-primary underline underline-offset-4 wrap-anywhere focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <bdi>{label || url}</bdi>
      <span className="sr-only"> · يفتح في نافذة جديدة</span>
    </a>
  );
}

export function References({ items }: { items: ExternalReference[] }) {
  if (!items.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-5"
          >
            <strong className="text-base" dir="auto">
              {safeExternalUrl(item.url) ? (
                <SourceLink url={item.url} label={item.provider} />
              ) : (
                item.provider
              )}
            </strong>
            {item.externalId && (
              <bdi className="text-base text-muted-foreground wrap-anywhere">{item.externalId}</bdi>
            )}
            {item.url && !safeExternalUrl(item.url) && (
              <bdi className="text-sm text-muted-foreground wrap-anywhere">{item.url}</bdi>
            )}
          </li>
        ))}
      </ul>
      <Disclosure title="معرّفات المراجع">
        <RecordedFields rows={items.map((item) => [item.provider || item.externalId, item.id])} />
      </Disclosure>
    </div>
  );
}

export function MediaFiles({ files }: { files: MediaFile[] }) {
  if (!files.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {files.map((file) => (
        <Disclosure
          key={file.id}
          title={
            <>
              فيديو مسجّل
              {file.durationSeconds !== null && (
                <> · {Math.round(file.durationSeconds / 60)} دقيقة</>
              )}
            </>
          }
        >
          <RecordedFields
            rows={[
              ["المدة بالثواني", file.durationSeconds],
              ["معرّف الملف", file.id],
            ]}
          />
          {file.tracks.map((track) => (
            <Disclosure
              key={track.id}
              title={
                <>
                  {track.kind === "audio" ? "صوت" : track.kind === "subtitle" ? "ترجمة" : "فيديو"} ·{" "}
                  {track.title || track.language || track.streamIndex}
                </>
              }
            >
              <RecordedFields
                rows={[
                  ["اللغة", track.language],
                  ["الترميز", track.codec],
                  ["رقم المسار", track.streamIndex],
                  ["افتراضي", track.isDefault ? "نعم" : "لا"],
                  ["إجباري", track.isForced ? "نعم" : "لا"],
                  ["معرّف المسار", track.id],
                ]}
              />
            </Disclosure>
          ))}
        </Disclosure>
      ))}
    </div>
  );
}

export function ArtworkGallery({ images }: { images: ArtworkAssignment[] }) {
  if (!images.length) return null;
  return (
    <div className="grid min-w-0 gap-6 sm:grid-cols-2 2xl:grid-cols-3">
      {images.map((image) => (
        <figure className="flex min-w-0 flex-col gap-3" key={`${image.id}:${image.role}`}>
          <Artwork
            id={image.id}
            alt={image.originalFilename || artworkRoleLabels.get(image.role) || image.role}
            className="aspect-video w-full rounded-xl bg-card object-contain"
          />
          <figcaption className="flex flex-wrap items-center gap-2 text-base">
            <span>{artworkRoleLabels.get(image.role) || image.role}</span>
            {image.isPrimary && <Badge variant="secondary">رئيسية</Badge>}
          </figcaption>
          <Disclosure title="تفاصيل الملف">
            <RecordedFields
              rows={[
                ["اسم الملف", image.originalFilename],
                [
                  "الأبعاد",
                  image.width > 0 && image.height > 0 ? (
                    <bdi key="dimensions">
                      {image.width} × {image.height} px
                    </bdi>
                  ) : null,
                ],
                ["الحجم بالبايت", image.byteSize > 0 ? image.byteSize : null],
                ["الصيغة", image.mimeType],
                ["موضع التركيز الأفقي", image.focalX],
                ["موضع التركيز العمودي", image.focalY],
                ["الرابط المسجّل", image.url ? <SourceLink key="url" url={image.url} /> : null],
                ["معرّف الصورة", image.id],
                ["بصمة الصورة", image.sha256],
              ]}
            />
          </Disclosure>
        </figure>
      ))}
    </div>
  );
}

function VocabularyGroup({ title, items }: { title: string; items: Vocabulary[] }) {
  const arabic = items.filter((item) => item.labelAr.trim());
  if (!arabic.length) return null;
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-3">
        {arabic.map((item) => (
          <Badge
            key={item.id}
            variant="secondary"
            className="h-auto max-w-full px-4 py-2 text-base whitespace-normal wrap-anywhere"
          >
            {item.labelAr}
          </Badge>
        ))}
      </div>
    </Section>
  );
}

type Source = { label: string; url: string };

function externalSources(work: WorkDetail): Source[] {
  const sources: Source[] = [];
  const { imdbId, tmdbId, anilistId, malId } = work.externalIds;
  if (imdbId && /^tt\d+$/.test(imdbId.trim()))
    sources.push({ label: "IMDb", url: `https://www.imdb.com/title/${imdbId.trim()}/` });
  if (tmdbId !== null && Number.isSafeInteger(tmdbId) && tmdbId > 0) {
    // Match the dashboard's series/movie convention; the contract has no provider media type.
    const series = work.installments.some((unit) => unit.kind === "season");
    sources.push({
      label: "TMDB",
      url: `https://www.themoviedb.org/${series ? "tv" : "movie"}/${tmdbId}`,
    });
  }
  if (anilistId !== null && Number.isSafeInteger(anilistId) && anilistId > 0)
    sources.push({ label: "AniList", url: `https://anilist.co/anime/${anilistId}` });
  if (malId !== null && Number.isSafeInteger(malId) && malId > 0)
    sources.push({ label: "MyAnimeList", url: `https://myanimelist.net/anime/${malId}` });
  for (const reference of work.externalReferences) {
    const url = safeExternalUrl(reference.url);
    if (url && !sources.some((source) => source.url === url))
      sources.push({ label: reference.provider.trim() || "مصدر مسجّل", url });
  }
  return sources;
}

function ExternalSources({ work }: { work: WorkDetail }) {
  const navigation = useCardNavigation();
  const sources = externalSources(work);
  if (!sources.length && !work.externalReferences.length) return null;
  return (
    <Section title="المصادر الخارجية">
      {sources.length > 0 && (
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {sources.map((source) => (
            <li key={source.url} className="flex min-w-0">
              <a
                {...navigation}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-w-0 flex-1 items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex min-w-0 flex-col gap-2">
                  <strong className="text-lg font-semibold wrap-anywhere">
                    <bdi>{source.label}</bdi>
                  </strong>
                  <span className="text-sm text-muted-foreground">زيارة صفحة العمل</span>
                  <span className="sr-only">يفتح في نافذة جديدة</span>
                </span>
                <ExternalLink aria-hidden="true" className="size-5 shrink-0 text-primary" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {work.externalReferences.length > 0 && (
        <Disclosure title="تفاصيل المراجع المسجّلة">
          <References items={work.externalReferences} />
        </Disclosure>
      )}
    </Section>
  );
}

function WorkPlanetCard({ planet }: { planet: WorkDetail["planets"][number] }) {
  const navigation = useCardNavigation();
  return (
    <a
      {...navigation}
      href={entityLink("planets", planet.slug)}
      aria-label={`أعمال كوكب ${planet.nameAr}`}
      className="bg-(--planet-secondary) border-(--planet-border) text-(--planet) group relative flex min-h-52 min-w-0 flex-col gap-5 overflow-hidden rounded-3xl border p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      style={planetPalette(planet.primaryColor, planet.secondaryColor)}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -end-8 size-44 rounded-full border border-current/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-8 -end-4 size-36 rounded-full border border-current/10"
      />
      <div className="relative flex items-start justify-between gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-2xl border border-current/25 bg-background/45 text-3xl"
        >
          {planet.icon || "🪐"}
        </span>
        {planet.featuredRank !== null && <Badge variant="secondary">عمل بارز في الكوكب</Badge>}
      </div>
      <div className="relative flex flex-1 flex-col gap-3">
        <h3 className="text-xl font-semibold text-foreground wrap-anywhere" dir="auto">
          {planet.nameAr}
        </h3>
        {planet.description?.trim() && (
          <p
            className="text-base leading-relaxed text-foreground whitespace-pre-line wrap-anywhere"
            dir="auto"
          >
            {planet.description}
          </p>
        )}
      </div>
      <span className="relative inline-flex items-center justify-between gap-3 text-sm text-foreground">
        استكشف أعمال الكوكب
        <ArrowUpLeft aria-hidden="true" className="size-5 shrink-0 text-current" />
      </span>
    </a>
  );
}

function Award({ award, work }: { award: AwardRecognition; work: WorkDetail }) {
  const installment = work.installments.find((unit) => unit.id === award.installmentId);
  const category = award.category || award.awardCategory?.nameAr || award.awardCategory?.nameEn;
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h3 className="text-lg font-semibold wrap-anywhere" dir="auto">
            {award.organizationName || award.organization?.nameAr || award.organization?.nameEn}
          </h3>
          {category && (
            <p className="text-base text-muted-foreground" dir="auto">
              {category}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={award.result === "winner" ? "default" : "outline"}>
            {award.result === "winner" ? "فائز" : "مرشّح"}
          </Badge>
          {award.isFeatured && <Badge variant="secondary">تكريم بارز</Badge>}
          {award.year !== null && (
            <span className="text-base text-muted-foreground">{award.year}</span>
          )}
        </div>
      </header>
      {installment && (
        <a
          href={workLink(work.id, installment.id)}
          className="w-fit rounded-sm text-base text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <bdi>{installment.title}</bdi>
        </a>
      )}
      {award.notes?.trim() && (
        <p
          className="text-base leading-loose whitespace-pre-line wrap-anywhere md:text-lg"
          dir="auto"
        >
          {award.notes}
        </p>
      )}
      {award.sourceUrl && <SourceLink url={award.sourceUrl} label="مصدر التكريم" />}
      <Disclosure title="عن الجائزة والحفل">
        <RecordedFields
          rows={[
            [
              "الجهة بالعربية",
              award.organization?.nameAr !== award.organizationName
                ? award.organization?.nameAr
                : null,
            ],
            [
              "الجهة بالإنجليزية",
              award.organization?.nameEn !== award.organizationName
                ? award.organization?.nameEn
                : null,
            ],
            ["وصف الجهة", award.organization?.description],
            [
              "موقع الجهة",
              award.organization?.websiteUrl ? (
                <SourceLink key="website" url={award.organization.websiteUrl} />
              ) : null,
            ],
            [
              "الفئة بالعربية",
              award.awardCategory?.nameAr !== category ? award.awardCategory?.nameAr : null,
            ],
            [
              "الفئة بالإنجليزية",
              award.awardCategory?.nameEn !== category ? award.awardCategory?.nameEn : null,
            ],
            ["وصف الفئة", award.awardCategory?.description],
            ["الحفل", award.ceremony?.label],
            ["سنة الحفل", award.ceremony?.year],
            ["تاريخ الحفل", award.ceremony?.heldOn ? dateLabel(award.ceremony.heldOn) : null],
            ["إصدار الحفل", award.ceremony?.edition],
            [
              "مصدر الحفل",
              award.ceremony?.sourceUrl ? (
                <SourceLink key="ceremony" url={award.ceremony.sourceUrl} />
              ) : null,
            ],
            ["ترتيب التكريم", award.position],
            ["رمز الجهة", award.organizationSlug],
            [
              "رمز جهة الجائزة",
              award.organization?.slug !== award.organizationSlug ? award.organization?.slug : null,
            ],
            ["رمز الفئة", award.awardCategory?.slug],
            ["معرّف التكريم", award.id],
            ["معرّف الجهة", award.organization?.id],
            ["معرّف الفئة", award.awardCategory?.id],
            ["معرّف الحفل", award.ceremony?.id],
            ["معرّف الجزء", award.installmentId],
          ]}
        />
      </Disclosure>
    </article>
  );
}

export function DataPanel({ work }: { work: WorkDetail }) {
  return (
    <div className="min-w-0">
      <ExternalSources work={work} />
      <div className="grid min-w-0 gap-x-8 lg:grid-cols-2">
        <VocabularyGroup title="الأنواع الفنية" items={work.genres} />
        <VocabularyGroup title="الطابع" items={work.tones} />
        <VocabularyGroup title="الوسوم" items={work.tags} />
        <VocabularyGroup title="البلدان" items={work.countries} />
      </div>
      {work.planets.length > 0 && (
        <Section title="الكواكب">
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            {work.planets.map((planet) => (
              <WorkPlanetCard key={planet.id} planet={planet} />
            ))}
          </div>
        </Section>
      )}
      {work.awards.length > 0 && (
        <Section title="الجوائز والتكريمات">
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {work.awards.map((award) => (
              <Award key={award.id} award={award} work={work} />
            ))}
          </div>
        </Section>
      )}
      {(work.installmentCount > 0 || work.episodeCount > 0) && (
        <Disclosure title="حجم العمل">
          <RecordedFields
            rows={[
              ["الأجزاء", work.installmentCount > 0 ? work.installmentCount : null],
              ["الحلقات", work.episodeCount > 0 ? work.episodeCount : null],
            ]}
          />
        </Disclosure>
      )}
    </div>
  );
}

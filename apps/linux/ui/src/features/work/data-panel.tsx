import type {
  ArtworkAssignment,
  AwardRecognition,
  ExternalReference,
  MediaFile,
  Vocabulary,
  WorkDetail,
} from "@nahhasio/api-contract";
import { cn } from "cn";
import {
  Award as AwardIcon,
  ExternalLink,
  Film,
  Info,
  Tags,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useId, type ReactNode } from "react";

import { languageName, workLanguages } from "@/lib/languages";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { workLink } from "../shell/navigation";
import { Disclosure, FieldList } from "./field-list";
import {
  ageLabel,
  artworkRoleLabels,
  audienceLabels,
  dateLabel,
  safeExternalUrl,
  statusLabels,
} from "./format";
import { WorkBrowseChips } from "./work-browse-chips";
import { WorkGenres } from "./work-genres";

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

const detailChip = "h-auto min-h-8 max-w-full px-3 py-1 whitespace-normal wrap-anywhere";

export function DetailGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const heading = useId();
  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby={heading}>
      <h2 id={heading} className="flex items-center gap-2 text-base font-semibold">
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function ClassificationRow({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", wide && "sm:col-span-2")}>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const countryNames = new Intl.DisplayNames(["ar"], { type: "region", fallback: "none" });

function VocabularyGroup({
  title,
  items,
  facet,
}: {
  title: string;
  items: Vocabulary[];
  facet: "tones" | "tags" | "countries";
}) {
  const options = items.flatMap((item) => {
    const label = item.labelAr.trim();
    const region =
      facet === "countries"
        ? [item.slug, item.labelEn, label].find((value) => /^[a-z]{2}$/i.test(value))?.toUpperCase()
        : undefined;
    const country = region ? countryNames.of(region) : undefined;
    const name = country && (!label || label.toUpperCase() === region) ? country : label;
    if (!item.slug || !name) return [];
    return [
      {
        value: item.slug,
        label: name,
        icon:
          country && region ? (
            <span className="shrink-0" data-icon="inline-start" aria-hidden>
              {String.fromCodePoint(
                ...[...region].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65),
              )}
            </span>
          ) : undefined,
      },
    ];
  });
  if (!options.length) return null;
  return (
    <ClassificationRow title={title}>
      <WorkBrowseChips label={title} facet={facet} options={options} />
    </ClassificationRow>
  );
}

function LanguageGroup({
  title,
  facet,
  languages,
}: {
  title: string;
  facet: "languages" | "dubLanguages";
  languages: string[];
}) {
  const options = [...new Set(languages.filter(Boolean))].map((value) => ({
    value,
    label: languageName(value),
  }));
  if (!options.length) return null;
  return (
    <ClassificationRow title={title}>
      <WorkBrowseChips label={title} facet={facet} options={options} />
    </ClassificationRow>
  );
}

function Award({ award, work }: { award: AwardRecognition; work: WorkDetail }) {
  const navigation = useCardNavigation();
  const installment = work.installments.find((unit) => unit.id === award.installmentId);
  const recordedCategory = award.category.trim();
  const categorySlug = /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(recordedCategory);
  const category =
    award.awardCategory?.nameAr?.trim() ||
    (!categorySlug && recordedCategory) ||
    award.awardCategory?.nameEn?.trim() ||
    recordedCategory.replaceAll("-", " ");
  const organization =
    award.organizationName.trim() || award.organization?.nameAr || award.organization?.nameEn;
  const year = award.year ?? award.ceremony?.year;
  const source = safeExternalUrl(award.sourceUrl) ?? safeExternalUrl(award.ceremony?.sourceUrl);
  const won = award.result === "winner";
  const Icon = won ? Trophy : AwardIcon;
  const hasActions = Boolean(installment || source);

  return (
    <article className="flex min-w-0 items-start gap-3 px-3 py-2.5 sm:px-4">
      <div
        className={
          won
            ? "grid size-9 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning"
            : "grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
        }
      >
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="grid min-w-0 flex-1 items-center gap-x-4 gap-y-1.5 lg:grid-cols-5">
        <header
          className={cn(
            "flex min-w-0 flex-wrap items-start gap-x-4 gap-y-1.5",
            hasActions ? "lg:col-span-3" : "lg:col-span-5",
          )}
        >
          <div className="min-w-0">
            <h3 className="text-base font-semibold wrap-anywhere">
              <bdi>{organization || "تكريم"}</bdi>
            </h3>
            {category && (
              <p className="text-sm break-words text-muted-foreground">
                <bdi>{category}</bdi>
              </p>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant={won ? "secondary" : "outline"}>{won ? "فائز" : "مرشّح"}</Badge>
            {award.isFeatured && <Badge variant="outline">تكريم بارز</Badge>}
            {year != null && (
              <bdi className="text-sm text-muted-foreground tabular-nums">{year}</bdi>
            )}
          </div>
        </header>
        {hasActions && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:col-span-2 lg:justify-end">
            {installment && (
              <a
                {...navigation}
                href={workLink(work.id, installment.id)}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: detailChip,
                })}
              >
                <Film data-icon="inline-start" aria-hidden />
                <bdi>{installment.title}</bdi>
              </a>
            )}
            {source && (
              <a
                {...navigation}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                مصدر التكريم
                <ExternalLink data-icon="inline-end" aria-hidden />
                <span className="sr-only"> · يفتح في نافذة جديدة</span>
              </a>
            )}
          </div>
        )}
        {award.notes?.trim() && (
          <p
            className="text-sm leading-relaxed whitespace-pre-line wrap-anywhere lg:col-span-5"
            dir="auto"
          >
            {award.notes}
          </p>
        )}
      </div>
    </article>
  );
}

export function DataPanel({ work, status }: { work: WorkDetail; status: string }) {
  const languages = workLanguages(work);
  const dubLanguages = work.dubLanguages ?? [];
  const dates = work.installments.flatMap(({ releaseDate }) => releaseDate ?? []).toSorted();
  const premiere = dates[0];
  const latest = dates.at(-1);
  const seasons = work.installments.filter(({ kind }) => kind === "season").length;
  const onlySeasons = seasons > 0 && seasons === work.installmentCount;
  const single = work.installments.length === 1 ? work.installments[0] : null;
  const facts = [
    ["أول إصدار", premiere ? dateLabel(premiere) : work.releaseYear],
    ["آخر إصدار مسجّل", latest && latest !== premiere ? dateLabel(latest) : null],
    ["نوع العمل", work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"],
    ["الحالة", status === "unknown" ? null : statusLabels.get(status)],
    ["الفئة العمرية", work.age ? ageLabel(work.age) : null],
    ["الجمهور", audienceLabels.get(work.audience)],
    [onlySeasons ? "عدد المواسم" : "عدد الإصدارات", work.installmentCount || null],
    ["عدد المواسم", !onlySeasons && seasons > 0 ? seasons : null],
    ["عدد الحلقات", work.episodeCount || null],
    [
      single?.kind === "season" ? "مدة الحلقة" : "مدة العرض",
      single?.runtimeMinutes ? `${single.runtimeMinutes} دقيقة` : null,
    ],
  ].filter(([, value]) => value != null);
  const hasGenres = work.genres.some((genre) => genre.labelAr.trim());
  const hasVocabulary =
    work.countries.length > 0 || [...work.tones, ...work.tags].some((term) => term.labelAr.trim());
  const hasClassifications =
    languages.length > 0 || dubLanguages.length > 0 || hasGenres || hasVocabulary;
  const trivia = [...new Set(work.trivia.map((fact) => fact.trim()).filter(Boolean))];
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <DetailGroup title="بيانات الإصدار" icon={Film}>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {facts.map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-base font-medium wrap-anywhere tabular-nums">
                <bdi>{value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
      </DetailGroup>
      {trivia.length > 0 && (
        <DetailGroup title="حقائق ومعلومات" icon={Info}>
          <ul className="divide-y divide-border rounded-xl border-s-2 border-border bg-muted/30 px-3">
            {trivia.map((fact) => (
              <li key={fact} className="py-2.5 text-sm leading-relaxed wrap-anywhere">
                <bdi>{fact}</bdi>
              </li>
            ))}
          </ul>
        </DetailGroup>
      )}
      {hasClassifications && (
        <DetailGroup title="التصنيفات" icon={Tags}>
          <div className="grid min-w-0 gap-x-6 gap-y-3 rounded-xl border border-border bg-card/60 p-3 sm:grid-cols-2">
            {hasGenres && (
              <ClassificationRow title="الأنواع الفنية" wide>
                <WorkGenres genres={work.genres} />
              </ClassificationRow>
            )}
            <VocabularyGroup title="الطابع" facet="tones" items={work.tones} />
            <VocabularyGroup title="الوسوم" facet="tags" items={work.tags} />
            <LanguageGroup title="لغات العمل" facet="languages" languages={languages} />
            <LanguageGroup title="لغات الدبلجة" facet="dubLanguages" languages={dubLanguages} />
            <VocabularyGroup title="البلدان" facet="countries" items={work.countries} />
          </div>
        </DetailGroup>
      )}
      {work.awards.length > 0 && (
        <DetailGroup title="الجوائز والتكريمات" icon={Trophy}>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/60">
            {work.awards.map((award) => (
              <li key={award.id}>
                <Award award={award} work={work} />
              </li>
            ))}
          </ul>
        </DetailGroup>
      )}
    </div>
  );
}

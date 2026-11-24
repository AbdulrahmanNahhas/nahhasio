import type { Installment, WorkDetail } from "@nahhasio/api-contract";
import { AudioLines, Image, Info, Link2, Shield, X } from "lucide-react";

import { useCardNavigation } from "@/components/card-navigation";
import { LanguageBadges } from "@/components/language-badges";
import { MobileDrawer } from "@/components/ui-sdk/mobile-drawer";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";

import { ArtworkGallery, DetailGroup } from "./data-panel";
import { RiskRows } from "./family-panel";
import { FieldList, PanelEmpty } from "./field-list";
import { classificationLabels, externalIdLabels, safeExternalUrl } from "./format";

function ReleaseDetailsBody({ item, work }: { item: Installment; work: WorkDetail }) {
  const navigation = useCardNavigation();
  const hasClassification = [...classificationLabels.keys()].some(
    (key) => item.classification[key] !== work[key],
  );
  const tracks = item.mediaFiles.flatMap((file) => file.tracks);
  const audio = tracks.flatMap((track) =>
    track.kind === "audio" && track.language ? [track.language] : [],
  );
  const subtitles = tracks.flatMap((track) =>
    track.kind === "subtitle" && track.language ? [track.language] : [],
  );
  const artwork = item.artwork.filter(
    (image) =>
      image.role !== "poster" &&
      !work.artwork.some((shared) => shared.id === image.id && shared.role === image.role),
  );
  const workRefs = new Set(work.externalReferences.map(({ url }) => safeExternalUrl(url)));
  const references = new Map<string, string>();
  for (const entry of item.externalReferences) {
    const url = safeExternalUrl(entry.url);
    if (url && !workRefs.has(url)) references.set(url, entry.provider.trim() || "مرجع الإصدار");
  }
  const workIds = new Map(Object.entries(work.externalIds));
  const ids = Object.entries(item.externalIds).flatMap(([key, value]) => {
    const label = externalIdLabels.get(key);
    if (
      !label ||
      value === null ||
      workIds.get(key) === value ||
      item.externalReferences.some(
        (ref) => ref.externalId === String(value) && references.has(safeExternalUrl(ref.url) ?? ""),
      )
    )
      return [];
    return [[label, <bdi key={key}>{value}</bdi>] as const];
  });
  const hasMedia = audio.length > 0 || subtitles.length > 0;
  if (!hasClassification && !hasMedia && !references.size && !ids.length && !artwork.length) {
    return <PanelEmpty title="لا توجد تفاصيل إضافية لهذا الإصدار" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {hasClassification && (
        <DetailGroup title="تصنيف هذا الإصدار" icon={Shield}>
          <div className="rounded-xl border border-border bg-card/60 px-3">
            <RiskRows classification={item.classification} baseline={work} />
          </div>
        </DetailGroup>
      )}
      {hasMedia && (
        <DetailGroup title="مسارات الفيديو المسجّل" icon={AudioLines}>
          <dl className="grid min-w-0 gap-3 rounded-xl border border-border bg-card/60 p-3 sm:grid-cols-2">
            {audio.length > 0 && (
              <div className="flex min-w-0 flex-col gap-1.5">
                <dt className="text-sm text-muted-foreground">الصوت</dt>
                <dd>
                  <LanguageBadges languages={audio} />
                </dd>
              </div>
            )}
            {subtitles.length > 0 && (
              <div className="flex min-w-0 flex-col gap-1.5">
                <dt className="text-sm text-muted-foreground">الترجمة</dt>
                <dd>
                  <LanguageBadges languages={subtitles} />
                </dd>
              </div>
            )}
          </dl>
        </DetailGroup>
      )}
      {(references.size > 0 || ids.length > 0) && (
        <DetailGroup title="مراجع الإصدار" icon={Link2}>
          {references.size > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...references].map(([url, label]) => (
                <a
                  {...navigation}
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <bdi>{label}</bdi>
                </a>
              ))}
            </div>
          )}
          {ids.length > 0 && (
            <div className="rounded-xl border border-border bg-card/60 px-3">
              <FieldList rows={ids.map(([label, value]) => [label, value])} />
            </div>
          )}
        </DetailGroup>
      )}
      {artwork.length > 0 && (
        <DetailGroup title="صور الإصدار" icon={Image}>
          <ArtworkGallery images={artwork} />
        </DetailGroup>
      )}
    </div>
  );
}

export function InstallmentDetails({ item, work }: { item: Installment; work: WorkDetail }) {
  const navigation = useCardNavigation();
  const mobile = useIsMobile();
  const title = "تفاصيل الإصدار";
  const trigger = (
    <Button {...navigation} variant="outline" size="icon-sm" aria-label={title} title={title}>
      <Info aria-hidden />
    </Button>
  );
  const content = (
    <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
      <ReleaseDetailsBody item={item} work={work} />
    </div>
  );

  if (mobile) {
    return (
      <MobileDrawer title={`${title} · ${item.title}`} trigger={trigger}>
        {content}
      </MobileDrawer>
    );
  }
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent
        showCloseButton={false}
        className="flex max-h-5/6 w-11/12 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-5 py-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <DialogTitle className="shrink-0">{title}</DialogTitle>
            <DialogDescription className="min-w-0 wrap-anywhere" dir="auto">
              {item.title}
            </DialogDescription>
          </div>
          <DialogClose
            render={<Button variant="ghost" size="icon" aria-label="إغلاق تفاصيل الإصدار" />}
          >
            <X aria-hidden />
          </DialogClose>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

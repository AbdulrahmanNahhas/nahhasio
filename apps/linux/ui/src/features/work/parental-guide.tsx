import type { Classification, WorkDetail } from "@nahhasio/api-contract";
import { Separator } from "@ui-sdk/react/separator";
import { cn } from "cn";
import {
  BookOpen,
  ChevronLeft,
  FileText,
  Heart,
  MessageSquareWarning,
  Swords,
  TriangleAlert,
  X,
} from "lucide-react";

import { useCardNavigation } from "@/components/card-navigation";
import { MobileDrawer } from "@/components/ui-sdk/mobile-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { ageLabel, audienceLabels, classificationLabels, riskLabels } from "./format";

const factors = [
  { key: "sexualityRisk", icon: Heart, label: classificationLabels.get("sexualityRisk") },
  { key: "behavioralRisk", icon: Swords, label: classificationLabels.get("behavioralRisk") },
  { key: null, icon: MessageSquareWarning, label: "الألفاظ النابية والكحول" },
  { key: "theologyRisk", icon: BookOpen, label: classificationLabels.get("theologyRisk") },
] as const;

const severity = {
  none: {
    segments: 0,
    label: "text-muted-foreground",
    fill: "bg-muted",
    iconBackground: "bg-muted",
  },
  low: { segments: 1, label: "text-success", fill: "bg-success", iconBackground: "bg-success/10" },
  medium: {
    segments: 2,
    label: "text-warning",
    fill: "bg-warning",
    iconBackground: "bg-warning/10",
  },
  high: {
    segments: 4,
    label: "text-destructive",
    fill: "bg-destructive",
    iconBackground: "bg-destructive/10",
  },
} satisfies Record<
  Classification["sexualityRisk"],
  { segments: number; label: string; fill: string; iconBackground: string }
>;

function GuideFactors({
  classification,
  compact = false,
}: {
  classification: Classification;
  compact?: boolean;
}) {
  const visibleFactors = compact ? factors.filter(({ key }) => key !== null) : factors;
  return (
    <dl className={cn("flex flex-col", compact ? "gap-3" : "gap-4")}>
      {visibleFactors.map(({ key, icon: Icon, label }) => {
        const risk = key === null ? null : classification[key];
        const tone = risk === null ? severity.none : severity[risk];
        return (
          <div key={label} className={cn("flex min-w-0 flex-col mb-2 gap-1.5")}>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="flex min-w-0 items-center gap-2 text-base">
                <Icon
                  className={cn("shrink-0", compact ? "size-3.5" : "size-4", tone.label)}
                  aria-hidden
                />
                {label}
              </dt>
              <dd
                className={cn("shrink-0 font-medium", compact ? "text-xs" : "text-sm", tone.label)}
              >
                {risk === null ? "غير مقيّم" : riskLabels.get(risk)}
              </dd>
            </div>
            <div className="grid grid-cols-5 gap-1" aria-hidden>
              {[1, 2, 3, 4, 5].map((segment) => (
                <span
                  key={segment}
                  className={cn(
                    "rounded-full",
                    compact ? "h-1" : "h-1.5",
                    segment <= tone.segments ? tone.fill : "bg-foreground/10",
                  )}
                />
              ))}
            </div>
          </div>
        );
      })}
    </dl>
  );
}

export function ParentalGuide({ work }: { work: WorkDetail }) {
  const navigation = useCardNavigation();
  const mobile = useIsMobile();
  const title = "دليل الوالدين";
  const sexuality = severity[work.sexualityRisk];
  const behavior = severity[work.behavioralRisk];
  const notes = [
    {
      title: "تنبيه المحتوى",
      text: work.contentWarnings,
      icon: TriangleAlert,
      tone: sexuality.segments > behavior.segments ? sexuality : behavior,
    },
    {
      title: "ملاحظات التحليل",
      text: work.analysisNotes,
      icon: FileText,
      tone: severity[work.theologyRisk],
    },
  ].filter(({ text }) => text?.trim());

  const trigger = (
    <Button
      {...navigation}
      className="w-full justify-between"
      variant="outline"
      size="default"
      aria-label="تفاصيل دليل الوالدين"
    >
      التفاصيل
      <ChevronLeft data-icon="inline-end" aria-hidden />
    </Button>
  );
  const close = (
    <Button variant="ghost" size="icon" aria-label="إغلاق دليل الوالدين">
      <X aria-hidden />
    </Button>
  );
  const header = (
    <DialogHeader className="shrink-0 flex-row items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
      <bdi className="grid min-h-12 min-w-12 shrink-0 place-items-center rounded-xl border border-border bg-muted/40 px-2 text-base font-bold tabular-nums">
        {ageLabel(work.age)}
      </bdi>
      <div className="min-w-0 flex-1">
        <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
        <DialogDescription>{audienceLabels.get(work.audience)}</DialogDescription>
      </div>
      <DialogClose render={close} />
    </DialogHeader>
  );
  const body = (
    <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
      <GuideFactors classification={work} />
      {notes.length > 0 && (
        <>
          <Separator className="h-px shrink-0 bg-border" />
          <div className="flex flex-col gap-4">
            {notes.map(({ title: noteTitle, text, icon: Icon, tone }) => (
              <section key={noteTitle} className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg",
                    tone.iconBackground,
                    tone.label,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-sm font-medium">{noteTitle}</h3>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-line wrap-anywhere text-muted-foreground"
                    dir="auto"
                  >
                    {text}
                  </p>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <Card size="sm" className="w-full min-w-0 gap-4 bg-card/60">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>
            <h2 className="text-lg font-semibold">{title}</h2>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{audienceLabels.get(work.audience)}</p>
        </div>
        <Badge variant="outline" className="size-10 rounded-md text-base">
          <bdi>{ageLabel(work.age)}</bdi>
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <GuideFactors classification={work} compact />
        {mobile ? (
          <MobileDrawer title={title} trigger={trigger}>
            {body}
          </MobileDrawer>
        ) : (
          <Dialog>
            <DialogTrigger render={trigger} />
            <DialogContent
              showCloseButton={false}
              className="flex max-h-5/6 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
            >
              {header}
              {body}
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

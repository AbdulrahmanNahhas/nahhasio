import type { WorkDetail } from "@nahhasio/api-contract";
import { cn } from "cn";
import { BarChart3, Info, X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { useCardNavigation } from "@/components/card-navigation";
import { scoreTone } from "@/components/score-tone";
import { MobileDrawer } from "@/components/ui-sdk/mobile-drawer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { replaceParams, useViewerRoute } from "@/features/shell/navigation";
import { useIsMobile } from "@/hooks/use-mobile";

import { DataPanel } from "./data-panel";
import { ScoresPanel } from "./scores-panel";

function useWorkOverlay(panel: "details" | "score", legacy: "data" | "scores") {
  const { path, params } = useViewerRoute();
  return {
    open: params.get("panel") === panel || (!params.has("panel") && params.get("tab") === legacy),
    onOpenChange(open: boolean) {
      const next = new URLSearchParams(params);
      next.delete("tab");
      if (open) next.set("panel", panel);
      else next.delete("panel");
      replaceParams(path, next);
    },
  };
}

function ScoreOverlay({
  title,
  work,
  overlay,
  trigger,
  triggerContent,
  children,
}: {
  title: string;
  work: WorkDetail;
  overlay: ReturnType<typeof useWorkOverlay>;
  trigger: ReactElement;
  triggerContent: ReactNode;
  children: ReactNode;
}) {
  const mobile = useIsMobile();
  const Title = mobile ? DrawerTitle : DialogTitle;
  const Description = mobile ? DrawerDescription : DialogDescription;
  const Close = mobile ? DrawerClose : DialogClose;
  const content = (
    <>
      <div className="sr-only">
        <Title>{title}</Title>
        <Description>{work.titleAr || work.canonicalTitle}</Description>
      </div>
      <Close
        render={
          <Button
            variant="ghost"
            size="icon"
            className="absolute end-4 top-5 z-10 sm:end-6 sm:top-4"
            aria-label={`إغلاق ${title}`}
          />
        }
      >
        <X aria-hidden />
      </Close>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-6 select-text sm:px-6">
        {children}
      </div>
    </>
  );
  if (mobile) {
    return (
      <Drawer {...overlay} showSwipeHandle>
        <DrawerTrigger render={trigger}>{triggerContent}</DrawerTrigger>
        <DrawerContent className="max-h-9/10 overflow-hidden">{content}</DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog {...overlay}>
      <DialogTrigger render={trigger}>{triggerContent}</DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-5/6 w-11/12 flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}

export function WorkDetails({
  work,
  status,
  compact = false,
}: {
  work: WorkDetail;
  status: string;
  compact?: boolean;
}) {
  const navigation = useCardNavigation();
  const overlay = useWorkOverlay("details", "data");
  const mobile = useIsMobile();
  const title = "تفاصيل العمل";
  const trigger = (
    <Button
      {...navigation}
      variant="outline"
      size={compact ? "default" : "lg"}
      className="min-w-0 px-2"
    >
      <Info data-icon="inline-start" aria-hidden />
      {title}
    </Button>
  );
  const content = (
    <div
      className={cn(
        "px-4 py-3 sm:px-5 sm:py-4",
        !mobile && "min-h-0 overflow-y-auto overscroll-contain",
      )}
    >
      <DataPanel work={work} status={status} />
    </div>
  );
  if (mobile) {
    return (
      <MobileDrawer {...overlay} title={title} trigger={trigger}>
        {content}
      </MobileDrawer>
    );
  }
  return (
    <Dialog {...overlay}>
      <DialogTrigger render={trigger} />
      <DialogContent
        showCloseButton={false}
        className="flex max-h-5/6 w-11/12 flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-5 py-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <DialogTitle className="shrink-0">{title}</DialogTitle>
            <DialogDescription className="min-w-0 wrap-anywhere" dir="auto">
              {work.titleAr || work.canonicalTitle}
            </DialogDescription>
          </div>
          <DialogClose
            render={<Button variant="ghost" size="icon" aria-label="إغلاق تفاصيل العمل" />}
          >
            <X aria-hidden />
          </DialogClose>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

export function WorkScore({ work, compact = false }: { work: WorkDetail; compact?: boolean }) {
  const navigation = useCardNavigation();
  const overlay = useWorkOverlay("score", "scores");
  const rating = work.score.rating === null ? null : Math.round(work.score.rating * 10);
  return (
    <ScoreOverlay
      title="تقييم نحّاسيو"
      work={work}
      overlay={overlay}
      trigger={
        <Button
          {...navigation}
          variant="outline"
          size={compact ? "default" : "lg"}
          className="min-w-0 px-2"
          aria-label="تفاصيل تقييم نحّاسيو"
          aria-description={rating === null ? "غير مقيّم" : `${rating} من 100`}
        />
      }
      triggerContent={
        <>
          {rating === null ? (
            <BarChart3 data-icon="inline-start" aria-hidden />
          ) : (
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-score-ink tabular-nums",
                scoreTone(rating).background,
              )}
            >
              {rating}
            </span>
          )}
          التقييم
        </>
      }
    >
      <ScoresPanel work={work} />
    </ScoreOverlay>
  );
}

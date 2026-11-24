import { cn } from "cn";
import { CheckIcon, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { MobileDrawer } from "@/components/ui-sdk/mobile-drawer";
import { useIsMobile } from "@/hooks/use-mobile";

import { useCardNavigation } from "../../components/card-navigation";
import { Failure } from "../../components/status";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import type { WorkTracking } from "./use-work-tracking";

export function WatchedControl({
  tracking,
  installmentId,
  episodeId,
  label,
  compact = false,
  concise = false,
}: {
  tracking: WorkTracking;
  installmentId?: string;
  episodeId?: string;
  label: string;
  compact?: boolean;
  concise?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const navigation = useCardNavigation();
  const data = tracking.state.data;
  const episode = episodeId ? tracking.unitByEpisode.get(episodeId) : undefined;
  const units = episodeId
    ? episode
      ? [episode]
      : []
    : installmentId
      ? (tracking.unitsByInstallment.get(installmentId) ?? [])
      : (data?.units ?? []);
  const summary = installmentId
    ? data?.installments.find((item) => item.installmentId === installmentId)?.summary
    : data?.summary;
  const isPlayed = episodeId
    ? Boolean(units[0]?.isPlayed)
    : Boolean(summary?.isFullyWatched || (units.length && units.every((unit) => unit.isPlayed)));
  const disabled = !data || !units.length || tracking.pending;
  const text = isPlayed ? `إلغاء مشاهدة ${label}` : `تحديد ${label} كمُشاهَد`;
  const Icon = isPlayed ? CheckIcon : concise ? EyeOff : Eye;
  const mutate = () =>
    tracking.watched.mutate(
      { installmentId, episodeId, isPlayed: !isPlayed },
      { onSuccess: () => setOpen(false) },
    );
  const control = (
    <Button
      {...navigation}
      variant={isPlayed && concise ? "secondary" : "outline"}
      size={compact ? "icon-lg" : concise ? "sm" : "lg"}
      className={cn(
        compact &&
          isPlayed &&
          "border-success/35 bg-success/10 text-success hover:border-success/60 hover:bg-success/20 hover:text-success active:bg-success/25 aria-expanded:bg-success/20 aria-expanded:text-success",
      )}
      disabled={disabled}
      aria-label={text}
      aria-pressed={isPlayed}
      title={text}
      onClick={episodeId ? mutate : undefined}
    >
      {(!isPlayed || compact || concise) && <Icon data-icon="inline-start" aria-hidden />}
      {!compact &&
        (concise
          ? isPlayed
            ? "شُوهدت"
            : "غير مُشاهدة"
          : isPlayed
            ? "تمّت المشاهدة"
            : "تحديد كمُشاهَد")}
    </Button>
  );
  if (episodeId) return control;
  const description = `يشمل هذا التغيير جميع الحلقات والإصدارات المسجّلة في ${label}، بما فيها القادمة. العلامة يدوية ولا تغيّر تقدم التشغيل أو حالة الإصدار.`;
  const confirm = (
    <Button disabled={tracking.pending} onClick={mutate}>
      {isPlayed ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
      {tracking.pending ? "جارٍ الحفظ…" : "تأكيد التغيير"}
    </Button>
  );
  if (mobile) {
    return (
      <MobileDrawer
        title={text}
        description={description}
        showTitle
        open={open}
        onOpenChange={setOpen}
        trigger={control}
      >
        <div className="flex flex-col gap-3 p-4">
          {tracking.watched.error && <Failure error={tracking.watched.error} />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            {confirm}
          </div>
        </div>
      </MobileDrawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={control} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {tracking.watched.error && <Failure error={tracking.watched.error} />}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>إلغاء</DialogClose>
          {confirm}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { CheckIcon, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

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
  large = false,
}: {
  tracking: WorkTracking;
  installmentId?: string;
  episodeId?: string;
  label: string;
  compact?: boolean;
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
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
  const Icon = isPlayed ? CheckIcon : Eye;
  const mutate = () =>
    tracking.watched.mutate(
      { installmentId, episodeId, isPlayed: !isPlayed },
      { onSuccess: () => setOpen(false) },
    );
  const control = (
    <Button
      {...navigation}
      variant={isPlayed ? "secondary" : "outline"}
      size={compact ? (large ? "icon-lg" : "icon") : "default"}
      className={large ? "size-12" : undefined}
      disabled={disabled}
      aria-label={text}
      aria-pressed={isPlayed}
      title={text}
      onClick={episodeId ? mutate : undefined}
    >
      <Icon data-icon="inline-start" />
      {!compact && (isPlayed ? "تمّت المشاهدة" : "تحديد كمُشاهَد")}
    </Button>
  );
  if (episodeId) return control;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={control} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text}</DialogTitle>
          <DialogDescription>
            يشمل هذا التغيير جميع الحلقات والإصدارات المسجّلة في {label}، بما فيها القادمة. العلامة
            يدوية ولا تغيّر تقدم التشغيل أو حالة الإصدار.
          </DialogDescription>
        </DialogHeader>
        {tracking.watched.error && <Failure error={tracking.watched.error} />}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>إلغاء</DialogClose>
          <Button disabled={tracking.pending} onClick={mutate}>
            {isPlayed ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
            {tracking.pending ? "جارٍ الحفظ…" : "تأكيد التغيير"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

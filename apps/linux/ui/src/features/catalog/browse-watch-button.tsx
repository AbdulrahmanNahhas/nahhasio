import type { CatalogEntry } from "@nahhasio/api-contract";
import { Check, Eye, Play } from "lucide-react";
import { useState } from "react";

import { Failure } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useWorkTracking } from "../work/use-work-tracking";
import { optionLabel } from "./filter-model";

export function BrowseWatchButton({
  entry,
  labeled = false,
}: {
  entry: CatalogEntry;
  labeled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tracking = useWorkTracking(entry.work.id, open);
  const installmentId = entry.installment?.id;
  const label = entry.installment?.title ?? entry.work.titleAr ?? entry.work.canonicalTitle;
  const summary = installmentId
    ? tracking.state.data?.installments.find((value) => value.installmentId === installmentId)
        ?.summary
    : tracking.state.data?.summary;
  const watched = summary?.isFullyWatched ?? entry.watchState === "watched";
  const watching = !watched && entry.watchState === "in-progress";
  const Icon = watched ? Check : watching ? Play : Eye;
  const state = watched ? "watched" : watching ? "in-progress" : "unwatched";
  const stateLabel = optionLabel(state, state);
  const action = watched ? "إلغاء المشاهدة" : "تحديد كمُشاهَد";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="secondary"
            size={labeled ? "sm" : "icon-sm"}
            className={watched ? "text-success" : watching ? "text-warning" : undefined}
            aria-label={labeled ? `${stateLabel}، ${action}: ${label}` : `${action}: ${label}`}
            title={action}
          />
        }
      >
        <Icon data-icon="inline-start" aria-hidden="true" />
        {labeled && stateLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {action}: {label}
          </DialogTitle>
          <DialogDescription>
            يشمل التغيير وحدات المشاهدة المسجّلة ضمن هذا {installmentId ? "الإصدار" : "العمل"}. يبقى
            تقدم التشغيل كما هو.
          </DialogDescription>
        </DialogHeader>
        {tracking.error && <Failure error={tracking.error} />}
        {tracking.state.error && (
          <Failure error={tracking.state.error} retry={() => void tracking.state.refetch()} />
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>إلغاء</DialogClose>
          <Button
            disabled={tracking.pending || !summary?.catalogUnits}
            onClick={() =>
              tracking.watched.mutate(
                { installmentId, isPlayed: !watched },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {tracking.pending ? "جارٍ الحفظ…" : "تأكيد التغيير"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

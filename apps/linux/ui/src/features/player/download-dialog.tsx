import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { DownloadQueue } from "./download-queue";
import { HomeDownloadSources } from "./home-sources";
import { DownloadSources } from "./source-controls";
import type { WatchTarget } from "./watch-request";

export function DownloadDialog({
  target,
  sessionId,
  onClose,
}: {
  target: WatchTarget;
  sessionId: string;
  onClose: () => void;
}) {
  const [queued, setQueued] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-5/6 w-11/12 flex-col sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>تنزيل · {target.title}</DialogTitle>
          <DialogDescription>
            {queued
              ? "أُضيف التنزيل. تابع حالته هنا أو من قائمة التنزيلات في حسابك."
              : "اختر المصدر والملف. يستمر التنزيل بعد إغلاق هذه النافذة ما دام التطبيق مفتوحًا."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {!queued && <HomeDownloadSources target={target} onQueued={() => setQueued(true)} />}
          {queued ? (
            <DownloadQueue />
          ) : (
            <DownloadSources
              target={target}
              sessionId={sessionId}
              onQueued={() => setQueued(true)}
            />
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>إغلاق</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

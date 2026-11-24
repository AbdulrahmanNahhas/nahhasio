import { useState } from "react";

import { MobileDrawer } from "@/components/ui-sdk/mobile-drawer";
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
import { useIsMobile } from "@/hooks/use-mobile";

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
  const mobile = useIsMobile();
  const title = `تنزيل · ${target.title}`;
  const description = queued
    ? "أُضيف التنزيل. تابع حالته هنا أو من قائمة التنزيلات في حسابك."
    : "اختر المصدر والملف. يستمر التنزيل بعد إغلاق هذه النافذة ما دام التطبيق مفتوحًا.";
  const content = (
    <>
      {!queued && <HomeDownloadSources target={target} onQueued={() => setQueued(true)} />}
      {queued ? (
        <DownloadQueue />
      ) : (
        <DownloadSources target={target} sessionId={sessionId} onQueued={() => setQueued(true)} />
      )}
    </>
  );
  const manage = (
    <Button
      nativeButton={false}
      variant="outline"
      render={<a href="#/downloads?view=queue" />}
      onClick={onClose}
    >
      إدارة التنزيلات
    </Button>
  );
  if (mobile) {
    return (
      <MobileDrawer
        title={title}
        description={description}
        showTitle
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <div className="flex flex-col gap-4 p-4">
          {content}
          <div className="self-end">{manage}</div>
        </div>
      </MobileDrawer>
    );
  }
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain">{content}</div>
        <DialogFooter>
          {manage}
          <DialogClose render={<Button variant="outline" />}>إغلاق</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

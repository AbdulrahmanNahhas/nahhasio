import type { MediaUnitStatus } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { FileVideo, FilePlus2, FileWarning, Files, Trash2, LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { formatSourceSize } from "@/features/player/source-format";

import { ImportMediaDialog } from "./import-media-dialog";
import { unitFilesOptions } from "./media-data";
import { MediaFileActions } from "./media-file-actions";
import { unitMediaLabel } from "./unit-media-status";

export function UnitMedia({
  workId,
  installmentId,
  episodeId,
  title,
  status,
  persisted,
  allowImport,
  compact = false,
}: {
  workId: string;
  installmentId: string;
  episodeId?: string;
  title: string;
  status?: MediaUnitStatus;
  persisted: boolean;
  allowImport: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = !persisted
    ? "احفظ الجزء أو الحلقة أولًا"
    : status
      ? unitMediaLabel(status)
      : "الإتاحة غير معروفة";
  const Icon = status?.availableFiles
    ? status.availableFiles > 1
      ? Files
      : FileVideo
    : status?.activeImports
      ? LoaderCircle
      : status?.missingFiles || status?.reviewFiles
        ? FileWarning
        : status?.trashedFiles
          ? Trash2
          : FilePlus2;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={compact ? "ghost" : "outline"}
            size={compact ? "icon-sm" : "sm"}
            className="max-w-full"
            aria-label={label}
            title={`${title} · ${label}`}
            disabled={!persisted || !status}
          />
        }
      >
        <Icon data-icon="inline-start" />
        {!compact && <span className="truncate">{label}</span>}
      </DialogTrigger>
      <DialogContent className="max-h-5/6 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ملفات {title}</DialogTitle>
          <DialogDescription className="sr-only">
            هذه ملفات الحلقة نفسها في الفهرس. تبقى الصورة والبيانات وسجل المشاهدة عند حذف الفيديو.
          </DialogDescription>
        </DialogHeader>
        {status &&
          Boolean(
            status.availableFiles ||
            status.activeImports ||
            status.missingFiles ||
            status.reviewFiles ||
            status.trashedFiles,
          ) && (
            <div className="flex flex-wrap gap-2">
              {!!status.availableFiles && (
                <Badge variant="secondary">{status.availableFiles} متاحًا</Badge>
              )}
              {!!status.activeImports && <Badge variant="outline">جارٍ الاستيراد</Badge>}
              {!!status.missingFiles && (
                <Badge variant="outline">{status.missingFiles} مفقودًا من القرص</Badge>
              )}
              {!!status.reviewFiles && (
                <Badge variant="outline">{status.reviewFiles} يحتاج تحققًا</Badge>
              )}
              {!!status.trashedFiles && (
                <Badge variant="outline">{status.trashedFiles} في المحذوفات</Badge>
              )}
            </div>
          )}
        {open && (
          <UnitFiles
            workId={workId}
            installmentId={installmentId}
            episodeId={episodeId}
            allowImport={allowImport}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function UnitFiles({
  workId,
  installmentId,
  episodeId,
  allowImport,
}: {
  workId: string;
  installmentId: string;
  episodeId?: string;
  allowImport: boolean;
}) {
  const [page, setPage] = useState(1);
  const files = useQuery(unitFilesOptions(workId, installmentId, episodeId ?? "none", page));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {files.data ? `${files.data.total} ملف مسجّل` : "ملفات هذه الحلقة"}
        </span>
        <ImportMediaDialog workId={workId} installmentId={installmentId} episodeId={episodeId}>
          <Button
            variant="outline"
            size="sm"
            disabled={!allowImport}
            title={!allowImport ? "احفظ تغييرات الفهرس قبل الاستيراد" : undefined}
          >
            <Plus data-icon="inline-start" />
            استيراد ملف
          </Button>
        </ImportMediaDialog>
      </div>
      {!allowImport && (
        <p className="text-xs text-muted-foreground">احفظ تغييرات الفهرس لتفعيل الاستيراد.</p>
      )}
      {files.isPending && <p role="status">جارٍ تحميل الملفات…</p>}
      {files.error && (
        <Alert variant="destructive">
          <AlertDescription>
            {files.error.message}
            <Button variant="outline" size="sm" onClick={() => void files.refetch()}>
              إعادة المحاولة
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {files.data?.items.map((file) => (
        <section
          key={file.id}
          aria-label={`نسخة ${file.id}`}
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={file.isTrashed ? "outline" : "secondary"}>
              {file.isTrashed
                ? "في المحذوفات"
                : file.availability === "present"
                  ? "متاح"
                  : file.availability === "missing"
                    ? "مفقود من القرص"
                    : "يحتاج تحققًا"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {file.byteSize === null ? "الحجم غير معروف" : formatSourceSize(file.byteSize)}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <p className="min-w-48 flex-1 break-all text-sm" dir="ltr">
              {file.relativePath}
            </p>
            <MediaFileActions file={file} />
          </div>
        </section>
      ))}
      {files.data?.total === 0 && (
        <Empty className="gap-3 py-6">
          <EmptyHeader className="gap-1">
            <EmptyTitle>بلا ملف على الخادم</EmptyTitle>
            <EmptyDescription>
              استورد فيديو لهذه الحلقة. تبقى صورتها وبياناتها وسجل مشاهدتها كما هي.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {files.data && files.data.total > files.data.pageSize && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            السابق
          </Button>
          <span>
            {page} / {Math.ceil(files.data.total / files.data.pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page * files.data.pageSize >= files.data.total}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
}

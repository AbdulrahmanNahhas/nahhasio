import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pause, Play, RefreshCw, Search, Trash2 } from "lucide-react";
import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { Choice } from "@/components/choice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/features/editor/use-confirm";
import { nativeCall } from "@/lib/bridge";

import {
  downloadKeys,
  downloadQueueOptions,
  jobCategory,
  jobLabel,
  okReply,
  videoTitle,
  workTitle,
  type DownloadJob,
} from "./download-data";
import { SavedVideoActions } from "./saved-video-actions";
import { SavedVideoRow } from "./saved-video-row";
import { formatSourceSize } from "./source-format";
import { requestDownload } from "./watch-request";
export { downloadQueueOptions } from "./download-data";

export function DownloadQueue({ compact = true }: { compact?: boolean }) {
  const jobs = useQuery(downloadQueueOptions());
  const client = useQueryClient();
  const confirm = useConfirm("إزالة من قائمة النقل");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(compact ? 8 : 24);
  const counts = {
    all: jobs.data?.length ?? 0,
    active: jobs.data?.filter((job) => jobCategory(job) === "active").length ?? 0,
    completed: jobs.data?.filter((job) => jobCategory(job) === "completed").length ?? 0,
    failed: jobs.data?.filter((job) => jobCategory(job) === "failed").length ?? 0,
  };
  const action = useMutation({
    scope: { id: "native-downloads" },
    mutationFn: async ({
      id,
      command,
    }: {
      id: string;
      command: "media.pause" | "media.resume" | "media.forgetDownload";
    }) => okReply.parse(await nativeCall(command, { id })),
    onSuccess: async (_, variables) => {
      await client.invalidateQueries({ queryKey: downloadKeys });
      if (variables.command === "media.forgetDownload")
        toast.add({
          type: "success",
          title: "أُزيل من قائمة النقل",
          description: "الفيديوهات المحفوظة باقية في مكتبة الجهاز.",
        });
    },
    networkMode: "always",
    retry: false,
  });
  const visible =
    jobs.data?.filter(
      (job) =>
        (filter === "all" || jobCategory(job) === filter) &&
        `${job.files.map((file) => file.path).join(" ")} ${job.exports.map((file) => `${workTitle(file)} ${videoTitle(file)}`).join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    ) ?? [];
  async function forget(job: DownloadJob) {
    if (
      await confirm.confirm(
        "إلغاء النقل وإزالة هذا العنصر من قائمة النقل؟ الفيديوهات المكتملة تبقى محفوظة، ولن تُحذف ملفات الفيديو.",
      )
    )
      action.mutate({ id: job.id, command: "media.forgetDownload" });
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {confirm.dialog}
      <div className="flex flex-wrap items-center gap-3">
        <InputGroup className="min-w-48 flex-1">
          <InputGroupInput
            aria-label="بحث في التنزيلات"
            placeholder="ابحث عن عمل أو حلقة…"
            value={q}
            maxLength={300}
            onChange={(event) => setQ(event.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
        <div className="w-44">
          <Choice
            label="حالة التنزيل"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `الكل (${counts.all})` },
              { value: "active", label: `قيد النقل (${counts.active})` },
              { value: "completed", label: `مكتمل (${counts.completed})` },
              { value: "failed", label: `يحتاج انتباهاً (${counts.failed})` },
            ]}
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="تحديث التنزيلات"
          disabled={jobs.isFetching}
          onClick={() => {
            action.reset();
            void jobs.refetch();
          }}
        >
          <RefreshCw data-icon="inline-start" />
        </Button>
      </div>
      {(jobs.error || action.error) && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحديث التنزيلات</AlertTitle>
          <AlertDescription>{jobs.error?.message ?? action.error?.message}</AlertDescription>
        </Alert>
      )}
      {jobs.isPending ? (
        <Skeleton className="h-48" />
      ) : !visible.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              {jobs.data?.length ? "لا توجد نتائج مطابقة" : "قائمة النقل فارغة"}
            </EmptyTitle>
            <EmptyDescription>
              {jobs.data?.length
                ? "غيّر البحث أو مرشح الحالة."
                : "ابدأ التنزيل من صفحة العمل أو الحلقة. تجد الفيديوهات المكتملة في مكتبة الجهاز."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        visible.slice(0, limit).map((job) => (
          <QueueCard
            key={job.id}
            job={job}
            compact={compact}
            busy={action.isPending}
            onPause={() =>
              action.mutate({
                id: job.id,
                command: job.status.paused ? "media.resume" : "media.pause",
              })
            }
            onForget={() => void forget(job)}
          />
        ))
      )}
      {visible.length > limit && (
        <Button variant="outline" onClick={() => setLimit(limit + 24)}>
          عرض المزيد ({limit} / {visible.length})
        </Button>
      )}
    </div>
  );
}
function QueueCard({
  job,
  compact,
  busy,
  onPause,
  onForget,
}: {
  job: DownloadJob;
  compact: boolean;
  busy: boolean;
  onPause: () => void;
  onForget: () => void;
}) {
  const first = job.exports[0];
  const recoverFile =
    job.exports.find((file) => !file.available && job.selected.includes(file.file)) ?? first;
  const target = recoverFile?.target;
  const category = jobCategory(job);
  const percent =
    job.status.total > 0 ? Math.min(100, (job.status.verified / job.status.total) * 100) : 0;
  const eta =
    job.status.download_rate > 0 && !job.status.complete
      ? Math.ceil((job.status.total - job.status.verified) / job.status.download_rate / 60)
      : null;
  const error = job.exports.find((file) => file.error)?.error ?? job.status.error;
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start gap-4">
          {!compact && (
            <Artwork
              id={first?.posterId}
              alt=""
              className="h-18 w-12 shrink-0 rounded-lg object-cover"
              fallback={<Download className="size-6" />}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <CardTitle>
              <span dir="auto">{first ? workTitle(first) : "تنزيل فيديو"}</span>
            </CardTitle>
            <CardDescription>
              <span className="break-words" dir="auto">
                {job.exports.map(videoTitle).join(" · ") ||
                  job.files.map((file) => file.path.split("/").at(-1)).join(" · ")}
              </span>
            </CardDescription>
            <div>
              <Badge variant={category === "failed" ? "destructive" : "secondary"}>
                {jobLabel(job)}
              </Badge>
            </div>
            {first?.target && (
              <a
                href={`#/titles/${first.target.workId}`}
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                فتح العمل
              </a>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {category !== "completed" && (
          <>
            <Progress
              value={job.status.total > 0 ? percent : null}
              max={100}
              aria-label="تقدم التنزيل"
            />
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span>
                {percent.toFixed(1)}% · {formatSourceSize(job.status.verified)} /{" "}
                {formatSourceSize(job.status.total)}
              </span>
              <span>
                {formatSourceSize(job.status.download_rate)}/s · {job.status.peers} مشارك
              </span>
            </div>
            {eta !== null && (
              <p className="text-xs text-muted-foreground">حوالي {Math.max(1, eta)} دقيقة متبقية</p>
            )}
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{jobLabel(job)}</AlertTitle>
            <AlertDescription>
              <p className="break-words" dir="auto">
                {error}
              </p>
              <p>
                تحقق من المساحة والصلاحيات وتعارض اسم الملف. للمصدر المحظور أو التالف، اختر مصدراً آخر
                من العمل.
              </p>
            </AlertDescription>
          </Alert>
        )}
        {!compact &&
          job.exports.map((file) =>
            file.published ? (
              <SavedVideoRow key={file.file} file={{ ...file, id: job.id }} />
            ) : (
              <p key={file.file} className="truncate text-xs text-muted-foreground" dir="auto">
                {videoTitle(file)}
              </p>
            ),
          )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {category === "failed" && target && recoverFile && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              requestDownload({
                workId: target.workId,
                installmentId: target.installmentId ?? undefined,
                episodeId: target.episodeId ?? undefined,
                title: videoTitle(recoverFile),
              })
            }
          >
            <RefreshCw data-icon="inline-start" />
            اختيار مصدر آخر
          </Button>
        )}
        {category !== "completed" &&
          !job.status.complete &&
          !["blocked", "failed", "missing"].includes(job.status.state) && (
            <Button variant="outline" size="sm" disabled={busy} onClick={onPause}>
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : job.status.paused ? (
                <Play data-icon="inline-start" />
              ) : (
                <Pause data-icon="inline-start" />
              )}
              {job.status.paused ? "استئناف" : "إيقاف مؤقت"}
            </Button>
          )}
        {compact && first?.available && <SavedVideoActions file={{ ...first, id: job.id }} />}
        <Button variant="ghost" size="sm" disabled={busy} onClick={onForget}>
          <Trash2 data-icon="inline-start" />
          {category === "completed" ? "إزالة من قائمة النقل" : "إلغاء النقل"}
        </Button>
      </CardFooter>
    </Card>
  );
}

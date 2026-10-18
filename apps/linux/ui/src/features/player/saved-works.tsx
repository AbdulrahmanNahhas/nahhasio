import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Check, Download, RefreshCw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Artwork } from "@/components/artwork";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { nativeCall } from "@/lib/bridge";

import { offlineStatusOptions, savedWorksOptions, syncSavedWorks } from "./saved-works-data";

export function SaveWorkControl({ id }: { id: string }) {
  const client = useQueryClient();
  const status = useQuery(offlineStatusOptions());
  const works = useQuery({ ...savedWorksOptions(), enabled: Boolean(status.data?.active) });
  const saved = works.data?.some((work) => work.id === id);
  const running = status.data?.job?.running;
  const job = status.data?.job?.workId === id ? status.data.job : null;
  const save = useMutation({
    networkMode: "always",
    mutationFn: () => nativeCall("offline.save", { id }),
    onSuccess: async () => {
      toast.add({ title: "بدأ حفظ بيانات العمل وصوره على الجهاز", type: "info" });
      await client.invalidateQueries({ queryKey: ["offline"] });
    },
  });
  if (status.data?.offline)
    return (
      <Badge variant="secondary">
        <Check /> محفوظ على الجهاز
      </Badge>
    );
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="lg"
        disabled={save.isPending || running || !status.data?.active}
        onClick={() => save.mutate()}
      >
        {save.isPending || job?.running ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Bookmark data-icon="inline-start" />
        )}
        {job?.running
          ? `جارٍ الحفظ · ${job.completed} / ${job.total}`
          : saved
            ? "تحديث النسخة المحفوظة"
            : "حفظ العمل للجهاز"}
      </Button>
      {save.error && (
        <p role="alert" className="text-sm text-destructive">
          {save.error.message}
        </p>
      )}
      {job?.error && (
        <p role="alert" className="text-sm text-destructive">
          {job.error}
        </p>
      )}
    </div>
  );
}

export function SavedWorks() {
  const client = useQueryClient();
  const status = useQuery(offlineStatusOptions());
  const works = useQuery({ ...savedWorksOptions(), enabled: Boolean(status.data?.active) });
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<{ id: string; title: string } | null>(null);
  const [resolution, setResolution] = useState<{ id: string; choice: "device" | "server" } | null>(
    null,
  );
  const review = useQuery({
    queryKey: ["offline", "review", resolution?.id],
    queryFn: async ({ signal }) =>
      z
        .object({
          revision: z.string(),
          changes: z.array(
            z.object({
              label: z.string(),
              key: z.string(),
              devicePlayed: z.boolean(),
              serverPlayed: z.boolean(),
              devicePosition: z.number(),
              serverPosition: z.number(),
            }),
          ),
        })
        .parse(await nativeCall("offline.review", { id: resolution!.id }, signal)),
    enabled: Boolean(resolution),
    networkMode: "always",
    retry: false,
    staleTime: 0,
  });
  const action = useMutation({
    networkMode: "always",
    mutationFn: ({
      command,
      payload,
    }: {
      command: string;
      payload: { id: string; choice?: string; revision?: string };
    }) => nativeCall(command, payload),
    onSuccess: async () => {
      setRemoving(null);
      setResolution(null);
      await client.invalidateQueries({ queryKey: ["offline"] });
      await client.invalidateQueries({ queryKey: ["viewer"] });
    },
  });
  const sync = useMutation({
    networkMode: "always",
    mutationFn: syncSavedWorks,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["offline"] });
      await client.invalidateQueries({ queryKey: ["viewer"] });
    },
  });
  const job = status.data?.job;
  const visible =
    works.data?.filter((work) => work.title.toLocaleLowerCase().includes(q.toLocaleLowerCase())) ??
    [];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        بيانات الأعمال وصورها متاحة دون الخادم. الفيديوهات المنزّلة في تبويب الفيديوهات.
      </p>
      {job && (job.running || job.error) && (
        <Alert variant={job.error ? "destructive" : "default"}>
          <AlertTitle>{job.error ? "لم يكتمل حفظ العمل" : "جارٍ حفظ العمل وصوره…"}</AlertTitle>
          <AlertDescription>{job.error ?? `${job.completed} / ${job.total} صورة`}</AlertDescription>
          {job.running && (
            <Progress
              value={job.total ? (100 * job.completed) / job.total : 0}
              aria-label="حفظ صور العمل"
            />
          )}
        </Alert>
      )}
      {Boolean(status.data?.pending) && (
        <Alert>
          <AlertTitle>{status.data?.pending} تغيير مشاهدة ينتظر المزامنة</AlertTitle>
          <AlertDescription>
            تبقى التغييرات لحساب هذه المكتبة. إذا تغيّرت الحالة على الخادم، يمكنك اختيار النسخة التي
            تريدها.
          </AlertDescription>
          {!status.data?.offline && (
            <Button
              size="sm"
              variant="outline"
              disabled={sync.isPending}
              onClick={() => sync.mutate()}
            >
              {sync.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}{" "}
              مزامنة الآن
            </Button>
          )}
        </Alert>
      )}
      {works.data
        ?.filter((work) => work.conflict)
        .map((work) => (
          <Card key={work.id} size="sm">
            <CardHeader>
              <CardTitle>{work.title}</CardTitle>
              <CardDescription>تغيّرت المشاهدة على الخادم منذ حفظ النسخة.</CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={status.data?.offline}
                onClick={() => setResolution({ id: work.id, choice: "server" })}
              >
                الاحتفاظ بتغييرات الخادم
              </Button>
              <Button
                disabled={status.data?.offline}
                onClick={() => setResolution({ id: work.id, choice: "device" })}
              >
                اعتماد تغييرات الجهاز
              </Button>
            </CardFooter>
          </Card>
        ))}
      {(works.error || action.error || sync.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {action.error?.message ?? sync.error?.message ?? works.error?.message}
          </AlertDescription>
        </Alert>
      )}
      <InputGroup>
        <InputGroupInput
          aria-label="بحث في الأعمال المحفوظة"
          placeholder="ابحث في الأعمال المحفوظة…"
          value={q}
          maxLength={300}
          onChange={(event) => setQ(event.target.value)}
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
      </InputGroup>
      {works.isPending && status.data?.active ? (
        <Skeleton className="h-64" />
      ) : !visible.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{q ? "لا توجد نتائج" : "لم تحفظ أعمالًا بعد"}</EmptyTitle>
            <EmptyDescription>
              افتح صفحة عمل واختر «حفظ العمل للجهاز» لتصفحه دون الخادم.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {visible.map((work) => (
            <Card key={work.id} size="sm">
              <CardHeader className="flex-row gap-4">
                <a href={`#/titles/${work.id}`} aria-label={`فتح ${work.title}`}>
                  <Artwork
                    id={work.posterId}
                    alt=""
                    className="h-24 w-16 shrink-0 rounded-lg object-cover"
                    fallback={<Download />}
                  />
                </a>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <CardTitle>
                    <a href={`#/titles/${work.id}`} dir="auto">
                      {work.title}
                    </a>
                  </CardTitle>
                  <CardDescription>
                    {work.images} صورة ·{" "}
                    <time dateTime={work.savedAt}>
                      {new Date(work.savedAt).toLocaleDateString("ar")}
                    </time>
                  </CardDescription>
                  <Badge variant="secondary">جاهز دون الخادم</Badge>
                  {Boolean(work.pending) && (
                    <Badge variant="outline">{work.pending} تغيير غير متزامن</Badge>
                  )}
                </div>
              </CardHeader>
              <CardFooter className="flex flex-wrap gap-2">
                <Button variant="outline" render={<a href={`#/titles/${work.id}`} />}>
                  فتح العمل
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`إزالة بيانات ${work.title} من الجهاز`}
                  title={
                    work.pending
                      ? "زامن تغييرات المشاهدة قبل إزالة البيانات"
                      : "إزالة بيانات العمل؛ تبقى الفيديوهات"
                  }
                  disabled={action.isPending || job?.running || work.pending > 0}
                  onClick={() => setRemoving(work)}
                >
                  <Trash2 />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={Boolean(removing || resolution)}
        onOpenChange={(open) => {
          if (!open && !action.isPending) {
            setRemoving(null);
            setResolution(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {removing ? "إزالة بيانات العمل من الجهاز؟" : "تأكيد اختيار نسخة المشاهدة"}
            </DialogTitle>
            <DialogDescription>
              {removing
                ? `تُزال بيانات «${removing.title}» وصوره غير المستخدمة. تبقى فيديوهاتك وحسابك وبيانات الخادم.`
                : resolution?.choice === "server"
                  ? "ستُحذف تغييرات المشاهدة المعلّقة لهذا العمل من الجهاز وتُستخدم حالة الخادم."
                  : "ستُعاد محاولة إرسال تغييرات الجهاز فوق الحالة الحالية للخادم. أي تغيير أحدث أثناء الإرسال سيحتاج مراجعة أخرى."}
            </DialogDescription>
          </DialogHeader>
          {resolution &&
            (review.isPending ? (
              <Skeleton className="h-32" />
            ) : review.error ? (
              <Alert variant="destructive">
                <AlertDescription>{review.error.message}</AlertDescription>
              </Alert>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحلقة / الإصدار</TableHead>
                      <TableHead>الجهاز</TableHead>
                      <TableHead>الخادم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {review.data?.changes.map((change) => (
                      <TableRow key={change.key}>
                        <TableCell>{change.label}</TableCell>
                        <TableCell>
                          {change.devicePlayed ? "مُشاهَد" : "غير مُشاهَد"} ·{" "}
                          {Math.floor(change.devicePosition / 60)} د
                        </TableCell>
                        <TableCell>
                          {change.serverPlayed ? "مُشاهَد" : "غير مُشاهَد"} ·{" "}
                          {Math.floor(change.serverPosition / 60)} د
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          {action.error && (
            <Alert variant="destructive">
              <AlertDescription>{action.error.message}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                setRemoving(null);
                setResolution(null);
              }}
            >
              إلغاء
            </Button>
            <Button
              disabled={
                action.isPending ||
                (Boolean(resolution) && (!review.data || review.isFetching || review.isError))
              }
              variant={removing ? "destructive" : "default"}
              onClick={() => {
                if (removing)
                  action.mutate({ command: "offline.remove", payload: { id: removing.id } });
                else if (resolution)
                  action.mutate({
                    command: "offline.resolve",
                    payload: { ...resolution, revision: review.data?.revision },
                  });
              }}
            >
              {action.isPending ? <Spinner data-icon="inline-start" /> : null}تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

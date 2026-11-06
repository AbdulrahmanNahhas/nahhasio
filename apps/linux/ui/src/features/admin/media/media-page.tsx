import type { MediaJob } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate, useSearch } from "@tanstack/react-router";
import { FolderOpen, Plus, RefreshCw } from "lucide-react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { formatSourceSize } from "@/features/player/source-format";

import { WorkspacePage } from "../workspace";
import { ImportMediaDialog } from "./import-media-dialog";
import {
  controlMediaJob,
  mediaInventoryOptions,
  mediaJobsOptions,
  mediaCoverageOptions,
} from "./media-data";
import { MediaFileActions } from "./media-file-actions";

export function MediaLibraryPage() {
  const search = useSearch({ from: "/admin/$section" });
  const navigate = useNavigate({ from: "/admin/$section" });
  const page = Number(search.page);
  const files = useQuery({
    ...mediaInventoryOptions(search.q, page, search.workId, search.mediaState, search.mediaSource),
    enabled: !search.workId && search.mediaView === "files",
  });
  const coverage = useQuery({
    ...mediaCoverageOptions(search.q, page, search.workId, search.mediaView === "missing"),
    enabled: !search.workId && search.mediaView !== "files",
  });
  if (search.workId)
    return (
      <Navigate
        to="/admin/works/$workId"
        params={{ workId: search.workId }}
        search={{ section: "structure" }}
        replace
      />
    );
  return (
    <WorkspacePage
      title="مكتبة ملفات الخادم"
      description="أعمال الملفات فقط والأعمال ذات ملفات مسجّلة. التغطية للأجزاء التي تُدار بملفات؛ تنزيلات جهازك مستقلة."
    >
      <div className="flex flex-wrap items-center gap-3">
        <InputGroup className="min-w-48 flex-1">
          <InputGroupInput
            aria-label="بحث في ملفات الخادم"
            placeholder="ابحث باسم العمل أو الحلقة…"
            value={search.q}
            onChange={(event) =>
              void navigate({
                search: (previous) => ({ ...previous, q: event.target.value, page: "1" }),
                replace: true,
              })
            }
          />
        </InputGroup>
        <ImportMediaDialog workId={search.workId || undefined}>
          <Button>
            <Plus data-icon="inline-start" />
            استيراد فيديوهات
          </Button>
        </ImportMediaDialog>
        <Button
          variant="outline"
          size="icon"
          aria-label="تحديث ملفات الخادم"
          onClick={() => void (search.mediaView === "files" ? files.refetch() : coverage.refetch())}
        >
          <RefreshCw />
        </Button>
      </div>
      <FieldGroup className="grid gap-3 sm:grid-cols-3">
        <Field>
          <FieldLabel>العرض</FieldLabel>
          <Choice
            label="عرض مكتبة الخادم"
            value={search.mediaView}
            options={[
              { value: "files", label: "الفيديوهات" },
              { value: "works", label: "تغطية الأعمال" },
              { value: "missing", label: "حلقات وأفلام لم تُستورد" },
            ]}
            onChange={(value) =>
              void navigate({
                search: (previous) => ({
                  ...previous,
                  mediaView:
                    value === "works" ? "works" : value === "missing" ? "missing" : "files",
                  page: "1",
                }),
              })
            }
          />
        </Field>
        {search.mediaView === "files" && (
          <>
            <Field>
              <FieldLabel>الإتاحة</FieldLabel>
              <Choice
                label="حالة ملفات الخادم"
                value={search.mediaState}
                options={[
                  { value: "all", label: "كل الحالات" },
                  { value: "present", label: "متاح" },
                  { value: "needs-review", label: "أخطاء أو ملفات مفقودة" },
                  { value: "trash", label: "المحذوفات" },
                ]}
                onChange={(value) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      mediaState:
                        value === "present"
                          ? "present"
                          : value === "needs-review"
                            ? "needs-review"
                            : value === "trash"
                              ? "trash"
                              : "all",
                      page: "1",
                    }),
                  })
                }
              />
            </Field>
            <Field>
              <FieldLabel>مصدر الاستيراد</FieldLabel>
              <Choice
                label="تصفية مصدر ملفات الخادم"
                value={search.mediaSource}
                options={[
                  { value: "all", label: "كل المصادر" },
                  { value: "server-folder", label: "مجلد الخادم" },
                  { value: "upload", label: "رفع من جهاز" },
                  { value: "youtube", label: "YouTube" },
                ]}
                onChange={(value) =>
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      mediaSource:
                        value === "server-folder"
                          ? "server-folder"
                          : value === "youtube"
                            ? "youtube"
                            : value === "upload"
                              ? "upload"
                              : "all",
                      page: "1",
                    }),
                  })
                }
              />
            </Field>
          </>
        )}
      </FieldGroup>
      {search.workId && (
        <Button
          variant="outline"
          onClick={() =>
            void navigate({ search: (previous) => ({ ...previous, workId: "", page: "1" }) })
          }
        >
          عرض جميع الأعمال
        </Button>
      )}
      {files.data && (
        <p className="text-sm text-muted-foreground">
          المحذوفات: {files.data.trashFiles} ملفًا · {formatSourceSize(files.data.trashBytes)} ما
          زالت تشغل مساحة حتى الحذف النهائي. مدة الاحتفاظ سبعة أيام.
        </p>
      )}
      {(files.error || coverage.error) && (
        <Alert variant="destructive">
          <AlertDescription>{(files.error ?? coverage.error)?.message}</AlertDescription>
        </Alert>
      )}
      {search.mediaView !== "files" ? (
        <>
          {coverage.isPending && <p role="status">جارٍ حساب تغطية الحلقات والأفلام…</p>}
          {coverage.data?.items.map((work) => (
            <Card key={work.workId} size="sm">
              <CardHeader>
                <CardTitle>
                  <a href={`#/titles/${work.workId}`}>{work.workTitle}</a>
                </CardTitle>
                <CardDescription>
                  {work.availableUnits} متاحًا من {work.expectedUnits} حلقة أو فيلم ·{" "}
                  {work.missingUnits} لم تُستورد · {work.fileCount} ملفًا مسجّلًا
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress
                  value={work.expectedUnits ? (100 * work.availableUnits) / work.expectedUnits : 0}
                  aria-label={`تغطية ${work.workTitle}`}
                />
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  render={<a href={`#/admin/works/${work.workId}?section=structure`} />}
                >
                  إدارة الفيديوهات
                </Button>
                <ImportMediaDialog workId={work.workId}>
                  <Button variant="secondary">استيراد إلى هذا العمل</Button>
                </ImportMediaDialog>
              </CardFooter>
            </Card>
          ))}
          {coverage.data?.items.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد أعمال مطابقة</EmptyTitle>
                <EmptyDescription>غيّر البحث أو عرض التغطية.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {coverage.data && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() =>
                  void navigate({ search: (previous) => ({ ...previous, page: String(page - 1) }) })
                }
              >
                السابق
              </Button>
              <span>
                {coverage.data.total} عملًا · الصفحة {page}
              </span>
              <Button
                variant="outline"
                disabled={page * 30 >= coverage.data.total}
                onClick={() =>
                  void navigate({ search: (previous) => ({ ...previous, page: String(page + 1) }) })
                }
              >
                التالي
              </Button>
            </div>
          )}
        </>
      ) : files.isPending ? (
        <p role="status">جارٍ قراءة مكتبة الخادم…</p>
      ) : files.data?.items.length ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العمل / الحلقة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الحجم</TableHead>
                  <TableHead>الملف</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.data.items.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <a href={`#/admin/works/${file.workId}?section=structure`}>
                          {file.workTitle}
                        </a>
                        <span>{file.episodeTitle ?? file.installmentTitle}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={file.availability === "present" ? "secondary" : "outline"}>
                        {file.isTrashed
                          ? "في المحذوفات"
                          : file.availability === "present"
                            ? "متاح"
                            : "يحتاج مراجعة"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {file.byteSize === null ? "—" : formatSourceSize(file.byteSize)}
                    </TableCell>
                    <TableCell>
                      <span className="break-all" dir="ltr">
                        {file.relativePath}
                      </span>
                    </TableCell>
                    <TableCell>
                      <MediaFileActions file={file} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-4 md:hidden">
            {files.data.items.map((file) => (
              <Card key={file.id} size="sm">
                <CardHeader>
                  <CardTitle>
                    <a href={`#/admin/works/${file.workId}?section=structure`}>{file.workTitle}</a>
                  </CardTitle>
                  <CardDescription>{file.episodeTitle ?? file.installmentTitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline">
                      {file.isTrashed
                        ? "في المحذوفات"
                        : file.availability === "present"
                          ? "متاح"
                          : "يحتاج مراجعة"}
                    </Badge>
                    <span>{file.byteSize === null ? "—" : formatSourceSize(file.byteSize)}</span>
                  </div>
                  <p className="mt-3 break-all text-xs text-muted-foreground" dir="ltr">
                    {file.relativePath}
                  </p>
                </CardContent>
                <CardFooter>
                  <MediaFileActions file={file} />
                </CardFooter>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() =>
                void navigate({ search: (previous) => ({ ...previous, page: String(page - 1) }) })
              }
            >
              السابق
            </Button>
            <span>
              {files.data.total} ملفًا · الصفحة {page}
            </span>
            <Button
              variant="outline"
              disabled={page * 30 >= files.data.total}
              onClick={() =>
                void navigate({ search: (previous) => ({ ...previous, page: String(page + 1) }) })
              }
            >
              التالي
            </Button>
          </div>
        </>
      ) : (
        files.isSuccess && (
          <Empty>
            <EmptyHeader>
              <FolderOpen />
              <EmptyTitle>لم تُسجّل فيديوهات بعد</EmptyTitle>
              <EmptyDescription>
                استورد ملفاتك واربطها بالأعمال الموجودة. وجود ملف في مجلد الخادم وحده لا يجعله متاحًا
                للمشاهدة.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      )}
    </WorkspacePage>
  );
}
export function MediaJobsPage() {
  const client = useQueryClient();
  const jobs = useQuery(mediaJobsOptions());
  const action = useMutation({
    mutationFn: ({ id, action: operation }: { id: string; action: "cancel" | "retry" }) =>
      controlMediaJob(id, operation),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "media"] }),
  });
  const status = {
    queued: "في الانتظار",
    running: "قيد المعالجة",
    completed: "مكتمل",
    failed: "فشل",
    cancelled: "ملغى",
  };
  return (
    <WorkspacePage
      title="مهام وسائط الخادم"
      description="تستمر المهام على الخادم عند إغلاق التطبيق. لا تشمل تنزيلات الجهاز."
    >
      {(jobs.error || action.error) && (
        <Alert variant="destructive">
          <AlertDescription>{(jobs.error ?? action.error)?.message}</AlertDescription>
        </Alert>
      )}
      {jobs.isPending && <p role="status">جارٍ قراءة المهام…</p>}
      {jobs.data?.map((job) => (
        <section key={job.id} className="flex flex-col gap-3 border-b pb-4">
          <h2>
            {job.label ??
              (job.type === "media.youtube.preview"
                ? "معاينة YouTube"
                : job.type === "media.file"
                  ? "إجراء على ملف"
                  : job.type === "media.upload"
                    ? "رفع ملف"
                    : job.type === "media.upload.verify"
                      ? "التحقق من فيديو مرفوع"
                      : "استيراد فيديوهات")}
          </h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="outline">{status[job.status]}</Badge>
            <span>{new Date(job.createdAt).toLocaleString("ar")}</span>
            <div className="flex gap-2">
              {["queued", "running"].includes(job.status) ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={action.isPending || job.cancelRequested}
                  onClick={() => action.mutate({ id: job.id, action: "cancel" })}
                >
                  {job.cancelRequested ? "جارٍ الإلغاء" : "إلغاء"}
                </Button>
              ) : (
                job.status !== "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: job.id, action: "retry" })}
                  >
                    إعادة المحاولة
                  </Button>
                )
              )}
            </div>
          </div>
          <Progress value={job.progress} aria-label="تقدم مهمة الاستيراد" />
          <MediaJobResult job={job} />
          {job.error && <p role="alert">{job.error}</p>}
        </section>
      ))}
      {jobs.data?.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد مهام وسائط</EmptyTitle>
            <EmptyDescription>ابدأ استيرادًا من مكتبة ملفات الخادم.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </WorkspacePage>
  );
}
const jobResult = z.object({
  phase: z.enum(["downloading", "inspecting", "importing", "verifying", "preview"]).optional(),
  currentFile: z.string().optional(),
  processed: z.number().optional(),
  total: z.number().optional(),
  items: z
    .array(
      z.object({
        fileId: z.string(),
        name: z.string().nullable(),
        status: z.string(),
        error: z.string().nullable(),
      }),
    )
    .optional(),
});
function MediaJobResult({ job }: { job: MediaJob }) {
  const result = jobResult.safeParse(job.result);
  if (!result.success) return null;
  const data = result.data;
  const phases = {
    downloading: "تنزيل الفيديو",
    inspecting: "فحص الملف",
    importing: "تنظيم الملفات",
    verifying: "التحقق من الفيديو",
    preview: "معاينة القائمة",
  };
  return (
    <div className="flex flex-col gap-2 text-sm">
      {job.status === "running" && data.phase && (
        <p role="status">
          {phases[data.phase] ?? "معالجة"} {data.currentFile && `· ${data.currentFile}`}
        </p>
      )}
      {data.total !== undefined && (
        <p>
          {data.processed ?? 0} من {data.total} ملفًا ·{" "}
          {data.items?.filter((item) => item.status === "completed").length ?? 0} مكتملًا
        </p>
      )}
      {data.items
        ?.filter((item) => item.error)
        .map((item) => (
          <p key={item.fileId} role="alert">
            {item.name}: {item.error}
          </p>
        ))}
    </div>
  );
}

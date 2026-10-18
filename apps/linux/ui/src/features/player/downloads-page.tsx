import { useQuery } from "@tanstack/react-query";
import { Download, HardDrive, RefreshCw, Search, ChevronDown, Bookmark } from "lucide-react";
import { useMemo, useState } from "react";

import { Artwork } from "@/components/artwork";
import { Choice } from "@/components/choice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CacheControl } from "./cache-control";
import {
  downloadLibraryOptions,
  downloadQueueOptions,
  jobCategory,
  videoTitle,
  workTitle,
  type SavedVideo,
} from "./download-data";
import { DownloadQueue } from "./download-queue";
import { SavedVideoRow } from "./saved-video-row";
import { SavedWorks } from "./saved-works";
import { offlineStatusOptions } from "./saved-works-data";
import { formatSourceSize } from "./source-format";

export function DownloadsPage() {
  const offline = useQuery(offlineStatusOptions());
  const library = useQuery(downloadLibraryOptions());
  const jobs = useQuery(downloadQueueOptions());
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(24);
  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      { title: string; posterId: string | null; workId: string | null; files: SavedVideo[] }
    >();
    for (const file of library.data?.files ?? []) {
      const key = file.target?.workId ?? file.path.split("/").slice(0, -1).join("/");
      const previous = grouped.get(key);
      if (previous) previous.files.push(file);
      else
        grouped.set(key, {
          title: workTitle(file),
          posterId: file.posterId,
          workId: file.target?.workId ?? null,
          files: [file],
        });
    }
    return [...grouped.entries()].toSorted((a, b) => a[1].title.localeCompare(b[1].title, "ar"));
  }, [library.data]);
  const visible = groups.filter(
    ([, group]) =>
      (filter === "all" ||
        (filter === "ready"
          ? group.files.some((file) => file.available)
          : group.files.some((file) => !file.available))) &&
      `${group.title} ${group.files.map(videoTitle).join(" ")}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const active = jobs.data?.filter((job) => jobCategory(job) === "active").length ?? 0;
  return (
    <section
      className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8"
      aria-labelledby="downloads-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="downloads-heading" className="font-display text-3xl font-semibold">
            مكتبة الجهاز
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            أعمالك المحفوظة، فيديوهاتك، والتنزيلات على هذا الجهاز.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <HardDrive data-icon="inline-start" />
            التخزين
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>التخزين على هذا الجهاز</DialogTitle>
              <DialogDescription>الفيديوهات المحلية والملفات المؤقتة.</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">الفيديوهات المسجّلة</dt>
                <dd className="text-lg font-semibold">
                  {library.data ? formatSourceSize(library.data.usedBytes) : "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted-foreground">المساحة المتاحة</dt>
                <dd className="text-lg font-semibold">
                  {library.data?.freeBytes == null
                    ? "غير متاح"
                    : formatSourceSize(library.data.freeBytes)}
                </dd>
              </div>
            </dl>
            <p className="break-all text-xs text-muted-foreground" dir="ltr">
              {library.data?.root ?? "جارٍ قراءة مجلد الحفظ…"}
            </p>
            {library.error && (
              <Alert variant="destructive">
                <AlertDescription>{library.error.message}</AlertDescription>
              </Alert>
            )}
            <CacheControl />
          </DialogContent>
        </Dialog>
      </header>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{active} قيد النقل</span>
        <span>
          {library.data
            ? `${library.data.files.filter((file) => file.available).length} فيديو جاهز`
            : "جارٍ قراءة الفيديوهات…"}
        </span>
        <span>
          {library.data?.freeBytes == null
            ? ""
            : `${formatSourceSize(library.data.freeBytes)} متاحة`}
        </span>
      </div>
      <Tabs defaultValue={offline.data?.offline ? "saved" : "queue"}>
        <TabsList className="h-auto max-w-full flex-wrap">
          <TabsTrigger value="queue">
            <Download data-icon="inline-start" /> النقل ({jobs.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="saved">
            <Bookmark data-icon="inline-start" /> الأعمال المحفوظة
          </TabsTrigger>
          <TabsTrigger value="library">
            <HardDrive data-icon="inline-start" /> الفيديوهات ({groups.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-5">
          <DownloadQueue compact={false} />
        </TabsContent>
        <TabsContent value="saved" className="mt-5">
          <SavedWorks />
        </TabsContent>
        <TabsContent value="library" className="mt-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <InputGroup className="min-w-48 flex-1">
              <InputGroupInput
                aria-label="بحث في مكتبة الجهاز"
                placeholder="ابحث عن عمل أو حلقة محفوظة…"
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
                label="حالة الفيديوهات المحفوظة"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "كل الأعمال" },
                  { value: "ready", label: "لها فيديو جاهز" },
                  { value: "missing", label: "ملفات تحتاج مراجعة" },
                ]}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="فحص ملفات مكتبة الجهاز"
              disabled={library.isFetching}
              onClick={() => void library.refetch()}
            >
              <RefreshCw data-icon="inline-start" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            فيديوهات جاهزة للتشغيل محليًا. حفظ بيانات العمل وصوره متاح في تبويب الأعمال المحفوظة.
          </p>
          {library.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر قراءة مكتبة الجهاز</AlertTitle>
              <AlertDescription>{library.error.message}</AlertDescription>
            </Alert>
          )}
          {library.isPending ? (
            <Skeleton className="h-64" />
          ) : !visible.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{q ? "لا توجد نتائج" : "لا توجد فيديوهات محفوظة بعد"}</EmptyTitle>
                <EmptyDescription>
                  ستظهر الأعمال هنا بعد اكتمال تنزيل الفيديو والتحقق من حفظه.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            visible.slice(0, limit).map(([key, group]) => (
              <Card key={`${key}:${Boolean(q)}`} size="sm">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Artwork
                      id={group.posterId}
                      alt=""
                      className="h-20 w-14 shrink-0 rounded-lg object-cover"
                      fallback={<Download className="size-7" />}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <CardTitle>
                        <span dir="auto">{group.title}</span>
                      </CardTitle>
                      <CardDescription>
                        {group.files.length} فيديو ·{" "}
                        {formatSourceSize(
                          group.files.reduce((total, file) => total + file.size, 0),
                        )}
                      </CardDescription>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">
                          {group.files.filter((file) => file.available).length} جاهز
                        </Badge>
                        {group.files.some((file) => !file.available) && (
                          <Badge variant="destructive">ملفات مفقودة أو متغيرة</Badge>
                        )}
                      </div>
                      {group.workId && (
                        <a
                          href={`#/titles/${group.workId}`}
                          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                        >
                          فتح صفحة العمل
                        </a>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Collapsible defaultOpen={Boolean(q) || group.files.length <= 3}>
                    <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
                      <ChevronDown data-icon="inline-start" />
                      الفيديوهات ({group.files.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 flex flex-col gap-3">
                      {group.files.map((file) => (
                        <SavedVideoRow key={`${file.id}-${file.file}`} file={file} />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            ))
          )}
          {visible.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 24)}>
              عرض المزيد من الأعمال ({limit} / {visible.length})
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

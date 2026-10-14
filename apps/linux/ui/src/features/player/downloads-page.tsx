import { useQuery } from "@tanstack/react-query";
import { Download, HardDrive, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Artwork } from "@/components/artwork";
import { Choice } from "@/components/choice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { SavedVideoActions } from "./saved-video-actions";
import { formatSourceSize } from "./source-format";

export function DownloadsPage() {
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
      className="mx-auto flex w-full min-w-0 max-w-380 flex-col gap-5 p-4 sm:p-8"
      aria-labelledby="downloads-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="downloads-heading" className="font-display text-3xl font-semibold">
            التنزيلات ومكتبة الجهاز
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            تابع النقل، وادخل إلى الأعمال التي لها فيديوهات محفوظة على جهازك.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{active} قيد النقل</Badge>
          <Badge variant="outline">{groups.length} عمل محفوظ</Badge>
        </div>
      </header>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <HardDrive className="size-5" />
              التخزين على هذا الجهاز
            </span>
          </CardTitle>
          <CardDescription>
            الفيديو المحلي مستقل عن حفظ بيانات العمل وتنزيلات الخادم.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 break-all text-xs text-muted-foreground" dir="ltr">
            {library.data?.root ?? "جارٍ قراءة مجلد الحفظ…"}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span>الفيديوهات المسجّلة: {formatSourceSize(library.data?.usedBytes ?? 0)}</span>
            <span>
              المتاح:{" "}
              {library.data?.freeBytes === null || !library.data
                ? "غير متاح"
                : formatSourceSize(library.data.freeBytes)}
            </span>
          </div>
        </CardContent>
        <CardContent>
          <Collapsible>
            <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
              إدارة الملفات المؤقتة
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <CacheControl />
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">قائمة النقل ({jobs.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="library">الأعمال المحفوظة ({groups.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="queue" className="mt-5">
          <DownloadQueue compact={false} />
        </TabsContent>
        <TabsContent value="library" className="mt-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <InputGroup>
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
            هذه المكتبة تعرض الفيديوهات المسجّلة على جهازك. بيانات صفحة العمل وصوره تعتمد حالياً على
            الاتصال بالخادم.
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
              <Card key={`${key}:${Boolean(q)}`}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Artwork
                      id={group.posterId}
                      alt=""
                      className="h-32 w-24 shrink-0 rounded-xl object-cover"
                      fallback={<Download className="size-7" />}
                    />
                    <div className="flex min-w-0 flex-col gap-2">
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
                      عرض الفيديوهات ({group.files.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 flex flex-col gap-3">
                      {group.files.map((file) => (
                        <div
                          key={`${file.id}-${file.file}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium" dir="auto">
                              {videoTitle(file)}
                            </p>
                            <p className="mt-1 break-all text-xs text-muted-foreground" dir="ltr">
                              {file.path}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatSourceSize(file.size)} ·{" "}
                              {file.available ? "جاهز للمشاهدة" : "مفقود أو تغيّر"}
                            </p>
                          </div>
                          <SavedVideoActions file={file} />
                        </div>
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

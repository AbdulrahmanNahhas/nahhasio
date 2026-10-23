import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Trash2, FileJson, Images, Users, Building2, RefreshCw } from "lucide-react";
import { useState } from "react";

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
import { Skeleton } from "@/components/ui/skeleton";

import { EpisodeArtworkAction } from "./episode-artwork-action";
import { LibraryCleanup } from "./library-cleanup";
import { serverOverviewQuery } from "./queries";

export function LibraryActions() {
  const overview = useQuery(serverOverviewQuery());
  const [action, setAction] = useState<"episodes" | "cleanup" | null>(null);
  const data = overview.data?.insights;
  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          إجراءات على المكتبة · المعاينة أولاً، ثم التأكيد عند تعديل البيانات.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={overview.isFetching}
          onClick={() => void overview.refetch()}
        >
          <RefreshCw data-icon="inline-start" />
          تحديث
        </Button>
      </div>
      {overview.isPending ? (
        <Skeleton className="h-64" />
      ) : overview.isError ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل حالة المكتبة</AlertTitle>
          <AlertDescription>{overview.error.message}</AlertDescription>
        </Alert>
      ) : (
        data && (
          <>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImagePlus />
                    صور الحلقات الناقصة
                  </CardTitle>
                  <CardDescription>
                    جلب صور TMDB وربطها بالحلقات، مع مراجعة المطابقة وعدم استبدال الصور الحالية.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="outline">{data.episodesMissing} حلقة بلا صورة</Badge>
                  <Badge variant="secondary">{data.episodesEligible} مرشحة للمطابقة</Badge>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button
                    disabled={!data.episodeTargets.length}
                    onClick={() => setAction("episodes")}
                  >
                    تجهيز دفعة صور
                  </Button>
                  <Button variant="ghost" render={<a href="#/admin/works?gap=episode-images" />}>
                    مراجعة الأعمال
                  </Button>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 />
                    تنظيف الصور غير المرتبطة
                  </CardTitle>
                  <CardDescription>
                    حذف سجلات الصور غير المستخدمة بعد المعاينة. الصور اللازمة للمراجعات والنسخ المشتقة
                    محمية، والملفات الفعلية تُحفظ للاستعادة.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">
                    {data.unattachedImages} صورة غير مرتبطة قبل فحص الحماية
                  </Badge>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={!data.unattachedImages}
                    onClick={() => setAction("cleanup")}
                  >
                    معاينة التنظيف
                  </Button>
                  <Button variant="ghost" render={<a href="#/admin/images?usage=unassigned" />}>
                    فتح الصور
                  </Button>
                </CardFooter>
              </Card>
            </div>
            <h2 className="text-lg font-semibold">مراجعة وتنظيم البيانات</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  title: "صور الأشخاص",
                  description: "الأشخاص الذين لم تُربط بهم صورة بعد.",
                  href: "#/admin/people?image=without",
                  icon: Users,
                },
                {
                  title: "ملفات الاستوديوهات",
                  description: "الاستوديوهات غير المرتبطة بأعمال؛ راجعها قبل أي حذف.",
                  href: "#/admin/studios?usage=unlinked",
                  icon: Building2,
                },
                {
                  title: "توحيد أسماء الصور",
                  description: "اقتراح أسماء الصور المرتبطة ومراجعتها من مكتبة الصور.",
                  href: "#/admin/images?usage=assigned",
                  icon: Images,
                },
                {
                  title: "تقييمات ناقصة",
                  description: "الأعمال التي تحتوي أجزاء بمعايير تقييم غير مكتملة.",
                  href: "#/admin/works?gap=scores",
                  icon: ImagePlus,
                },
                {
                  title: "تحرير جماعي",
                  description: "تحديد الأعمال ثم مراجعة تعديلات JSON قبل الحفظ.",
                  href: "#/admin/works",
                  icon: FileJson,
                },
                {
                  title: "مراجعة البيانات الخام",
                  description: "فحص الجداول والحقول للقراءة فقط.",
                  href: "#/admin/tables",
                  icon: FileJson,
                },
              ].map((item) => (
                <Card key={item.title} size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <item.icon />
                      {item.title}
                    </CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button variant="outline" render={<a href={item.href} />}>
                      فتح المراجعة
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </>
        )
      )}
      {action === "cleanup" && <LibraryCleanup onClose={() => setAction(null)} />}
      {action === "episodes" && data && (
        <EpisodeArtworkAction targets={data.episodeTargets} onClose={() => setAction(null)} />
      )}
    </div>
  );
}

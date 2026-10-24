import type { WorkDetail } from "@nahhasio/api-contract";
import { CalendarDays, Clock3 } from "lucide-react";
import type { ReactNode } from "react";

import { Artwork } from "@/components/artwork";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { entityLink } from "@/features/shell/navigation";
import { pickArtwork } from "@/features/work/format";

import { WatchCompanion } from "./watch-companion";

export function MovieInfo({
  work,
  installment,
  offline,
  onLeave,
  selector,
  navigation,
  showRecommendations = true,
  status,
}: {
  work: WorkDetail;
  installment: WorkDetail["installments"][number];
  offline: boolean;
  onLeave: () => void;
  selector?: ReactNode;
  navigation?: ReactNode;
  showRecommendations?: boolean;
  status: "playing" | "selected" | "browsing";
}) {
  const title =
    work.installments.length === 1 ? work.titleAr || work.canonicalTitle : installment.title;
  const studios = work.contributions
    .filter((credit) => credit.kind === "organization")
    .toSorted((a, b) => a.position - b.position);
  const year = installment.releaseDate?.slice(0, 4) || work.releaseYear;
  return (
    <aside
      aria-label={installment.kind === "special" ? "معلومات العرض الخاص" : "معلومات الفيلم"}
      className="min-w-0 xl:sticky xl:top-4 xl:row-span-2 xl:h-[calc(100dvh-6rem)]"
    >
      <Card className="h-full">
        <CardHeader>
          {selector}
          <div className="flex items-start gap-4">
            <Artwork
              id={(pickArtwork(installment.artwork, "poster") ?? work.poster)?.id}
              alt=""
              className="aspect-2/3 w-24 shrink-0 rounded-lg object-cover"
            />
            <div className="flex min-w-0 flex-col gap-3">
              <CardTitle>
                <h2 dir="auto">{title}</h2>
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">
                  {installment.kind === "special" ? "عرض خاص" : "فيلم"}
                </Badge>
                <Badge variant={status === "playing" ? "secondary" : "outline"}>
                  {status === "playing"
                    ? "قيد التشغيل"
                    : status === "selected"
                      ? "المحدد للمشاهدة"
                      : "تستعرض هذا الجزء"}
                </Badge>
              </div>
              {work.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {work.genres.map((genre) => (
                    <Badge key={genre.id} variant="secondary">
                      {genre.labelAr || genre.labelEn}
                    </Badge>
                  ))}
                </div>
              )}
              {title !== work.canonicalTitle && (
                <p dir="auto" className="text-sm text-muted-foreground">
                  {work.canonicalTitle}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {year && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3" aria-hidden="true" />
                    {year}
                  </span>
                )}
                {installment.runtimeMinutes && (
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-3" aria-hidden="true" />
                    {installment.runtimeMinutes} دقيقة
                  </span>
                )}
                {work.age && <Badge variant="outline">{work.age}</Badge>}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-5 scroll-fade-y overflow-y-auto">
          {studios.length > 0 && (
            <section className="flex flex-col gap-3" aria-label="الاستوديوهات والجهات">
              <h3 className="text-sm font-semibold">الاستوديوهات والجهات</h3>
              <ItemGroup>
                {studios.map((studio) => (
                  <div key={`${studio.id}:${studio.roleId}`} role="listitem">
                    <Item
                      size="xs"
                      className="flex-nowrap text-start"
                      render={<a href={entityLink("studios", studio.id)} onClick={onLeave} />}
                    >
                      <Artwork
                        studioLogo="compact"
                        id={pickArtwork(studio.artwork, "logo")?.id ?? studio.artwork[0]?.id}
                        alt=""
                        className="aspect-video w-28 shrink-0 rounded-lg"
                      />
                      <ItemContent className="min-w-0">
                        <ItemTitle dir="auto" className="line-clamp-2">
                          {studio.name}
                        </ItemTitle>
                        <p className="text-xs text-muted-foreground">
                          {studio.roleLabelAr || studio.roleLabelEn}
                        </p>
                      </ItemContent>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            </section>
          )}
          <WatchCompanion
            work={work}
            offline={offline}
            onLeave={onLeave}
            showRecommendations={showRecommendations}
          />
        </CardContent>
        {navigation && (
          <CardFooter className="flex-col items-stretch gap-3 border-t">{navigation}</CardFooter>
        )}
      </Card>
    </aside>
  );
}

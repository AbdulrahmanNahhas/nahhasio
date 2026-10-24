import type { WorkDetail } from "@nahhasio/api-contract";
import { Check, Play } from "lucide-react";

import { Artwork } from "@/components/artwork";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { pickArtwork } from "@/features/work/format";
import type { WorkTracking } from "@/features/work/use-work-tracking";

import { WatchCompanion } from "./watch-companion";

type Installment = WorkDetail["installments"][number];

export function MovieInstallments({
  work,
  selectedId,
  playing,
  pending,
  tracking,
  onSelect,
  offline,
  onLeave,
}: {
  work: WorkDetail;
  selectedId: string;
  playing: boolean;
  pending: boolean;
  tracking: WorkTracking;
  onSelect: (installment: Installment) => void;
  offline: boolean;
  onLeave: () => void;
}) {
  const installments = work.installments.toSorted((a, b) => a.position - b.position);
  return (
    <aside
      aria-label="أفلام وأجزاء العمل"
      className="min-w-0 xl:sticky xl:top-4 xl:row-span-2 xl:h-[calc(100dvh-6rem)]"
    >
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>
              <h2>أفلام وأجزاء العمل</h2>
            </CardTitle>
            <Badge variant="outline">{installments.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-5 scroll-fade-y overflow-y-auto">
          <ItemGroup aria-label="اختر الفيلم أو الجزء">
            {installments.map((installment) => {
              const selected = installment.id === selectedId;
              const upcoming =
                installment.status === "announced" || installment.releaseState === "upcoming";
              const watched = tracking.state.data?.installments.find(
                (item) => item.installmentId === installment.id,
              )?.summary.isFullyWatched;
              const year = installment.releaseDate?.slice(0, 4);
              return (
                <div key={installment.id} role="listitem">
                  <Item
                    size="sm"
                    variant={selected ? "muted" : "default"}
                    className="flex-nowrap text-start hover:bg-muted disabled:opacity-50"
                    render={
                      <button
                        type="button"
                        disabled={pending || upcoming}
                        aria-current={selected ? "true" : undefined}
                        onClick={() => {
                          if (!selected) onSelect(installment);
                        }}
                      />
                    }
                  >
                    <Artwork
                      id={(pickArtwork(installment.artwork, "poster") ?? work.poster)?.id}
                      alt=""
                      className="aspect-2/3 w-16 shrink-0 rounded-lg object-cover"
                    />
                    <ItemContent className="min-w-0">
                      <ItemTitle dir="auto" className="line-clamp-2">
                        {installment.title}
                      </ItemTitle>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {year && <span>{year}</span>}
                        {installment.runtimeMinutes && (
                          <span>{installment.runtimeMinutes} دقيقة</span>
                        )}
                        {installment.kind === "season" && (
                          <span>{installment.episodes.length} حلقة</span>
                        )}
                        {installment.kind === "special" && <span>عرض خاص</span>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selected && (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <Play className="size-3" aria-hidden="true" />
                            {playing
                              ? "قيد التشغيل"
                              : installment.kind === "special"
                                ? "العرض المحدد"
                                : "الفيلم المحدد"}
                          </span>
                        )}
                        {upcoming && <Badge variant="outline">قادم</Badge>}
                        {watched && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Check className="size-3" aria-hidden="true" />
                            تمّت المشاهدة
                          </span>
                        )}
                      </div>
                    </ItemContent>
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
          <WatchCompanion work={work} offline={offline} onLeave={onLeave} />
        </CardContent>
      </Card>
    </aside>
  );
}

import type { WorkDetail } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";

import { Artwork } from "@/components/artwork";
import { Failure } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { workLink } from "@/features/shell/navigation";
import { gateway } from "@/lib/bridge";
import { languageName } from "@/lib/languages";

/** Companion data uses the work page's existing recommendation endpoint and cache. */
export function WatchCompanion({
  work,
  offline,
  onLeave,
  showRecommendations = true,
}: {
  work: WorkDetail;
  offline: boolean;
  onLeave: () => void;
  showRecommendations?: boolean;
}) {
  const recommendations = useQuery({
    queryKey: ["work", work.id, "recommendations"],
    queryFn: ({ signal }) => gateway.recommendations(work.id, signal),
    enabled: !offline && showRecommendations,
    staleTime: 60000,
    retry: 1,
  });
  const facts = [
    ["النوع", work.format === "animated" ? "رسوم متحركة" : "تمثيل حي"],
    ["بلد الإنتاج", work.countries.map((country) => country.labelAr || country.labelEn).join("، ")],
    ["الدبلجة المسجّلة", work.dubLanguages?.map(languageName).join("، ")],
  ].filter((row) => row[1]);
  return (
    <div className="flex flex-col gap-5">
      <Separator />
      <section aria-label="عن العمل" className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">عن العمل</h3>
        <dl className="flex flex-col gap-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="shrink-0 text-muted-foreground">{label}</dt>
              <dd className="text-end">{value}</dd>
            </div>
          ))}
        </dl>
        {work.dubbingNotes && (
          <p dir="auto" className="text-sm leading-loose text-muted-foreground">
            {work.dubbingNotes}
          </p>
        )}
        {work.playbackPolicy === "files-only" && (
          <Badge variant="outline">المشاهدة من الملفات</Badge>
        )}
      </section>
      {!offline && showRecommendations && (
        <section aria-label="أعمال مقترحة للمشاهدة" className="flex flex-col gap-3">
          <Separator />
          <h3 className="text-sm font-semibold">قد يعجبك أيضًا</h3>
          {recommendations.isPending && (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          )}
          {recommendations.isError && (
            <Failure error={recommendations.error} retry={() => void recommendations.refetch()} />
          )}
          {recommendations.isSuccess && recommendations.data.items.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد اقتراحات مشابهة حاليًا.</p>
          )}
          <ItemGroup>
            {recommendations.data?.items.slice(0, 3).map((item) => (
              <div key={item.id} role="listitem">
                <Item
                  size="xs"
                  className="flex-nowrap"
                  render={<a href={workLink(item.id)} onClick={onLeave} />}
                >
                  <Artwork
                    id={item.poster?.id}
                    alt=""
                    className="aspect-2/3 w-12 shrink-0 rounded-lg object-cover"
                  />
                  <ItemContent className="min-w-0">
                    <ItemTitle dir="auto" className="line-clamp-2">
                      {item.titleAr || item.canonicalTitle}
                    </ItemTitle>
                    <p className="text-xs text-muted-foreground">{item.releaseYear}</p>
                  </ItemContent>
                </Item>
              </div>
            ))}
          </ItemGroup>
        </section>
      )}
    </div>
  );
}

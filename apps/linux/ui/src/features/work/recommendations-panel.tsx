import type { WorkMatch } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp } from "lucide-react";

import { MediaCard } from "@/components/media-card";
import { Failure } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { offlineStatusOptions } from "@/features/player/saved-works-data";
import { gateway } from "@/lib/bridge";

function MatchExplanation({ match }: { match: WorkMatch }) {
  const total = match.reasons.reduce((sum, reason) => sum + reason.weight, 0);
  const strongest = match.reasons.filter((reason) => reason.similarity > 0).slice(0, 3);
  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <Badge variant="secondary">{match.percentage}% تشابه</Badge>
      <Popover>
        <PopoverTrigger
          render={<Button size="icon-sm" variant="ghost" aria-label="لماذا اقتُرح هذا العمل؟" />}
        >
          <CircleHelp />
        </PopoverTrigger>
        <PopoverContent className="max-h-96 w-80 max-w-full overflow-y-auto" align="end">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <PopoverTitle>لماذا هذا الاقتراح؟</PopoverTitle>
              <PopoverDescription>أقوى نقاط التشابه مع العمل الحالي</PopoverDescription>
            </div>
            <Badge variant="secondary">{match.percentage}%</Badge>
          </div>
          <div className="flex flex-col gap-4">
            {strongest.map((reason) => (
              <div key={reason.key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{reason.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {reason.similarity}%
                  </span>
                </div>
                {reason.shared.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reason.shared.slice(0, 3).map((label) => (
                      <Badge key={label} variant="outline">
                        {label}
                      </Badge>
                    ))}
                    {reason.shared.length > 3 && (
                      <Badge variant="outline">+{reason.shared.length - 3}</Badge>
                    )}
                  </div>
                )}
                <Progress value={reason.similarity} aria-label={`تشابه ${reason.label}`} />
              </div>
            ))}
          </div>
          <details className="border-t border-border pt-3">
            <summary className="cursor-pointer text-sm font-medium">تفاصيل حساب التشابه</summary>
            <dl className="mt-3 flex flex-col gap-3">
              {match.reasons.map((reason) => (
                <div key={reason.key} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3">
                    <dt>{reason.label}</dt>
                    <dd className="tabular-nums">{reason.similarity}%</dd>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    وزنه في النتيجة: {Math.round((reason.weight / total) * 100)}%
                    {reason.shared.length > 0 && (
                      <p className="mt-1 leading-relaxed">{reason.shared.join("، ")}</p>
                    )}
                  </div>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              النسبة متوسط موزون لتشابه البيانات، وليست توقعًا للإعجاب. لا ترفع البيانات الناقصة نسبة
              التشابه.
            </p>
          </details>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function RecommendationsPanel({ id }: { id: string }) {
  const offline = useQuery(offlineStatusOptions());
  const query = useQuery({
    queryKey: ["work", id, "recommendations"],
    queryFn: ({ signal }) => gateway.recommendations(id, signal),
    enabled: offline.isSuccess && !offline.data.offline,
    staleTime: 60000,
    retry: 1,
  });
  if (offline.data?.offline || query.data?.items.length === 0) return null;
  return (
    <section className="mt-12 min-w-0 border-t border-border pt-8" aria-label="أعمال قد تعجبك">
      <header className="mb-5 flex flex-col gap-2">
        <h2 className="text-xl font-semibold">أعمال قد تعجبك</h2>
        <p className="text-sm text-muted-foreground">
          حتى عشرة أعمال من مكتبتك، بناءً على هذا العمل. افتح علامة الاستفهام لمعرفة تفاصيل التشابه.
        </p>
      </header>
      {query.isError && <Failure error={query.error} retry={() => void query.refetch()} />}
      {query.isPending && (
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-5"
          aria-label="جارٍ تحميل الاقتراحات"
        >
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="aspect-2/3" />
          ))}
        </div>
      )}
      <div
        role="list"
        aria-label="الأعمال المقترحة"
        className="grid grid-cols-2 gap-x-4 gap-y-7 lg:grid-cols-5"
      >
        {query.data?.items.map((work) => {
          const match = query.data?.matches?.find((item) => item.workId === work.id);
          return (
            <div key={work.id} role="listitem" className="min-w-0">
              <MediaCard work={work} />
              {match && <MatchExplanation match={match} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

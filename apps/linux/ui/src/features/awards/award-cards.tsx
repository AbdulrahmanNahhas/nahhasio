import type { AwardEntry } from "@nahhasio/api-contract";
import { cn } from "cn";
import { Award, ChevronLeft, Trophy } from "lucide-react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { Badge } from "@/components/ui/badge";
import { workLink } from "@/features/shell/navigation";

const linkFocus =
  "outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AwardProgramLink({
  slug,
  name,
  workCount,
}: {
  slug: string;
  name: string;
  workCount: number;
}) {
  const navigation = useCardNavigation();
  return (
    <a
      {...navigation}
      href={`#/awards/${encodeURIComponent(slug)}`}
      className={cn(
        "group/award flex min-h-32 min-w-0 flex-col justify-between gap-3 rounded-2xl border border-border bg-linear-to-br from-warning/15 to-card p-4 hover:border-warning/60",
        linkFocus,
      )}
    >
      <Award className="size-6 text-warning" aria-hidden />
      <div className="flex min-w-0 items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold wrap-anywhere" dir="auto">
            {name}
          </p>
          <p className="text-xs text-muted-foreground">{workCount} عمل</p>
        </div>
        <ChevronLeft
          className="size-4 shrink-0 text-muted-foreground group-hover/award:text-foreground group-focus-visible/award:text-foreground"
          aria-hidden
        />
      </div>
    </a>
  );
}

export function AwardWorkCard({
  entry,
  compact = false,
}: {
  entry: AwardEntry;
  compact?: boolean;
}) {
  const navigation = useCardNavigation();
  const { workId, installmentId, title, installmentTitle, result, category, year, posterId } =
    entry;
  const winner = result === "winner";
  return (
    <a
      {...navigation}
      href={workLink(workId, installmentId ?? undefined)}
      className={cn(
        "group/recognition flex min-w-0 rounded-xl",
        compact ? "items-center gap-3 p-2 hover:bg-muted" : "flex-col gap-2",
        linkFocus,
      )}
    >
      <div
        className={cn(
          "relative aspect-2/3 shrink-0 overflow-hidden rounded-xl bg-muted",
          compact
            ? "w-11"
            : "w-full border border-border group-hover/recognition:border-warning/60",
        )}
      >
        <Artwork id={posterId} alt="" width={320} className="size-full object-cover" />
        {!compact && (
          <div className="absolute inset-s-2 top-2">
            <Badge variant="secondary">
              <Trophy className="text-warning" data-icon="inline-start" aria-hidden />
              {year ?? "فائز"}
            </Badge>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 font-medium" dir="auto">
          {title}
        </span>
        {installmentTitle && installmentTitle !== title && (
          <span className="line-clamp-1 text-xs text-muted-foreground" dir="auto">
            {installmentTitle}
          </span>
        )}
        {compact ? (
          <div>
            {winner ? (
              <Badge variant="secondary">
                <Trophy className="text-warning" data-icon="inline-start" aria-hidden /> فائز
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">مرشّح</span>
            )}
          </div>
        ) : (
          <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground" dir="auto">
            {category}
          </span>
        )}
      </div>
    </a>
  );
}

import type { WorkDetail } from "@nahhasio/api-contract";
import { ChevronDown, Clapperboard, ExternalLink } from "lucide-react";

import { useCardNavigation } from "@/components/card-navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { languageName } from "@/lib/languages";

type Trailers = NonNullable<WorkDetail["trailers"]>;
const trailerUrl = (trailer: Trailers[number]) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.youtubeVideoId)}`;

export function WorkTrailers({ trailers }: { trailers: Trailers }) {
  const navigation = useCardNavigation();
  const primary = trailers.find((trailer) => trailer.isPrimary) ?? trailers[0];
  if (!primary) return null;
  return (
    <div className="flex items-center gap-1" aria-label="إعلانات العمل">
      <Button
        {...navigation}
        variant="outline"
        size="icon-lg"
        className="size-12"
        render={<a href={trailerUrl(primary)} target="_blank" rel="noopener noreferrer" />}
        aria-label="مشاهدة الإعلان التشويقي على YouTube"
        title={`الإعلان التشويقي على YouTube${primary.title ? `: ${primary.title}` : ""}`}
      >
        <Clapperboard />
      </Button>
      {trailers.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                {...navigation}
                variant="outline"
                size="icon-sm"
                title="كل الإعلانات التشويقية"
                aria-label="كل الإعلانات التشويقية"
              />
            }
          >
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel>الإعلانات على YouTube</DropdownMenuLabel>
              {trailers.map((trailer) => (
                <DropdownMenuItem
                  key={trailer.id}
                  render={
                    <a href={trailerUrl(trailer)} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="whitespace-normal wrap-anywhere" dir="auto">
                      {trailer.title || "الإعلان التشويقي"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        trailer.language ? languageName(trailer.language) : null,
                        trailer.isPrimary ? "الإعلان الرئيسي" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ExternalLink data-icon="inline-end" />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

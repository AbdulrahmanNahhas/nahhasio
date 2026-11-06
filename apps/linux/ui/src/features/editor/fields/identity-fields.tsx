import type { WorkDocument } from "@arcadia/contracts/work";
import { ExternalLinkIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { identityKeys, identityLink } from "@/features/editor/artwork/artwork-model";
import { TextField } from "@/features/editor/fields/work-fields";

type Key = "tmdbId" | "imdbId" | "anilistId" | "malId";
export function IdentityFields({
  ids,
  series,
  prefix = "",
  onChange,
  keys = identityKeys,
  compact = false,
}: {
  compact?: boolean;
  ids: Pick<WorkDocument, Key>;
  keys?: readonly Key[];
  series: boolean;
  prefix?: string;
  onChange: (key: Key, value: string | number | null) => void;
}) {
  return (
    <FieldGroup className={compact ? "grid grid-cols-2" : "grid sm:grid-cols-2 lg:grid-cols-3"}>
      {keys.map((key) => {
        const href = identityLink(key, ids[key], series);
        const label = {
          tmdbId: "TMDB",
          imdbId: "IMDb",
          anilistId: "AniList",
          malId: "MyAnimeList",
        }[key];
        return (
          <div key={key} className="flex min-w-0 flex-col gap-2">
            <TextField
              label={
                compact ? (
                  <>
                    <span className="sr-only">{prefix}</span>
                    {label}
                  </>
                ) : (
                  `${prefix}${label}`
                )
              }
              type={key === "imdbId" ? "text" : "number"}
              min={1}
              value={ids[key]}
              onChange={(value) =>
                onChange(key, value ? (key === "imdbId" ? value : Number(value)) : null)
              }
            />
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                معاينة {label}
              </a>
            )}
          </div>
        );
      })}
    </FieldGroup>
  );
}

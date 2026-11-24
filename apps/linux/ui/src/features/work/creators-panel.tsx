import type { Contribution, WorkDetail } from "@nahhasio/api-contract";

import { EntityCard } from "@/features/catalog/entity-card";
import { ScrollShelf } from "@/features/home/scroll-shelf";
import { languageName } from "@/lib/languages";

import { entityLink } from "../shell/navigation";
import { pickArtwork } from "./format";

export function CreatorsPanel({ work }: { work: WorkDetail }) {
  const creditsByEntity = new Map<string, { entity: Contribution; credits: Contribution[] }>();
  for (const credit of work.contributions) {
    const key = `${credit.kind}:${credit.id}`;
    const group = creditsByEntity.get(key);
    if (group) group.credits.push(credit);
    else creditsByEntity.set(key, { entity: credit, credits: [credit] });
  }
  const contributions = [...creditsByEntity.values()].toSorted(
    (a, b) => Number(b.entity.kind === "organization") - Number(a.entity.kind === "organization"),
  );
  return (
    <section className="min-w-0" aria-label="الاستوديوهات والأشخاص">
      <h2 className="text-xl font-semibold">الاستوديوهات والأشخاص</h2>
      <ScrollShelf
        label="مساهمو العمل"
        itemClassName={({ entity }) =>
          entity.kind === "organization" ? "w-50 sm:w-55 xl:w-60" : "w-40 sm:w-44 xl:w-48"
        }
        items={contributions}
        render={({ entity, credits }) => {
          const studio = entity.kind === "organization";
          const images = credits.flatMap((credit) => credit.artwork);
          const artwork = pickArtwork(images, studio ? "logo" : "profile") ?? images[0];
          const roles = new Set(
            credits.map((credit) => credit.roleLabelAr || credit.roleLabelEn || credit.role),
          );
          const languages = new Set(credits.flatMap((credit) => credit.languages ?? []));
          const notes = new Set(
            credits
              .flatMap((credit) => [
                credit.description.trim(),
                credit.roleDescriptionAr.trim() || credit.roleDescriptionEn.trim(),
              ])
              .filter(Boolean),
          );
          return (
            <EntityCard
              key={`${entity.kind}:${entity.id}`}
              entity={{ label: entity.name, artworkId: artwork?.id }}
              kind={studio ? "studio" : "person"}
              href={entityLink(studio ? "studios" : "contributors", entity.id)}
              artworkLayout={studio ? "square" : "portrait"}
              accessibleLabel={`أعمال ${entity.name}`}
              metadata={
                <div className="mt-1 flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
                  <p dir="auto">{[...roles].join("، ")}</p>
                  {!studio && credits.some((credit) => credit.isPrimary) && <p>دور رئيسي</p>}
                  {languages.size > 0 && (
                    <p dir="auto">{[...languages].map(languageName).join("، ")}</p>
                  )}
                  {!studio &&
                    [...notes].map((note) => (
                      <p key={note} className="line-clamp-2" dir="auto">
                        {note}
                      </p>
                    ))}
                </div>
              }
              compact
            />
          );
        }}
      />
    </section>
  );
}

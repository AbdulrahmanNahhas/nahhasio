import type { Contribution, WorkDetail } from "@nahhasio/api-contract";
import { ArrowUpLeft } from "lucide-react";

import { languageName } from "@/lib/languages";

import { Artwork } from "../../components/artwork";
import { useCardNavigation } from "../../components/card-navigation";
import { Badge } from "../../components/ui/badge";
import { entityLink } from "../shell/navigation";
import { Section } from "./field-list";
import { pickArtwork } from "./format";

function Credit({ credit }: { credit: Contribution }) {
  const navigation = useCardNavigation();
  const organization = credit.kind === "organization";
  const roleDescription = credit.roleDescriptionAr.trim() || credit.roleDescriptionEn.trim();
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-0">
      <a
        {...navigation}
        href={entityLink(organization ? "studios" : "contributors", credit.id)}
        aria-label={`أعمال ${credit.name}`}
        className="group flex min-w-0 flex-1 items-start gap-4 rounded-xl p-2 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Artwork
          id={pickArtwork(credit.artwork, "profile")?.id ?? credit.artwork[0]?.id}
          alt=""
          className="size-20 shrink-0 rounded-xl object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold wrap-anywhere">
              <bdi>{credit.name}</bdi>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-primary" dir="auto">
                {credit.roleLabelAr || credit.roleLabelEn || credit.role}
              </span>
              {credit.languages?.map((language) => (
                <Badge variant="outline" key={language}>
                  {languageName(language)}
                </Badge>
              ))}
              {credit.isPrimary && <Badge variant="secondary">دور رئيسي</Badge>}
            </div>
          </div>
          {credit.description.trim() && (
            <p
              className="line-clamp-3 text-sm leading-relaxed text-muted-foreground wrap-anywhere"
              dir="auto"
            >
              {credit.description}
            </p>
          )}
          {roleDescription && roleDescription !== credit.description.trim() && (
            <p className="line-clamp-2 text-sm leading-relaxed wrap-anywhere" dir="auto">
              {roleDescription}
            </p>
          )}
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground group-hover:text-primary">
            {organization ? "استكشف أعمال الجهة" : "استكشف أعمال الشخص"}
            <ArrowUpLeft aria-hidden="true" className="size-4 shrink-0" />
          </span>
        </div>
      </a>
    </article>
  );
}

export function CreatorsPanel({ work }: { work: WorkDetail }) {
  const groups = [
    {
      title: "الأشخاص",
      description: "المساهمون في كتابة العمل وإخراجه وأدائه وتنفيذه، بحسب الأدوار المسجّلة.",
      items: work.contributions.filter((credit) => credit.kind !== "organization"),
    },
    {
      title: "الاستوديوهات والجهات",
      description: "جهات الإنتاج والمساهمات المؤسسية المسجّلة لهذا العمل.",
      items: work.contributions.filter((credit) => credit.kind === "organization"),
    },
  ];
  return (
    <div className="min-w-0">
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <Section key={group.title} title={group.title} description={group.description}>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {group.items.map((credit) => (
                <Credit
                  credit={credit}
                  key={`${credit.kind}:${credit.id}:${credit.roleId}:${credit.position}`}
                />
              ))}
            </div>
          </Section>
        ))}
    </div>
  );
}

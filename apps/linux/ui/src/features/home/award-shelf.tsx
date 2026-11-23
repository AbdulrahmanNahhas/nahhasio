import { useQuery } from "@tanstack/react-query";

import { AwardProgramLink } from "@/features/awards/award-cards";
import { awardsQuery } from "@/features/awards/awards.queries";

import { HomeSectionHeading } from "./home-section";
import { ScrollShelf } from "./scroll-shelf";

export function AwardShelf() {
  const { data } = useQuery(awardsQuery());
  if (!data?.programs.length) return null;
  return (
    <section aria-label="الجوائز">
      <HomeSectionHeading title="الجوائز" href="#/awards" />
      <ScrollShelf
        items={data.programs}
        layout="logo"
        render={(program) => <AwardProgramLink key={program.slug} {...program} />}
      />
    </section>
  );
}

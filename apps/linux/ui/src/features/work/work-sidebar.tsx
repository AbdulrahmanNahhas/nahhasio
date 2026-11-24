import type { WorkDetail } from "@nahhasio/api-contract";
import { cn } from "cn";
import { ChevronLeft, Film, MessagesSquare, Users } from "lucide-react";
import type { RefObject } from "react";

import { useCardNavigation } from "@/components/card-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanetTile } from "@/features/planets/planet-tile";

import { ParentalGuide } from "./parental-guide";

type SectionTarget = RefObject<HTMLElement | null>;

export function WorkSidebar({
  work,
  className,
  installments,
  credits,
  discussion,
}: {
  work: WorkDetail;
  className?: string;
  installments?: SectionTarget;
  credits?: SectionTarget;
  discussion?: SectionTarget;
}) {
  const navigation = useCardNavigation();
  const sections = [
    { target: installments, label: "الأجزاء والإصدارات", icon: Film },
    { target: credits, label: "الاستوديوهات والأشخاص", icon: Users },
    { target: discussion, label: "نقاش العائلة", icon: MessagesSquare },
  ].filter(({ target }) => target);

  return (
    <aside
      className={cn(
        "grid min-w-0 gap-4 xl:sticky xl:top-4 xl:max-h-work-sidebar xl:overflow-y-auto xl:p-1 xl:scrollbar-thin",
        className,
      )}
      aria-label="لمحة العمل"
    >
      <ParentalGuide work={work} />
      {work.planets.length > 0 && (
        <section aria-label="الكوكب" className="grid min-w-0 gap-4">
          {work.planets.map((planet) => (
            <PlanetTile key={planet.id} planet={planet} variant="work" bannerId={work.banner?.id} />
          ))}
        </section>
      )}
      {sections.length > 0 && (
        <Card size="sm" className="hidden min-w-0 gap-2 bg-card/60 md:flex">
          <CardHeader>
            <CardTitle>
              <h2 className="font-semibold">أقسام العمل</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <nav className="flex flex-col gap-1" aria-label="أقسام العمل">
              {sections.map(({ target, label, icon: Icon }) => (
                <Button
                  key={label}
                  {...navigation}
                  variant="ghost"
                  size="sm"
                  className="h-auto min-h-9 w-full justify-start py-1.5 text-start whitespace-normal"
                  onClick={() => {
                    const section = target?.current;
                    section?.scrollIntoView({ block: "start" });
                    section?.focus({ preventScroll: true });
                  }}
                >
                  <Icon data-icon="inline-start" aria-hidden />
                  <span className="min-w-0 flex-1 wrap-anywhere">{label}</span>
                  <ChevronLeft data-icon="inline-end" aria-hidden />
                </Button>
              ))}
            </nav>
          </CardContent>
        </Card>
      )}
    </aside>
  );
}

import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { useCardNavigation } from "@/components/card-navigation";

export function HomeSectionHeading({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children?: ReactNode;
}) {
  const navigation = useCardNavigation();
  return (
    <header className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <h2 className="font-display text-2xl leading-normal font-semibold sm:text-3xl">
        {href ? (
          <a
            {...navigation}
            href={href}
            className="group/heading inline-flex items-center gap-2 rounded-lg outline-none transition-colors hover:text-primary focus-visible:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            {title}
            <ChevronLeft
              className="size-5 text-muted-foreground group-hover/heading:text-current group-focus-visible/heading:text-current motion-safe:transition-transform motion-safe:group-hover/heading:-translate-x-1"
              aria-hidden
            />
          </a>
        ) : (
          title
        )}
      </h2>
      {children}
    </header>
  );
}

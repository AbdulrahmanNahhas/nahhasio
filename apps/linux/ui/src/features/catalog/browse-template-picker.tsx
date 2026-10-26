import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

import { browseLibrary, browseTemplates, selectLibrary } from "./browse-templates";

export function BrowseTemplatePicker({
  search,
  path,
  onApply,
}: {
  search: string;
  path: string;
  onApply: (search: string) => void;
}) {
  const current = new URLSearchParams(search);
  const active = browseLibrary(current).template?.id ?? "all";
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const reveal = () =>
      navigation.current
        ?.querySelector<HTMLAnchorElement>(`[data-library="${active}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    reveal();
    const observer = new ResizeObserver(reveal);
    if (navigation.current) observer.observe(navigation.current);
    return () => observer.disconnect();
  }, [active]);
  const libraries = [
    { id: "all", title: "كل المكتبة", description: "جميع أعمال المكتبة" },
    ...browseTemplates,
  ];
  return (
    <nav ref={navigation} className="min-w-0 overflow-x-auto py-2" aria-label="مكتبات التصفح">
      <div className="flex w-max min-w-full items-center gap-1">
        {libraries.map((library) => {
          const next =
            active === library.id
              ? current.toString()
              : selectLibrary(current, library.id).toString();
          return (
            <Button
              key={library.id}
              variant={active === library.id ? "secondary" : "ghost"}
              className="shrink-0"
              render={
                <a
                  data-library={library.id}
                  href={`#${path}?${next}`}
                  aria-current={active === library.id ? "page" : undefined}
                />
              }
              title={library.description}
              onClick={(event) => {
                if (
                  event.button ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                if (active !== library.id) onApply(next);
              }}
            >
              {library.title}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

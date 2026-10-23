import { cn } from "cn";
import {
  Building2,
  CalendarDays,
  Clapperboard,
  Compass,
  Ellipsis,
  Home,
  Library,
  MonitorPlay,
  Orbit,
  Search,
  Users,
  Film,
} from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { openSearch } from "./navigation";

const pages = [
  { path: "home", label: "الرئيسية", description: "آخر الإضافات ومختارات المكتبة", icon: Home },
  { path: "search", label: "البحث", description: "ابحث عن عمل أو اسم في المكتبة", icon: Search },
  {
    path: "browse",
    label: "تصفّح المكتبة",
    description: "الأعمال والمرشحات وعروض التصفح",
    icon: Compass,
  },
  {
    path: "releases",
    label: "التقويم",
    description: "مواعيد الأفلام والمواسم والحلقات",
    icon: CalendarDays,
  },
  {
    path: "planets",
    label: "الكواكب",
    description: "العوالم والأعمال التي تنتمي إليها",
    icon: Orbit,
  },
  {
    path: "episodes",
    label: "الحلقات",
    description: "أحدث الحلقات في المكتبة",
    icon: Clapperboard,
  },
  {
    path: "watch",
    label: "مشاهدة مباشرة",
    description: "افتح عملًا للمشاهدة أو التنزيل",
    icon: MonitorPlay,
  },
  {
    path: "trailers",
    label: "الإعلانات التشويقية",
    description: "شاهد إعلانات الأعمال على YouTube",
    icon: Film,
  },
  {
    path: "studios",
    label: "الاستوديوهات",
    description: "الاستوديوهات وإنتاجاتها ومساهماتها",
    icon: Building2,
  },
  { path: "people", label: "الصنّاع", description: "الأشخاص وأعمالهم وأدوارهم", icon: Users },
];
const navigationItemClass =
  "relative flex size-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-card hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

export function LibraryNavigation({
  path,
  overlayControls = false,
  footer,
  onDialogChange,
}: {
  path: string;
  overlayControls?: boolean;
  footer: ReactNode;
  onDialogChange: (open: boolean) => void;
}) {
  const region = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(pages.length);
  const [open, setOpen] = useState(false);
  const active = path.split("/")[1] || "home";
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // Each rail link is 48px high with an 8px gap. Reserve a slot only when needed.
      const slots = Math.max(0, Math.floor((entry.contentRect.height + 8) / 56));
      setVisibleCount(slots >= pages.length ? pages.length : Math.max(0, slots - 1));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const visible = pages.slice(0, visibleCount);
  const hidden = pages.slice(visibleCount);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onDialogChange(next);
  };
  const clickPage = (event: MouseEvent<HTMLAnchorElement>, page: string) => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    changeOpen(false);
    if (page === "search") {
      event.preventDefault();
      openSearch(true);
    }
  };
  return (
    <nav
      className={cn(
        "flex w-20 shrink-0 flex-col items-center gap-4 border-e border-border bg-sidebar px-2 pb-4 max-sm:w-16 max-sm:px-1",
        overlayControls ? "pt-14" : "pt-5",
      )}
      aria-label="التنقل الرئيسي"
      onKeyDown={(event) => {
        if (open) return;
        if (
          event.key === "ArrowLeft" &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey
        ) {
          event.preventDefault();
          window.dispatchEvent(new Event("nahhasio:focus-content"));
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <a
              href="#/home"
              className="flex size-12 shrink-0 items-center justify-center rounded-xl text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="نحّاسيو الرئيسية"
            />
          }
        >
          <Library className="size-7" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="left">نحّاسيو</TooltipContent>
      </Tooltip>
      <div
        ref={region}
        className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-hidden"
      >
        {visible.map((page) => (
          <Tooltip key={page.path}>
            <TooltipTrigger
              render={
                <a
                  href={`#/${page.path}`}
                  className={navigationItemClass}
                  aria-current={active === page.path ? "page" : undefined}
                  aria-label={page.label}
                  aria-keyshortcuts={page.path === "search" ? "Control+k Meta+k" : undefined}
                  onClick={(event) => clickPage(event, page.path)}
                />
              }
            >
              <page.icon className="size-6" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="left">
              {page.path === "search" ? "البحث (Ctrl+K)" : page.label}
            </TooltipContent>
          </Tooltip>
        ))}
        <Dialog open={open} onOpenChange={changeOpen}>
          {(hidden.length > 0 || open) && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <DialogTrigger
                    render={
                      <Button
                        variant={
                          hidden.some((page) => page.path === active) ? "secondary" : "ghost"
                        }
                        size="icon-lg"
                        className="size-12 shrink-0"
                        aria-label="صفحات أخرى"
                      />
                    }
                  />
                }
              >
                <Ellipsis />
              </TooltipTrigger>
              <TooltipContent side="left">صفحات أخرى ({hidden.length})</TooltipContent>
            </Tooltip>
          )}
          <DialogContent className="max-h-5/6 overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>صفحات أخرى</DialogTitle>
              <DialogDescription>
                اختصارات الصفحات التي لا تتسع لها القائمة في حجم النافذة الحالي.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {(hidden.length ? hidden : pages).map((page) => (
                <a
                  key={page.path}
                  href={`#/${page.path}`}
                  onClick={(event) => clickPage(event, page.path)}
                  aria-current={active === page.path ? "page" : undefined}
                  className="flex items-start gap-3 rounded-xl border border-border p-4 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-secondary"
                >
                  <page.icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {page.label}
                      {active === page.path && <Badge variant="secondary">الصفحة الحالية</Badge>}
                    </span>
                    <span className="text-sm text-muted-foreground">{page.description}</span>
                  </span>
                </a>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex w-full shrink-0 flex-col items-center gap-2">{footer}</div>
    </nav>
  );
}

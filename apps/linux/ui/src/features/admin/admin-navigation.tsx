import { useRouterState } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowRight } from "lucide-react";

import { Separator } from "@/components/ui/separator";

import { adminGroups, overview, isAdminSectionAvailable } from "./navigation";

const linkClass =
  "flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:bg-secondary aria-[current=page]:font-medium aria-[current=page]:text-primary max-[800px]:min-h-12 max-[800px]:flex-col max-[800px]:gap-1 max-[800px]:px-1 max-[800px]:text-center max-[800px]:text-[10px]";
export function AdminNavigation() {
  const path = useRouterState({ select: (state) => state.location.pathname.replace(/\/$/, "") });
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3" aria-label="أقسام الإدارة">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain scrollbar-thin">
        <p className="px-2 text-xs text-muted-foreground max-[800px]:hidden">
          الأقسام الباهتة غير متاحة بعد
        </p>
        <a
          href="#/admin"
          className={linkClass}
          aria-current={path === "/admin" ? "page" : undefined}
          title={overview.title}
        >
          <overview.icon className="size-4 shrink-0" aria-hidden="true" />
          <span>{overview.title}</span>
        </a>
        {adminGroups.map((group) => (
          <div
            key={group.title}
            className="flex shrink-0 flex-col gap-0.5"
            role="group"
            aria-label={group.title}
          >
            <p className="mb-1 px-2 text-xs font-medium text-muted-foreground max-[800px]:px-1 max-[800px]:text-center max-[800px]:text-[10px]">
              {group.title}
            </p>
            {group.items.map((item) =>
              isAdminSectionAvailable(item.slug) ? (
                <a
                  key={item.slug}
                  href={`#/admin/${item.slug}`}
                  className={linkClass}
                  aria-current={path === `/admin/${item.slug}` ? "page" : undefined}
                  title={item.title}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{item.title}</span>
                </a>
              ) : (
                <button
                  key={item.slug}
                  type="button"
                  disabled
                  className={cn(
                    linkClass,
                    "cursor-not-allowed text-start opacity-45 hover:bg-transparent hover:text-muted-foreground",
                  )}
                  title={`${item.title} — غير متاح بعد`}
                  aria-label={`${item.title} — غير متاح بعد`}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{item.title}</span>
                </button>
              ),
            )}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <Separator />
        <a href="#/home" className={linkClass} title="العودة إلى المكتبة">
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          <span>العودة إلى المكتبة</span>
        </a>
      </div>
    </div>
  );
}

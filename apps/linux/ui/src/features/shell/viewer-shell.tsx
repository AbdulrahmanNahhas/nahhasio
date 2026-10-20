import type { User } from "@nahhasio/api-contract";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { Compass, Home, Search, Library, Ellipsis, CalendarDays, MonitorPlay } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import { CardNavigationProvider } from "../../components/card-navigation";
import { Button } from "../../components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../components/ui/tooltip";
import { AccountMenu } from "../account/account-menu";
import { AdminNavigation } from "../admin/admin-navigation";
import { DownloadQueueButton } from "../player/download-queue-button";
import { openSearch, useViewerRoute } from "./navigation";
const navigationItemClass =
  "relative flex size-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-card hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";
const scrollPositions = new Map<string, number>();
export function ViewerShell({ user }: { user: User }) {
  const route = useViewerRoute();

  const [account, setAccount] = useState(false);
  const accountOpen = useRef(false);
  const changeAccountOpen = (open: boolean) => {
    accountOpen.current = open;
    setAccount(open);
  };
  const resolvedPath = useRouterState({
    select: (state) => state.resolvedLocation?.pathname ?? state.location.pathname,
  });
  const main = useRef<HTMLDivElement>(null);
  const previous = useRef(route.path);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.isComposing &&
        (event.code === "KeyK" || event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        if (!event.repeat && !accountOpen.current) {
          openSearch(true);
        }
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    let enterPath: string | undefined;
    const press = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.repeat && !event.isComposing)
        enterPath = window.location.hash.split("?")[0];
    };
    const release = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      // A new page may focus a button before keyup; don't activate it with the previous page's Enter.
      if (enterPath !== undefined && enterPath !== window.location.hash.split("?")[0]) {
        event.preventDefault();
        event.stopPropagation();
      }
      enterPath = undefined;
    };
    window.addEventListener("keydown", press, true);
    window.addEventListener("keyup", release, true);
    return () => {
      window.removeEventListener("keydown", press, true);
      window.removeEventListener("keyup", release, true);
    };
  }, []);
  useEffect(() => {
    if (main.current) {
      scrollPositions.set(previous.current, main.current.scrollTop);
      main.current.scrollTop = scrollPositions.get(resolvedPath) ?? 0;
      main.current.focus({ preventScroll: true });
    }
    previous.current = resolvedPath;
  }, [resolvedPath]);
  const parts = route.path.split("/").slice(1);
  const adminArea = parts[0] === "admin" && user.isAdmin;
  const home = parts[0] === "home" || !parts[0];
  const ContentRegion = adminArea ? "div" : "main";
  const content = (
    <CardNavigationProvider key={route.path}>
      <ContentRegion
        ref={main}
        tabIndex={-1}
        className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-p-4 [scrollbar-color:var(--line)_transparent] scrollbar-thin motion-reduce:scroll-auto **:data-card-navigation:scroll-m-2"
        id="main-content"
      >
        <Button
          variant="ghost"
          type="button"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-20 focus:rounded-lg focus:bg-primary focus:px-5 focus:py-3 focus:text-primary-foreground"
          onClick={() =>
            window.dispatchEvent(
              new Event(parts[0] === "search" ? "nahhasio:focus-search" : "nahhasio:focus-content"),
            )
          }
        >
          {home
            ? "الانتقال إلى العرض الرئيسي"
            : parts[0] === "search"
              ? "الانتقال إلى البحث"
              : "الانتقال إلى المحتوى"}
        </Button>
        <Outlet />
      </ContentRegion>
    </CardNavigationProvider>
  );
  return (
    <TooltipProvider delay={250}>
      {adminArea ? (
        <SidebarProvider className="h-dvh min-h-0 overflow-hidden">
          <AdminNavigation />
          <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
            <div className="flex shrink-0 items-center px-4 pt-3 md:hidden">
              <SidebarTrigger
                aria-label="إظهار أو إخفاء القائمة"
                aria-keyshortcuts="Control+b Meta+b"
              />
            </div>
            {content}
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <div className="flex h-dvh overflow-hidden bg-background">
          <nav
            className="flex w-20 shrink-0 flex-col items-center gap-6 border-e border-border bg-sidebar px-2 pt-5 pb-4 max-[520px]:w-16 max-[520px]:gap-4 max-[520px]:px-1"
            aria-label="التنقل الرئيسي"
            onKeyDown={(event) => {
              if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

              if (event.key === "ArrowLeft") {
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

            <div className="flex min-h-0 w-full flex-col items-center gap-2 overflow-y-auto py-1 scrollbar-thin">
              {[
                { href: "#/home", label: "الرئيسية", icon: Home, active: home },
                { href: "#/search", label: "البحث", icon: Search, active: parts[0] === "search" },
                {
                  href: "#/browse",
                  label: "تصفّح المكتبة",
                  icon: Compass,
                  active: parts[0] === "browse",
                },
                {
                  href: "#/watch",
                  label: "مشاهدة مباشرة",
                  icon: MonitorPlay,
                  active: parts[0] === "watch",
                },
                {
                  href: "#/releases",
                  label: "التقويم",
                  icon: CalendarDays,
                  active: parts[0] === "releases",
                },
                {
                  href: "#/more",
                  label: "المزيد",
                  icon: Ellipsis,
                  active: [
                    "more",
                    "planets",
                    "people",
                    "studios",
                    "profile",
                    "profiles",
                    "downloads",
                  ].includes(parts[0]),
                },
              ].map((item) => (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    render={
                      item.href === "#/search" ? (
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => openSearch()}
                          className={navigationItemClass}
                          aria-current={item.active ? "page" : undefined}
                          aria-label={item.label}
                          aria-keyshortcuts="Control+k Meta+k"
                        />
                      ) : (
                        <a
                          href={item.href}
                          className={navigationItemClass}
                          aria-current={item.active ? "page" : undefined}
                          aria-label={item.label}
                        />
                      )
                    }
                  >
                    <item.icon className="size-6 stroke-[1.65]" aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {item.href === "#/search" ? "البحث (Ctrl+K)" : item.label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-2">
              <DownloadQueueButton />
              <AccountMenu user={user} open={account} onOpenChange={changeAccountOpen} />
            </div>
          </nav>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{content}</div>
        </div>
      )}
    </TooltipProvider>
  );
}

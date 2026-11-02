import type { User } from "@nahhasio/api-contract";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "cn";
import { useEffect, useState, useRef } from "react";

import { developmentBrowserAvailable } from "@/lib/development-platform";

import { CardNavigationProvider } from "../../components/card-navigation";
import { Button } from "../../components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../../components/ui/sidebar";
import { TooltipProvider } from "../../components/ui/tooltip";
import { AccountMenu } from "../account/account-menu";
import { AdminNavigation } from "../admin/admin-navigation";
import { DownloadQueueButton } from "../player/download-queue-button";
import { QuickSearch } from "../search/quick-search";
import { BottomNavigation } from "./bottom-navigation";
import { LibraryNavigation } from "./library-navigation";
import { NativePageContext } from "./native-page-context";
import { useViewerRoute } from "./navigation";
const scrollPositions = new Map<string, number>();
export function ViewerShell({ user }: { user: User }) {
  const route = useViewerRoute();
  const [quickSearch, setQuickSearch] = useState(false);
  const [account, setAccount] = useState(false);
  const accountOpen = useRef(false);
  const navigationOpen = useRef(false);
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
        if (!event.repeat && !accountOpen.current && !navigationOpen.current) {
          const target = event.target;
          if (
            !(target instanceof Element) ||
            !target.closest('[role="dialog"], [role="alertdialog"]')
          )
            setQuickSearch(true);
        }
      }
    };
    const openQuickSearch = () => {
      if (!accountOpen.current && !navigationOpen.current) setQuickSearch(true);
    };
    window.addEventListener("keydown", shortcut);
    window.addEventListener("nahhasio:quick-search", openQuickSearch);
    return () => {
      window.removeEventListener("keydown", shortcut);
      window.removeEventListener("nahhasio:quick-search", openQuickSearch);
    };
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
    navigationOpen.current = false;
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
        className={cn(
          "relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-p-4 [scrollbar-color:var(--line)_transparent] scrollbar-thin motion-reduce:scroll-auto **:data-card-navigation:scroll-m-2",
          !adminArea && "pb-24 md:pb-0",
        )}
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
  const developmentNotice = developmentBrowserAvailable() ? (
    <div role="note" className="shrink-0 border-b bg-muted px-4 py-2 text-xs text-muted-foreground">
      معاينة تطوير محلية · التشغيل والتنزيلات ومكتبة الجهاز تحتاج تطبيق Linux.
    </div>
  ) : null;
  return (
    <TooltipProvider delay={250}>
      <NativePageContext />
      <QuickSearch open={quickSearch} onOpenChange={setQuickSearch} isAdmin={user.isAdmin} />
      {adminArea ? (
        <SidebarProvider className={"h-dvh min-h-0 overflow-hidden"}>
          <AdminNavigation />
          <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
            {developmentNotice}
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
        <div className="relative flex h-dvh overflow-hidden bg-background">
          <div className="hidden shrink-0 md:flex">
            <LibraryNavigation
              path={route.path}

              onDialogChange={(open) => {
                navigationOpen.current = open;
              }}
              footer={
                <>
                  <DownloadQueueButton />
                  <AccountMenu user={user} open={account} onOpenChange={changeAccountOpen} />
                </>
              }
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {developmentNotice}
            {content}
            <BottomNavigation
              path={route.path}
              user={user}
              onSearch={() => setQuickSearch(true)}
              onDialogChange={(open) => {
                navigationOpen.current = open;
              }}
            />
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}

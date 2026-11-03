import type { User } from "@nahhasio/api-contract";
import { Download, Ellipsis, Home, Library, Search } from "lucide-react";
import { useRef, useState } from "react";

import { ContentScrollArea } from "@/components/content-scroll-area";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

import { AccountAvatar } from "../account/account-avatar";
import { MobileAccountActions } from "../account/mobile-account-actions";
import { pageDirectory } from "./page-directory";

const destinations = [
  { path: "home", label: "الرئيسية", icon: Home },
  { path: "browse", label: "المكتبة", icon: Library },
  { path: "downloads", label: "التنزيلات", icon: Download },
] as const;
export function BottomNavigation({
  path,
  user,
  onSearch,
  onDialogChange,
}: {
  path: string;
  user: User;
  onSearch: () => void;
  onDialogChange: (open: boolean) => void;
}) {
  const active = path.split("/")[1] || "home";
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === path;
  const navigating = useRef(false);
  const changeOpen = (next: boolean) => {
    if (next) navigating.current = false;
    setMenuPath(next ? path : null);
    onDialogChange(next);
  };
  const pages = pageDirectory(user.isAdmin)
    .filter((page) => !page.path.startsWith("admin/"))
    .map((page) => (page.path === "admin" ? { ...page, group: "حسابي والجهاز" } : page));
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pt-2 pb-safe md:hidden">
      <nav
        aria-label="التنقل الرئيسي"
        className="pointer-events-auto mx-auto flex max-w-lg items-center gap-1 rounded-full border border-border bg-sidebar/70 p-1.5 shadow-xl backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-reduce:transition-none"
      >
        {destinations.slice(0, 2).map((destination) => (
          <Destination key={destination.path} destination={destination} active={active} />
        ))}
        <Button
          variant={active === "search" ? "secondary" : "ghost"}
          className="h-14 min-w-0 flex-1 flex-col gap-1 px-1"
          aria-label="البحث السريع"
          aria-haspopup="dialog"
          onClick={onSearch}
        >
          <Search data-icon="inline-start" />
          <span className="text-xs">البحث</span>
        </Button>
        <Destination destination={destinations[2]} active={active} />
        <Drawer open={open} onOpenChange={changeOpen} showSwipeHandle>
          <DrawerTrigger
            render={
              <Button
                variant={
                  !["home", "browse", "search", "downloads"].includes(active)
                    ? "secondary"
                    : "ghost"
                }
                className="h-14 min-w-0 flex-1 flex-col gap-1 px-1"
                aria-label="كل الصفحات"
              />
            }
          >
            <Ellipsis data-icon="inline-start" />
            <span className="text-xs">المزيد</span>
          </DrawerTrigger>
          <DrawerContent
            aria-label="كل الصفحات"
            className="max-h-5/6"
            finalFocus={() => !navigating.current}
          >
            <DrawerTitle className="sr-only">كل الصفحات</DrawerTitle>
            <ContentScrollArea>
              <div className="flex flex-col gap-5 px-4 pt-4 pb-safe">
                <div className="flex items-center gap-3">
                  <AccountAvatar name={user.name} avatarKey={user.avatarKey} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.isAdmin ? "إدارة المكتبة" : "حساب المكتبة"}
                    </p>
                  </div>
                </div>
                {[...new Set(pages.map((page) => page.group))].map((group) => (
                  <section key={group} className="flex flex-col gap-2" aria-label={group}>
                    <h2 className="text-sm text-muted-foreground">{group}</h2>
                    <ItemGroup className="grid grid-cols-2 gap-2">
                      {pages
                        .filter((page) => page.group === group)
                        .map((page) => (
                          <Item
                            key={page.href}
                            size="sm"
                            variant={path === `/${page.path}` ? "muted" : "outline"}
                            render={
                              <a
                                href={page.href}
                                aria-label={page.label}
                                aria-current={path === `/${page.path}` ? "page" : undefined}
                                onClick={(event) => {
                                  if (
                                    !event.ctrlKey &&
                                    !event.metaKey &&
                                    !event.shiftKey &&
                                    !event.altKey &&
                                    event.button === 0
                                  ) {
                                    navigating.current = true;
                                    changeOpen(false);
                                  }
                                }}
                              />
                            }
                          >
                            <ItemMedia variant="icon">
                              <page.icon />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>{page.label}</ItemTitle>
                              <ItemDescription className="sr-only">
                                {page.description}
                              </ItemDescription>
                            </ItemContent>
                          </Item>
                        ))}
                    </ItemGroup>
                  </section>
                ))}
                <MobileAccountActions accountId={user.accountId} close={() => changeOpen(false)} />
              </div>
            </ContentScrollArea>
          </DrawerContent>
        </Drawer>
      </nav>
    </div>
  );
}
function Destination({
  destination,
  active,
}: {
  destination: (typeof destinations)[number];
  active: string;
}) {
  return (
    <Button
      nativeButton={false}
      variant={active === destination.path ? "secondary" : "ghost"}
      className="h-14 min-w-0 flex-1 flex-col gap-1 px-1 motion-reduce:transition-none"
      render={
        <a
          role="link"
          href={`#/${destination.path}`}
          aria-current={active === destination.path ? "page" : undefined}
        />
      }
    >
      <destination.icon data-icon="inline-start" />
      <span className="text-xs">{destination.label}</span>
    </Button>
  );
}

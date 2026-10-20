import { useRouterState } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { adminGroups, overview, isAdminSectionAvailable } from "./navigation";

export function AdminNavigation() {
  const path = useRouterState({ select: (state) => state.location.pathname.replace(/\/$/, "") });
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar side="right" variant="inset" collapsible="icon" dir="rtl" aria-label="التنقل الإداري">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <a
                  href="#/admin"
                  onClick={closeMobile}
                  aria-current={path === "/admin" ? "page" : undefined}
                />
              }
              isActive={path === "/admin"}
              tooltip={{ children: overview.title, side: "left" }}
              aria-label={overview.title}
            >
              <overview.icon aria-hidden="true" />
              <span>{overview.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-y-scroll! scroll-fade-y">
        {adminGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const available = isAdminSectionAvailable(item.slug);
                  const active = path === `/admin/${item.slug}`;
                  const label = available ? item.title : `${item.title} — غير متاح بعد`;
                  return (
                    <SidebarMenuItem key={item.slug}>
                      <SidebarMenuButton
                        render={
                          available ? (
                            <a
                              href={`#/admin/${item.slug}`}
                              onClick={closeMobile}
                              aria-current={active ? "page" : undefined}
                            />
                          ) : undefined
                        }
                        disabled={!available}
                        isActive={active}
                        tooltip={{ children: label, side: "left" }}
                        aria-label={label}
                        title={label}
                      >
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<a href="#/home" onClick={closeMobile} />}
              tooltip={{ children: "العودة إلى المكتبة", side: "left" }}
              aria-label="العودة إلى المكتبة"
            >
              <ArrowRight aria-hidden="true" />
              <span>العودة إلى المكتبة</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

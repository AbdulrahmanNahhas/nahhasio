import { Download, Home, Library, Search, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

const destinations = [
  { path: "home", href: "#/home", label: "الرئيسية", icon: Home },
  { path: "browse", href: "#/browse", label: "المكتبة", icon: Library },
  { path: "search", href: "#/search", label: "البحث", icon: Search },
  { path: "downloads", href: "#/downloads", label: "التنزيلات", icon: Download },
  { path: "settings", href: "#/settings", label: "الحساب", icon: UserRound },
] as const;

export function BottomNavigation({ path }: { path: string }) {
  const active = path.split("/")[1] || "home";
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="flex shrink-0 justify-around gap-1 border-t border-border bg-sidebar px-2 pt-2 pb-safe shadow-lg md:hidden"
    >
      {destinations.map((destination) => (
        <Button
          nativeButton={false}
          key={destination.path}
          variant={active === destination.path ? "secondary" : "ghost"}
          className="h-auto min-h-14 min-w-0 flex-1 flex-col gap-1 px-1 py-2"
          render={
            <a
              role="link"
              href={destination.href}
              aria-current={active === destination.path ? "page" : undefined}
            />
          }
        >
          <destination.icon data-icon="inline-start" />
          <span className="text-xs">{destination.label}</span>
        </Button>
      ))}
    </nav>
  );
}

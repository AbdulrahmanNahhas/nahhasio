import type { User } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  HardDrive,
  LogOut,
  MonitorPlay,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { connectionsOptions } from "../auth/connections";
import { ServerConnections } from "../auth/server-connections";
import { navigate } from "../shell/navigation";
import { AccountAvatar } from "./account-avatar";
import { useAccountActions } from "./use-account-actions";

export function AccountMenu({
  user,
  open,
  onOpenChange,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [connections, setConnections] = useState(false);
  const servers = useQuery({ ...connectionsOptions(), enabled: open });
  const currentServer = servers.data?.servers.find(
    (server) => server.url === servers.data.selected,
  );
  const { local, switching, logout } = useAccountActions(user.accountId);
  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="size-12 rounded-xl outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    aria-label="الملف والحساب"
                  />
                }
              />
            }
          >
            <AccountAvatar
              name={user.name}
              avatarKey={user.avatarKey}
              className="size-10 shrink-0"
            />
          </TooltipTrigger>
          <TooltipContent side="left">{user.name} — الملف والحساب</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side="left"
          align="end"
          sideOffset={8}
          className="w-64 max-w-[calc(100vw-2rem)] p-1.5"
          aria-label="الحساب"
          onKeyDown={(event) => {
            if (
              open &&
              (event.ctrlKey || event.metaKey) &&
              (event.code === "KeyK" || event.key.toLowerCase() === "k")
            ) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => navigate(`/profiles/${user.accountId}`)}
              className="gap-3 py-3"
              aria-label="الملف الشخصي"
            >
              <AccountAvatar
                name={user.name}
                avatarKey={user.avatarKey}
                className="size-11 shrink-0"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">الملف الشخصي</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => navigate("/downloads")}>
              <Download data-icon="inline-start" /> مكتبة الجهاز
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <MonitorPlay data-icon="inline-start" />
              مشاهدة مباشرة
              <Badge variant="secondary" className="ms-auto">
                قريبًا
              </Badge>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings data-icon="inline-start" /> الإعدادات والمساعدة
            </DropdownMenuItem>
            {user.isAdmin && (
              <DropdownMenuItem onClick={() => navigate("/admin")}>
                <ShieldCheck data-icon="inline-start" />
                لوحة الإدارة
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setConnections(true)}>
              <Server data-icon="inline-start" />
              <span className="min-w-0 truncate" title={currentServer?.name}>
                {currentServer ? `الخادم: ${currentServer.name}` : "الخادم والاتصال"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={local.isPending || logout.isPending}
              onClick={() => local.mutate()}
            >
              <HardDrive data-icon="inline-start" />
              المكتبة دون اتصال
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={switching.isPending || logout.isPending}
              onClick={() => switching.mutate()}
            >
              <Users data-icon="inline-start" /> تبديل الحساب
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              className="min-h-11 gap-3 px-3"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut data-icon="inline-start" />
              {logout.isPending ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {switching.error && (
            <Alert variant="destructive">
              <AlertDescription>{switching.error.message}</AlertDescription>
            </Alert>
          )}
          {logout.error && (
            <Alert variant="destructive">
              <AlertDescription>{logout.error.message}</AlertDescription>
            </Alert>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ServerConnections open={connections} onOpenChange={setConnections} />
    </>
  );
}

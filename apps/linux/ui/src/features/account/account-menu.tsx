import type { User } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Server, HardDrive } from "lucide-react";
import { LogOut, ShieldCheck, UserRound, ChevronLeft } from "lucide-react";
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
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { gateway } from "@/lib/bridge";

import { connectionsOptions } from "../auth/connections";
import { ServerConnections } from "../auth/server-connections";
import { changeOfflineMode } from "../player/saved-works-data";
import { navigate } from "../shell/navigation";
import { AccountAvatar } from "./account-avatar";

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
  const client = useQueryClient();
  const local = useMutation({
    networkMode: "always",
    mutationFn: () => changeOfflineMode(client, user.accountId),
    onError: (error) => toast.add({ type: "error", title: error.message }),
  });
  const logout = useMutation({
    mutationFn: gateway.logout,
    onSettled: async () => {
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session" && query.queryKey[0] !== "native",
      });
      client.setQueryData(["session"], null);
      window.dispatchEvent(new Event("nahhasio:signed-out"));
      navigate("/home");
    },
  });
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
              className="size-10 shrink-0 rounded-xl after:rounded-xl [&_[data-slot=avatar-image]]:rounded-xl [&_[data-slot=avatar-fallback]]:rounded-xl"
              rounded
            />
          </TooltipTrigger>
          <TooltipContent side="left">{user.name} — الملف والحساب</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side="left"
          align="end"
          sideOffset={8}
          className="w-64 max-w-[calc(100vw-2rem)] p-2"
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
            <DropdownMenuLabel className="px-3 py-3">
              <div className="flex items-center gap-3">
                <AccountAvatar
                  name={user.name}
                  avatarKey={user.avatarKey}
                  className="size-14 shrink-0"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {user.name}
                  </span>
                  {/*<span className="truncate text-xs text-muted-foreground" dir="ltr">
                  {user.email}
                </span>*/}
                  <Badge variant="secondary" className="mt-1 w-fit">
                    {user.isAdmin ? "مدير المكتبة" : "عضو المكتبة"}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="min-h-11 gap-3 px-3" onClick={() => navigate("/profile")}>
              <UserRound data-icon="inline-start" />
              الملف الشخصي
              <ChevronLeft className="ms-auto" data-icon="inline-end" />
            </DropdownMenuItem>
            {user.isAdmin && (
              <DropdownMenuItem className="min-h-11 gap-3 px-3" onClick={() => navigate("/admin")}>
                <ShieldCheck data-icon="inline-start" />
                لوحة الإدارة
                <ChevronLeft className="ms-auto" data-icon="inline-end" />
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setConnections(true)}>
              <Server data-icon="inline-start" />
              {currentServer ? `الخادم: ${currentServer.name}` : "الخادم والاتصال"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={local.isPending || logout.isPending}
              onClick={() => local.mutate()}
            >
              <HardDrive data-icon="inline-start" />
              فتح مكتبة الجهاز دون الخادم
            </DropdownMenuItem>
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

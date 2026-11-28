import { SessionSchema, type User } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, HardDrive, LogOut, Plus, Stethoscope, Trash2 } from "lucide-react";
import { useState } from "react";

import { Failure } from "@/components/status";
import { Separator } from "@/components/ui-sdk/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { nativeCall } from "@/lib/bridge";

import { AccountAvatar } from "../account/account-avatar";
import { PasswordDialog } from "../account/password-card";
import { ProfileEditor } from "../account/profile-editor";
import { useAccountActions } from "../account/use-account-actions";
import { connectionsOptions } from "../auth/connections";
import { loginAccountsOptions } from "../auth/login-accounts";
import { switchAccount } from "../auth/remembered-accounts";
import { navigate } from "../shell/navigation";

export function AccountSettings({ user }: { user: User }) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <ProfileEditor user={user} />
      <section aria-labelledby="account-security" className="flex flex-col gap-3">
        <h2 id="account-security" className="text-base font-semibold">
          أمان الحساب
        </h2>
        <AccountSecurity user={user} />
      </section>
      <section aria-labelledby="account-device" className="flex flex-col gap-3">
        <h2 id="account-device" className="text-base font-semibold">
          الجهاز
        </h2>
        <DeviceAccounts user={user} />
      </section>
    </div>
  );
}

function AccountSecurity({ user }: { user: User }) {
  const { logout } = useAccountActions(user.accountId);
  const copy = useMutation({ mutationFn: () => navigator.clipboard.writeText(user.email) });

  return (
    <Card size="sm" className="py-0">
      <CardContent>
        <Item className="px-0">
          <ItemContent className="min-w-0">
            <ItemTitle>البريد الإلكتروني</ItemTitle>
            <ItemDescription>
              <bdi dir="ltr" className="break-all">
                {user.email}
              </bdi>
            </ItemDescription>
            {copy.error && (
              <p role="alert" className="text-sm text-destructive">
                تعذّر نسخ البريد.
              </p>
            )}
          </ItemContent>
          <ItemActions>
            <Button variant="outline" onClick={() => copy.mutate()} disabled={copy.isPending}>
              {copy.isSuccess ? (
                <Check data-icon="inline-start" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copy.isSuccess ? "نُسخ البريد" : "نسخ البريد"}
            </Button>
          </ItemActions>
        </Item>
        <Separator />
        <Item className="px-0">
          <ItemContent>
            <ItemTitle>كلمة المرور</ItemTitle>
            <ItemDescription>يُنهي تغييرها جلساتك على الأجهزة الأخرى.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <PasswordDialog />
          </ItemActions>
        </Item>
        <Separator />
        <Item className="px-0">
          <ItemContent>
            <ItemTitle>الجلسة الحالية</ItemTitle>
          </ItemContent>
          <ItemActions>
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" />}>
                <LogOut data-icon="inline-start" />
                تسجيل الخروج
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تسجيل الخروج من هذا الجهاز؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    ستحتاج إلى تسجيل الدخول لفتح المكتبة مجددًا.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={logout.isPending}
                    onClick={() => logout.mutate()}
                  >
                    تسجيل الخروج
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </ItemActions>
        </Item>
      </CardContent>
    </Card>
  );
}

function DeviceAccounts({ user }: { user: User }) {
  const client = useQueryClient();
  const connections = useQuery(connectionsOptions());
  const accountOptions = loginAccountsOptions(connections.data?.selected);
  const accounts = useQuery(accountOptions);
  const [forgetting, setForgetting] = useState<{ id: string; name: string } | null>(null);
  const select = useMutation({
    networkMode: "always",
    mutationFn: (id?: string) => switchAccount(client, id),
    onSuccess: (session) => {
      if (session) client.setQueryData(["session"], session);
      navigate("/home");
    },
  });
  const forget = useMutation({
    networkMode: "always",
    mutationFn: async (id: string) =>
      SessionSchema.nullable().parse(await nativeCall("accounts.forget", { accountId: id })),
    onSuccess: async (session, id) => {
      setForgetting(null);
      if (id !== user.accountId) {
        await client.invalidateQueries({ queryKey: accountOptions.queryKey });
        return;
      }
      await client.cancelQueries();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      window.dispatchEvent(new Event("nahhasio:session-changed"));
      client.setQueryData(["session"], session);
      if (!session) navigate("/home");
    },
  });
  const busy = select.isPending || forget.isPending;

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle>الحسابات المحفوظة</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {accounts.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد حسابات محفوظة على هذا الجهاز.</p>
            )}
            <Button variant="outline" disabled={busy} onClick={() => select.mutate(undefined)}>
              <Plus data-icon="inline-start" />
              إضافة حساب أو تبديله
            </Button>
          </div>
          {accounts.isFetching && !accounts.data && <Skeleton className="h-16 w-full" />}
          {accounts.error && (
            <Failure error={accounts.error} retry={() => void accounts.refetch()} />
          )}
          {accounts.data?.map((account) => {
            const current = account.id === user.accountId;
            return (
              <Item key={account.id} variant="outline" size="sm" className="w-full flex-wrap">
                <ItemMedia>
                  <AccountAvatar
                    name={account.name}
                    avatarKey={account.avatarKey}
                    className="size-8"
                  />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    <span className="break-all" dir="auto">
                      {account.name}
                    </span>
                    {current && <Badge variant="secondary">الحالي</Badge>}
                  </ItemTitle>
                </ItemContent>
                <ItemActions>
                  {!current && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      aria-label={`التبديل إلى ${account.name}`}
                      onClick={() => select.mutate(account.id)}
                    >
                      تبديل
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`نسيان ${account.name} من الجهاز`}
                    onClick={() => {
                      forget.reset();
                      setForgetting(account);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </ItemActions>
              </Item>
            );
          })}
          {select.error && <Failure error={select.error} />}
        </CardContent>
        <Separator />
        <CardFooter className="flex flex-wrap gap-2">
          <a className={buttonVariants({ variant: "ghost" })} href="#/downloads?view=storage">
            <HardDrive data-icon="inline-start" />
            تخزين الجهاز
          </a>
          <a className={buttonVariants({ variant: "ghost" })} href="#/settings?section=help">
            <Stethoscope data-icon="inline-start" />
            التحديثات والتشخيص
          </a>
        </CardFooter>
      </Card>
      <AlertDialog
        open={forgetting !== null}
        onOpenChange={(open) => {
          if (!open && !forget.isPending) setForgetting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>نسيان {forgetting?.name}؟</AlertDialogTitle>
            <AlertDialogDescription>
              يُزال تسجيل الدخول المحفوظ لهذا الحساب من الجهاز.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {forget.error && <Failure error={forget.error} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={forget.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={forget.isPending}
              onClick={() => {
                if (forgetting) forget.mutate(forgetting.id);
              }}
            >
              تأكيد نسيان الحساب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

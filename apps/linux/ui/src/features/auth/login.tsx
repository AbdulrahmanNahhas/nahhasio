import type { LoginAccount } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, HardDrive, LockKeyhole, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Brand } from "@/components/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { gateway, nativeAvailable } from "@/lib/bridge";

import { avatarSource } from "../account/account-avatar";
import { OfflineProfiles } from "../player/offline-library";
import { connectionsOptions } from "./connections";
import { loginAccountsOptions } from "./login-accounts";
import { LoginBackdrop } from "./login-backdrop";
import { CurrentServer, ServerConnections } from "./server-connections";

function LoginAvatar({ account }: { account: LoginAccount }) {
  return (
    <Avatar className="size-28 sm:size-36">
      <AvatarImage src={avatarSource(account.avatarKey)} alt="" />
      <AvatarFallback>{account.name.trim().charAt(0)}</AvatarFallback>
    </Avatar>
  );
}

export function Login({
  restoring = false,
  sessionError,
}: {
  restoring?: boolean;
  sessionError?: string;
}) {
  const [connections, setConnections] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const client = useQueryClient();
  const servers = useQuery(connectionsOptions());
  const accounts = useQuery(loginAccountsOptions(servers.data?.selected, !restoring));
  const selected = accounts.data?.find((account) => account.id === selectedId);
  const login = useMutation({
    networkMode: "always",
    mutationFn: gateway.login,
    onSuccess: async (session) => {
      window.dispatchEvent(new Event("nahhasio:session-changed"));
      setPassword("");
      setVisible(false);
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session" && query.queryKey[0] !== "native",
      });
      client.setQueryData(["session"], session);
    },
  });
  const resetLogin = login.reset;
  useEffect(() => {
    const clear = () => {
      setSelectedId(null);
      setManual(false);
      setEmail("");
      setPassword("");
      setVisible(false);
      setCapsLock(false);
      resetLogin();
      setConnections(false);
    };
    window.addEventListener("nahhasio:server-changed", clear);
    return () => window.removeEventListener("nahhasio:server-changed", clear);
  }, [resetLogin]);
  const clearPassword = () => {
    setPassword("");
    setVisible(false);
    setCapsLock(false);
    login.reset();
  };
  const busy = login.isPending || restoring;
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-x-clip text-foreground">
      <LoginBackdrop />
      <header className="flex shrink-0 items-center justify-between gap-6 px-5 py-5 sm:px-10 sm:py-7">
        <span className="font-display text-sm text-muted-foreground">مكتبتنا. حكايات تجمعنا.</span>
        <Dialog>
          <DialogTrigger render={<Button variant="ghost" size="sm" />}>
            <HardDrive data-icon="inline-start" />
            مكتبة الجهاز
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>مكتبة هذا الجهاز</DialogTitle>
              <DialogDescription>
                اختر حسابًا لفتح أعماله المحفوظة دون اتصال. هذه نسخة محلية، وليست تسجيل دخول إلى
                الخادم.
              </DialogDescription>
            </DialogHeader>
            <OfflineProfiles />
          </DialogContent>
        </Dialog>
      </header>
      <section
        className="flex flex-1 flex-col items-center justify-center gap-10 px-5 py-12 sm:gap-12"
        aria-labelledby="login-heading"
      >
        <div className="flex flex-col items-center gap-7 text-center">
          <Brand />
          <div className="flex flex-col gap-3">
            <h1 id="login-heading" className="font-display text-3xl font-semibold sm:text-4xl">
              من يشاهد؟
            </h1>
            <p className="text-sm text-muted-foreground">اختر حسابك، وأكمل حكايتك.</p>
          </div>
        </div>
        <Dialog
          open={Boolean(selected) || manual}
          onOpenChange={(open) => {
            if (!open && !login.isPending) {
              setSelectedId(null);
              setManual(false);
              clearPassword();
            }
          }}
        >
          <div
            className="flex w-full max-w-3xl flex-wrap justify-center gap-4 sm:gap-8"
            aria-label="حسابات المكتبة"
            aria-busy={accounts.isFetching || restoring}
          >
            {restoring || accounts.isLoading ? (
              <div className="flex gap-10" role="status" aria-label="جارٍ تحميل الحسابات">
                {[0, 1].map((item) => (
                  <div key={item} className="flex flex-col items-center gap-5">
                    <Skeleton className="size-28 rounded-full sm:size-36" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              accounts.data?.map((account) => (
                <DialogTrigger
                  key={account.id}
                  render={
                    <Button
                      variant="ghost"
                      className="group h-auto w-36 flex-col gap-5 px-3 py-5 sm:w-48"
                    />
                  }
                  disabled={busy}
                  onClick={() => {
                    clearPassword();
                    setManual(false);
                    setSelectedId(account.id);
                  }}
                >
                  <span className="rounded-full ring-2 ring-transparent ring-offset-4 ring-offset-login-background transition-all duration-200 group-hover:ring-foreground/60 group-focus-visible:ring-foreground motion-safe:group-hover:scale-105 motion-reduce:transition-none">
                    <LoginAvatar account={account} />
                  </span>
                  <span
                    className="w-full truncate text-center font-display text-lg font-semibold"
                    title={account.name}
                  >
                    {account.name}
                  </span>
                </DialogTrigger>
              ))
            )}
            {!restoring && accounts.data?.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>لا توجد حسابات متاحة</EmptyTitle>
                  <EmptyDescription>
                    تحقق من اختيار الخادم الصحيح أو تواصل مع المشرف لتفعيل حسابك.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
          {accounts.error && (
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <Alert variant="destructive">
                <AlertDescription>{accounts.error.message}</AlertDescription>
              </Alert>
              <Button variant="ghost" size="sm" onClick={() => void accounts.refetch()}>
                <RefreshCw data-icon="inline-start" />
                إعادة المحاولة
              </Button>
            </div>
          )}
          {!nativeAvailable() && (
            <Alert className="max-w-sm">
              <AlertDescription>افتح نحّاسيو من تطبيق سطح المكتب للاتصال بالخادم.</AlertDescription>
            </Alert>
          )}
          <DialogTrigger
            render={<Button variant="ghost" size="sm" />}
            disabled={busy || !nativeAvailable()}
            onClick={() => {
              clearPassword();
              setSelectedId(null);
              setManual(true);
            }}
          >
            الدخول بالبريد الإلكتروني
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm" showCloseButton={!login.isPending}>
            <DialogHeader className="items-center text-center sm:text-center">
              {selected && <LoginAvatar account={selected} />}
              <DialogTitle className="font-display text-2xl">
                {selected?.name ?? "أهلاً بعودتك"}
              </DialogTitle>
              <DialogDescription>
                {selected
                  ? "أدخل كلمة مرورك لفتح المكتبة."
                  : "سجّل الدخول باستخدام بريدك الإلكتروني وكلمة مرورك."}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy) {
                  if (selected) login.mutate({ accountId: selected.id, password });
                  else if (manual) login.mutate({ email: email.trim(), password });
                }
              }}
            >
              <FieldGroup className="gap-5">
                {manual && (
                  <Field data-disabled={busy}>
                    <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      dir="ltr"
                      autoComplete="username"
                      maxLength={254}
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={busy}
                    />
                  </Field>
                )}
                <Field data-disabled={busy} data-invalid={Boolean(login.error)}>
                  <FieldLabel htmlFor="password">كلمة المرور</FieldLabel>
                  <InputGroup className="h-12">
                    <InputGroupInput
                      id="password"
                      type={visible ? "text" : "password"}
                      dir="ltr"
                      autoComplete="current-password"
                      maxLength={128}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                      disabled={busy}
                      aria-invalid={Boolean(login.error)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-sm"
                        aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        aria-pressed={visible}
                        disabled={busy}
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {capsLock && <FieldDescription>مفتاح الأحرف الكبيرة مفعّل.</FieldDescription>}
                </Field>
                {login.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{login.error.message}</AlertDescription>
                  </Alert>
                )}
                <Button
                  size="lg"
                  className="h-12 w-full"
                  disabled={busy || !nativeAvailable()}
                  type="submit"
                >
                  {login.isPending ? <Spinner data-icon="inline-start" /> : null}
                  {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول المكتبة"}
                  <ArrowLeft data-icon="inline-end" />
                </Button>
              </FieldGroup>
            </form>
          </DialogContent>
        </Dialog>
      </section>
      <footer className="flex shrink-0 flex-col items-center gap-5 px-5 pb-7 pt-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
          <CurrentServer
            onManage={() => setConnections(true)}
            disabled={busy}
            sessionError={!restoring ? sessionError : undefined}
          />
        </div>
        <p className="flex items-center gap-2 text-center text-xs text-muted-foreground">
          <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
          يبقى حسابك متصلاً على هذا الجهاز. كلمة مرورك لا تُحفظ.
        </p>
      </footer>
      <ServerConnections open={connections} onOpenChange={setConnections} />
    </main>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Library, HardDrive, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { gateway, nativeAvailable } from "@/lib/bridge";

import { OfflineProfiles } from "../player/offline-library";
import { LoginBackdrop } from "./login-backdrop";
import { CurrentServer, ServerConnections } from "./server-connections";

export function Login({
  restoring = false,
  sessionError,
}: {
  restoring?: boolean;
  sessionError?: string;
}) {
  const [connections, setConnections] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const client = useQueryClient();
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
  return (
    <main className="relative isolate flex h-dvh flex-col overflow-x-hidden overflow-y-auto bg-background">
      <LoginBackdrop />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-background via-background/65 to-background/40"
        aria-hidden="true"
      />
      <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 sm:px-10 sm:py-5">
        <div className="flex items-center gap-2.5 text-primary">
          <Library className="size-7 shrink-0" aria-hidden="true" />
          <span className="font-display text-2xl font-semibold">نحّاسيو</span>
        </div>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden="true" />
          مكتبتك العائلية الخاصة
        </span>
      </header>
      <div className="flex flex-1 shrink-0 items-center justify-center px-5 py-3 sm:px-8">
        <section
          className="flex w-full max-w-100 flex-col gap-5 rounded-xl bg-background/95 px-6 py-6 shadow-2xl sm:px-9 sm:py-7"
          aria-labelledby="login-heading"
        >
          <div className="flex flex-col gap-1.5">
            <h1 id="login-heading" className="font-display text-3xl font-semibold">
              ادخل إلى مكتبتك
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              سجّل الدخول بحساب مكتبتك.
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5">
            <CurrentServer
              onManage={() => setConnections(true)}
              disabled={login.isPending}
              sessionError={!restoring ? sessionError : undefined}
            />
            {restoring && (
              <p
                className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
                role="status"
              >
                <Spinner />
                جارٍ استعادة جلسة المكتبة…
              </p>
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!login.isPending && !restoring) login.mutate({ email: email.trim(), password });
            }}
          >
            <FieldGroup className="gap-4">
              <Field data-disabled={login.isPending || restoring}>
                <FieldLabel htmlFor="email">البريد الإلكتروني</FieldLabel>
                <Input
                  id="email"
                  className="h-12"
                  type="email"
                  dir="ltr"
                  autoComplete="username"
                  maxLength={254}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={login.isPending || restoring}
                  placeholder="you@nahhasio.local"
                />
              </Field>
              <Field data-disabled={login.isPending || restoring}>
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
                    disabled={login.isPending || restoring}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-sm"
                      aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      aria-pressed={visible}
                      disabled={login.isPending || restoring}
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {capsLock && <FieldDescription>مفتاح الأحرف الكبيرة مفعّل.</FieldDescription>}
              </Field>
              {!nativeAvailable() && (
                <Alert variant="destructive">
                  <AlertDescription>
                    افتح نحّاسيو من تطبيق سطح المكتب للاتصال بالخادم.
                  </AlertDescription>
                </Alert>
              )}
              {login.error && (
                <Alert variant="destructive">
                  <AlertDescription>{login.error.message}</AlertDescription>
                </Alert>
              )}
              <Button
                size="lg"
                className="mt-1 h-12 w-full"
                disabled={login.isPending || restoring || !nativeAvailable()}
                type="submit"
              >
                {login.isPending ? <Spinner data-icon="inline-start" /> : null}
                {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول المكتبة"}
                <ArrowLeft data-icon="inline-end" />
              </Button>
            </FieldGroup>
          </form>
          <Dialog>
            <DialogTrigger render={<Button variant="ghost" size="sm" />}>
              <HardDrive data-icon="inline-start" />
              فتح مكتبة الجهاز دون اتصال
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>مكتبة هذا الجهاز</DialogTitle>
                <DialogDescription>
                  اختر حسابًا لفتح أعماله المحفوظة. هذه نسخة محلية متاحة لمستخدم الجهاز، وليست تسجيل
                  دخول إلى الخادم.
                </DialogDescription>
              </DialogHeader>
              <OfflineProfiles />
            </DialogContent>
          </Dialog>
        </section>
      </div>
      <footer className="shrink-0 px-5 py-3 text-center text-xs leading-relaxed text-muted-foreground sm:px-10 sm:py-4">
        يبقى حسابك متصلاً على هذا الجهاز. كلمة مرورك لا تُحفظ.
      </footer>
      <ServerConnections open={connections} onOpenChange={setConnections} />
    </main>
  );
}

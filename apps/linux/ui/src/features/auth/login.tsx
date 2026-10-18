import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Library, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-l from-background via-background/95 to-background/30"
        aria-hidden="true"
      />
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-6 sm:px-12 sm:py-8">
        <div className="flex items-center gap-2.5 text-primary">
          <Library className="size-7 shrink-0" aria-hidden="true" />
          <span className="font-display text-2xl font-semibold">نحّاسيو</span>
        </div>
        <span className="hidden text-xs text-muted-foreground sm:block">
          مكتبتك الخاصة، أينما كنت.
        </span>
      </header>
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-16 px-5 py-8 sm:px-12 sm:py-14 lg:grid-cols-2">
        <section
          className="mx-auto flex w-full max-w-md flex-col gap-7 rounded-3xl border border-border/50 bg-background/95 p-6 sm:p-10 lg:mx-0"
          aria-labelledby="login-heading"
        >
          <div className="flex flex-col gap-3">
            <h1 id="login-heading" className="font-display text-3xl font-semibold">
              ادخل إلى مكتبتك
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              قصص تحبّها، ومكان يجمعها. سجّل الدخول للمتابعة.
            </p>
          </div>
          <div className="border-y border-border py-4">
            <CurrentServer onManage={() => setConnections(true)} disabled={login.isPending} />
            {restoring && (
              <p
                className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
                role="status"
              >
                <Spinner />
                جارٍ استعادة جلسة المكتبة…
              </p>
            )}
            {!restoring && sessionError && (
              <p className="mt-3 text-xs text-muted-foreground" role="status">
                {sessionError}
              </p>
            )}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!login.isPending && !restoring) login.mutate({ email: email.trim(), password });
            }}
          >
            <FieldGroup>
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
                className="mt-2 h-12 w-full"
                disabled={login.isPending || restoring || !nativeAvailable()}
                type="submit"
              >
                {login.isPending ? <Spinner data-icon="inline-start" /> : null}
                {login.isPending ? "جارٍ تسجيل الدخول…" : "دخول المكتبة"}
                <ArrowLeft data-icon="inline-end" />
              </Button>
            </FieldGroup>
          </form>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            مكتبة خاصة لك ولعائلتك. للدخول، استخدم حساب مكتبتك.
          </p>
        </section>
        <aside className="hidden max-w-lg flex-col gap-5 pb-16 lg:flex">
          <h2 className="font-display text-6xl leading-tight font-semibold tracking-tight">
            كل حكاية،
            <br />
            تستحق مكانها.
          </h2>
          <p className="max-w-sm text-lg leading-relaxed text-muted-foreground">
            أفلامك ومسلسلاتك، تفاصيلها، واللحظات التي توقّفت عندها. مكتبة واحدة لك ولعائلتك.
          </p>
          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            خادمك. مكتبتك. خصوصيتك.
          </div>
        </aside>
      </div>
      <footer className="px-6 py-5 text-center text-xs text-muted-foreground sm:px-12">
        يُحفظ اتصالك على هذا الجهاز. كلمة مرورك لا تُحفظ.
      </footer>
      <ServerConnections open={connections} onOpenChange={setConnections} />
    </main>
  );
}

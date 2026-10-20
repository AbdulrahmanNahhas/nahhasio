import { useMutation } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { gateway } from "@/lib/bridge";

export function PasswordCard() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const update = useMutation({
    mutationFn: gateway.updatePassword,
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirmation("");
    },
  });
  const mismatch = confirmation.length > 0 && confirmation !== newPassword;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole aria-hidden="true" />
          أمان الحساب
        </CardTitle>
        <CardDescription>
          بعد تغيير كلمة المرور، تُنهى جلساتك الأخرى ويبقى هذا التطبيق متصلاً.
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (newPassword === confirmation) update.mutate({ currentPassword, newPassword });
        }}
      >
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">كلمة المرور الحالية</FieldLabel>
              <Input
                id="current-password"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
                maxLength={128}
                value={currentPassword}
                onChange={(event) => setCurrent(event.target.value)}
                disabled={update.isPending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">كلمة المرور الجديدة</FieldLabel>
              <Input
                id="new-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNext(event.target.value)}
                disabled={update.isPending}
              />
              <FieldDescription>من 6 إلى 128 حرفاً.</FieldDescription>
            </Field>
            <Field data-invalid={mismatch}>
              <FieldLabel htmlFor="confirm-password">تأكيد كلمة المرور</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                required
                maxLength={128}
                aria-invalid={mismatch}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={update.isPending}
              />
              {mismatch && <FieldDescription>كلمتا المرور غير متطابقتين.</FieldDescription>}
            </Field>
            {update.error && (
              <Alert variant="destructive">
                <AlertDescription>{update.error.message}</AlertDescription>
              </Alert>
            )}
            {update.isSuccess && (
              <Alert>
                <AlertDescription>تغيّرت كلمة المرور وانتهت الجلسات الأخرى.</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </CardContent>
        <CardFooter className="pt-6">
          <Button
            variant="outline"
            type="submit"
            disabled={
              update.isPending ||
              !currentPassword ||
              newPassword.length < 6 ||
              newPassword !== confirmation
            }
          >
            {update.isPending ? "جارٍ التغيير…" : "تغيير كلمة المرور"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

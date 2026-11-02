import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Globe2 } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { probeServerAddress, replaceServerAddress, type SavedServer } from "./connections";

export function ServerAddressForm({
  server,
  onDone,
  onBusyChange,
}: {
  server: SavedServer;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState(server.url);
  const client = useQueryClient();
  const test = useMutation({
    mutationFn: () => probeServerAddress(server.url, url),
    networkMode: "always",
  });
  const save = useMutation({
    mutationFn: () => replaceServerAddress(client, server.url, url),
    networkMode: "always",
    onMutate: () => onBusyChange(true),
    onSettled: () => onBusyChange(false),
    onSuccess: onDone,
  });
  const busy = test.isPending || save.isPending;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (test.data && !busy) save.mutate();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel>الاتصال المحفوظ</FieldLabel>
          <p className="text-sm">{server.name}</p>
          <p className="break-all text-xs text-muted-foreground" dir="ltr">
            {server.url}
          </p>
        </Field>
        <Field>
          <FieldLabel htmlFor="replacement-server-url">العنوان الجديد</FieldLabel>
          <Input
            id="replacement-server-url"
            dir="ltr"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            maxLength={2048}
            value={url}
            disabled={busy}
            required
            placeholder="https://library.home:8443"
            onChange={(event) => {
              setUrl(event.target.value);
              test.reset();
              save.reset();
            }}
          />
          <FieldDescription>
            يمكن إدخال اسم ثابت بعد إعداده في شبكتك، بدلًا من عنوان IP متغيّر. يجب أن تكون شهادة الخادم
            صالحة للعنوان الجديد.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <p className="text-sm text-muted-foreground">
        {server.trustedFingerprint
          ? "تُستخدم شهادة الجذر المحفوظة تلقائيًا."
          : "يستمر التحقق من أمان الاتصال باستخدام شهادات الجهاز الموثوقة."}{" "}
        تبقى ملفاتك وإعدادات مكتبتك على الجهاز؛ ستحتاج إلى تسجيل الدخول في العنوان الجديد.
      </p>
      {test.data && !test.error && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>تم التحقق من المكتبة</AlertTitle>
          <AlertDescription>
            الاتصال آمن وهوية «{test.data.info.name}» تطابق مكتبتك المحفوظة. يُعاد التحقق عند الحفظ.
          </AlertDescription>
        </Alert>
      )}
      {(test.error || save.error) && (
        <Alert variant="destructive">
          <AlertDescription>{save.error?.message ?? test.error?.message}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
          رجوع
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !url.trim() || url.trim() === server.url}
          onClick={() => test.mutate()}
        >
          {test.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Globe2 data-icon="inline-start" />
          )}
          تحقق من العنوان
        </Button>
        <Button type="submit" disabled={busy || !test.data}>
          {save.isPending && <Spinner data-icon="inline-start" />}حفظ العنوان
        </Button>
      </DialogFooter>
    </form>
  );
}

import type { ServerBackupPolicy, ServerBackupPolicyStatus } from "@nahhasio/api-contract";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function BackupPolicy({
  policy,
  disabled,
  onSave,
}: {
  policy: ServerBackupPolicyStatus;
  disabled: boolean;
  onSave: (policy: ServerBackupPolicy) => void;
}) {
  return (
    <form
      key={JSON.stringify(policy)}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          dailyEnabled: form.has("dailyEnabled"),
          retainDaily: Number(form.get("retainDaily")),
        });
      }}
    >
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="scheduled-backups">نسخة يومية تلقائية</FieldLabel>
            <FieldDescription>
              الساعة ٤ صباحًا بتوقيت الخادم، مع تأخير حتى ١٥ دقيقة. يُعوّض الموعد الفائت بعد التشغيل.
            </FieldDescription>
          </FieldContent>
          <Switch
            id="scheduled-backups"
            name="dailyEnabled"
            defaultChecked={policy.dailyEnabled}
            disabled={disabled}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="backup-retention">النسخ اليومية المحتفَظ بها</FieldLabel>
          <Input
            id="backup-retention"
            name="retainDaily"
            type="number"
            min={1}
            max={30}
            required
            defaultValue={policy.retainDaily}
            disabled={disabled}
          />
          <FieldDescription>
            من ١ إلى ٣٠. تبقى النسخ اليدوية، وآخر نسختين قبل التحديث وآخر نسختين قبل الاستعادة. يُطبّق
            التنظيف بعد اكتمال نسخة جديدة.
          </FieldDescription>
        </Field>
      </FieldGroup>
      {policy.dailyEnabled !== policy.timerActive && (
        <Alert>
          <AlertTitle>الجدولة تحتاج إلى تفعيل</AlertTitle>
          <AlertDescription>
            حالة المؤقّت لا تطابق الإعداد المحفوظ. احفظ الإعداد لتطبيقه، أو راجع نتيجة عملية الصيانة إذا
            تعذّر تشغيله.
          </AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="outline" disabled={disabled}>
        حفظ سياسة النسخ
      </Button>
    </form>
  );
}

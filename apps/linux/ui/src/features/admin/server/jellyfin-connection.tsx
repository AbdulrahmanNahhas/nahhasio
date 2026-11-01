import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function JellyfinConnection() {
  return (
    <Card size="sm" aria-label="اتصال Jellyfin">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Jellyfin<Badge variant="outline">قادم</Badge>
        </CardTitle>
        <CardDescription>
          مصدر اختياري لملفات الفيديو. تبقى بيانات المكتبة وصورها وسجل مشاهدتها في نحّاسيو.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field data-disabled>
            <FieldLabel htmlFor="jellyfin-url">عنوان خادم Jellyfin</FieldLabel>
            {/* TODO(jellyfin-connection): Validate and persist the server origin through an authorized native/server service. */}
            <Input
              id="jellyfin-url"
              type="url"
              dir="ltr"
              placeholder="https://jellyfin.home"
              disabled
            />
          </Field>
          <Field data-disabled>
            <FieldLabel htmlFor="jellyfin-token">رمز الوصول</FieldLabel>
            {/* TODO(jellyfin-credentials): Add write-only encrypted credential storage and masked connection status. */}
            <Input
              id="jellyfin-token"
              type="password"
              autoComplete="off"
              placeholder="متاح بعد تفعيل التكامل"
              disabled
            />
            <FieldDescription>لن يُعرض الرمز المحفوظ في التطبيق.</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {/* TODO(jellyfin-save): Enable only after authorized connection editing and removal are implemented. */}
        <Button size="sm" disabled>
          حفظ الاتصال
        </Button>
        {/* TODO(jellyfin-test): Add a bounded connection/authentication check without starting playback or downloads. */}
        <Button size="sm" variant="outline" disabled>
          اختبار الاتصال
        </Button>
        {/* TODO(jellyfin-matching): Implement reviewed catalog-to-file matching without importing metadata or viewing history. */}
        <Button size="sm" variant="ghost" disabled>
          مطابقة المكتبات
        </Button>
      </CardFooter>
    </Card>
  );
}

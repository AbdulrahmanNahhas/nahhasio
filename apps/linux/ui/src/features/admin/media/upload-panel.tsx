import { NativeUploadsSchema } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { nativeCall } from "@/lib/bridge";
export function UploadPanel() {
  const client = useQueryClient();
  const key = ["admin", "media", "uploads"];
  const uploads = useQuery({
    queryKey: key,
    queryFn: async () => NativeUploadsSchema.parse(await nativeCall("media.uploadStatus", {})),
    refetchInterval: 2000,
  });
  const action = useMutation({
    mutationFn: async (id: string | null) =>
      NativeUploadsSchema.parse(
        await nativeCall(
          id ? "media.uploadRetry" : "media.uploadFiles",
          id ? { id } : {},
          undefined,
          120000,
        ),
      ),
    onSuccess: async (data) => {
      client.setQueryData(key, data);
      await client.invalidateQueries({ queryKey: ["admin", "media", "incoming"] });
    },
  });
  return (
    <section className="flex flex-col gap-3" aria-label="رفع الفيديوهات من الجهاز">
      <p>
        تُرفع نسخة إلى الخادم وتبقى الملفات الأصلية على جهازك. بعد التحقق، تظهر الفيديوهات أدناه
        لربطها بالحلقات.
      </p>
      <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate(null)}>
        <Upload data-icon="inline-start" />
        اختيار فيديوهات من الجهاز
      </Button>
      {uploads.data?.map((file) => (
        <div key={file.id} className="flex flex-col gap-2">
          <span>{file.name}</span>
          {file.status === "verifying" && (
            <p role="status">جارٍ التحقق من بايتات الملف قبل الرفع…</p>
          )}
          {file.status === "verifying-server" && (
            <p role="status">جارٍ التحقق على الخادم؛ تستمر المهمة حتى إن أغلقت النافذة.</p>
          )}
          <Progress
            value={file.bytes ? (file.offset * 100) / file.bytes : 0}
            aria-label={`رفع ${file.name}`}
          />
          {file.status === "completed" ? (
            <p>اكتمل الرفع؛ الملف جاهز للربط.</p>
          ) : ["failed", "paused"].includes(file.status) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={action.isPending}
              onClick={() => action.mutate(file.id)}
            >
              استئناف / إعادة المحاولة
            </Button>
          ) : (
            <p role="status">
              {file.status === "queued"
                ? "في انتظار دور الرفع"
                : file.status === "verifying-server"
                  ? "بانتظار نتيجة التحقق"
                  : "جارٍ الرفع"}
            </p>
          )}
          {file.error && <p role="alert">{file.error}</p>}
        </div>
      ))}
      {(uploads.error || action.error) && (
        <Alert variant="destructive">
          <AlertDescription>{(uploads.error ?? action.error)?.message}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}

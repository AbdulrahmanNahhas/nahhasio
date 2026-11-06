import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { downloadLibraryOptions, downloadQueueOptions } from "./download-data";

export function useDeviceDownloadsState() {
  const library = useQuery(downloadLibraryOptions());
  const jobs = useQuery(downloadQueueOptions());
  return {
    library,
    jobs,
    ready: library.isSuccess && jobs.isSuccess,
    error: library.error ?? jobs.error,
  };
}
export function DeviceDownloadsCheck({
  state,
}: {
  state: ReturnType<typeof useDeviceDownloadsState>;
}) {
  if (state.error)
    return (
      <Alert variant="destructive">
        <AlertTitle>تعذّر التحقق من تنزيلات الجهاز</AlertTitle>
        <AlertDescription>
          أعد قراءة الفيديوهات وقائمة النقل قبل بدء تنزيل جديد.
          <Button
            variant="outline"
            size="sm"
            onClick={() => void Promise.all([state.library.refetch(), state.jobs.refetch()])}
          >
            إعادة التحقق
          </Button>
        </AlertDescription>
      </Alert>
    );
  return state.ready ? null : <p role="status">جارٍ التحقق من تنزيلات الجهاز…</p>;
}

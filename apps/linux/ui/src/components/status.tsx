import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "./ui/empty";

export function Failure({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>تعذّر تحميل البيانات</AlertTitle>
      <AlertDescription>
        {error.message}
        {retry && (
          <Button variant="outline" onClick={retry}>
            إعادة المحاولة
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function NoResults({
  title = "لا توجد أعمال مطابقة",
  description = "غيّر البحث أو التصفية لتوسيع النتائج.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

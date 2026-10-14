import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  isJsonString,
  workFields,
  type DocumentReview,
  type JsonValue,
} from "@/features/editor/json/document/document-model";

function Value({ value }: { value: JsonValue | null }) {
  return (
    <pre
      dir="auto"
      className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm leading-7"
    >
      {isJsonString(value) ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
export function ChangeReview({
  review,
  onBack,
  onSave,
  busy,
  recordLabel = "عمل",
}: {
  review: DocumentReview;
  onBack: () => void;
  onSave: () => void;
  busy: boolean;
  recordLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const count = review.records.reduce((total, record) => total + record.changes.length, 0);
  const records = review.records
    .map((record) => ({
      ...record,
      changes: record.changes.filter((change) =>
        `${record.name} ${record.id} ${change.path} ${JSON.stringify(change.before)} ${JSON.stringify(change.after)}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    }))
    .filter((record) => record.changes.length);
  return (
    <section aria-label="مراجعة التغييرات" className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">مراجعة قبل الحفظ</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {review.records.length} {recordLabel} · {count} تغيير. راجع القيم السابقة والجديدة ثم
            أكد الحفظ.
          </p>
        </div>
        <Badge variant="outline">لم يُحفظ شيء بعد</Badge>
      </div>
      <Input
        aria-label="بحث في التغييرات"
        placeholder="ابحث بالعنوان أو الحقل أو القيمة…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {!records.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{count ? "لا توجد تغييرات مطابقة" : "لا توجد تغييرات للحفظ"}</EmptyTitle>
            <EmptyDescription>يمكنك العودة إلى المحرر ومتابعة العمل.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {records.map((record) => (
        <Card key={record.id}>
          <CardHeader>
            <CardTitle>{record.name}</CardTitle>
            <CardDescription>
              <span dir="ltr">{record.id}</span> · {record.changes.length} حقل
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {record.changes.map((change) => (
                <div key={change.path} className="flex min-w-0 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {workFields.find(
                        (field) =>
                          change.path === field.key ||
                          change.path.startsWith(`${field.key}.`) ||
                          change.path.startsWith(`${field.key}[`),
                      )?.label ?? change.path}
                    </span>
                    <code dir="ltr" className="break-all text-xs text-muted-foreground">
                      {change.path}
                    </code>
                  </div>
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-4">
                      <p className="mb-2 text-xs text-muted-foreground">القيمة السابقة</p>
                      <Value value={change.before} />
                    </div>
                    <div className="min-w-0 rounded-lg border border-border p-4">
                      <p className="mb-2 text-xs text-muted-foreground">القيمة الجديدة</p>
                      <Value value={change.after} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          <ArrowLeftIcon data-icon="inline-start" />
          العودة إلى المحرر
        </Button>
        <Button onClick={onSave} disabled={!count || busy}>
          <CheckIcon data-icon="inline-start" />
          {busy ? "جارٍ الحفظ…" : `تأكيد حفظ ${review.records.length} عمل`}
        </Button>
      </div>
    </section>
  );
}

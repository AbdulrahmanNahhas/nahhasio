import { rpcResults } from "@arcadia/contracts/editor-rpc";
import { useMutation } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ChangeReview } from "@/features/editor/json/document/change-review";
import { gateway } from "@/lib/bridge";
const kinds = z.enum(["season", "movie", "special"]);
export function CreateMediaPart({
  workId,
  children,
  onSaved,
}: {
  workId: string;
  children: ReactElement;
  onSaved: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>إضافة جزء إلى العمل</DialogTitle>
          <DialogDescription>تُراجع الإضافة قبل الحفظ. لا يتغيّر أي جزء موجود.</DialogDescription>
        </DialogHeader>
        {open && (
          <PartForm
            workId={workId}
            onSaved={(id) => {
              setOpen(false);
              onSaved(id);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function PartForm({ workId, onSaved }: { workId: string; onSaved: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<z.infer<typeof kinds>>("season");
  const [id] = useState(() => crypto.randomUUID());
  const review = useMutation({
    mutationFn: async () => {
      const rows = rpcResults.read.parse(
        await gateway.editorCall({ operation: "read", data: { ids: [workId] } }),
      );
      const row = rows[0];
      if (!row) throw new Error("تعذّر تحميل العمل.");
      const installments = [
        ...(row.document.installments ?? []),
        {
          id,
          title,
          kind,
          position:
            Math.max(0, ...(row.document.installments ?? []).map((part) => part.position ?? 0)) + 1,
          status: "unknown",
          episodes: [],
        },
      ];
      return rpcResults.review.parse(
        await gateway.editorCall({
          operation: "review",
          data: {
            json: JSON.stringify({
              schemaVersion: 1,
              fields: ["installments"],
              records: [{ id: workId, installments }],
            }),
            originals: [{ id: workId, revision: row.revision }],
          },
        }),
      );
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!review.data) throw new Error("راجع الإضافة أولًا.");
      return gateway.editorCall({ operation: "save", data: { ticket: review.data.ticket } });
    },
    onSuccess: () => onSaved(id),
  });
  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="media-part-title">عنوان الجزء</FieldLabel>
          <Input
            id="media-part-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              review.reset();
            }}
          />
        </Field>
        <Field>
          <FieldLabel>نوع الجزء</FieldLabel>
          <Choice
            label="نوع الجزء الجديد"
            value={kind}
            onChange={(value) => {
              setKind(kinds.parse(value));
              review.reset();
            }}
            options={[
              { value: "season", label: "موسم" },
              { value: "movie", label: "فيلم" },
              { value: "special", label: "جزء خاص" },
            ]}
          />
        </Field>
      </FieldGroup>
      {review.data ? (
        <ChangeReview
          review={review.data}
          onBack={() => review.reset()}
          onSave={() => save.mutate()}
          busy={save.isPending}
        />
      ) : (
        <Button disabled={!title.trim() || review.isPending} onClick={() => review.mutate()}>
          مراجعة الجزء الجديد
        </Button>
      )}
      {(review.error || save.error) && (
        <Alert variant="destructive">
          <AlertDescription>{(review.error ?? save.error)?.message}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

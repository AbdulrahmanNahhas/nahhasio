import { imageRoleSchema } from "@arcadia/contracts/editor-rpc";
import { useMutation } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { uploadArtwork } from "@/features/artwork/library/artwork.functions";
import { SelectField } from "@/features/editor/fields/work-fields";

import { imageRoles, fileSize } from "./images-model";

export function ImageUpload({
  onUploaded,
  defaultRole = "poster",
}: {
  onUploaded: (id: string) => Promise<void>;
  defaultRole?: z.infer<typeof imageRoleSchema>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload data-icon="inline-start" />
        رفع صورة
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفع صورة</DialogTitle>
            <DialogDescription>
              أضف صورة للمكتبة، ثم اختر السجلات التي تريد ربطها بها.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <UploadForm
              defaultRole={defaultRole}
              onBusy={setBusy}
              onUploaded={async (id) => {
                await onUploaded(id);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function UploadForm({
  defaultRole,
  onUploaded,
  onBusy,
}: {
  defaultRole: z.infer<typeof imageRoleSchema>;
  onUploaded: (id: string) => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [role, setRole] = useState<z.infer<typeof imageRoleSchema>>(defaultRole);
  const upload = useMutation({
    mutationFn: async () => {
      onBusy(true);
      if (!file) throw new Error("اختر صورة أولاً.");
      if (file.size > 10000000) throw new Error("الحد الأقصى للصورة 10 ميغابايت.");
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))
        throw new Error("اختر صورة PNG أو JPEG أو WebP أو GIF.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(z.string().parse(reader.result)), {
          once: true,
        });
        reader.addEventListener("error", () => reject(new Error("تعذّرت قراءة الصورة.")), {
          once: true,
        });
        reader.readAsDataURL(file);
      });
      return uploadArtwork({
        data: { dataUrl, fileName: file.name, role, ownerName: file.name.slice(0, 200) || "صورة" },
      });
    },
    onSuccess: async (result) => onUploaded(result.id),
    onSettled: () => onBusy(false),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!upload.isPending) upload.mutate();
      }}
    >
      <fieldset disabled={upload.isPending} className="min-w-0">
        <FieldGroup>
          {upload.isError && (
            <Alert variant="destructive">
              <AlertTitle>تعذّر رفع الصورة</AlertTitle>
              <AlertDescription>{upload.error.message}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="library-image-file">ملف الصورة</FieldLabel>
            <Input
              id="library-image-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={upload.isPending}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                upload.reset();
              }}
            />
            <FieldDescription>
              {file
                ? `${file.name} — ${fileSize(file.size)}`
                : "PNG، JPEG، WebP أو GIF · حتى 10 ميغابايت"}
            </FieldDescription>
          </Field>
          <SelectField label="نوع الصورة" value={role} items={imageRoles} onChange={setRole} />
          <Button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Upload data-icon="inline-start" />
            )}
            {upload.isPending ? "جارٍ الرفع…" : "رفع الصورة"}
          </Button>
        </FieldGroup>
      </fieldset>
    </form>
  );
}

import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function RemoveArtwork({
  label,
  disabled,
  iconOnly = true,
  onRemove,
}: {
  label: string;
  disabled?: boolean;
  iconOnly?: boolean;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant={iconOnly ? "ghost" : "outline"}
            size={iconOnly ? "icon-sm" : "sm"}
            disabled={disabled}
            aria-label={`إزالة صورة ${label}`}
            title="إزالة من المسودة"
          />
        }
      >
        <Trash2 />
        {!iconOnly && `إزالة صورة ${label}`}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>إزالة صورة {label}؟</AlertDialogTitle>
          <AlertDialogDescription>
            تُزال الصورة من المسودة فقط. يبقى ملفها في مكتبة الصور، ويمكن التراجع قبل حفظ التغييرات.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
          >
            إزالة من المسودة
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

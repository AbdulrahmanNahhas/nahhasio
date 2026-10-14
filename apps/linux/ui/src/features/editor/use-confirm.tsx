import { useState, useRef, useEffect } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
export function useConfirm(title = "تأكيد تغيير المسودة") {
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((result: boolean) => void) | null>(null);
  useEffect(() => () => pending.current?.(false), []);
  function finish(result: boolean) {
    pending.current?.(result);
    pending.current = null;
    setMessage(null);
  }
  return {
    confirm: (text: string) =>
      new Promise<boolean>((resolve) => {
        pending.current?.(false);
        pending.current = resolve;
        setMessage(text);
      }),
    dialog: (
      <AlertDialog
        open={message !== null}
        onOpenChange={(open) => {
          if (!open) finish(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => finish(false)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => finish(true)}>متابعة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}

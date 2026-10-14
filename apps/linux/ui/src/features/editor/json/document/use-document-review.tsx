import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useBlocker } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";
import type { DocumentReview, WorkSnapshot } from "@/features/editor/json/document/document-model";
import {
  reviewNewWork,
  reviewWorks,
  saveWorkReview,
} from "@/features/editor/json/document/document.functions";

export function useDocumentReview(
  snapshots: WorkSnapshot[],
  json: () => string,
  dirty: boolean,
  create = false,
) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const latest = useRef(json);
  const committed = useRef(false);
  useEffect(() => {
    latest.current = json;
  }, [json]);
  const [review, setReview] = useState<DocumentReview | null>(null);
  const [saved, setSaved] = useState(false);
  const blocker = useBlocker({
    withResolver: true,
    shouldBlockFn: ({ current, next }) =>
      (current.pathname !== next.pathname ||
        current.search.ids !== next.search.ids ||
        current.search.target !== next.search.target) &&
      dirty &&
      !committed.current,
    enableBeforeUnload: dirty && !saved,
  });
  const prepare = useMutation({
    mutationFn: (draft: string) =>
      create
        ? reviewNewWork({ data: { json: draft } })
        : reviewWorks({
            data: {
              json: draft,
              originals: snapshots.map(({ document, revision }) => ({
                id: document.id ?? "",
                revision,
              })),
            },
          }),
    onSuccess: (result, draft) => {
      if (draft === latest.current()) setReview(result);
    },
  });
  const save = useMutation({
    mutationFn: (ticket: string) => saveWorkReview({ data: { ticket } }),
    onSuccess: async (result) => {
      committed.current = true;
      setSaved(true);
      setReview(null);
      await invalidateCatalogEdit(client);
      if (result.createdId)
        await navigate({
          to: "/admin/works/$workId",
          params: { workId: result.createdId },
          search: { section: "identity" },
        });
    },
  });
  function changed() {
    committed.current = false;
    setReview(null);
    setSaved(false);
    if (prepare.status !== "idle") prepare.reset();
    if (save.status !== "idle") save.reset();
  }
  return {
    leaveDialog: (
      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.status === "blocked") blocker.reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تغييرات غير محفوظة</AlertDialogTitle>
            <AlertDialogDescription>
              مغادرة المحرر ستتجاهل المسودة. هل تريد المغادرة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>العودة للمحرر</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (blocker.status === "blocked") blocker.proceed();
              }}
            >
              تجاهل ومغادرة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
    review,
    prepare,
    save,
    saved,
    changed,
    back: () => setReview(null),
    busy: prepare.isPending || save.isPending,
  };
}

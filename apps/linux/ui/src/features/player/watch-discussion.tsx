import type { WorkActivityItem } from "@nahhasio/api-contract";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Pencil, Reply, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";

import { Failure } from "@/components/status";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { AccountAvatar } from "@/features/account/account-avatar";
import { dateLabel } from "@/features/work/format";
import { gateway } from "@/lib/bridge";

type Mode = { kind: "reply" | "edit"; item: WorkActivityItem };
export function WatchDiscussion({
  id,
  accountId,
  offline,
}: {
  id: string;
  accountId?: string;
  offline: boolean;
}) {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [replacement, setReplacement] = useState<Mode | null>(null);
  const [deleting, setDeleting] = useState<WorkActivityItem | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const feed = useInfiniteQuery({
    queryKey: ["work", id, "activity"],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => gateway.workActivity(id, pageParam, signal),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    enabled: !offline,
    refetchInterval: offline ? false : 30000,
  });
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const change = useMutation({
    mutationFn: () =>
      gateway.workComment(id, {
        action: mode?.kind === "edit" ? "update" : "create",
        commentId: mode?.kind === "edit" ? mode.item.id : undefined,
        parentId: mode?.kind === "reply" ? mode.item.id : undefined,
        body: body.trim(),
        containsSpoilers: spoilers,
      }),
    onSuccess: async () => {
      setBody("");
      setSpoilers(false);
      setMode(null);
      await client.invalidateQueries({ queryKey: ["work", id, "activity"] });
      await client.invalidateQueries({ queryKey: ["home"] });
    },
  });
  const remove = useMutation({
    mutationFn: (commentId: string) => gateway.workComment(id, { action: "delete", commentId }),
    onSuccess: async () => {
      setDeleting(null);
      await client.invalidateQueries({ queryKey: ["work", id, "activity"] });
      await client.invalidateQueries({ queryKey: ["home"] });
    },
  });
  function compose(next: Mode) {
    if (body.trim()) {
      setReplacement(next);
      return;
    }
    applyMode(next);
  }
  function applyMode(next: Mode) {
    setMode(next);
    setBody(next.kind === "edit" ? next.item.body : "");
    setSpoilers(next.kind === "edit" && next.item.containsSpoilers);
    requestAnimationFrame(() => input.current?.focus());
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const threads = new Map<string, WorkActivityItem[]>();
  for (const item of items) {
    let root = item;
    const visited = new Set<string>();
    while (root.parentId && byId.has(root.parentId) && !visited.has(root.parentId)) {
      visited.add(root.id);
      const parent = byId.get(root.parentId);
      if (!parent) break;
      root = parent;
    }
    const thread = threads.get(root.id) ?? [];
    thread.push(item);
    threads.set(root.id, thread);
  }
  return (
    <section className="flex min-w-0 flex-col gap-5" aria-label="نقاش العائلة">
      <header className="flex items-center gap-2">
        <MessageCircle className="size-5" />
        <h2 className="text-xl font-semibold">نقاش العائلة</h2>
        {feed.data && <Badge variant="secondary">{feed.data.pages[0]?.total}</Badge>}
      </header>
      <p className="text-sm text-muted-foreground">
        نقاش العمل كاملًا. علّم التعليق إذا كان يحوي حرقًا للأحداث.
      </p>
      {offline ? (
        <p className="text-sm text-muted-foreground">نقاش العائلة يحتاج اتصالًا بالخادم.</p>
      ) : (
        <>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (body.trim() && !change.isPending) change.mutate();
            }}
          >
            {mode && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
                <span className="text-sm">
                  {mode.kind === "edit" ? "تعديل تعليقك" : `رد على ${mode.item.author.displayName}`}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={change.isPending}
                  aria-label="إلغاء الرد أو التعديل"
                  onClick={() => {
                    setMode(null);
                    setBody("");
                    setSpoilers(false);
                  }}
                >
                  <X />
                </Button>
              </div>
            )}
            <Field>
              <FieldLabel htmlFor="watch-comment">
                {mode?.kind === "edit" ? "تعديل التعليق" : "اكتب تعليقًا للعائلة"}
              </FieldLabel>
              <Textarea
                id="watch-comment"
                ref={input}
                value={body}
                maxLength={1200}
                rows={3}
                disabled={change.isPending}
                dir="auto"
                placeholder="شارك العائلة رأيك…"
                onChange={(event) => setBody(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={spoilers}
                  disabled={change.isPending}
                  onCheckedChange={(value) => setSpoilers(value === true)}
                />
                يحوي حرقًا للأحداث
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {body.length}/1200
                </span>
                <Button type="submit" disabled={!body.trim() || change.isPending}>
                  {change.isPending
                    ? "جارٍ الإرسال…"
                    : mode?.kind === "edit"
                      ? "حفظ التعديل"
                      : "إرسال التعليق"}
                </Button>
              </div>
            </div>
            {change.isError && <Failure error={change.error} />}
          </form>
          {feed.isPending && <p role="status">جارٍ تحميل النقاش…</p>}
          {feed.isError && <Failure error={feed.error} retry={() => void feed.refetch()} />}
          {feed.isSuccess && !items.length && (
            <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              لا توجد تعليقات بعد. ابدأ نقاش العائلة.
            </p>
          )}
          {[...threads].map(([rootId, thread]) => (
            <div key={rootId} className="flex flex-col gap-4 border-b border-border pb-5">
              {thread
                .toSorted((a, b) =>
                  a.id === rootId
                    ? -1
                    : b.id === rootId
                      ? 1
                      : a.createdAt.localeCompare(b.createdAt),
                )
                .map((item) => (
                  <DiscussionComment
                    key={item.id}
                    item={item}
                    reply={item.id !== rootId || Boolean(item.parentId && !byId.has(item.parentId))}
                    own={item.author.id === accountId && item.kind === "comment"}
                    busy={change.isPending || remove.isPending}
                    onReply={() => compose({ kind: "reply", item })}
                    onEdit={() => compose({ kind: "edit", item })}
                    onDelete={() => setDeleting(item)}
                  />
                ))}
            </div>
          ))}
          {feed.hasNextPage && (
            <Button
              variant="outline"
              disabled={feed.isFetchingNextPage}
              onClick={() => void feed.fetchNextPage()}
            >
              {feed.isFetchingNextPage ? "جارٍ التحميل…" : "تعليقات أقدم"}
            </Button>
          )}
        </>
      )}
      <AlertDialog
        open={!!replacement}
        onOpenChange={(open) => {
          if (!open) setReplacement(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>استبدال مسودة التعليق؟</AlertDialogTitle>
            <AlertDialogDescription>
              لديك نص لم يُرسل بعد. يمكنك الاحتفاظ به أو بدء الرد أو التعديل الجديد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>الاحتفاظ بالمسودة</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (replacement) applyMode(replacement);
                setReplacement(null);
              }}
            >
              استبدال المسودة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف تعليقك؟</AlertDialogTitle>
            <AlertDialogDescription>
              يُخفى تعليقك من النقاش. تبقى ردود بقية أفراد العائلة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {remove.isError && <Failure error={remove.error} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              حذف التعليق
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
function DiscussionComment({
  item,
  reply,
  own,
  busy,
  onReply,
  onEdit,
  onDelete,
}: {
  item: WorkActivityItem;
  reply: boolean;
  own: boolean;
  busy: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <article
      className={
        reply ? "ms-6 flex min-w-0 gap-3 border-s border-border ps-4" : "flex min-w-0 gap-3"
      }
    >
      <a href={`#/profiles/${item.author.id}`} aria-label={`ملف ${item.author.displayName}`}>
        <AccountAvatar name={item.author.displayName} avatarKey={item.author.avatarKey} />
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex flex-wrap items-center gap-2">
          <a href={`#/profiles/${item.author.id}`} className="text-sm font-semibold">
            {item.author.displayName}
          </a>
          <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
            {dateLabel(item.createdAt)}
          </time>
          {reply && <Badge variant="outline">رد</Badge>}
          {item.kind === "review" && (
            <Badge variant="outline">
              مراجعة{item.rating !== null ? ` · ${item.rating}/5` : ""}
            </Badge>
          )}
        </header>
        {item.containsSpoilers && !revealed ? (
          <Button className="w-fit" variant="outline" size="sm" onClick={() => setRevealed(true)}>
            إظهار تعليق يحوي حرقًا
          </Button>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-line wrap-anywhere" dir="auto">
            {item.body}
          </p>
        )}
        <div className="flex gap-1">
          {item.kind === "comment" && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onReply}>
              <Reply />
              رد
            </Button>
          )}
          {own && (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="تعديل تعليقك"
                disabled={busy}
                onClick={onEdit}
              >
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="حذف تعليقك"
                disabled={busy}
                onClick={onDelete}
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

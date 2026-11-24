import type { WorkActivityItem } from "@nahhasio/api-contract";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, MenuGroup, MenuItem, MenuTrigger } from "@ui-sdk/react/menu";
import { Radio, RadioGroup } from "@ui-sdk/react/radio";
import { cn } from "cn";
import { Ellipsis, MessageCircle, Pencil, Reply, Send, Star, Trash2, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

import { Failure } from "@/components/status";
import { SdkMenuContent, sdkMenuItemClassName } from "@/components/ui-sdk/menu";
import { MobileDrawer } from "@/components/ui-sdk/mobile-drawer";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AccountAvatar } from "@/features/account/account-avatar";
import { dateLabel } from "@/features/work/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { gateway } from "@/lib/bridge";

const stars = [1, 2, 3, 4, 5];

function ReviewScore({ value }: { value: number }) {
  return (
    <div
      role="img"
      aria-label={`تقييم ${value} من 5`}
      className="flex items-center gap-1 text-warning"
    >
      {stars.map((star) => (
        <Star
          key={star}
          className={cn("size-3.5", star <= value ? "fill-current" : "text-muted-foreground")}
          aria-hidden
        />
      ))}
    </div>
  );
}

function ScoreChoice({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="text-sm font-medium">
        تقييمك <span className="font-normal text-muted-foreground">اختياري</span>
      </span>
      <RadioGroup
        aria-label="تقييمك من 5"
        className="flex items-center gap-1"
        value={value === null ? "" : String(value)}
        onValueChange={(next) => onChange(Number(next))}
        disabled={disabled}
      >
        {stars.map((star) => (
          <Radio
            key={star}
            value={String(star)}
            aria-label={`${star} من 5`}
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-disabled:opacity-50"
          >
            <Star
              className={cn(
                "size-5",
                value !== null && star <= value && "fill-current text-warning",
              )}
              aria-hidden
            />
          </Radio>
        ))}
      </RadioGroup>
      {value !== null && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          إزالة التقييم
        </Button>
      )}
    </div>
  );
}

type Mode = { kind: "reply" | "edit"; item: WorkActivityItem };
export function WorkDiscussion({
  id,
  accountId,
  offline,
}: {
  id: string;
  accountId?: string;
  offline: boolean;
}) {
  const client = useQueryClient();
  const composerId = useId();
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [replacement, setReplacement] = useState<Mode | "discard" | null>(null);
  const [deleting, setDeleting] = useState<WorkActivityItem | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const prompt = useRef<HTMLButtonElement>(null);
  const user = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => gateway.session(signal),
    select: (session) => session?.user,
    enabled: !offline,
  }).data;
  const viewerId = accountId ?? user?.accountId;
  const feed = useInfiniteQuery({
    queryKey: ["work", id, "activity"],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      gateway.workActivity(id, pageParam, signal, pageParam === 1),
    getNextPageParam: (page) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    enabled: !offline,
    refetchInterval: offline ? false : 30000,
  });
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
  const ownReview =
    feed.data?.pages[0]?.ownReview ??
    items.find((item) => item.kind === "review" && item.author.id === viewerId);
  const reviewsAvailable = feed.data?.pages[0]?.ownReview !== undefined;
  const canScore =
    reviewsAvailable && (mode?.kind === "edit" ? mode.item.kind === "review" : !mode && !ownReview);
  const isReview = mode?.kind === "edit" ? mode.item.kind === "review" : !mode && score !== null;
  const hasDraft = Boolean(body.trim() || spoilers || score !== null);
  function closeComposer() {
    setExpanded(false);
    requestAnimationFrame(() => prompt.current?.focus());
  }
  function clearDraft() {
    setBody("");
    setSpoilers(false);
    setScore(null);
    setMode(null);
  }
  function openComposer() {
    setExpanded(true);
    requestAnimationFrame(() => input.current?.focus());
  }
  const change = useMutation({
    mutationFn: () =>
      gateway.workComment(id, {
        action: mode?.kind === "edit" ? "update" : "create",
        commentId: mode?.kind === "edit" ? mode.item.id : undefined,
        parentId: mode?.kind === "reply" ? mode.item.id : undefined,
        kind: isReview ? "review" : undefined,
        rating: isReview ? (score ?? undefined) : undefined,
        body: body.trim(),
        containsSpoilers: spoilers,
      }),
    onSuccess: async () => {
      clearDraft();
      closeComposer();
      await client.invalidateQueries({ queryKey: ["work", id, "activity"] });
      await client.invalidateQueries({ queryKey: ["home"] });
    },
  });
  const remove = useMutation({
    mutationFn: (item: WorkActivityItem) =>
      gateway.workComment(id, {
        action: "delete",
        commentId: item.id,
        kind: item.kind === "review" ? "review" : undefined,
      }),
    onSuccess: async (_, item) => {
      setDeleting(null);
      if (mode?.item.id === item.id) {
        clearDraft();
        change.reset();
        closeComposer();
      }
      await client.invalidateQueries({ queryKey: ["work", id, "activity"] });
      await client.invalidateQueries({ queryKey: ["home"] });
    },
  });
  function compose(next: Mode) {
    if (hasDraft) {
      setReplacement(next);
      return;
    }
    applyMode(next);
  }
  function applyMode(next: Mode) {
    setMode(next);
    setBody(next.kind === "edit" ? next.item.body : "");
    setSpoilers(next.kind === "edit" && next.item.containsSpoilers);
    setScore(next.kind === "edit" ? next.item.rating : null);
    change.reset();
    openComposer();
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
        <MessageCircle className="size-5" aria-hidden="true" />
        <h2 className="text-xl font-semibold">نقاش العائلة</h2>
        {feed.data && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {feed.data.pages[0]?.total}
          </span>
        )}
      </header>
      {offline ? (
        <p className="text-sm text-muted-foreground">نقاش العائلة يحتاج اتصالًا بالخادم.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border bg-card/65">
            {expanded ? (
              <form
                className="flex flex-col gap-3 p-3 sm:p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (body.trim() && !change.isPending) change.mutate();
                }}
              >
                <header className="flex min-w-0 items-center gap-3">
                  <ComposerAvatar name={user?.name} avatarKey={user?.avatarKey} />
                  <h3 className="min-w-0 flex-1 text-base font-semibold wrap-anywhere">
                    {mode?.kind === "reply"
                      ? `رد على ${mode.item.author.displayName}`
                      : mode?.kind === "edit"
                        ? isReview
                          ? "تعديل المراجعة"
                          : "تعديل التعليق"
                        : "شارك رأيك"}
                  </h3>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="طي محرّر النقاش"
                    disabled={change.isPending}
                    onClick={closeComposer}
                  >
                    <X aria-hidden />
                  </Button>
                </header>
                {canScore && (
                  <ScoreChoice value={score} onChange={setScore} disabled={change.isPending} />
                )}
                <Field>
                  <FieldLabel htmlFor={composerId} className="sr-only">
                    اكتب تعليقًا للعائلة
                  </FieldLabel>
                  <Textarea
                    id={composerId}
                    ref={input}
                    value={body}
                    maxLength={1200}
                    rows={4}
                    disabled={change.isPending}
                    dir="auto"
                    placeholder="ما رأيك في العمل؟"
                    onChange={(event) => setBody(event.target.value)}
                  />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={spoilers}
                      disabled={change.isPending}
                      onCheckedChange={(value) => setSpoilers(value === true)}
                    />
                    يحوي حرقًا للأحداث
                  </label>
                  <div className="ms-auto flex items-center gap-2">
                    {mode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={change.isPending}
                        onClick={() => {
                          if (hasDraft) setReplacement("discard");
                          else {
                            clearDraft();
                            change.reset();
                          }
                        }}
                      >
                        إلغاء
                      </Button>
                    )}
                    {body.length > 0 && (
                      <bdi className="text-xs text-muted-foreground tabular-nums">
                        {body.length}/1200
                      </bdi>
                    )}
                    <Button type="submit" disabled={!body.trim() || change.isPending}>
                      <Send data-icon="inline-start" aria-hidden />
                      {change.isPending
                        ? "جارٍ الإرسال…"
                        : mode?.kind === "edit"
                          ? "حفظ التعديل"
                          : isReview
                            ? "نشر المراجعة"
                            : "إرسال التعليق"}
                    </Button>
                  </div>
                </div>
                {change.isError && <Failure error={change.error} />}
              </form>
            ) : (
              <button
                ref={prompt}
                type="button"
                aria-expanded={false}
                onClick={openComposer}
                className="press-feedback flex w-full items-center gap-3 px-3 py-3 text-start text-sm text-muted-foreground outline-none hover:bg-muted/40 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring sm:px-4 sm:text-base"
              >
                <ComposerAvatar name={user?.name} avatarKey={user?.avatarKey} />
                <span className="min-w-0 flex-1">
                  {hasDraft
                    ? "متابعة المسودة"
                    : reviewsAvailable
                      ? "ما رأيك؟ اكتب تعليقًا أو مراجعة…"
                      : "ما رأيك؟ اكتب تعليقًا…"}
                </span>
                <Pencil className="size-4 shrink-0" aria-hidden />
              </button>
            )}
          </div>
          {reviewsAvailable &&
            ownReview &&
            !(mode?.kind === "edit" && mode.item.id === ownReview.id) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">مراجعتك</span>
                {ownReview.rating !== null && <ReviewScore value={ownReview.rating} />}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={change.isPending || remove.isPending}
                  onClick={() => compose({ kind: "edit", item: ownReview })}
                >
                  تعديل مراجعتك
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="حذف مراجعتك"
                  disabled={change.isPending || remove.isPending}
                  onClick={() => setDeleting(ownReview)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            )}
          {feed.isPending && (
            <div role="status" aria-label="جارٍ تحميل النقاش" className="flex flex-col gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          )}
          {feed.isError && <Failure error={feed.error} retry={() => void feed.refetch()} />}
          {feed.isSuccess && items.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد تعليقات بعد. ابدأ النقاش.</p>
          )}
          {[...threads].map(([rootId, thread]) => (
            <div key={rootId} className="flex flex-col gap-3 border-b border-border pb-5">
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
                    own={
                      item.author.id === viewerId && (item.kind === "comment" || reviewsAvailable)
                    }
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
      <DiscussionConfirmation
        open={!!replacement}
        title={replacement === "discard" ? "التخلّي عن المسودة؟" : "استبدال المسودة؟"}
        description={
          replacement === "discard"
            ? "ستُحذف التعديلات غير المحفوظة من المحرّر."
            : "لديك مسودة لم تُرسل بعد. يمكنك الاحتفاظ بها أو بدء الرد أو التعديل الجديد."
        }
        cancelLabel="الاحتفاظ بالمسودة"
        actionLabel={replacement === "discard" ? "التخلّي عن المسودة" : "استبدال المسودة"}
        onCancel={() => setReplacement(null)}
        onConfirm={() => {
          if (replacement === "discard") {
            clearDraft();
            change.reset();
            closeComposer();
          } else if (replacement) applyMode(replacement);
          setReplacement(null);
        }}
      />
      <DiscussionConfirmation
        open={!!deleting}
        title={deleting?.kind === "review" ? "حذف مراجعتك؟" : "حذف تعليقك؟"}
        description={
          deleting?.kind === "review"
            ? "تُحذف مراجعتك ودرجتها من نقاش العائلة."
            : "يُخفى تعليقك من النقاش. تبقى ردود بقية أفراد العائلة."
        }
        cancelLabel="إلغاء"
        actionLabel={deleting?.kind === "review" ? "حذف المراجعة" : "حذف التعليق"}
        destructive
        pending={remove.isPending}
        feedback={remove.isError && <Failure error={remove.error} />}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting);
        }}
      />
    </section>
  );
}
function DiscussionConfirmation({
  open,
  title,
  description,
  cancelLabel,
  actionLabel,
  onCancel,
  onConfirm,
  feedback,
  pending,
  destructive,
}: {
  open: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  actionLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  feedback?: ReactNode;
  pending?: boolean;
  destructive?: boolean;
}) {
  const mobile = useIsMobile();
  const onOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !pending) onCancel();
  };
  const variant = destructive ? "destructive" : "default";
  if (mobile) {
    return (
      <MobileDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        showTitle
      >
        <div className="flex flex-col gap-3 p-4">
          {feedback}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={pending} onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant={variant} disabled={pending} onClick={onConfirm}>
              {actionLabel}
            </Button>
          </div>
        </div>
      </MobileDrawer>
    );
  }
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {feedback}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            disabled={pending}
            onClick={(event) => {
              if (destructive) event.preventDefault();
              onConfirm();
            }}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ComposerAvatar({ name, avatarKey }: { name?: string; avatarKey?: string }) {
  return name && avatarKey ? (
    <span className="shrink-0" aria-hidden>
      <AccountAvatar name={name} avatarKey={avatarKey} className="size-9" />
    </span>
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
      <MessageCircle className="size-4" />
    </span>
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
  const [expanded, setExpanded] = useState(false);
  const bodyId = useId();
  const long = item.body.length > 360 || item.body.split("\n").length > 5;
  const hidden = item.containsSpoilers && !revealed;
  return (
    <article
      className={cn(
        "flex min-w-0 items-start gap-3",
        reply && "ms-4 border-s border-border ps-3 sm:ms-10",
      )}
    >
      <a
        href={`#/profiles/${item.author.id}`}
        className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={`ملف ${item.author.displayName}`}
      >
        <AccountAvatar
          name={item.author.displayName}
          avatarKey={item.author.avatarKey}
          className={reply ? "size-8" : "size-10"}
        />
      </a>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <a
              href={`#/profiles/${item.author.id}`}
              className="min-w-0 font-semibold wrap-anywhere hover:underline"
            >
              <bdi>{item.author.displayName}</bdi>
            </a>
            <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
              {dateLabel(item.createdAt)}
            </time>
            {reply && <span className="text-xs text-muted-foreground">رد</span>}
            {item.kind === "review" && (
              <span className="text-xs text-muted-foreground">مراجعة</span>
            )}
          </div>
          {own && (
            <Menu modal={false}>
              <MenuTrigger
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                disabled={busy}
                aria-label={item.kind === "review" ? "إجراءات مراجعتك" : "إجراءات تعليقك"}
              >
                <Ellipsis aria-hidden />
              </MenuTrigger>
              <SdkMenuContent align="end">
                <MenuGroup>
                  <MenuItem className={sdkMenuItemClassName} onSelect={onEdit}>
                    <Pencil className="size-4" aria-hidden /> تعديل
                  </MenuItem>
                  <MenuItem className={sdkMenuItemClassName} onSelect={onDelete}>
                    <Trash2 className="size-4 text-destructive" aria-hidden /> حذف
                  </MenuItem>
                </MenuGroup>
              </SdkMenuContent>
            </Menu>
          )}
        </header>
        {item.rating !== null && <ReviewScore value={item.rating} />}
        {hidden ? (
          <Button className="w-fit" variant="outline" size="sm" onClick={() => setRevealed(true)}>
            إظهار تعليق يحوي حرقًا
          </Button>
        ) : (
          <>
            {item.body.trim() && (
              <p
                id={bodyId}
                className={cn(
                  "text-base leading-relaxed whitespace-pre-line wrap-anywhere",
                  long && !expanded && "line-clamp-5",
                )}
                dir="auto"
              >
                {item.body}
              </p>
            )}
            {(long || item.containsSpoilers) && (
              <div className="flex flex-wrap gap-1">
                {long && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={expanded}
                    aria-controls={bodyId}
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? "عرض أقل" : "قراءة المزيد"}
                  </Button>
                )}
                {item.containsSpoilers && (
                  <Button size="sm" variant="ghost" onClick={() => setRevealed(false)}>
                    إخفاء الحرق
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        {item.kind === "comment" && (
          <div className="flex">
            <Button size="sm" variant="ghost" disabled={busy} onClick={onReply}>
              <Reply data-icon="inline-start" aria-hidden />
              رد
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

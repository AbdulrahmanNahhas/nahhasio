import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Braces, ListChecks, Search, X, Ellipsis, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";

import { connectionsOptions } from "../auth/connections";
import { changeSelection, type SelectedRecord } from "./catalog-selection-model";
import type { WorksView } from "./works-results";

type CatalogSelectionState = { selected: SelectedRecord[]; view: WorksView };
/** Session-only UI state: survives route changes, but logout/server switching clears the query cache. */
export type SelectionTarget = "works" | "people" | "studios";
export function useCatalogSelection(userId: string, target: SelectionTarget = "works") {
  const client = useQueryClient();
  const connections = useQuery(connectionsOptions());
  const key = [
    "admin",
    "catalog-selection",
    connections.data?.selected ?? "",
    userId,
    target,
  ] as const;
  const state = useQuery({
    queryKey: key,
    queryFn: (): CatalogSelectionState => ({ selected: [], view: "posters" }),
    initialData: (): CatalogSelectionState => ({ selected: [], view: "posters" }),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const update = (change: (previous: CatalogSelectionState) => CatalogSelectionState) =>
    client.setQueryData<CatalogSelectionState>(key, (previous) =>
      change(previous ?? { selected: [], view: "posters" }),
    );
  return {
    selected: state.data.selected,
    view: state.data.view,
    setView: (view: WorksView) => update((previous) => ({ ...previous, view })),
    clear: () => update((previous) => ({ ...previous, selected: [] })),
    change: (records: SelectedRecord[], checked: boolean) => {
      update((previous) => ({
        ...previous,
        selected: changeSelection(previous.selected, records, checked),
      }));
    },
  };
}
export function CatalogSelectionActions({
  selected,
  visible,
  onClear,
  onRemove,
  target = "works",
  onDelete,
}: {
  target?: SelectionTarget;
  onDelete?: () => void;
  selected: SelectedRecord[];
  visible: string[];
  onClear: () => void;
  onRemove: (record: SelectedRecord) => void;
}) {
  const [review, setReview] = useState(false);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const noun = target === "works" ? "عمل" : "سجل";
  const changeReview = (open: boolean) => {
    setReview(open);
    if (!open) {
      setQ("");
      setLimit(50);
    }
  };
  const clear = () => {
    changeReview(false);
    onClear();
  };
  if (!selected.length) return null;
  const visibleIds = new Set(visible);
  const hidden = selected.filter((record) => !visibleIds.has(record.id)).length;
  const query = q.trim().toLocaleLowerCase();
  const matches = review
    ? selected.filter((record) => record.name.toLocaleLowerCase().includes(query))
    : [];
  return (
    <div
      className="fixed inset-x-4 bottom-5 z-30 mx-auto flex w-fit max-w-full items-center gap-3 rounded-2xl border border-border bg-popover px-3 py-2.5 shadow-lg"
      data-slot="work-selection-actions"
      role="region"
      aria-label={target === "works" ? "إجراءات الأعمال المحددة" : "إجراءات السجلات المحددة"}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={target === "works" ? "إلغاء تحديد الأعمال" : "إلغاء تحديد السجلات"}
        onClick={clear}
      >
        <X />
      </Button>
      <Dialog open={review} onOpenChange={changeReview}>
        <DialogTrigger render={<Button variant="ghost" size="sm" aria-label="مراجعة التحديد" />}>
          <ListChecks data-icon="inline-start" />
          <span role="status" aria-live="polite">
            {selected.length} {noun} محدّد
          </span>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {target === "works" ? "الأعمال المحددة" : "السجلات المحددة"} ({selected.length})
            </DialogTitle>
            <DialogDescription>
              {hidden > 0 ? `${hidden} خارج الصفحة الحالية. ` : ""}البحث أو تغيير الصفحة لا يلغي
              تحديدك.
            </DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="بحث في التحديد"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setLimit(50);
              }}
              placeholder="ابحث في التحديد…"
            />
            {q && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton aria-label="مسح بحث التحديد" onClick={() => setQ("")}>
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <div className="flex flex-col gap-1">
            {matches.slice(0, limit).map((record) => (
              <div
                key={record.id}
                className="flex min-w-0 items-center gap-3 border-b border-border py-2 last:border-0"
              >
                <span className="min-w-0 flex-1 truncate text-sm" dir="auto" title={record.name}>
                  {record.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`إلغاء تحديد ${record.name}`}
                  onClick={() => {
                    if (selected.length === 1) changeReview(false);
                    onRemove(record);
                  }}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
          {!matches.length && (
            <p className="text-sm text-muted-foreground">لا توجد سجلات مطابقة في التحديد.</p>
          )}
          {matches.length > limit && (
            <Button variant="outline" onClick={() => setLimit(limit + 50)}>
              عرض المزيد ({Math.min(limit, matches.length)} / {matches.length})
            </Button>
          )}
          <Button variant="ghost" onClick={clear}>
            إلغاء تحديد الجميع
          </Button>
        </DialogContent>
      </Dialog>
      <Button
        size="sm"
        render={
          <a
            href={
              target === "works"
                ? "#/admin/json?selection=works"
                : `#/admin/json?target=${target}&selection=${target}`
            }
          />
        }
      >
        <Braces data-icon="inline-start" /> تحرير JSON
      </Button>
      {onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="المزيد من إجراءات التحديد" />
            }
          >
            <Ellipsis />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={selected.length > 50} onClick={onDelete}>
                <Trash2 data-icon="inline-start" />{" "}
                {selected.length > 50 ? "الحذف متاح حتى 50 سجلاً في الدفعة" : "حذف المحدد"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

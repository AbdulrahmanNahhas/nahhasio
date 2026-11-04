import { FileSearch, Search, X } from "lucide-react";
import { useRef, useState } from "react";

import { Artwork } from "@/components/artwork";
import { Failure } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";

import { normalizeFacetSearch } from "../catalog/filter-model";
import { entityLink, navigate, workLink } from "../shell/navigation";
import { pageDirectory } from "../shell/page-directory";
import { searchTypes, type SearchType } from "./search-model";
import { useLibrarySearch } from "./use-library-search";

export function QuickSearch({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  const navigating = useRef(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) navigating.current = false;
        onOpenChange(next);
      }}
    >
      <DialogContent
        dir="rtl"
        showCloseButton={false}
        finalFocus={() => !navigating.current}
        className="bottom-3 top-auto max-h-5/6 translate-y-0 gap-2 p-2 md:bottom-auto md:top-1/4 md:max-w-2xl motion-safe:duration-200 data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4 md:data-open:slide-in-from-top-2 md:data-closed:slide-out-to-top-2 motion-reduce:animate-none"
      >
        <DialogHeader className="sr-only start-4 top-4">
          <DialogTitle>البحث السريع</DialogTitle>
          <DialogDescription>
            ابحث في المكتبة أو انتقل إلى صفحة. استخدم الأسهم للاختيار وEnter للفتح وEscape للإغلاق.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <SearchCommand
            isAdmin={isAdmin}
            close={() => onOpenChange(false)}
            choose={(href) => {
              navigating.current = true;
              onOpenChange(false);
              navigate(href.replace(/^#/, ""));
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function SearchCommand({
  isAdmin,
  close,
  choose,
}: {
  isAdmin: boolean;
  close: () => void;
  choose: (href: string) => void;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState<SearchType>("all");
  const isMobile = useIsMobile();
  const [privateResults, setPrivateResults] = useState(false);
  const includePrivate = !isMobile && privateResults;
  const data = useLibrarySearch(text, type, includePrivate);
  const words = normalizeFacetSearch(text).split(" ").filter(Boolean);
  const pages =
    type === "all"
      ? pageDirectory(isAdmin).filter((page) =>
          words.every((word) =>
            normalizeFacetSearch(`${page.label} ${page.description} ${page.path}`).includes(word),
          ),
        )
      : [];
  const fullSearchParams = new URLSearchParams({ q: text, type });
  if (includePrivate) fullSearchParams.set("privacy", "all");
  const fullSearch = `#/search?${fullSearchParams}`;
  return (
    <Command
      shouldFilter={false}
      label="ابحث في المكتبة والصفحات"
      className="relative min-h-0 min-w-0 flex-col-reverse md:flex-col"
    >
      <div className="flex shrink-0 items-center gap-1 p-1">
        <div className="min-w-0 flex-1">
          <CommandInput
            aria-label="ابحث في المكتبة والصفحات"
            placeholder="عمل، صانع، استوديو، أو صفحة…"
            value={text}
            onValueChange={(value) => setText(value.slice(0, 200))}
            maxLength={200}
            autoComplete="off"
          />
        </div>
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="فتح صفحة البحث"
            title="فتح صفحة البحث"
            onClick={() => choose(fullSearch)}
          >
            <FileSearch />
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="إغلاق البحث السريع" onClick={close}>
          <X />
        </Button>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <div className="no-scrollbar min-w-0 overflow-x-auto px-2 py-1">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={1}
            value={[type]}
            aria-label="نوع البحث السريع"
            onValueChange={(values) => {
              const next = searchTypes.find((item) => item.value === values[0]);
              if (next) setType(next.value);
            }}
          >
            {searchTypes.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {!isMobile && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3">
            <p role="status" className="text-xs text-muted-foreground">
              {!text.trim()
                ? "إلى أين تريد الذهاب؟"
                : data.waiting
                  ? "جارٍ البحث…"
                  : `${data.total} نتيجة في المكتبة · ${pages.length} صفحة`}
            </p>
            {isAdmin && (
              <Field orientation="horizontal" className="relative w-auto">
                <Checkbox
                  id="quick-private"
                  checked={includePrivate}
                  onCheckedChange={(value) => setPrivateResults(value === true)}
                />
                <FieldLabel htmlFor="quick-private">تضمين الأعمال الخاصة</FieldLabel>
              </Field>
            )}
          </div>
        )}
        <CommandList
          className="max-h-80 min-h-24 md:max-h-96"
          label="نتائج البحث السريع"
          aria-busy={data.waiting}
        >
          {data.error && (
            <Failure
              error={data.error}
              retry={() => {
                void data.works.refetch();
                void data.facets.refetch();
              }}
            />
          )}
          {pages.length > 0 && (
            <CommandGroup heading="الصفحات">
              {pages.map((page) => (
                <CommandItem key={page.href} value={page.href} onSelect={() => choose(page.href)}>
                  <page.icon />
                  <span className="min-w-0 flex-1 truncate">{page.label}</span>
                  <span className="text-xs text-muted-foreground">{page.group}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {text.trim() && !data.waiting && data.entities.length > 0 && (
            <CommandGroup heading="الأسماء والعوالم">
              {data.entities.slice(0, 12).map((item) => (
                <CommandItem
                  key={`${item.group.key}:${item.value}`}
                  value={`${item.group.key}:${item.value}`}
                  onSelect={() => choose(entityLink(item.group.key, item.value))}
                >
                  <item.group.icon />
                  <span className="min-w-0 flex-1 truncate" dir="auto">
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.group.label} · {item.count}
                  </span>
                </CommandItem>
              ))}
              {data.entities.length > 12 && (
                <CommandItem value="all-entities" onSelect={() => choose(fullSearch)}>
                  عرض كل الأسماء والعوالم
                </CommandItem>
              )}
            </CommandGroup>
          )}
          {text.trim() && !data.waiting && data.entries.length > 0 && (
            <CommandGroup heading={type === "installments" ? "الأجزاء" : "الأعمال"}>
              {data.entries.map((entry) => (
                <CommandItem
                  key={entry.installment?.id ?? entry.work.id}
                  value={entry.installment?.id ?? entry.work.id}
                  onSelect={() => choose(workLink(entry.work.id, entry.installment?.id))}
                >
                  <Artwork
                    id={entry.work.poster?.id}
                    width={320}
                    alt=""
                    className="h-14 w-10 shrink-0 rounded-lg object-cover"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate" dir="auto">
                      {entry.work.titleAr ?? entry.work.canonicalTitle}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {entry.installment?.title ??
                        (entry.work.format === "animated" ? "رسوم متحركة" : "تمثيل حي")}{" "}
                      {entry.work.releaseYear ?? ""}
                    </span>
                  </span>
                </CommandItem>
              ))}
              {data.works.hasNextPage && (
                <CommandItem
                  value="more-results"
                  disabled={data.works.isFetchingNextPage}
                  onSelect={() => void data.works.fetchNextPage()}
                >
                  {data.works.isFetchingNextPage ? "جارٍ تحميل المزيد…" : "المزيد من النتائج"}
                </CommandItem>
              )}
              {data.works.isFetchNextPageError && (
                <CommandItem value="retry-results" onSelect={() => void data.works.fetchNextPage()}>
                  تعذّر تحميل المزيد · أعد المحاولة
                </CommandItem>
              )}
            </CommandGroup>
          )}
          {text.trim() && !data.waiting && !data.error && !pages.length && data.total === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Search className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm">لا توجد نتائج مطابقة</p>
              <p className="text-xs text-muted-foreground">جرّب اسمًا آخر أو اختر الكل.</p>
            </div>
          )}
        </CommandList>
        {!isMobile && (
          <div className="flex shrink-0 items-center justify-between gap-2 p-2">
            <Button variant="ghost" size="sm" onClick={() => choose(fullSearch)}>
              <FileSearch data-icon="inline-start" />
              فتح صفحة البحث
            </Button>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Kbd>↑ ↓</Kbd> اختيار <Kbd>Enter</Kbd> فتح <Kbd>Esc</Kbd>
            </span>
          </div>
        )}
      </div>
    </Command>
  );
}

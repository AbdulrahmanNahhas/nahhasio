import { ArrowUpLeft, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Label } from "@/components/ui/label";

import {
  useCardNavigation,
  useContentEntry,
  useLoadMoreNavigation,
} from "../../components/card-navigation";
import { MediaCard } from "../../components/media-card";
import { Failure, NoResults } from "../../components/status";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { useIsAdmin } from "../account/use-is-admin";
import { entityLink, replaceParams } from "../shell/navigation";
import { matchingEntities } from "./search-entities";
import { parseSearchType, searchTypes } from "./search-model";
import { useLibrarySearch } from "./use-library-search";

function EntityMatches({ items }: { items: ReturnType<typeof matchingEntities> }) {
  const navigation = useCardNavigation();
  const [limit, setLimit] = useState(12);
  return (
    <section className="mb-10" aria-label="الأسماء والعوالم المطابقة">
      <header className="mb-5 flex items-center gap-3">
        <h2 className="text-lg font-semibold">الأسماء والعوالم</h2>
        <span className="text-xs text-muted-foreground">{items.length} نتيجة</span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, limit).map((item) => (
          <a
            {...navigation}
            key={`${item.group.key}-${item.value}`}
            href={entityLink(item.group.key, item.value)}
            className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary motion-reduce:transition-none"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <item.group.icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm" dir="auto">
                {item.label}
              </strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.group.label} · {item.count} عمل
              </span>
            </span>
            <ArrowUpLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        ))}
      </div>
      {limit < items.length && (
        <Button
          {...navigation}
          variant="outline"
          className="mt-5"
          onClick={() => setLimit((value) => value + 12)}
        >
          المزيد من الأسماء والعوالم
        </Button>
      )}
    </section>
  );
}
export function SearchPage({ params }: { params: URLSearchParams }) {
  const navigation = useCardNavigation();
  const loadMore = useLoadMoreNavigation();
  const focusResults = useContentEntry();
  const input = useRef<HTMLInputElement>(null);
  const text = (params.get("q") ?? "").slice(0, 200);
  const type = parseSearchType(params.get("type"));
  const isAdmin = useIsAdmin();
  const includePrivate = isAdmin && params.get("privacy") === "all";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    replaceParams("/search", next);
  };
  useEffect(() => {
    const focus = () => {
      input.current?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focus);
    window.addEventListener("nahhasio:focus-search", focus);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("nahhasio:focus-search", focus);
    };
  }, []);
  const { q, works, facets, showWorks, showEntities, entities, entries, total, waiting, error } =
    useLibrarySearch(text, type, includePrivate);
  return (
    <section
      className="mx-auto min-h-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8"
      aria-label="صفحة البحث"
    >
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">البحث في المكتبة</h1>
          <p className="text-sm text-muted-foreground">الأعمال والصنّاع والاستوديوهات والعوالم.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.dispatchEvent(new Event("nahhasio:quick-search"))}
        >
          البحث السريع · Ctrl+K
        </Button>
      </header>
      <div className="mb-6 shadow-xs backdrop-blur-sm">
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            input.current?.blur();
          }}
        >
          <InputGroup className="h-12">
            <InputGroupAddon>
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              ref={input}
              id="library-search"
              role="searchbox"
              aria-label="ابحث في المكتبة"
              value={text}
              maxLength={200}
              autoComplete="off"
              placeholder="عنوان عمل، اسم صانع، أو عالم…"
              className="text-sm placeholder:text-muted-foreground/70"
              onChange={(event) => update("q", event.target.value)}
            />
            <InputGroupAddon align="inline-end">
              {text && (
                <InputGroupButton
                  aria-label="مسح البحث"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    update("q", "");
                    input.current?.focus();
                  }}
                >
                  <X className="size-3.5" />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 max-w-full overflow-x-auto pb-0.5">
            <ToggleGroup
              value={[type]}
              onValueChange={(values) => {
                const next = values[0];
                if (next) update("type", parseSearchType(next));
              }}
              variant="outline"
              size="sm"
              aria-label="نوع البحث"
              className="inline-flex"
            >
              {searchTypes.map((item) => (
                <ToggleGroupItem
                  key={item.value}
                  value={item.value}
                  aria-label={item.label}
                  className="gap-1.5 rounded-lg px-3 py-1 text-xs font-medium"
                >
                  <item.icon className="size-3.5" aria-hidden="true" />
                  <span>{item.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {isAdmin && (
            <Label
              htmlFor="search-private"
              className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Checkbox
                id="search-private"
                checked={includePrivate}
                onCheckedChange={(checked) => update("privacy", checked ? "all" : "")}
                className="size-4 rounded"
              />
              <span>تضمين الأعمال الخاصة</span>
            </Label>
          )}
        </div>
      </div>
      {text.trim() && (
        <Button
          variant="ghost"
          type="button"
          onClick={focusResults}
          className="sr-only focus:not-sr-only focus:mb-5 focus:rounded-lg focus:bg-primary focus:px-5 focus:py-3 focus:text-primary-foreground"
        >
          الانتقال إلى النتائج
        </Button>
      )}
      {!text.trim() ? (
        <NoResults
          title="ما الذي تتذكره؟"
          description="اكتب عنوانًا أو اسمًا، ثم اختر نوعًا لتضييق النتائج. يبحث «الكل» في الأعمال والأسماء والعوالم معًا."
        />
      ) : (
        <>
          <header
            className="mb-7 flex flex-wrap items-center justify-between gap-3"
            aria-live="polite"
          >
            <h2 className="text-lg font-semibold">نتائج «{text.trim()}»</h2>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {waiting ? (
                <>
                  <LoaderCircle
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  جارٍ البحث…
                </>
              ) : (
                `${total} نتيجة`
              )}
            </p>
          </header>
          {error && (
            <Failure
              error={error}
              retry={() => {
                if (showWorks) void works.refetch();
                if (showEntities) void facets.refetch();
              }}
            />
          )}
          {!waiting && !error && total === 0 && (
            <NoResults
              title="لا توجد نتائج مطابقة"
              description="جرّب اسمًا آخر أو اختر «الكل» لتوسيع البحث."
            />
          )}
          {!waiting && showEntities && entities.length > 0 && (
            <EntityMatches key={`${q}-${type}-${includePrivate}`} items={entities} />
          )}
          {!waiting && showWorks && entries.length > 0 && (
            <section aria-label="الأعمال المطابقة">
              <header className="mb-5 flex items-center gap-3">
                <h2 className="text-lg font-semibold">
                  {type === "installments" ? "الأجزاء" : "الأعمال"}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {works.data?.pages[0]?.total} نتيجة
                </span>
              </header>
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {entries.map((entry) => (
                  <MediaCard key={entry.installment?.id ?? entry.work.id} entry={entry} />
                ))}
              </div>
              {works.hasNextPage && (
                <div className="mt-9 flex justify-center">
                  <Button
                    {...navigation}
                    variant="outline"
                    size="lg"
                    aria-disabled={works.isFetchingNextPage}
                    onClick={(event) => {
                      if (works.isFetchingNextPage) return;
                      if (loadMore)
                        void loadMore(event.currentTarget, async () => {
                          await works.fetchNextPage();
                        });
                      else void works.fetchNextPage();
                    }}
                  >
                    {works.isFetchingNextPage ? "جارٍ تحميل المزيد…" : "المزيد من النتائج"}
                  </Button>
                </div>
              )}
              {works.isFetchNextPageError && (
                <Failure
                  error={works.error ?? new Error("تعذّر تحميل المزيد.")}
                  retry={() => void works.fetchNextPage()}
                />
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}

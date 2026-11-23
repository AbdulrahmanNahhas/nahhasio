import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { useQuery } from "@tanstack/react-query";
import { CommandInput as CommandText } from "cmdk";
import { cn } from "cn";
import { ArrowLeft, ArrowUpLeft, Search, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import { Artwork } from "@/components/artwork";
import { CardNavigationProvider } from "@/components/card-navigation";
import { ScoreBadge } from "@/components/media-card";
import { Failure, NoResults } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gateway } from "@/lib/bridge";

import { normalizeFacetSearch } from "../catalog/filter-model";
import { pageDirectory } from "../shell/page-directory";
import { entityTypes } from "./search-entities";
import { parseSearchType, searchTypes, type SearchType } from "./search-model";
import {
  entityMatch,
  matchDescription,
  MatchThumbnail,
  matchTitle,
  SearchPreview,
  workMatch,
  type SearchMatch,
} from "./search-preview";
import { SearchStart } from "./search-start";
import { useLibrarySearch } from "./use-library-search";

const groupLimit = 4;
const pageSize = 24;
const resultFocus =
  "group-focus-visible/search-results:aria-selected:inset-ring-2 group-focus-visible/search-results:aria-selected:inset-ring-ring";

export function QuickSearch({
  open,
  onOpenChange,
  isAdmin,
  linkQuery,
}: {
  open: boolean;
  onOpenChange: (open: boolean, destination?: string) => void;
  isAdmin: boolean;
  linkQuery?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const navigating = useRef(false);
  const linked = new URLSearchParams(linkQuery);
  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent
        dir="rtl"
        showCloseButton={false}
        initialFocus={() => {
          navigating.current = false;
          return input.current;
        }}
        finalFocus={() => !navigating.current}
        className="start-0 top-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none md:start-1/2 md:top-1/2 md:h-5/6 md:max-h-200 md:w-11/12 md:max-w-6xl md:-translate-y-1/2 rtl:translate-x-0 md:rounded-3xl md:rtl:translate-x-1/2 motion-reduce:animate-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>البحث السريع</DialogTitle>
          <DialogDescription>
            ابحث في المكتبة والصفحات. تنقّل بين النتائج بالأسهم وافتح النتيجة المحددة بمفتاح Enter.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <SearchCommand
            key={linkQuery ?? ""}
            input={input}
            isAdmin={isAdmin}
            initialText={(linked.get("q") ?? "").slice(0, 200)}
            initialType={parseSearchType(linked.get("type"))}
            initialPrivate={linked.get("privacy") === "all"}
            choose={(href) => {
              navigating.current = true;
              onOpenChange(false, href);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function isExact(match: SearchMatch, query: string) {
  if (!query || match.kind === "page") return false;
  return [
    matchTitle(match),
    ...(match.kind === "entity" ? (match.entity.searchTerms ?? []) : [match.work.canonicalTitle]),
  ].some((name) => normalizeFacetSearch(name) === query);
}

function rankMatches(items: SearchMatch[], query: string) {
  return items.toSorted((a, b) => Number(isExact(b, query)) - Number(isExact(a, query)));
}

function preserveControlKeys(event: KeyboardEvent) {
  if (["Enter", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) event.stopPropagation();
}

function isPlainArrow(event: KeyboardEvent) {
  return (
    event.key.startsWith("Arrow") &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.nativeEvent.isComposing
  );
}

function moveFocus(event: KeyboardEvent, target: HTMLElement | null | undefined) {
  if (!target?.getClientRects().length) return;
  event.preventDefault();
  event.stopPropagation();
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function SearchCommand({
  input,
  isAdmin,
  initialText,
  initialType,
  initialPrivate,
  choose,
}: {
  input: React.RefObject<HTMLInputElement | null>;
  isAdmin: boolean;
  initialText: string;
  initialType: SearchType;
  initialPrivate: boolean;
  choose: (href: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [type, setType] = useState(initialType);
  const [privateResults, setPrivateResults] = useState(initialPrivate);
  const [selected, setSelected] = useState("");
  const [entityPage, setEntityPage] = useState({ key: "", limit: pageSize });
  const tabs = useRef<HTMLDivElement>(null);
  const start = useRef<HTMLDivElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLElement>(null);
  const includePrivate = isAdmin && privateResults;
  const data = useLibrarySearch(text, type, includePrivate);
  const planetCatalog = useQuery({
    queryKey: ["catalog", "filters"],
    queryFn: ({ signal }) => gateway.filters(signal),
    enabled: data.entities.some((entity) => entity.group.type === "planets"),
    staleTime: 30_000,
  });
  const normalized = normalizeFacetSearch(data.q);
  const words = normalizeFacetSearch(text).split(" ").filter(Boolean);
  const directory = pageDirectory(isAdmin);
  const pages: SearchMatch[] =
    (type === "all" || type === "pages") && words.length
      ? directory
          .filter((page) => {
            const name = normalizeFacetSearch(`${page.label} ${page.description} ${page.path}`);
            return words.every((word) => name.includes(word));
          })
          .map((page) => ({ kind: "page", href: page.href, page }))
      : [];
  const scopeKey = JSON.stringify([data.q, type, includePrivate]);
  const all = type === "all";
  const idle = !text.trim();
  const entityLimit = entityPage.key === scopeKey ? entityPage.limit : pageSize;

  const workGroup = {
    scope: "works" as const,
    label:
      searchTypes.find(({ value }) => value === type && (value === "movies" || value === "series"))
        ?.label ?? "الأعمال",
    matches: rankMatches(
      data.workEntries.map(({ work }) => workMatch(work)),
      normalized,
    ),
    count: data.workTotal,
  };
  const groups = [
    workGroup,
    ...entityTypes.map(({ key, label, type: scope }) => {
      const entityMatches = rankMatches(
        data.entities
          .filter((item) => item.group.key === key)
          .map((item) =>
            entityMatch(
              item,
              key === "planets"
                ? planetCatalog.data?.planets.find((planet) => planet.slug === item.value)
                : undefined,
            ),
          ),
        normalized,
      );
      return {
        scope,
        label,
        matches: entityMatches.slice(0, entityLimit),
        count: entityMatches.length,
      };
    }),
    { scope: "pages" as const, label: "الصفحات", matches: pages, count: pages.length },
  ]
    .filter((group) => group.matches.length > 0)
    .toSorted(
      (a, b) =>
        Number(b.matches.some((match) => isExact(match, normalized))) -
        Number(a.matches.some((match) => isExact(match, normalized))),
    )
    .map((group) => ({
      ...group,
      shown: all ? group.matches.slice(0, groupLimit) : group.matches,
    }));
  const matches = groups.flatMap((group) => group.shown);
  const exact = matches.find((match) => isExact(match, normalized));
  const active = matches.find(({ href }) => href === selected) ?? exact ?? matches[0];
  const previewGroup = all
    ? groups.find(({ scope, count, shown }) => selected === `more:${scope}` && count > shown.length)
    : undefined;
  const selection =
    matches.some(({ href }) => href === selected) ||
    groups.some(({ scope, count, shown }) => selected === `more:${scope}` && count > shown.length)
      ? selected
      : (active?.href ?? "");
  const total = data.workTotal + data.entities.length + pages.length;

  const changeScope = (next: SearchType) => {
    setType(next);
    setSelected("");
  };
  const activeTab = () => tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]');
  const startLinks = () =>
    Array.from(start.current?.querySelectorAll<HTMLElement>("[data-card-navigation]") ?? []);
  const resultOptions = () =>
    Array.from(
      results.current?.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])',
      ) ?? [],
    );
  return (
    <Command
      shouldFilter={false}
      value={selection}
      onValueChange={setSelected}
      onKeyDown={(event) => {
        if (
          !isAdmin ||
          !event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.nativeEvent.isComposing ||
          (event.code !== "KeyP" && event.key.toLowerCase() !== "p")
        )
          return;
        event.preventDefault();
        if (!event.repeat) {
          setPrivateResults((previous) => !previous);
          setSelected("");
        }
      }}
      label="ابحث في المكتبة والصفحات"
      className="min-h-0 min-w-0 flex-1 rounded-none p-0"
    >
      <InputGroup
        className="h-14 shrink-0 rounded-none border-0 border-b border-border bg-transparent md:h-16"
        onKeyDown={(event) => {
          if (isPlainArrow(event) && event.key === "ArrowDown") moveFocus(event, activeTab());
          if (event.target === input.current) {
            if (["ArrowUp", "Home", "End"].includes(event.key)) event.stopPropagation();
          } else {
            if (isPlainArrow(event) && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
              const controls = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>("input, button"),
              );
              const index = controls.findIndex((control) => control === event.target);
              moveFocus(event, controls[index + (event.key === "ArrowLeft" ? 1 : -1)]);
            }
            preserveControlKeys(event);
          }
        }}
      >
        <InputGroupAddon className="ps-4 sm:ps-6">
          <Search className="size-5" aria-hidden />
        </InputGroupAddon>
        <CommandText
          ref={input}
          aria-label="ابحث في المكتبة والصفحات"
          placeholder="ابحث عن عمل أو اسم أو صفحة…"
          className="h-full min-w-0 flex-1 text-start text-base outline-none md:text-lg"
          value={text}
          onValueChange={(value) => {
            setText(value);
            setSelected("");
          }}
          maxLength={200}
          autoComplete="off"
          dir={text ? "auto" : "rtl"}
        />
        <InputGroupAddon align="inline-end" className="pe-3 sm:pe-5">
          {text && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="مسح البحث"
              onClick={() => {
                setText("");
                setSelected("");
                input.current?.focus();
              }}
            >
              <X data-icon="inline-start" />
            </Button>
          )}
          <DialogClose render={<Button variant="ghost" aria-label="إغلاق البحث السريع" />}>
            إغلاق
          </DialogClose>
        </InputGroupAddon>
      </InputGroup>
      <Tabs
        className="min-h-0 min-w-0 flex-1 gap-0"
        value={type}
        onValueChange={(value) => {
          const next = searchTypes.find((item) => item.value === value);
          if (next) changeScope(next.value);
        }}
      >
        <div className="no-scrollbar shrink-0 overflow-x-auto scroll-px-3 border-b">
          <TabsList
            ref={tabs}
            variant="line"
            activateOnFocus
            aria-label="نوع البحث السريع"
            onKeyDown={(event) => {
              if (isPlainArrow(event)) {
                if (event.key === "ArrowUp") moveFocus(event, input.current);
                if (event.key === "ArrowDown") {
                  if (idle) moveFocus(event, startLinks()[0] ?? start.current);
                  else {
                    setSelected(resultOptions()[0]?.dataset.value ?? "");
                    moveFocus(event, results.current);
                  }
                }
              }
              preserveControlKeys(event);
            }}
            className="relative gap-1 px-3 py-1.5 group-data-horizontal/tabs:h-auto sm:px-5"
          >
            {searchTypes.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-9 shrink-0 px-3 after:hidden focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none focus-visible:bg-accent! focus-visible:text-accent-foreground motion-reduce:transition-none"
              >
                {label}
              </TabsTrigger>
            ))}
            <TabsPrimitive.Indicator className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-primary transition-[translate,width] duration-200 ease-out motion-reduce:transition-none" />
          </TabsList>
        </div>
        <TabsContent value={type} className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {idle && (
            <div
              ref={start}
              tabIndex={-1}
              className="min-w-0 flex-1 overflow-y-auto scroll-p-5 px-4 pt-5 pb-safe sm:px-6 sm:py-6"
              onKeyDownCapture={(event) => {
                if (!isPlainArrow(event) || !(event.target instanceof HTMLElement)) return;
                const links = startLinks();
                if (event.target === event.currentTarget && event.key === "ArrowDown") {
                  moveFocus(event, links[0]);
                  return;
                }
                const top = event.target.getBoundingClientRect().top;
                if (
                  event.key === "ArrowUp" &&
                  !links.some((link) => link.getBoundingClientRect().top < top - 4)
                )
                  moveFocus(event, activeTab());
              }}
              onKeyDown={preserveControlKeys}
            >
              <CardNavigationProvider>
                <SearchStart type={type} directory={directory} choose={choose} />
              </CardNavigationProvider>
            </div>
          )}
          <CommandList
            ref={results}
            className={
              idle
                ? "hidden"
                : "group/search-results max-h-none min-h-0 min-w-0 flex-1 scroll-py-4 px-2 py-3 sm:px-4"
            }
            label="نتائج البحث السريع"
            aria-busy={!idle && data.waiting}
            onKeyDown={(event) => {
              if (!isPlainArrow(event) || event.target !== event.currentTarget) return;
              const options = resultOptions();
              const selectedOption = options.find(
                (option) => option.getAttribute("aria-selected") === "true",
              );
              if (event.key === "ArrowUp" && selectedOption === options[0])
                moveFocus(event, activeTab());
              if (event.key === "ArrowLeft")
                moveFocus(event, preview.current?.querySelector("a, button"));
            }}
          >
            {!idle && (
              <>
                {data.error && (
                  <div className="px-2" onKeyDown={preserveControlKeys}>
                    <Failure error={data.error} retry={data.retry} />
                  </div>
                )}
                {data.waiting && groups.length === 0 && (
                  <div className="flex flex-col gap-2 p-3" aria-hidden>
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                )}
                {!data.waiting && !data.error && matches.length === 0 && (
                  <NoResults
                    title="لا توجد نتائج مطابقة"
                    description="جرّب كتابة اسم آخر أو وسّع البحث باختيار الكل."
                  />
                )}
                {groups.map(({ scope, label, shown, count }) => {
                  const loader = scope === "works" ? data.works : null;
                  const pending = !all && !!loader?.isFetchingNextPage;
                  return (
                    <CommandGroup key={scope} heading={all ? `${label} · ${count}` : undefined}>
                      {shown.map((match) => (
                        <SearchRow
                          key={match.href}
                          match={match}
                          featured={match.href === exact?.href}
                          choose={choose}
                        />
                      ))}
                      {count > shown.length && (
                        <CommandItem
                          value={`more:${scope}`}
                          disabled={pending}
                          onSelect={() => {
                            if (all) {
                              changeScope(scope);
                              input.current?.focus();
                            } else {
                              setSelected(shown.at(-1)?.href ?? "");
                              if (loader) void loader.fetchNextPage();
                              else setEntityPage({ key: scopeKey, limit: entityLimit + pageSize });
                            }
                          }}
                          className={cn("min-h-12 text-sm font-medium text-primary", resultFocus)}
                        >
                          {pending
                            ? "جارٍ تحميل المزيد…"
                            : loader?.isFetchNextPageError
                              ? "أعد محاولة تحميل المزيد"
                              : all
                                ? `عرض نتائج ${label}`
                                : "عرض المزيد"}
                          <CommandShortcut className="ms-auto tracking-normal">
                            <ArrowLeft aria-hidden />
                          </CommandShortcut>
                        </CommandItem>
                      )}
                    </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>
          {!idle && (active || previewGroup) && (
            <aside
              ref={preview}
              aria-label="معاينة النتيجة"
              className="hidden w-5/12 max-w-lg shrink-0 overflow-y-auto scroll-p-4 border-s bg-background/45 md:block"
              onKeyDown={(event) => {
                if (isPlainArrow(event)) {
                  if (event.key === "ArrowRight") moveFocus(event, results.current);
                  if (event.key === "ArrowUp") moveFocus(event, activeTab());
                }
                preserveControlKeys(event);
              }}
            >
              {previewGroup ? (
                <div className="flex flex-col items-start gap-3 p-5">
                  <h3 className="font-display text-2xl font-semibold">{previewGroup.label}</h3>
                  <p className="text-sm text-muted-foreground">{previewGroup.count} نتيجة</p>
                  <Button
                    onClick={() => {
                      changeScope(previewGroup.scope);
                      input.current?.focus();
                    }}
                  >
                    عرض كل النتائج
                    <ArrowLeft data-icon="inline-end" />
                  </Button>
                </div>
              ) : (
                active && (
                  <SearchPreview
                    key={active.href}
                    match={active}
                    exact={active.href === exact?.href}
                    open={choose}
                  />
                )
              )}
            </aside>
          )}
        </TabsContent>
      </Tabs>
      {(!idle || isAdmin) && (
        <footer className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-t bg-background/50 px-4 pt-2 pb-safe text-xs text-muted-foreground sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            {!idle && (
              <p role="status" className="shrink-0 font-medium text-foreground tabular-nums">
                {data.waiting ? "جارٍ البحث…" : data.error ? "" : `${total} نتيجة`}
              </p>
            )}
            <div className="hidden items-center gap-3 md:flex" aria-hidden>
              <span className="flex items-center gap-1.5">
                <Kbd dir="ltr">↑ ↓</Kbd> تنقّل
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd dir="ltr">Enter</Kbd> فتح
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd dir="ltr">Esc</Kbd> إغلاق
              </span>
            </div>
          </div>
          {isAdmin && (
            <Field
              orientation="horizontal"
              className="relative w-auto shrink-0 gap-2"
              onKeyDown={preserveControlKeys}
            >
              <Switch
                id="quick-private"
                checked={includePrivate}
                aria-keyshortcuts="Alt+p"
                onCheckedChange={(value) => {
                  setPrivateResults(value === true);
                  setSelected("");
                }}
              />
              <FieldLabel
                htmlFor="quick-private"
                className="cursor-pointer text-xs text-foreground"
              >
                تضمين الأعمال الخاصة
              </FieldLabel>
              <Kbd className="hidden lg:inline-flex" dir="ltr" aria-hidden>
                Alt+P
              </Kbd>
            </Field>
          )}
        </footer>
      )}
    </Command>
  );
}

function SearchRow({
  match,
  featured,
  choose,
}: {
  match: SearchMatch;
  featured: boolean;
  choose: (href: string) => void;
}) {
  const score = match.kind === "work" ? match.work.score : null;
  const backdrop = match.kind === "work" ? match.work.banner?.id : null;
  return (
    <CommandItem
      value={match.href}
      onSelect={() => choose(match.href)}
      className={cn(
        featured
          ? "isolate my-1 min-h-16 overflow-hidden border-s-2 border-primary max-md:min-h-24 max-md:bg-primary/10"
          : "my-1 min-h-16",
        resultFocus,
      )}
    >
      {featured && backdrop && (
        <Artwork
          id={backdrop}
          alt=""
          width={640}
          className="absolute inset-0 -z-10 size-full object-cover opacity-15 md:hidden"
        />
      )}
      <MatchThumbnail match={match} />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        {featured && <span className="text-xs text-primary md:hidden">مطابقة تامة</span>}
        <span className="line-clamp-2 font-semibold" dir="auto">
          {matchTitle(match)}
        </span>
        <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground" dir="auto">
          {matchDescription(match)}
        </span>
      </span>
      <CommandShortcut className="tracking-normal">
        {score?.rating != null ? <ScoreBadge score={score} /> : <ArrowUpLeft aria-hidden />}
      </CommandShortcut>
    </CommandItem>
  );
}

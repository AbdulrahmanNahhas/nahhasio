import type { AwardEntry } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { Award, ChevronLeft, ChevronRight } from "lucide-react";

import { useCardNavigation } from "@/components/card-navigation";
import { Failure, NoResults } from "@/components/status";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-sdk/select";
import { Separator } from "@/components/ui-sdk/separator";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeSectionHeading } from "@/features/home/home-section";
import { ScrollShelf } from "@/features/home/scroll-shelf";
import { CatalogPage, PublicPageHeader } from "@/features/shell/public-page";

import { AwardWorkCard } from "./award-cards";
import { awardsQuery, AWARDS_PAGE_SIZE, RECOGNITIONS_PAGE_SIZE } from "./awards.queries";

const yearLabel = (year: string) => (year === "undated" ? "بلا سنة" : year);

function AwardsLoading() {
  return (
    <div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      role="status"
      aria-label="جارٍ تحميل الجوائز"
    >
      {["first", "second", "third", "fourth", "fifth"].map((item) => (
        <Skeleton key={item} className="aspect-2/3 rounded-xl" />
      ))}
    </div>
  );
}

function AwardsPager({
  page,
  pages,
  onPage,
  pending,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  pending: boolean;
}) {
  if (pages <= 1 && page === 1) return null;
  return (
    <nav aria-label="صفحات النتائج" className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="الصفحة السابقة"
        disabled={page <= 1 || pending}
        onClick={() => onPage(Math.min(page - 1, pages))}
      >
        <ChevronRight aria-hidden />
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {page} / {pages}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="الصفحة التالية"
        disabled={page >= pages || pending}
        onClick={() => onPage(page + 1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
    </nav>
  );
}

export function AwardsDirectory({
  page,
  onPage,
}: {
  page: number;
  onPage: (page: number) => void;
}) {
  const query = useQuery(awardsQuery(page === 1 ? {} : { page }));
  const total = query.data?.totalPrograms ?? 0;
  const pages = Math.max(1, Math.ceil(total / AWARDS_PAGE_SIZE));
  return (
    <CatalogPage
      heading={
        <PublicPageHeader
          title="الجوائز"
          count={query.data && <Badge variant="secondary">{total} جهة مانحة</Badge>}
          actions={
            <AwardsPager
              page={page}
              pages={pages}
              onPage={onPage}
              pending={query.isPlaceholderData}
            />
          }
        />
      }
    >
      {query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : query.isPending || query.isPlaceholderData ? (
        <AwardsLoading />
      ) : query.data.programs.length ? (
        <div className="flex flex-col gap-8">
          {query.data.programs.map((program) => (
            <section key={program.slug} className="min-w-0" aria-label={program.name}>
              <HomeSectionHeading
                title={program.name}
                href={`#/awards/${encodeURIComponent(program.slug)}`}
              >
                <span className="text-sm text-muted-foreground">
                  {program.entries.length ? "أحدث الفائزين" : "الترشيحات"}
                </span>
              </HomeSectionHeading>
              {program.entries.length ? (
                <ScrollShelf
                  items={program.entries}
                  render={(entry) => <AwardWorkCard key={entry.id} entry={entry} />}
                />
              ) : (
                <p className="px-1 text-sm text-muted-foreground">
                  لا توجد أعمال فائزة مسجّلة لهذه الجهة.
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <NoResults
          title={total ? "لا توجد جهات في هذه الصفحة" : "لا توجد جوائز في المكتبة"}
          description={
            total
              ? "انتقل إلى صفحة سابقة لعرض الجوائز."
              : "تظهر هنا الجهات المرتبطة بجوائز أو ترشيحات لأعمال المكتبة."
          }
        />
      )}
    </CatalogPage>
  );
}

export function AwardArchive({
  slug,
  year,
  page,
  onYear,
  onPage,
}: {
  slug: string;
  year?: string;
  page: number;
  onYear: (year: string) => void;
  onPage: (page: number) => void;
}) {
  const navigation = useCardNavigation();
  const query = useQuery(awardsQuery({ slug, year, page }));
  const program = query.data?.programs[0];
  const categories = new Map<string, { label: string; entries: AwardEntry[] }>();
  for (const entry of program?.entries ?? []) {
    const category = categories.get(entry.categoryKey);
    if (category) category.entries.push(entry);
    else categories.set(entry.categoryKey, { label: entry.category, entries: [entry] });
  }
  const pages = Math.max(1, Math.ceil((program?.totalEntries ?? 0) / RECOGNITIONS_PAGE_SIZE));
  const activeYear = query.isPlaceholderData && year ? year : program?.selectedYear;
  return (
    <CatalogPage
      heading={
        <>
          <div>
            <a
              {...navigation}
              href="#/awards"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ChevronRight data-icon="inline-start" aria-hidden />
              كل الجوائز
            </a>
          </div>
          <PublicPageHeader
            title={
              <span className="flex items-center gap-3">
                <Award className="size-7 shrink-0 text-warning" aria-hidden />
                <span dir="auto">{program?.name ?? "الجوائز"}</span>
              </span>
            }
            actions={
              program &&
              activeYear && (
                <Select
                  items={program.years.map((value) => ({ value, label: yearLabel(value) }))}
                  value={activeYear}
                  onValueChange={(next) => {
                    if (next) onYear(next);
                  }}
                >
                  <SelectTrigger className="min-w-28" aria-label="سنة الجائزة">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {program.years.map((value) => (
                        <SelectItem value={value} key={value}>
                          {yearLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )
            }
          />
        </>
      }
      toolbar={
        program && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {query.isPlaceholderData
                ? "جارٍ تحميل النتائج…"
                : `${program.totalEntries} نتيجة في المكتبة`}
            </span>
            <AwardsPager
              page={page}
              pages={pages}
              onPage={onPage}
              pending={query.isPlaceholderData}
            />
          </div>
        )
      }
    >
      {query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : query.isPending || query.isPlaceholderData ? (
        <AwardsLoading />
      ) : !program ? (
        <NoResults title="هذه الجائزة غير متاحة" description="تصفّح دليل الجوائز لاختيار جهة أخرى." />
      ) : !categories.size ? (
        <NoResults
          title="لا توجد نتائج في هذه الصفحة"
          description="اختر سنة أخرى أو عد إلى صفحة سابقة."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {[...categories].map(([key, { label, entries }]) => (
            <section key={key} aria-label={label} className="flex flex-col gap-2">
              <Separator />
              <h2 className="px-2 font-display text-lg font-semibold" dir="auto">
                {label}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry) => (
                  <AwardWorkCard key={entry.id} entry={entry} compact />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </CatalogPage>
  );
}

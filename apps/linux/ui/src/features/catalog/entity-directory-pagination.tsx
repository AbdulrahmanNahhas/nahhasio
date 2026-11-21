import {
  Pagination,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationList,
  PaginationNext,
  PaginationPrevious,
} from "@ui-sdk/react/pagination";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

const number = new Intl.NumberFormat("ar");
const control =
  "inline-flex size-9 items-center justify-center rounded-lg text-sm tabular-nums hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

export function EntityDirectoryPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const step = cn(control, "data-disabled:opacity-40 data-disabled:hover:bg-transparent");

  return (
    <Pagination
      aria-label="صفحات النتائج"
      page={page}
      pageCount={pageCount}
      siblings={0}
      onPageChange={onPageChange}
    >
      <PaginationList className="flex flex-wrap items-center justify-center gap-1 border-t border-border pt-4">
        {({ items }) => (
          <>
            <PaginationItem>
              <PaginationPrevious aria-label="الصفحة السابقة" className={step}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </PaginationPrevious>
            </PaginationItem>
            {items.map((item) => (
              <PaginationItem key={item}>
                {item === "ellipsis-start" || item === "ellipsis-end" ? (
                  <PaginationEllipsis className="inline-flex size-7 items-center justify-center text-muted-foreground" />
                ) : (
                  <PaginationLink
                    page={item}
                    aria-label={`الصفحة ${number.format(item)}`}
                    className={cn(
                      control,
                      "data-current:bg-primary data-current:text-primary-foreground",
                    )}
                  >
                    {number.format(item)}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext aria-label="الصفحة التالية" className={step}>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </PaginationNext>
            </PaginationItem>
          </>
        )}
      </PaginationList>
    </Pagination>
  );
}

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { databaseRecordsOptions } from "@/features/database/data/database.queries";
import { SelectField } from "@/features/editor/fields/work-fields";
import { isJsonString } from "@/features/editor/json/document/document-model";
import { RegisteredImage } from "@/features/editor/registered-image";

import { ReferenceField } from "./reference-field";

export function ReferencePicker({
  table,
  title,
  onPick,
  images = false,
  imageRole,
  triggerLabel = "اختيار",
}: {
  table: string;
  title: string;
  onPick: (value: string) => void;
  images?: boolean;
  imageRole?: "poster" | "banner" | "logo" | "profile" | "still";
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <SearchIcon data-icon="inline-start" />
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>ابحث واختر من السجلات الحالية.</DialogDescription>
          </DialogHeader>
          {open && (
            <PickerResults
              table={table}
              images={images}
              imageRole={imageRole}
              onPick={(value) => {
                onPick(value);
                setOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
type ArtworkFilters = { related_work?: string; image_role?: string };

function PickerResults({
  table,
  onPick,
  images,
  imageRole,
}: {
  table: string;
  onPick: (value: string) => void;
  images: boolean;
  imageRole?: "poster" | "banner" | "logo" | "profile" | "still";
}) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState("");
  const [sort, setSort] = useState<"default" | "newest" | "oldest">("newest");
  const [work, setWork] = useState("");
  const [role, setRole] = useState(imageRole ?? "all");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(search);
      setOffset(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);
  const filters: ArtworkFilters = {};
  if (images && work) filters.related_work = work;
  if (images && role !== "all") filters.image_role = role;
  const query = useQuery(databaseRecordsOptions(table, offset, settled, filters, sort));
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="بحث في السجلات"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOffset(0);
          }}
          placeholder={images ? "ابحث باسم الصورة أو عنوان العمل بالعربية أو الإنجليزية…" : "ابحث…"}
        />
      </InputGroup>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="الترتيب"
          value={sort}
          onChange={(value) => {
            setSort(value);
            setOffset(0);
          }}
          items={[
            { value: "newest", label: "الأحدث أولاً" },
            { value: "oldest", label: "الأقدم أولاً" },
            { value: "default", label: "الترتيب الافتراضي" },
          ]}
        />
        {images && (
          <SelectField
            label="نوع الصورة"
            value={role}
            onChange={(value) => {
              setRole(value);
              setOffset(0);
            }}
            items={[
              { value: "all", label: "كل الصور" },
              { value: "poster", label: "ملصق" },
              { value: "banner", label: "خلفية" },
              { value: "logo", label: "شعار" },
              { value: "profile", label: "صورة شخصية" },
              { value: "still", label: "صورة حلقة" },
            ]}
          />
        )}
      </div>
      {images && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <ReferenceField
              table="titles"
              label="صور مرتبطة بعمل (اختياري)"
              value={work}
              useIdValue
              onChange={(value) => {
                setWork(value);
                setOffset(0);
              }}
            />
          </div>
          {work && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setWork("");
                setOffset(0);
              }}
            >
              مسح العمل
            </Button>
          )}
        </div>
      )}
      {query.isError && (
        <Alert variant="destructive" className="border-border">
          <AlertTitle>تعذّر تحميل السجلات</AlertTitle>
          <Button variant="outline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </Button>
        </Alert>
      )}
      {query.isPending && <Skeleton className="h-48" />}
      {query.data && !query.data.rows.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد نتائج</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      <div className="grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {query.data?.rows.map((row) => {
          const label = String(
            row.owner_label ??
              row.title_ar ??
              row.label_ar ??
              row.name_ar ??
              row.name ??
              row.canonical_title ??
              row.original_filename ??
              row.slug ??
              row.id,
          );
          const path = row.path ?? null;
          const value = String(
            images ? row.path : (row.slug ?? row.name ?? row.canonical_title ?? row.id),
          );
          return (
            <button
              type="button"
              key={String(row.id)}
              onClick={() => onPick(value)}
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3 text-start outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {images && isJsonString(path) && path.startsWith("/media/") && (
                <RegisteredImage
                  src={path}
                  alt=""
                  className={cn(
                    "w-full object-contain",
                    role === "poster" && "aspect-2/3",
                    (role === "all" || role === "banner" || role === "still") && "aspect-video",
                    (role === "logo" || role === "profile") && "aspect-square",
                  )}
                  loading="lazy"
                />
              )}
              <span className="truncate text-sm">{label}</span>
              <span dir="auto" className="truncate text-xs text-muted-foreground">
                {value}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{query.data?.total ?? "…"} نتيجة</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0 || query.isFetching}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            السابق
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!query.data || query.isFetching || offset + 50 >= query.data.total}
            onClick={() => setOffset(offset + 50)}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}

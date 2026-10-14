import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Grid2X2, List, Search, RefreshCw, ArrowRight, ArrowLeft, Images } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableCaption,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { databaseKeys } from "@/features/database/data/database.queries";
import { RegisteredImage } from "@/features/editor/registered-image";

import { ImageDelete } from "./image-delete";
import { ImageDetail } from "./image-detail";
import { ImageRename } from "./image-rename";
import { ImageUpload } from "./image-upload";
import {
  fileSize,
  imageRoles,
  roleLabel,
  healthLabel,
  type ImageSearch,
  type ImageAsset,
} from "./images-model";
import { imageKeys, imagesOptions, imageOptions } from "./images.queries";

export function ImagesPage({
  search,
  onChange,
}: {
  search: ImageSearch;
  onChange: (patch: Partial<ImageSearch>, resetPage?: boolean) => void;
}) {
  const client = useQueryClient();
  const filters = {
    q: search.q,
    page: Number(search.page),
    pageSize: 24,
    usage: search.usage,
    health: search.health,
    role: search.role,
    sort: search.sort,
  };
  const images = useQuery(imagesOptions(filters));
  const totalPages = Math.max(1, Math.ceil((images.data?.total ?? 0) / 24));
  async function changed() {
    await Promise.all([
      client.invalidateQueries({ queryKey: imageKeys.all }),
      client.invalidateQueries({ queryKey: ["admin", "editor"] }),
      client.invalidateQueries({ queryKey: ["admin", "editor-image"] }),
      client.invalidateQueries({ queryKey: databaseKeys.all }),
      client.invalidateQueries({ queryKey: ["admin", "works"] }),
      client.invalidateQueries({ queryKey: ["catalog"] }),
      client.invalidateQueries({ queryKey: ["work"] }),
      client.invalidateQueries({ queryKey: ["home"] }),
      client.invalidateQueries({ queryKey: ["database"] }),
    ]);
  }
  function preloadImage(id: string) {
    void client.prefetchQuery(imageOptions(id));
  }
  function openImage(id: string) {
    preloadImage(id);
    onChange({ image: id }, false);
  }
  return (
    <article
      className="mx-auto flex w-full min-w-0 max-w-400 flex-col gap-6 p-4 sm:p-6"
      aria-label="مكتبة الصور"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">مكتبة الصور</h1>
          <p className="text-sm text-muted-foreground">
            الملصقات والخلفيات والشعارات وصور المساهمين، وروابطها بالسجلات.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImageRename
            ids={images.data?.items.map((asset) => asset.id) ?? []}
            onRenamed={changed}
          />
          <ImageUpload
            onUploaded={async (id) => {
              await changed();
              toast.add({
                type: "success",
                title: "الصورة جاهزة في المكتبة",
                description: "اختر سجلاً لربطها به.",
              });
              openImage(id);
            }}
          />
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm key={search.q} value={search.q} onSearch={(q) => onChange({ q })} />
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="الروابط"
            value={search.usage}
            items={[
              { value: "all", label: "كل الصور" },
              { value: "assigned", label: "مرتبطة بسجلات" },
              { value: "unassigned", label: "غير مرتبطة" },
            ]}
            onChange={(usage) => onChange({ usage })}
          />
          <FilterSelect
            label="نوع الاستخدام"
            value={search.role}
            items={[{ value: "all", label: "كل الأنواع" }, ...imageRoles]}
            onChange={(role) => onChange({ role })}
          />
          <FilterSelect
            label="حالة الملف"
            value={search.health}
            items={[
              { value: "all", label: "كل الملفات" },
              { value: "problems", label: "ملفات بها مشاكل" },
              { value: "missing", label: "ملفات مفقودة" },
              { value: "healthy", label: "ملفات متاحة" },
            ]}
            onChange={(health) => onChange({ health })}
          />
          <FilterSelect
            label="الترتيب"
            value={search.sort}
            items={[
              { value: "newest", label: "الأحدث إضافة" },
              { value: "oldest", label: "الأقدم إضافة" },
              { value: "name", label: "اسم الملف" },
              { value: "size", label: "الأكبر حجماً" },
            ]}
            onChange={(sort) => onChange({ sort })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {images.data ? new Intl.NumberFormat("ar").format(images.data.total) : "…"} صورة
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            aria-label="تحديث الصور"
            disabled={images.isFetching}
            onClick={() => {
              void client.invalidateQueries({ queryKey: ["admin", "editor-image"] });
              void images.refetch();
            }}
          >
            <RefreshCw data-icon="inline-start" />
          </Button>
          <ToggleGroup
            value={[search.view]}
            onValueChange={(values) => {
              const view = values[0];
              if (view === "grid" || view === "table") onChange({ view }, false);
            }}
            aria-label="طريقة عرض الصور"
          >
            <ToggleGroupItem value="grid" aria-label="شبكة الصور">
              <Grid2X2 />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="جدول الصور">
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {images.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : images.isError ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل مكتبة الصور</AlertTitle>
          <AlertDescription>{images.error.message}</AlertDescription>
          <Button variant="outline" onClick={() => void images.refetch()}>
            إعادة المحاولة
          </Button>
        </Alert>
      ) : !images.data.items.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>لا توجد صور مطابقة</EmptyTitle>
            <EmptyDescription>غيّر البحث أو المرشحات، أو ارفع صورة جديدة للمكتبة.</EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            onClick={() => onChange({ q: "", role: "all", usage: "all", health: "all" })}
          >
            مسح المرشحات
          </Button>
        </Empty>
      ) : search.view === "grid" ? (
        <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {images.data.items.map((asset) => (
            <Card key={asset.id} size="sm">
              <CardContent>
                <Button
                  variant="ghost"
                  className="h-auto w-full p-0"
                  onPointerEnter={() => preloadImage(asset.id)}
                  onFocus={() => preloadImage(asset.id)}
                  onClick={() => openImage(asset.id)}
                  aria-label={`تفاصيل ${asset.fileName}`}
                >
                  <RegisteredImage
                    assetId={asset.id}
                    alt={asset.fileName}
                    className="h-52 w-full rounded-lg bg-muted"
                  />
                </Button>
              </CardContent>
              <CardHeader>
                <CardTitle>
                  <span className="block truncate" dir="auto" title={asset.fileName}>
                    {asset.fileName}
                  </span>
                </CardTitle>
                <CardDescription>
                  <span dir="ltr">
                    {asset.width} × {asset.height}
                  </span>{" "}
                  · {fileSize(asset.byteSize)}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex-wrap justify-between gap-2">
                <ImageUsage asset={asset} showHealth />
                <div className="flex items-center gap-1">
                  <ImageDelete asset={asset} onDeleted={changed} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onPointerEnter={() => preloadImage(asset.id)}
                    onFocus={() => preloadImage(asset.id)}
                    onClick={() => openImage(asset.id)}
                  >
                    التفاصيل
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableCaption className="sr-only">صور المكتبة وروابطها وحالة ملفاتها</TableCaption>
            <TableHeader className="bg-muted/40 [&_tr]:border-border">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>الصورة</TableHead>
                <TableHead>حالة الملف</TableHead>
                <TableHead>الاستخدام</TableHead>
                <TableHead>الحجم</TableHead>
                <TableHead>تاريخ الإضافة</TableHead>
                <TableHead>
                  <span className="sr-only">الإجراءات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {images.data.items.map((asset) => (
                <TableRow key={asset.id} className="border-border">
                  <TableCell>
                    <button
                      type="button"
                      className="flex items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onPointerEnter={() => preloadImage(asset.id)}
                      onFocus={() => preloadImage(asset.id)}
                      onClick={() => openImage(asset.id)}
                    >
                      <RegisteredImage
                        assetId={asset.id}
                        alt=""
                        className="h-16 w-12 shrink-0 rounded-md bg-muted"
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span
                          className="max-w-64 truncate font-medium"
                          dir="auto"
                          title={asset.fileName}
                        >
                          {asset.fileName}
                        </span>
                        <span className="text-xs text-muted-foreground" dir="ltr">
                          {asset.width} × {asset.height} ·{" "}
                          {asset.mimeType.replace("image/", "").toUpperCase()}
                        </span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <ImageHealth asset={asset} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ImageUsage asset={asset} />
                      <span className="text-xs text-muted-foreground">
                        {asset.assignmentCount} روابط
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {fileSize(asset.byteSize)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
                      new Date(asset.createdAt),
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <ImageDelete asset={asset} onDeleted={changed} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`تفاصيل ${asset.fileName}`}
                        onPointerEnter={() => preloadImage(asset.id)}
                        onFocus={() => preloadImage(asset.id)}
                        onClick={() => openImage(asset.id)}
                      >
                        <ArrowLeft data-icon="inline-start" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          الصفحة {search.page} من {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={Number(search.page) <= 1 || images.isFetching}
            onClick={() => onChange({ page: String(Number(search.page) - 1) }, false)}
          >
            <ArrowRight data-icon="inline-start" />
            السابق
          </Button>
          <Button
            variant="outline"
            disabled={Number(search.page) >= totalPages || images.isFetching}
            onClick={() => onChange({ page: String(Number(search.page) + 1) }, false)}
          >
            التالي
            <ArrowLeft data-icon="inline-end" />
          </Button>
        </div>
      </footer>
      <ImageDetail
        id={search.image}
        previewAsset={images.data?.items.find((asset) => asset.id === search.image)}
        onClose={() => onChange({ image: "" }, false)}
        onChanged={changed}
      />
    </article>
  );
}
function ImageUsage({ asset, showHealth = false }: { asset: ImageAsset; showHealth?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {showHealth && asset.health !== "healthy" && <ImageHealth asset={asset} />}
      {asset.roles.length ? (
        asset.roles.map((role) => (
          <Badge key={role} variant="secondary">
            {roleLabel(role)}
          </Badge>
        ))
      ) : (
        <Badge variant="outline">غير مرتبطة</Badge>
      )}
    </div>
  );
}
function SearchForm({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="w-full sm:max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft);
      }}
    >
      <Field>
        <FieldLabel htmlFor="image-search" className="sr-only">
          البحث في مكتبة الصور
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="image-search"
            value={draft}
            maxLength={300}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="البحث باسم الملف…"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" aria-label="بحث الصور">
              <Search data-icon="inline-start" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </form>
  );
}

function ImageHealth({ asset }: { asset: ImageAsset }) {
  return (
    <Badge variant={asset.health === "healthy" ? "outline" : "destructive"}>
      {healthLabel(asset.health)}
    </Badge>
  );
}
function FilterSelect<T extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        const choice = items.find((item) => item.value === next);
        if (choice) onChange(choice.value);
      }}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

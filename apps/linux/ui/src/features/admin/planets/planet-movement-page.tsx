import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { ArrowLeft, ArrowRight, Check, RefreshCw, Search, X, Settings2, Orbit } from "lucide-react";
import { useState } from "react";

import { Artwork } from "@/components/artwork";
import { Choice } from "@/components/choice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";
import { useConfirm } from "@/features/editor/use-confirm";

import { AdminPageHeader } from "../admin-page-header";
import { PlanetDefinitions } from "./planet-definitions";
import {
  moveWorks,
  planetOptionsQuery,
  planetWorksQuery,
  type PlanetSearch,
  type PlanetWork,
} from "./planets.queries";

type MoveReview = { source: string | null; destination: string | null; records: PlanetWork[] };
export function PlanetMovementPage({
  search,
  onChange,
}: {
  search: PlanetSearch;
  onChange: (patch: Partial<PlanetSearch>) => void;
}) {
  const options = useQuery(planetOptionsQuery());
  const works = useQuery(planetWorksQuery(search));
  const client = useQueryClient();
  const confirm = useConfirm();
  const [selected, setSelected] = useState<Map<string, PlanetWork>>(() => new Map());
  const [destination, setDestination] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [review, setReview] = useState<MoveReview | null>(null);
  const [definitionsOpen, setDefinitionsOpen] = useState(false);
  const planets = options.data?.planets ?? [];
  const source = search.source === "none" ? null : search.source;
  const items = works.data?.items ?? [];
  const pages = Math.max(1, Math.ceil((works.data?.total ?? 0) / 24));
  const sourceName = source
    ? (planets.find((planet) => planet.id === source)?.name ?? "الكوكب")
    : "بدون كوكب";
  const name = (id: string | null) =>
    id ? (planets.find((planet) => planet.id === id)?.name ?? "الكوكب") : "بدون كوكب";
  const save = useMutation({
    mutationFn: () => {
      if (!review) throw new Error("راجع النقل أولاً.");
      return moveWorks({
        source: review.source,
        destination: review.destination,
        records: review.records.map((work) => ({ id: work.id, revision: work.revision })),
      });
    },
    onSuccess: async (result) => {
      setReview(null);
      setSelected(new Map());
      await invalidateCatalogEdit(client);
      toast.add({
        type: "success",
        title: "حُفظت انتماءات الأعمال",
        description: `${result.moved} عمل`,
      });
    },
  });
  function toggle(work: PlanetWork, checked: boolean) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (checked && next.size < 50) next.set(work.id, work);
      else if (!checked) next.delete(work.id);
      return next;
    });
  }
  function selectPage(checked: boolean) {
    setSelected((previous) => {
      const next = new Map(previous);
      for (const work of items) {
        if (!checked) next.delete(work.id);
        else if (next.size < 50) next.set(work.id, work);
      }
      return next;
    });
  }
  async function changeSource(value: string) {
    if (value === search.source) return;
    if (
      selected.size &&
      !(await confirm.confirm("تغيير المصدر سيُلغي اختيار الأعمال الحالي. متابعة؟"))
    )
      return;
    setSelected(new Map());
    setDestination("");
    onChange({ source: value });
  }
  async function reload() {
    if (selected.size && !(await confirm.confirm("تحديث البيانات سيُلغي الاختيار الحالي. متابعة؟")))
      return;
    setSelected(new Map());
    await Promise.all([works.refetch(), options.refetch()]);
  }
  return (
    <article className="mx-auto flex w-full min-w-0 max-w-400 flex-col gap-6 p-4 pb-20 sm:p-6 sm:pb-20">
      {confirm.dialog}
      <AdminPageHeader
        title="الكواكب"
        description="اختر المصدر، حدّد الأعمال، ثم اختر الوجهة وراجع النقل قبل الحفظ."
        icon={Orbit}
        count={options.data?.planets.length}
        unit="كوكب"
      >
        <Button
          variant="outline"
          disabled={save.isPending || works.isFetching || options.isFetching}
          onClick={() => void reload()}
        >
          <RefreshCw data-icon="inline-start" />
          تحديث
        </Button>
        <Button disabled={save.isPending} onClick={() => setDefinitionsOpen(true)}>
          <Settings2 data-icon="inline-start" />
          تعريف الكواكب
        </Button>
      </AdminPageHeader>
      <PlanetDefinitions
        open={definitionsOpen}
        onOpenChange={setDefinitionsOpen}
        onDeleted={(id) => {
          if (destination === id) setDestination("");
          if (search.source === id) {
            setSelected(new Map());
            onChange({ source: "none" });
          }
        }}
      />
      {options.isError && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل الكواكب</AlertTitle>
          <AlertDescription>{options.error.message}</AlertDescription>
        </Alert>
      )}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>من: {sourceName}</CardTitle>
            <CardDescription>
              {works.data?.total ?? "…"} عمل · حد الاختيار ٥٠ عملاً، ويمكن متابعة الاختيار عبر الصفحات.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Choice
                label="الكوكب المصدر"
                value={search.source}
                options={[
                  { value: "none", label: `بدون كوكب (${options.data?.unassigned ?? 0})` },
                  ...planets.map((planet) => ({
                    value: planet.id,
                    label: `${planet.icon} ${planet.name} (${planet.count})${planet.active ? "" : " · غير نشط"}`,
                  })),
                ]}
                onChange={(value) => void changeSource(value)}
              />
              <WorkSearch key={search.q} value={search.q} onSearch={(q) => onChange({ q })} />
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="planet-page-selection"
                checked={items.length > 0 && items.every((work) => selected.has(work.id))}
                disabled={!items.length || works.isFetching}
                onCheckedChange={(value) => selectPage(value === true)}
              />
              <FieldLabel htmlFor="planet-page-selection">تحديد الصفحة</FieldLabel>
              <Badge variant="secondary">{selected.size} محدد</Badge>
              {selected.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => setSelected(new Map())}
                >
                  <X data-icon="inline-start" />
                  إلغاء الاختيار
                </Button>
              )}
            </Field>
            {works.isPending ? (
              <Skeleton className="h-96" />
            ) : works.isError ? (
              <Alert variant="destructive">
                <AlertTitle>تعذّر تحميل الأعمال</AlertTitle>
                <AlertDescription>{works.error.message}</AlertDescription>
              </Alert>
            ) : !items.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>لا توجد أعمال هنا</EmptyTitle>
                  <EmptyDescription>
                    {search.q ? "غيّر البحث أو اختر مصدراً آخر." : "اختر كوكباً آخر لعرض أعماله."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((work) => (
                  <div key={work.id} className="flex min-w-0 flex-col gap-2">
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-xl",
                        selected.has(work.id) && "ring-2 ring-primary",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`تحديد ${work.title}`}
                        aria-pressed={selected.has(work.id)}
                        disabled={!selected.has(work.id) && selected.size >= 50}
                        onClick={() => toggle(work, !selected.has(work.id))}
                        className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Artwork
                          id={work.posterId}
                          alt={work.title}
                          className="aspect-2/3 w-full rounded-xl object-cover"
                        />
                      </button>
                      <div className="absolute inset-s-2 top-2 rounded-lg bg-background p-2">
                        <Checkbox
                          aria-label={`اختيار ${work.title}`}
                          checked={selected.has(work.id)}
                          disabled={!selected.has(work.id) && selected.size >= 50}
                          onCheckedChange={(value) => toggle(work, value === true)}
                        />
                      </div>
                    </div>
                    <p className="truncate text-sm font-medium" title={work.title} dir="auto">
                      {work.title}
                    </p>
                    <p
                      className="truncate text-xs text-muted-foreground"
                      dir="ltr"
                      title={work.englishTitle}
                    >
                      {work.englishTitle}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {work.memberships.map((planet) => (
                        <Badge key={planet.id} variant="secondary">
                          {planet.icon} {planet.name}
                        </Badge>
                      ))}
                      {!work.memberships.length && <Badge variant="outline">بدون كوكب</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <nav className="flex items-center justify-between gap-3" aria-label="صفحات الأعمال">
              <Button
                variant="outline"
                disabled={Number(search.page) <= 1 || works.isFetching}
                onClick={() => onChange({ page: String(Number(search.page) - 1) })}
              >
                <ArrowRight data-icon="inline-start" />
                السابق
              </Button>
              <span className="text-sm text-muted-foreground">
                {search.page} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={Number(search.page) >= pages || works.isFetching}
                onClick={() => onChange({ page: String(Number(search.page) + 1) })}
              >
                التالي
                <ArrowLeft data-icon="inline-end" />
              </Button>
            </nav>
          </CardContent>
        </Card>
        <Card className="min-w-0 lg:sticky lg:top-16">
          <CardHeader>
            <CardTitle>وجهة الأعمال</CardTitle>
            <CardDescription>
              {selected.size
                ? `${selected.size} عمل محدد للنقل من ${sourceName}.`
                : "حدّد أعمالًا من المصدر أولًا، ثم اختر الكوكب الذي ستنتقل إليه."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="planet-destination-search">البحث عن وجهة</FieldLabel>
              <Input
                id="planet-destination-search"
                placeholder="اسم الكوكب…"
                value={destinationSearch}
                onChange={(event) => setDestinationSearch(event.target.value)}
              />
            </Field>
            {options.isPending ? (
              <Skeleton className="h-56" />
            ) : (
              <FieldSet>
                <FieldLegend className="sr-only">الكوكب الوجهة</FieldLegend>
                <RadioGroup
                  aria-label="الكوكب الوجهة"
                  value={destination}
                  onValueChange={setDestination}
                  className="max-h-120 scroll-fade-y scrollbar-thin gap-2 overflow-y-auto overscroll-y-contain"
                >
                  {planets
                    .filter(
                      (planet) =>
                        planet.active &&
                        planet.id !== source &&
                        `${planet.name} ${planet.englishName ?? ""} ${planet.description}`
                          .toLocaleLowerCase()
                          .includes(destinationSearch.toLocaleLowerCase()),
                    )
                    .map((planet) => (
                      <Field
                        key={planet.id}
                        orientation="horizontal"
                        className="rounded-xl border border-border p-3 has-data-checked:bg-accent"
                      >
                        <RadioGroupItem id={`destination-${planet.id}`} value={planet.id} />
                        <FieldLabel htmlFor={`destination-${planet.id}`} className="min-w-0 flex-1">
                          <span className="font-emoji text-2xl" aria-hidden="true">
                            {planet.icon}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate">{planet.name}</span>
                              <Badge variant="outline">{planet.count} عمل</Badge>
                            </span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {planet.description || planet.englishName || "كوكب في مكتبتك"}
                            </span>
                          </span>
                        </FieldLabel>
                      </Field>
                    ))}
                  {source && (
                    <Field
                      orientation="horizontal"
                      className="rounded-xl border border-border p-3 has-data-checked:bg-accent"
                    >
                      <RadioGroupItem id="destination-none" value="none" />
                      <FieldLabel htmlFor="destination-none">إزالة من {sourceName}</FieldLabel>
                    </Field>
                  )}
                </RadioGroup>
              </FieldSet>
            )}
            {!options.isPending &&
              !planets.some(
                (planet) =>
                  planet.active &&
                  planet.id !== source &&
                  `${planet.name} ${planet.englishName ?? ""} ${planet.description}`
                    .toLocaleLowerCase()
                    .includes(destinationSearch.toLocaleLowerCase()),
              ) && (
                <p className="text-sm text-muted-foreground">
                  لا توجد كواكب مطابقة. غيّر البحث أو أضف كوكباً من تعريف الكواكب.
                </p>
              )}
          </CardContent>
        </Card>
      </div>
      {selected.size > 0 && (
        <div
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-popover p-3 shadow-lg"
          role="region"
          aria-label="نقل الأعمال المحددة"
        >
          <Badge variant="secondary">{selected.size} عمل</Badge>
          <span className="text-sm">
            {sourceName} ←{" "}
            {destination === "none"
              ? "إزالة من المصدر"
              : destination
                ? name(destination)
                : "اختر الوجهة"}
          </span>
          <Button
            disabled={!destination || options.isFetching || works.isFetching || save.isPending}
            onClick={() => {
              save.reset();
              setReview({
                source,
                destination: destination === "none" ? null : destination,
                records: [...selected.values()],
              });
            }}
          >
            <ArrowLeft data-icon="inline-start" />
            مراجعة النقل
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="إلغاء الاختيار"
            onClick={() => setSelected(new Map())}
          >
            <X data-icon="inline-start" />
          </Button>
        </div>
      )}
      <Dialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setReview(null);
        }}
      >
        <DialogContent
          className="max-h-11/12 overflow-y-auto sm:max-w-3xl"
          showCloseButton={!save.isPending}
        >
          <DialogHeader>
            <DialogTitle>مراجعة نقل {review?.records.length ?? 0} عمل</DialogTitle>
            <DialogDescription>
              من {name(review?.source ?? null)}:{" "}
              {review?.destination
                ? `النقل إلى ${name(review.destination)}`
                : "إزالة انتماء المصدر فقط"}
              . النقل لا يحذف الأعمال أو صورها أو بياناتها.
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العمل</TableHead>
                <TableHead>حالياً</TableHead>
                <TableHead>بعد الحفظ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {review?.records.map((work) => {
                const after = work.memberships
                  .filter((planet) => planet.id !== review.source)
                  .map((planet) => planet.id);
                if (review.destination && !after.includes(review.destination))
                  after.push(review.destination);
                return (
                  <TableRow key={work.id}>
                    <TableCell dir="auto">{work.title}</TableCell>
                    <TableCell>
                      {work.memberships.map((planet) => planet.name).join("، ") || "بدون كوكب"}
                    </TableCell>
                    <TableCell>{after.map(name).join("، ") || "بدون كوكب"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {save.isError && (
            <Alert variant="destructive">
              <AlertTitle>لم تُنقل الدفعة</AlertTitle>
              <AlertDescription>
                {save.error.message} أغلق المراجعة واضغط تحديث لإعادة اختيار البيانات الحالية.
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={save.isPending} onClick={() => setReview(null)}>
              العودة للاختيار
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              تأكيد النقل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
function WorkSearch({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="min-w-48 flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <InputGroup>
        <InputGroupInput
          aria-label="بحث في أعمال المصدر"
          placeholder="ابحث عن عمل…"
          value={draft}
          maxLength={300}
          onChange={(event) => setDraft(event.target.value)}
        />
        <InputGroupAddon>
          <InputGroupButton type="submit" aria-label="بحث في الأعمال">
            <Search data-icon="inline-start" />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Award,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  ListFilter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Artwork } from "@/components/artwork";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReferencePicker } from "@/features/editor/references/reference-picker";

import { AdminPageHeader, AdminFilterChips, type AdminFilterChip } from "../admin-page-header";
import { AwardEditor } from "./award-editor";
import { AwardFilters } from "./award-filters";
import {
  awardDetailQuery,
  awardLabel,
  awardLabels,
  awardListQuery,
  awardSearchSchema,
  resetAwardFilters,
  text,
  type AwardRow,
  type AwardSearch,
  type DefinitionTable,
} from "./awards.queries";
import { RecognitionResults } from "./recognition-results";

const tabs = [
  { value: "award_recognitions", icon: Trophy },
  { value: "award_categories", icon: ListFilter },
  { value: "award_ceremonies", icon: CalendarDays },
  { value: "award_organizations", icon: Building2 },
] as const;
export function AwardsPage({
  search,
  onChange,
}: {
  search: AwardSearch;
  onChange: (patch: Partial<AwardSearch>) => void;
}) {
  const navigate = useNavigate();
  const records = useQuery(awardListQuery(search));
  const organization = useQuery({
    ...awardDetailQuery("award_organizations", search.organization),
    enabled: !!search.organization,
  });
  const [editor, setEditor] = useState<{ table: DefinitionTable; id: string | null } | null>(null);
  const [detail, setDetail] = useState<AwardRow | null>(null);
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const current = organization.data?.row;
  const recognition = search.tab === "award_recognitions";
  const website = z
    .string()
    .url()
    .regex(/^https?:\/\//)
    .safeParse(current?.website_url).data;
  const filterChips: AdminFilterChip[] = [];
  if (search.q)
    filterChips.push({
      key: "q",
      label: `بحث: ${search.q}`,
      clear: () => onChange({ q: "", page: "1" }),
    });
  if (search.year)
    filterChips.push({
      key: "year",
      label: `سنة ${search.year}`,
      clear: () => onChange({ year: "", page: "1" }),
    });
  if (search.result !== "all")
    filterChips.push({
      key: "result",
      label: search.result === "winner" ? "الفائزون" : "المرشحون",
      clear: () => onChange({ result: "all", page: "1" }),
    });
  if (search.featured)
    filterChips.push({
      key: "featured",
      label: "جوائز بارزة",
      clear: () => onChange({ featured: "", page: "1" }),
    });
  if (search.source !== "all")
    filterChips.push({
      key: "source",
      label: search.source === "documented" ? "بمرجع" : "بدون مرجع",
      clear: () => onChange({ source: "all", page: "1" }),
    });
  const pages = Math.max(1, Math.ceil((records.data?.total ?? 0) / 25));
  const openWork = (id: string) =>
    void navigate({
      to: "/admin/works/$workId",
      params: { workId: id },
      search: { section: "awards" },
    });
  return (
    <article
      className="mx-auto flex w-full min-w-0 max-w-400 flex-col gap-6 p-4 pb-16 sm:p-6"
      aria-label="إدارة الجوائز"
    >
      <AdminPageHeader
        title="الجوائز"
        description="نظّم الجهات والفئات والدورات، ووثّق الجوائز والترشيحات المرتبطة بأعمال المكتبة."
        icon={Award}
        count={records.data?.total}
        unit={recognition ? "جائزة وترشيح" : "سجل"}
      >
        <Button
          variant="outline"
          disabled={records.isFetching}
          onClick={() => void records.refetch()}
        >
          <RefreshCw data-icon="inline-start" />
          تحديث
        </Button>
        <Button onClick={() => setEditor({ table: "award_organizations", id: null })}>
          <Plus data-icon="inline-start" />
          جهة جديدة
        </Button>
      </AdminPageHeader>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-4">
        <div
          className="hidden min-w-0 xl:sticky xl:top-16 xl:col-start-4 xl:row-start-1 xl:block"
          aria-label="جهات الجوائز"
          role="complementary"
        >
          <OrganizationRail
            selected={search.organization}
            onSelect={(organizationId) =>
              onChange({ ...resetAwardFilters, organization: organizationId })
            }
          />
        </div>
        <Collapsible
          open={organizationOpen}
          onOpenChange={setOrganizationOpen}
          className="min-w-0 xl:hidden"
        >
          <CollapsibleTrigger
            render={<Button variant="outline" className="w-full justify-between" />}
          >
            <Building2 data-icon="inline-start" />
            <span className="truncate">
              اختيار الجهة · {current ? awardLabel(current) : "كل الجهات"}
            </span>
            <ChevronDown data-icon="inline-end" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <OrganizationRail
              selected={search.organization}
              onSelect={(organizationId) => {
                onChange({ ...resetAwardFilters, organization: organizationId });
                setOrganizationOpen(false);
              }}
            />
          </CollapsibleContent>
        </Collapsible>
        <div
          className="flex min-w-0 flex-col gap-5 xl:col-span-3 xl:col-start-1 xl:row-start-1"
          aria-label="نتائج الجوائز"
          role="region"
        >
          <Card size="sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <CardTitle>
                    <span className="font-display text-2xl">
                      {current
                        ? awardLabel(current)
                        : search.organization
                          ? "الجهة المحددة"
                          : "سجل التكريم"}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {current
                      ? text(current, "name_en") || text(current, "slug")
                      : "كل الجهات المانحة، في مكان واحد"}
                  </CardDescription>
                </div>
                {current ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditor({ table: "award_organizations", id: search.organization })
                    }
                  >
                    <Pencil data-icon="inline-start" />
                    تحرير الجهة
                  </Button>
                ) : (
                  <Award className="size-8 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {current && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Collapsible>
                      <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                        عن الجهة
                        <ChevronDown data-icon="inline-end" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
                          {text(current, "description") || "لم يُضف وصف لهذه الجهة."}
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                    <Badge variant={current.is_active ? "secondary" : "outline"}>
                      {current.is_active ? "جهة نشطة" : "جهة غير نشطة"}
                    </Badge>
                    {website && (
                      <a
                        href={website}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "link", size: "sm" })}
                      >
                        الموقع الرسمي
                        <ExternalLink data-icon="inline-end" />
                      </a>
                    )}
                  </div>
                </>
              )}
              <Tabs
                value={search.tab}
                onValueChange={(value) => {
                  const tab = tabs.find((t) => t.value === value);
                  if (tab) onChange({ ...resetAwardFilters, tab: tab.value });
                }}
              >
                <TabsList variant="line" className="h-auto w-full flex-wrap justify-start">
                  {tabs.map(({ value, icon: Icon }) => (
                    <TabsTrigger key={value} value={value}>
                      <Icon data-icon="inline-start" />
                      {awardLabels[value]}
                      <Badge variant="secondary">{records.data?.counts[value] ?? "…"}</Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
          {organization.isError && (
            <Failure
              title="تعذّر تحميل الجهة"
              error={organization.error}
              retry={() => void organization.refetch()}
            />
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <AwardSearchForm
              key={`${search.tab}:${search.q}`}
              value={search.q}
              label="البحث في السجلات"
              onSearch={(q) => onChange({ q, page: "1" })}
            />
            {recognition ? (
              <>
                <ToggleGroup
                  value={[search.result]}
                  variant="outline"
                  spacing={0}
                  aria-label="نتيجة الجائزة"
                  onValueChange={(values) => {
                    const result = values[0];
                    if (result === "all" || result === "winner" || result === "nominee")
                      onChange({ result, page: "1" });
                  }}
                >
                  <ToggleGroupItem value="all">الكل</ToggleGroupItem>
                  <ToggleGroupItem value="winner">فائز</ToggleGroupItem>
                  <ToggleGroupItem value="nominee">مرشح</ToggleGroupItem>
                </ToggleGroup>
                <ReferencePicker
                  table="titles"
                  title="اختر العمل لإضافة جائزة أو تحرير جوائزه"
                  triggerLabel="جوائز عمل"
                  onPick={openWork}
                />
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  if (search.tab !== "award_recognitions")
                    setEditor({ table: search.tab, id: null });
                }}
              >
                <Plus data-icon="inline-start" />
                {search.tab === "award_categories"
                  ? "فئة جديدة"
                  : search.tab === "award_ceremonies"
                    ? "دورة جديدة"
                    : "جهة جديدة"}
              </Button>
            )}
          </div>
          {recognition && <AwardFilters search={search} onChange={onChange} />}
          <AdminFilterChips
            filters={filterChips}
            reset={() => onChange({ ...resetAwardFilters, q: "" })}
          />
          <p className="text-sm text-muted-foreground" role="status">
            {records.isFetching
              ? "جارٍ تحميل النتائج…"
              : `${records.data?.total ?? 0} ${recognition ? "جائزة وترشيح" : "سجل"}`}
          </p>
          {records.isPending ? (
            <Skeleton className="h-96" />
          ) : records.isError ? (
            <Failure
              title="تعذّر تحميل الجوائز"
              error={records.error}
              retry={() => void records.refetch()}
            />
          ) : !records.data.rows.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Trophy />
                </EmptyMedia>
                <EmptyTitle>
                  {recognition
                    ? "لا توجد جوائز مطابقة"
                    : search.q
                      ? "لا توجد نتائج مطابقة"
                      : "ابدأ توثيق الجوائز"}
                </EmptyTitle>
                <EmptyDescription>
                  {search.q
                    ? "جرّب اسماً أو سنة مختلفة، أو امسح البحث."
                    : recognition
                      ? "غيّر الفئة أو السنة أو بقية المرشحات. يمكنك أيضاً اختيار عمل لإضافة جائزة."
                      : "أضف أول سجل لهذا القسم باستخدام زر الإضافة."}
                </EmptyDescription>
              </EmptyHeader>
              {(search.q || recognition) && (
                <Button variant="outline" onClick={() => onChange(resetAwardFilters)}>
                  مسح البحث
                </Button>
              )}
            </Empty>
          ) : recognition ? (
            <RecognitionResults
              rows={records.data.rows}
              view={search.view}
              onDetail={setDetail}
              onFilter={onChange}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{awardLabels[search.tab]}</CardTitle>
                <CardDescription>
                  {records.data.total} سجل
                  {search.organization && search.tab !== "award_organizations"
                    ? " ضمن الجهة المحددة"
                    : " في المكتبة"}{" "}
                  · افتح التفاصيل لعرض جميع البيانات
                </CardDescription>
              </CardHeader>
              <CardContent className="min-w-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{recognition ? "العمل" : "الاسم"}</TableHead>
                      <TableHead>{recognition ? "الجائزة" : "التعريف"}</TableHead>
                      <TableHead>{recognition ? "النتيجة" : "الحالة"}</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.data.rows.map((row) => (
                      <TableRow key={text(row, "id")}>
                        <TableCell>
                          <div className="flex max-w-72 flex-col gap-1">
                            <Button
                              variant="link"
                              className="h-auto justify-start whitespace-normal text-start"
                              onClick={() =>
                                onChange({
                                  ...resetAwardFilters,
                                  tab: "award_recognitions",
                                  organization:
                                    search.tab === "award_organizations"
                                      ? text(row, "id")
                                      : text(row, "organization_id"),
                                  category:
                                    search.tab === "award_categories" ? text(row, "id") : "",
                                  year: search.tab === "award_ceremonies" ? String(row.year) : "",
                                })
                              }
                            >
                              {awardLabel(row)}
                            </Button>
                            {search.tab === "award_ceremonies" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  onChange({
                                    ...resetAwardFilters,
                                    tab: "award_recognitions",
                                    organization: text(row, "organization_id"),
                                    year: String(row.year),
                                  })
                                }
                              >
                                جوائز سنة {String(row.year)}
                              </Button>
                            )}
                            <span className="text-xs text-muted-foreground" dir="auto">
                              {recognition
                                ? text(row, "installment_name") || "العمل كاملاً"
                                : text(row, "name_en") || text(row, "held_on") || text(row, "slug")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex max-w-64 flex-col gap-1">
                            <span dir="auto">
                              {recognition
                                ? text(row, "category")
                                : search.tab === "award_ceremonies"
                                  ? `الدورة ${row.edition ?? "—"}`
                                  : text(row, "slug")}
                            </span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {recognition
                                ? `${text(row, "organization_name")} · ${row.year ?? "سنة غير محددة"}`
                                : text(row, "description") || text(row, "source_url") || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge
                              variant={
                                row.result === "winner" || row.is_active ? "secondary" : "outline"
                              }
                            >
                              {recognition
                                ? row.result === "winner"
                                  ? "فائز"
                                  : "مرشح"
                                : search.tab === "award_ceremonies"
                                  ? String(row.year)
                                  : row.is_active
                                    ? "نشط"
                                    : "غير نشط"}
                            </Badge>
                            <Badge variant="outline">
                              {String(row.recognition_count ?? 0)} جائزة وترشيح
                            </Badge>
                            <Badge variant="outline">{String(row.work_count ?? 0)} عمل</Badge>
                            <Badge variant="secondary">{String(row.winner_count ?? 0)} فوز</Badge>
                            {row.is_featured && <Badge variant="outline">بارزة</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>
                              التفاصيل
                            </Button>
                            {recognition ? (
                              <a
                                href={`#/admin/works/${text(row, "title_id")}?section=awards`}
                                className={buttonVariants({ variant: "outline", size: "sm" })}
                              >
                                تحرير الجوائز
                              </a>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (search.tab !== "award_recognitions")
                                    setEditor({ table: search.tab, id: text(row, "id") });
                                }}
                              >
                                <Pencil data-icon="inline-start" />
                                تحرير
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <nav className="flex items-center justify-between gap-3" aria-label="صفحات الجوائز">
            <Button
              variant="outline"
              disabled={Number(search.page) <= 1 || records.isFetching}
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
              disabled={Number(search.page) >= pages || records.isFetching}
              onClick={() => onChange({ page: String(Number(search.page) + 1) })}
            >
              التالي
              <ArrowLeft data-icon="inline-end" />
            </Button>
          </nav>
        </div>
      </div>
      {editor && (
        <AwardEditor
          key={`${editor.table}:${editor.id}`}
          {...editor}
          organization={search.organization}
          onClose={() => setEditor(null)}
        />
      )}
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>بيانات السجل</DialogTitle>
            <DialogDescription>
              جميع القيم المحفوظة، بما فيها المعرّفات ومعلومات المصدر والتواريخ.
            </DialogDescription>
          </DialogHeader>
          {detail && text(detail, "work_name") && (
            <div className="flex gap-4">
              <Artwork
                id={text(detail, "poster_id") || null}
                alt={text(detail, "work_name")}
                className="h-48 w-32 rounded-xl object-cover"
              />
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold">{text(detail, "work_name")}</h2>
                <p>{text(detail, "organization_name")}</p>
                <p>
                  {text(detail, "category")} · {String(detail.year ?? "—")}
                </p>
                <Badge variant="secondary">{detail.result === "winner" ? "فائز" : "مرشح"}</Badge>
                <p className="text-sm text-muted-foreground">{text(detail, "notes")}</p>
              </div>
            </div>
          )}
          {detail && (
            <dl className="grid gap-4 sm:grid-cols-2">
              {Object.entries(detail).map(([key, value]) => (
                <div key={key} className="flex min-w-0 flex-col gap-1">
                  <dt className="text-sm text-muted-foreground" dir="ltr">
                    {key}
                  </dt>
                  <dd className="break-words text-sm" dir="auto">
                    {value == null
                      ? "—"
                      : z.string().safeParse(value).success
                        ? z.string().parse(value)
                        : JSON.stringify(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
function OrganizationRail({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useQuery(
    awardListQuery(
      awardSearchSchema.parse({
        tab: "award_organizations",
        organization: "",
        q,
        page: String(page),
        result: "all",
      }),
    ),
  );
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>الجهات المانحة</CardTitle>
        <CardDescription>تصفّح سجل كل جهة وفئاتها ودوراتها.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <AwardSearchForm
          key={q}
          value={q}
          label="البحث عن جهة"
          onSearch={(value) => {
            setQ(value);
            setPage(1);
          }}
        />
        <Button
          variant={selected ? "ghost" : "secondary"}
          className="justify-start"
          aria-pressed={!selected}
          onClick={() => onSelect("")}
        >
          <Trophy data-icon="inline-start" />
          كل الجهات<Badge variant="outline">{list.data?.total ?? "…"}</Badge>
        </Button>
        <div className="flex max-h-120 scroll-fade-y flex-col scrollbar-thin gap-1 overflow-y-auto overscroll-y-contain py-1">
          {list.isPending ? (
            <Skeleton className="h-48" />
          ) : list.isError ? (
            <Failure
              title="تعذّر تحميل الجهات"
              error={list.error}
              retry={() => void list.refetch()}
            />
          ) : (
            list.data.rows.map((row) => (
              <Button
                key={text(row, "id")}
                variant={selected === row.id ? "secondary" : "ghost"}
                className="h-auto justify-start py-3"
                aria-pressed={selected === row.id}
                onClick={() => onSelect(text(row, "id"))}
              >
                <Building2 data-icon="inline-start" />
                <span className="flex min-w-0 flex-1 flex-col gap-1 text-start">
                  <span className="truncate">{awardLabel(row)}</span>
                  <span className="truncate text-xs text-muted-foreground" dir="auto">
                    {text(row, "name_en") || text(row, "slug")}
                  </span>
                </span>
                {!row.is_active && <Badge variant="outline">غير نشط</Badge>}
              </Button>
            ))
          )}
          {list.data?.rows.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">لا توجد جهة مطابقة.</p>
          )}
        </div>
        {(list.data?.total ?? 0) > 25 && (
          <div className="flex items-center justify-between gap-2">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="الجهات السابقة"
              disabled={page === 1 || list.isFetching}
              onClick={() => setPage(page - 1)}
            >
              <ArrowRight />
            </Button>
            <span className="text-xs text-muted-foreground">{page}</span>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="الجهات التالية"
              disabled={page * 25 >= (list.data?.total ?? 0) || list.isFetching}
              onClick={() => setPage(page + 1)}
            >
              <ArrowLeft />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
function AwardSearchForm({
  value,
  label,
  onSearch,
}: {
  value: string;
  label: string;
  onSearch: (q: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <InputGroup>
        <InputGroupInput
          aria-label={label}
          placeholder={label}
          value={draft}
          maxLength={300}
          onChange={(e) => setDraft(e.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" aria-label={label}>
            <Search />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
export function Failure({
  title,
  error,
  retry,
}: {
  title: string;
  error: Error;
  retry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
      <Button variant="outline" onClick={retry}>
        إعادة المحاولة
      </Button>
    </Alert>
  );
}

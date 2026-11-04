import { useQuery } from "@tanstack/react-query";
import { useState, type ComponentProps } from "react";

import { Choice } from "@/components/choice";
import { MediaCard } from "@/components/media-card";
import { Failure, NoResults } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { emptyFilters } from "@/features/catalog/filter-model";
import { PublicPage, PublicPageHeader } from "@/features/shell/public-page";
import { gateway } from "@/lib/bridge";

type MediaCardProps = ComponentProps<typeof MediaCard>;

const scenarios = [
  {
    key: "full",
    title: "كل التفاصيل",
    description: "العنوان الأصلي والتقييم والحالة والمعلومات المتاحة",
    props: {},
  },
  {
    key: "compact",
    title: "تفاصيل مختصرة",
    description: "العنوان والتقييم والحالة دون معلومات إضافية",
    props: { showMetadata: false, showOriginalTitle: false },
  },
  {
    key: "image",
    title: "الصورة فقط",
    description: "وضع العرض المختصر دون نصوص أو شارات",
    props: { minimal: true },
  },
] satisfies { key: string; title: string; description: string; props: Partial<MediaCardProps> }[];

const layouts = [
  { value: "poster", label: "الملصق" },
  { value: "banner", label: "اللافتة" },
  { value: "logo", label: "الشعار" },
] as const;

export function CardLabPage() {
  const [draft, setDraft] = useState("Witch Hat Atelier");
  const [search, setSearch] = useState("Witch Hat Atelier");
  const [selectedWork, setSelectedWork] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [minimal, setMinimal] = useState(false);
  const [borderless, setBorderless] = useState(false);
  const [original, setOriginal] = useState(true);
  const [score, setScore] = useState(true);
  const [metadata, setMetadata] = useState(true);
  const [status, setStatus] = useState(true);
  const [choice, setChoice] = useState("");
  const filters = JSON.stringify(emptyFilters());
  const works = useQuery({
    queryKey: ["catalog", "card-lab", "works", search],
    queryFn: ({ signal }) =>
      gateway.browse(
        { q: search, view: "works", privacy: "public", page: 1, pageSize: 8, filters },
        signal,
      ),
  });
  const workEntry =
    works.data?.items.find((entry) => entry.work.id === selectedWork) ?? works.data?.items[0];
  const work = workEntry?.work;
  const parts = useQuery({
    queryKey: ["catalog", "card-lab", "installments", work?.id],
    enabled: Boolean(work),
    queryFn: ({ signal }) =>
      gateway.browse(
        {
          q: work?.canonicalTitle ?? "",
          view: "installments",
          privacy: "public",
          page: 1,
          pageSize: 24,
          filters,
        },
        signal,
      ),
  });
  const units = parts.data?.items.filter(
    (entry) => entry.work.id === work?.id && entry.installment,
  );
  const unitEntry = units?.find((entry) => entry.installment?.id === selectedUnit) ?? units?.[0];
  const controls = [
    { key: "minimal", label: "الصورة فقط", value: minimal, set: setMinimal },
    { key: "borderless", label: "شعار دون إطار", value: borderless, set: setBorderless },
    { key: "original", label: "العنوان الأصلي", value: original, set: setOriginal },
    { key: "score", label: "التقييم", value: score, set: setScore },
    { key: "metadata", label: "المعلومات", value: metadata, set: setMetadata },
    { key: "status", label: "الحالة", value: status, set: setStatus },
  ];
  return (
    <PublicPage className="flex max-w-6xl flex-col gap-7">
      <PublicPageHeader
        title="حالات بطاقات المكتبة"
        description="البطاقة المستخدمة في التطبيق، ببيانات المكتبة الفعلية. قارن الملصق واللافتة والشعار للعمل وأجزائه، ثم جرّب التركيز بلوحة المفاتيح."
        count={<Badge variant="outline">معاينة تطوير</Badge>}
      />
      <section
        className="flex flex-col gap-5 rounded-2xl border border-border p-4"
        aria-label="إعداد المعاينة"
      >
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setSelectedWork("");
            setSelectedUnit("");
          }}
        >
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor="card-lab-search">اسم العمل</FieldLabel>
            <Input
              id="card-lab-search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={200}
            />
          </Field>
          <Button type="submit" disabled={!draft.trim()}>
            تحميل العمل
          </Button>
        </form>
        {work && (
          <div className="flex flex-wrap items-center gap-3">
            <Choice
              label="العمل المعروض"
              value={work.id}
              options={(works.data?.items ?? []).map((entry) => ({
                value: entry.work.id,
                label: entry.work.titleAr || entry.work.canonicalTitle,
              }))}
              onChange={(value) => {
                setSelectedWork(value);
                setSelectedUnit("");
              }}
            />
            {unitEntry?.installment && (
              <Choice
                label="الجزء المعروض"
                value={unitEntry.installment.id}
                options={(units ?? []).flatMap((entry) =>
                  entry.installment
                    ? [{ value: entry.installment.id, label: entry.installment.title }]
                    : [],
                )}
                onChange={setSelectedUnit}
              />
            )}
          </div>
        )}
        <FieldGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {controls.map((control) => (
            <Field key={control.key} orientation="horizontal">
              <Switch
                id={`card-lab-${control.key}`}
                checked={control.value}
                onCheckedChange={control.set}
              />
              <FieldLabel htmlFor={`card-lab-${control.key}`}>{control.label}</FieldLabel>
            </Field>
          ))}
        </FieldGroup>
        <p role="status" className="text-xs text-muted-foreground">
          {choice || "النقر يختبر اختيار البطاقة هنا؛ لا يغيّر بيانات المكتبة."}
        </p>
      </section>
      {works.error && <Failure error={works.error} retry={() => void works.refetch()} />}
      {parts.error && <Failure error={parts.error} retry={() => void parts.refetch()} />}
      {works.isPending && <p role="status">جارٍ تحميل بيانات العمل…</p>}
      {works.data && !work && (
        <NoResults title="لم نعثر على العمل" description="جرّب اسمه بالعربية أو الإنجليزية." />
      )}
      {workEntry &&
        [false, true].flatMap((isUnit) =>
          layouts.map((layout) => {
            const entry = isUnit ? unitEntry : workEntry;
            if (!entry) return null;
            const heading = `${isUnit ? "الجزء" : "العمل"} · ${layout.label}`;
            const props: MediaCardProps = {
              entry,
              layout: layout.value,
              minimal,
              borderless,
              showOriginalTitle: original,
              showScore: score,
              showMetadata: metadata,
              showStatus: status,
              onSelect: () =>
                setChoice(
                  `تم اختيار ${work?.titleAr || work?.canonicalTitle}${isUnit && entry.installment ? ` · ${entry.installment.title}` : ""}`,
                ),
            };
            return (
              <section
                key={`${isUnit}-${layout.value}`}
                aria-label={heading}
                className="flex flex-col gap-4"
              >
                <h2 className="border-b border-border pb-3 text-lg font-semibold">{heading}</h2>
                <div className="grid grid-cols-2 items-start gap-6 lg:grid-cols-4">
                  {[
                    ...scenarios,
                    ...(layout.value === "logo"
                      ? [
                          {
                            key: "bare",
                            title: "شعار حرّ",
                            description: "شعار دون خلفية أو إطار، مع بديل نصي عند غياب الصورة",
                            props: { borderless: true, minimal: true },
                          },
                        ]
                      : []),
                  ].map((scenario) => (
                    <div key={scenario.key} className="flex min-w-0 flex-col gap-4">
                      <div>
                        <h3 className="font-semibold">{scenario.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{scenario.description}</p>
                      </div>
                      <MediaCard {...props} {...scenario.props} />
                    </div>
                  ))}
                </div>
              </section>
            );
          }),
        )}
      {work && parts.data && !unitEntry && (
        <NoResults
          title="لا توجد أجزاء متاحة للمقارنة"
          description="يمكنك مقارنة بطاقة العمل أو اختيار عمل آخر."
        />
      )}
    </PublicPage>
  );
}

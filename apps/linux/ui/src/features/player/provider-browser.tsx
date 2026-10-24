import { Check, Play, Search, Star, Volume2 } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldLabel, FieldTitle } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import {
  offerKey,
  type EmbedStatus,
  type ProviderOffer,
  type ProviderCapabilities,
} from "./stream-providers";

const unknownCapabilities: ProviderCapabilities = {
  subtitles: "unknown",
  arabic: "unknown",
  upload: "unknown",
};
const supportLabels = {
  unknown: "غير معروف",
  reported: "ظهر في الاختبار",
  documented: "موثّق لدى المزوّد",
  notseen: "لم يظهر في الاختبار",
};

function audioLabel(offer: ProviderOffer) {
  if (offer.preferred) return "DUB + عربي";
  if (offer.audio === "sub") return "SUB";
  if (offer.audio === "original") return "الصوت غير محدّد";
  const subs = offer.capabilities?.subtitles;
  return subs === "reported" || subs === "documented" ? "DUB + SUB" : "DUB";
}

export function ProviderBrowser({
  offers,
  anime,
  busy,
  status,
  onOpen,
  onPresent,
}: {
  offers: ProviderOffer[];
  anime: boolean;
  busy: boolean;
  status?: EmbedStatus;
  onOpen: (offer: ProviderOffer) => void;
  onPresent: () => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState("");
  const [problems, setProblems] = useState(false);
  const term = search.trim().toLocaleLowerCase();
  const filtered = offers
    .filter((offer) => offer.name.toLocaleLowerCase().includes(term))
    .toSorted((a, b) => Number(b.preferred) - Number(a.preferred));
  const primary = (offer: ProviderOffer) =>
    offer.preferred || (offer.tier !== "issues" && (!anime || offer.audio === "dub"));
  const regular = filtered.filter(primary);
  const problematic = filtered.filter((offer) => !primary(offer));
  const visible = problems ? [...regular, ...problematic] : regular;
  const selected =
    visible.find((offer) => offerKey(offer) === selection) ??
    regular.find((offer) => offer.available && offer.preferred) ??
    regular.find((offer) => offer.available && offer.tier === "tested") ??
    regular.find((offer) => offer.available) ??
    visible[0];
  const selectedKey = selected ? offerKey(selected) : "";
  const active =
    selected &&
    status?.phase !== "closed" &&
    status?.provider === selected.provider &&
    status?.audio === selected.audio;
  const capabilities = selected?.capabilities ?? unknownCapabilities;

  function rows(items: ProviderOffer[]) {
    return items.map((offer) => {
      const key = offerKey(offer);
      return (
        <Field
          key={key}
          data-provider-choice={key}
          orientation="horizontal"
          className="rounded-xl border border-border px-3 py-2 has-data-checked:border-primary has-data-checked:bg-accent"
        >
          <RadioGroupItem
            id={`${id}-${key}`}
            value={key}
            disabled={busy}
            aria-label={`اختيار ${offer.name}${offer.audio === "sub" ? " SUB" : offer.audio === "dub" ? " DUB" : ""}`}
          />
          <FieldLabel htmlFor={`${id}-${key}`} className="min-w-0 flex-1 cursor-pointer">
            <FieldContent>
              <FieldTitle className="flex flex-wrap items-center justify-between gap-2">
                <span dir="ltr">{offer.name}</span>
                <Badge variant={offer.available ? "outline" : "secondary"}>
                  {offer.preferred && <Star data-icon="inline-start" aria-hidden="true" />}
                  {offer.available ? audioLabel(offer) : "معرّف ناقص"}
                </Badge>
              </FieldTitle>
            </FieldContent>
            {key === selectedKey && (
              <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
            )}
          </FieldLabel>
        </Field>
      );
    });
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">
          {anime ? "صوتك، ترجمتك، مصدرك" : "اختر طريقة عرضك"}
        </h3>
        <Badge variant="secondary">
          {new Set(offers.map((offer) => offer.provider)).size} مزوّد
        </Badge>
      </div>
      {anime && (
        <Badge variant="outline">
          <Volume2 data-icon="inline-start" />
          English DUB
        </Badge>
      )}
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <div className="order-2 flex min-w-0 flex-col gap-3 xl:order-1">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="البحث عن مزوّد"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث عن مزوّد…"
            />
          </InputGroup>
          <RadioGroup
            aria-label="مزوّد الفيديو"
            value={selectedKey}
            onValueChange={(value) => {
              const offer = offers.find((item) => offerKey(item) === value);
              if (offer) setSelection(offerKey(offer));
            }}
            className="gap-2"
          >
            {rows(regular)}
            {problematic.length > 0 && (
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={problems}
                  aria-controls={`${id}-more`}
                  onClick={() => setProblems(!problems)}
                >
                  {problems ? "إخفاء الخيارات الإضافية" : anime ? "تريد المزيد؟" : "خيارات إضافية"}
                  {` (${problematic.length})`}
                </Button>
                {problems && (
                  <div id={`${id}-more`} className="flex flex-col gap-2">
                    {anime && (
                      <p className="text-xs text-muted-foreground">
                        نسخ مترجمة، صوت غير محدّد، ومزوّدون واجهوا مشكلات.
                      </p>
                    )}
                    {rows(problematic)}
                  </div>
                )}
              </div>
            )}
          </RadioGroup>
          {visible.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>لا توجد خيارات مطابقة</EmptyTitle>
                <EmptyDescription>جرّب الخيارات الإضافية أو التورنت، أو غيّر البحث.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
        {selected && (
          <Card size="sm" className="order-1 min-w-0 self-start xl:order-2">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  <h4 dir="ltr">{selected.name}</h4>
                </CardTitle>
                {selected.preferred && (
                  <Badge>
                    <Star data-icon="inline-start" aria-hidden="true" />
                    دبلجة إنجليزية + ترجمة عربية
                  </Badge>
                )}
              </div>
              <CardDescription>
                {selected.preferred
                  ? "تأكّدت لهذا الإصدار في اختبار التشغيل"
                  : selected.audio === "dub"
                    ? "طلب دبلجة إنجليزية"
                    : selected.audio === "sub"
                      ? "نسخة مترجمة؛ الصوت ليس طلب دبلجة إنجليزية"
                      : "اختر الصوت من داخل المشغّل؛ الإنجليزية غير مؤكدة"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>الترجمة</dt>
                  <dd>{supportLabels[capabilities.subtitles]}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>ترجمة عربية</dt>
                  <dd>{supportLabels[capabilities.arabic]}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>رفع ملف ترجمة</dt>
                  <dd>{supportLabels[capabilities.upload]}</dd>
                </div>
              </dl>
              {selected.notes.length > 0 && (
                <div className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
                  {selected.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              )}
              {!selected.available && (
                <p role="status" className="text-sm text-destructive">
                  {selected.reason}
                </p>
              )}
              {active && (
                <p role="status" className="text-xs text-muted-foreground">
                  {status?.phase === "loading"
                    ? "جارٍ تحميل صفحة المشغّل…"
                    : status?.phase === "failed"
                      ? "تعذّر تحميل المصدر؛ جرّب إعادة فتحه أو غيّره."
                      : "صفحة المشغّل مفتوحة؛ لم يُتحقّق من تشغيل الفيديو."}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-3">
              <Button
                disabled={busy || !selected.available}
                onClick={() =>
                  active && status?.phase !== "failed" ? onPresent() : onOpen(selected)
                }
              >
                <Play data-icon="inline-start" />
                {busy
                  ? "جارٍ التجهيز…"
                  : active && status?.phase !== "failed"
                    ? "إظهار المشغّل"
                    : `المشاهدة عبر ${selected.name}`}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}

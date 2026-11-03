import {
  ArrowLeft,
  ExternalLink,
  Info,
  Library,
  Check,
  Download,
  Film,
  Hash,
  Search,
  ShieldCheck,
  Subtitles,
  Tv,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";

import { Badge } from "../../components/ui/badge";
import { Button, buttonVariants } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { PublicPage, PublicPageHeader } from "../shell/public-page";

const imdbSchema = z
  .string()
  .regex(/^tt\d{7,10}$/, "أدخل معرّف IMDb مثل tt1234567 أو رابط صفحة العنوان.");
function imdbId(value: string) {
  const trimmed = value.trim();
  if (/^tt\d{7,10}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (
      url.protocol === "https:" &&
      ["imdb.com", "www.imdb.com", "m.imdb.com"].includes(url.hostname)
    )
      return /^\/title\/(tt\d{7,10})(?:\/|$)/.exec(url.pathname)?.[1] ?? "";
  } catch {
    /* A bare IMDb identifier is validated below, not fetched as a URL. */
  }
  return "";
}
type RequestPreview = { id: string; kind: "movie" | "series"; season: number; episode: number };
export function WatchPage() {
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<"movie" | "series">("movie");
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [attempted, setAttempted] = useState(false);
  const [preview, setPreview] = useState<RequestPreview | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const parsed = imdbSchema.safeParse(imdbId(value));
  const seasonValid = /^\d+$/.test(season) && Number(season) <= 999;
  const episodeValid = /^\d+$/.test(episode) && Number(episode) >= 1 && Number(episode) <= 9999;
  const current =
    preview &&
    parsed.success &&
    preview.id === parsed.data &&
    preview.kind === kind &&
    (kind === "movie" || (preview.season === Number(season) && preview.episode === Number(episode)))
      ? preview
      : null;
  const series = kind === "series";
  const reset = () => {
    setValue("");
    setPreview(null);
    setAttempted(false);
    input.current?.focus();
  };
  return (
    <PublicPage
      as="article"
      className="flex max-w-6xl flex-col gap-6"
      aria-label="صفحة المشاهدة المباشرة"
    >
      <PublicPageHeader
        title="مشاهدة مباشرة"
        description="جهّز طلب فيلم أو حلقة خارج المكتبة، دون إضافته إلى سجل المشاهدة."
        actions={
          <a className={buttonVariants({ variant: "outline" })} href="#/browse">
            <Library data-icon="inline-start" />
            تصفّح المكتبة
          </a>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <h2>ما الذي تريد مشاهدته؟</h2>
            </CardTitle>
            <CardDescription>ابدأ برابط العنوان من IMDb، ثم حدّد الفيلم أو الحلقة.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                setAttempted(true);
                if (!parsed.success) {
                  input.current?.focus();
                  return;
                }
                if (series && (!seasonValid || !episodeValid)) {
                  event.currentTarget
                    .querySelector<HTMLInputElement>(
                      !seasonValid ? "#watch-season" : "#watch-episode",
                    )
                    ?.focus();
                  return;
                }
                setValue(parsed.data);
                setPreview({
                  id: parsed.data,
                  kind,
                  season: Number(season),
                  episode: Number(episode),
                });
                reviewHeading.current?.focus();
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel id="watch-kind-label">ماذا ستشاهد؟</FieldLabel>
                  <ToggleGroup
                    aria-labelledby="watch-kind-label"
                    value={[kind]}
                    onValueChange={(values) => {
                      if (values[0] === "movie" || values[0] === "series") setKind(values[0]);
                    }}
                    variant="outline"
                    size="lg"
                  >
                    <ToggleGroupItem value="movie">
                      <Film data-icon="inline-start" />
                      فيلم
                    </ToggleGroupItem>
                    <ToggleGroupItem value="series">
                      <Tv data-icon="inline-start" />
                      مسلسل
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field data-invalid={attempted && !parsed.success}>
                  <FieldLabel htmlFor="watch-imdb">معرّف IMDb أو رابط العنوان</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      ref={input}
                      id="watch-imdb"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="tt1234567"
                      autoComplete="off"
                      spellCheck={false}
                      dir="ltr"
                      maxLength={256}
                      aria-invalid={attempted && !parsed.success}
                      aria-describedby={
                        attempted && !parsed.success
                          ? "watch-imdb-help watch-imdb-error"
                          : "watch-imdb-help"
                      }
                    />
                    <InputGroupAddon>
                      <Hash />
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription id="watch-imdb-help">
                    الصق المعرّف، أو رابط imdb.com/title/…
                  </FieldDescription>
                  {attempted && !parsed.success && (
                    <FieldError id="watch-imdb-error">{parsed.error.issues[0]?.message}</FieldError>
                  )}
                </Field>
                {series && (
                  <FieldGroup className="grid grid-cols-2 gap-4">
                    <Field data-invalid={attempted && !seasonValid}>
                      <FieldLabel htmlFor="watch-season">الموسم</FieldLabel>
                      <Input
                        id="watch-season"
                        type="number"
                        min={0}
                        max={999}
                        step={1}
                        value={season}
                        onChange={(event) => setSeason(event.target.value)}
                        aria-invalid={attempted && !seasonValid}
                        aria-describedby="watch-season-help"
                      />
                      <FieldDescription id="watch-season-help">0 للحلقات الخاصة</FieldDescription>
                      {attempted && !seasonValid && (
                        <FieldError>أدخل موسمًا من 0 إلى 999.</FieldError>
                      )}
                    </Field>
                    <Field data-invalid={attempted && !episodeValid}>
                      <FieldLabel htmlFor="watch-episode">الحلقة</FieldLabel>
                      <Input
                        id="watch-episode"
                        type="number"
                        min={1}
                        max={9999}
                        step={1}
                        value={episode}
                        onChange={(event) => setEpisode(event.target.value)}
                        aria-invalid={attempted && !episodeValid}
                      />
                      {attempted && !episodeValid && (
                        <FieldError>أدخل حلقة من 1 إلى 9999.</FieldError>
                      )}
                    </Field>
                  </FieldGroup>
                )}
                <Button type="submit" size="lg">
                  <Search data-icon="inline-start" />
                  معاينة الطلب
                  <ArrowLeft data-icon="inline-end" />
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
          <CardFooter className="gap-2 border-t text-xs leading-relaxed text-muted-foreground">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            نتحقق من صيغة المعرّف فقط؛ لا تُجلب تفاصيل العنوان في هذا الإصدار.
          </CardFooter>
        </Card>
        <aside className="flex min-w-0 flex-col gap-5" aria-label="تفاصيل الطلب">
          <Card size="sm">
            <CardHeader>
              <CardTitle>
                <h2 ref={reviewHeading} tabIndex={-1}>
                  طلب المشاهدة
                </h2>
              </CardTitle>
              <CardDescription>راجع العنوان المحدّد قبل البحث عن مصادره.</CardDescription>
            </CardHeader>
            <CardContent aria-live="polite" className="flex flex-col gap-4">
              {current ? (
                <>
                  <div className="flex items-center gap-3">
                    {current.kind === "series" ? (
                      <Tv className="size-5 text-primary" aria-hidden="true" />
                    ) : (
                      <Film className="size-5 text-primary" aria-hidden="true" />
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="break-all text-lg font-semibold tabular-nums" dir="ltr">
                        {current.id}
                      </p>
                      <h3 className="text-sm">
                        {current.kind === "series"
                          ? `الموسم ${current.season} · الحلقة ${current.episode}`
                          : "فيلم"}
                      </h3>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    <Check data-icon="inline-start" />
                    صيغة المعرّف صحيحة
                  </Badge>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    نوع العنوان والموسم والحلقة حسب اختيارك؛ لم تُتحقق هويتها لدى IMDb.
                  </p>
                </>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">{series ? <Tv /> : <Film />}</EmptyMedia>
                    <EmptyTitle>لم تحدّد عنوانًا بعد</EmptyTitle>
                    <EmptyDescription>
                      الصق الرابط واستخدم «معاينة الطلب» لمراجعة اختيارك هنا.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
            {current && (
              <CardFooter className="flex-wrap gap-2 border-t">
                <a
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  href={`https://www.imdb.com/title/${current.id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  عرض على IMDb
                  <ExternalLink data-icon="inline-end" />
                </a>
                <Button size="sm" variant="ghost" onClick={() => input.current?.focus()}>
                  تعديل الطلب
                </Button>
                <Button size="sm" variant="ghost" onClick={reset}>
                  طلب جديد
                </Button>
              </CardFooter>
            )}
          </Card>
          <div className="flex items-start gap-3 px-1 text-sm leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-1 size-5 shrink-0" aria-hidden="true" />
            <p>
              طلبك لا يغيّر المكتبة ولا يحفظ تقدم المشاهدة. العناوين الخارجية لا تحمل تقييم العائلة.
            </p>
          </div>
        </aside>
      </div>
      <section className="flex flex-col gap-4" aria-label="المصادر والتنزيل والترجمة">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold">بعد تحديد العنوان</h2>
          <Badge variant="outline">قريبًا</Badge>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          ربط هذه الطلبات بمصادر الفيديو والمشغّل لم يُنفّذ بعد. معاينة الطلب لا تبدأ تشغيلًا أو تنزيلًا.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <UpcomingTool
            icon={Waves}
            title="مصادر الفيديو"
            description="مقارنة النسخ والجودة واختيار المصدر."
            action="البحث عن المصادر"
          />
          <UpcomingTool
            icon={Download}
            title="للمشاهدة لاحقًا"
            description="تنزيل المصدر الذي تختاره إلى جهازك."
            action="تنزيل الفيديو"
          />
          <UpcomingTool
            icon={Subtitles}
            title="الترجمة"
            description="اختيار اللغة والترجمة المطابقة للنسخة."
            action="اختيار ترجمة"
          />
        </div>
      </section>
    </PublicPage>
  );
}

function UpcomingTool({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h3 className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            {title}
          </h3>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {/* TODO(WATCH-01/02/03): Connect validated external identities to native sources, device metadata/download ownership and subtitle selection before enabling these actions. Never manufacture a catalog UUID. */}
      <CardFooter className="mt-auto">
        <Button variant="outline" disabled className="w-full">
          {action}
        </Button>
      </CardFooter>
    </Card>
  );
}

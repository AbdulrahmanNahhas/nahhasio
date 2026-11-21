import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Choice } from "@/components/choice";
import { Failure } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { nativeCall } from "@/lib/bridge";
import { developmentBrowserAvailable } from "@/lib/development-platform";

import {
  playbackPreferencesDefaults,
  playbackPreferencesSchema,
  subtitleColor,
  trackLanguage,
  type PlaybackPreferencesData,
} from "./playback-preferences-model";

const key = ["device", "playback-preferences"];
const languages = [
  { value: "auto", label: "اختيار الملف" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "الإنجليزية" },
  { value: "ja", label: "اليابانية" },
  { value: "ko", label: "الكورية" },
  { value: "fr", label: "الفرنسية" },
  { value: "es", label: "الإسبانية" },
];
const subtitleColors = [
  { value: "white", label: "أبيض" },
  { value: "yellow", label: "أصفر" },
];

export function PlaybackPreferences() {
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      playbackPreferencesSchema.parse(await nativeCall("playbackPreferences.load", {}, signal)),
    retry: false,
  });

  if (query.error) return <Failure error={query.error} retry={() => void query.refetch()} />;
  if (!query.data) return <Skeleton className="h-32" />;
  return <PreferencesForm key={JSON.stringify(query.data)} initial={query.data} />;
}

const numericFields = {
  subtitleSize: { label: "حجم الترجمة", min: 10, max: 120 },
  subtitlePosition: { label: "موضع الترجمة", min: 0, max: 100 },
  subtitleDelay: { label: "مزامنة الترجمة (ثانية)", min: -600, max: 600 },
};

function NumericPreference({
  name,
  value,
  onChange,
  disabled,
  description,
}: {
  name: keyof typeof numericFields;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  description?: string;
}) {
  const { label, min, max } = numericFields[name];
  const id = `playback-${name}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        step="any"
        min={min}
        max={max}
        dir="ltr"
        disabled={disabled}
        aria-describedby={description ? `${id}-hint` : undefined}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
      {description && <FieldDescription id={`${id}-hint`}>{description}</FieldDescription>}
    </Field>
  );
}

function PreferencesForm({ initial }: { initial: PlaybackPreferencesData }) {
  const [draft, setDraft] = useState(initial);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async (value: PlaybackPreferencesData) =>
      playbackPreferencesSchema.parse(await nativeCall("playbackPreferences.save", value)),
    onSuccess: (value) => {
      client.setQueryData(key, value);
      toast.add({ type: "success", title: "تم حفظ افتراضيات التشغيل" });
    },
  });
  const busy = save.isPending;
  const resetSubtitles = {
    ...initial,
    subtitleLanguage: playbackPreferencesDefaults.subtitleLanguage,
    subtitlesEnabled: playbackPreferencesDefaults.subtitlesEnabled,
    subtitleSize: playbackPreferencesDefaults.subtitleSize,
    subtitlePosition: playbackPreferencesDefaults.subtitlePosition,
    subtitleDelay: playbackPreferencesDefaults.subtitleDelay,
    subtitleColor: playbackPreferencesDefaults.subtitleColor,
    subtitleBackground: playbackPreferencesDefaults.subtitleBackground,
    subtitleBold: playbackPreferencesDefaults.subtitleBold,
  };
  const changed = JSON.stringify(draft) !== JSON.stringify(initial);
  const canReset = JSON.stringify(draft) !== JSON.stringify(resetSubtitles);
  const parsed = playbackPreferencesSchema.safeParse(draft);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && changed && parsed.success) save.mutate(parsed.data);
      }}
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>مسارات الترجمة</h2>
          </CardTitle>
          <CardDescription>
            {developmentBrowserAvailable()
              ? "تُحفظ تفضيلات المعاينة في هذا المتصفح."
              : "تُطبّق عند فتح مصدر جديد في المشغّل."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field orientation="horizontal">
              <FieldLabel htmlFor="default-subtitles">إظهار الترجمة عند بدء التشغيل</FieldLabel>
              <Switch
                id="default-subtitles"
                checked={draft.subtitlesEnabled}
                disabled={busy}
                onCheckedChange={(subtitlesEnabled) => setDraft({ ...draft, subtitlesEnabled })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="preferred-subtitle-language">لغة الترجمة المفضلة</FieldLabel>
              <Choice
                id="preferred-subtitle-language"
                label="لغة الترجمة المفضلة"
                value={draft.subtitleLanguage}
                options={languages}
                disabled={busy}
                onChange={(value) =>
                  setDraft({ ...draft, subtitleLanguage: trackLanguage.parse(value) })
                }
              />
              {draft.subtitleLanguage === "ar" && (
                <FieldDescription>تُختار الإنجليزية عند غياب مسار عربي.</FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <h2>شكل الترجمة وتوقيتها</h2>
          </CardTitle>
          <CardDescription>اللون والخط والخلفية للترجمات النصية غير المنسّقة.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <NumericPreference
              name="subtitleSize"
              value={draft.subtitleSize}
              disabled={busy}
              onChange={(subtitleSize) => setDraft({ ...draft, subtitleSize })}
            />
            <NumericPreference
              name="subtitlePosition"
              value={draft.subtitlePosition}
              disabled={busy}
              description="٠ أعلى الشاشة، و١٠٠ أسفلها."
              onChange={(subtitlePosition) => setDraft({ ...draft, subtitlePosition })}
            />
            <Field>
              <FieldLabel htmlFor="default-subtitle-color">لون النص</FieldLabel>
              <Choice
                id="default-subtitle-color"
                label="لون النص"
                value={draft.subtitleColor}
                options={subtitleColors}
                disabled={busy}
                onChange={(value) =>
                  setDraft({ ...draft, subtitleColor: subtitleColor.parse(value) })
                }
              />
            </Field>
            <NumericPreference
              name="subtitleDelay"
              value={draft.subtitleDelay}
              disabled={busy}
              description="قيمة سالبة للتقديم، وموجبة للتأخير."
              onChange={(subtitleDelay) => setDraft({ ...draft, subtitleDelay })}
            />
            <Field orientation="horizontal">
              <FieldLabel htmlFor="subtitle-background">خلفية داكنة خلف النص</FieldLabel>
              <Switch
                id="subtitle-background"
                checked={draft.subtitleBackground}
                disabled={busy}
                onCheckedChange={(subtitleBackground) => setDraft({ ...draft, subtitleBackground })}
              />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="subtitle-bold">خط عريض</FieldLabel>
              <Switch
                id="subtitle-bold"
                checked={draft.subtitleBold}
                disabled={busy}
                onCheckedChange={(subtitleBold) => setDraft({ ...draft, subtitleBold })}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      {save.error && <Failure error={save.error} />}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={busy || !changed || !parsed.success}>
          {save.isPending ? "جارٍ الحفظ…" : "حفظ الافتراضيات"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !canReset}
          onClick={() => setDraft(resetSubtitles)}
        >
          استعادة الافتراضيات
        </Button>
      </div>
    </form>
  );
}

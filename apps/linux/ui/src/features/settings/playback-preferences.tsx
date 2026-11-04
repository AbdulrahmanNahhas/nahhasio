import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Failure } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { nativeCall } from "@/lib/bridge";
import { developmentBrowserAvailable } from "@/lib/development-platform";

const audioLanguage = z.enum(["auto", "ar", "en", "ja", "ko", "fr", "es"]);
const subtitleLanguage = z.enum(["auto", "ar", "en", "fr", "es"]);
export const playbackPreferencesSchema = z.strictObject({
  version: z.literal(1),
  audioLanguage,
  subtitleLanguage,
  subtitlesEnabled: z.boolean(),
  subtitleSize: z.number().finite().min(10).max(120),
  subtitlePosition: z.number().finite().min(0).max(100),
});
type Preferences = z.infer<typeof playbackPreferencesSchema>;
const key = ["device", "playback-preferences"];
const languages = [
  { value: "auto", label: "تلقائي · اختيار الملف" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "الإنجليزية" },
  { value: "ja", label: "اليابانية" },
  { value: "ko", label: "الكورية" },
  { value: "fr", label: "الفرنسية" },
  { value: "es", label: "الإسبانية" },
];
export function PlaybackPreferences({ subtitles = false }: { subtitles?: boolean }) {
  const browser = developmentBrowserAvailable();
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      playbackPreferencesSchema.parse(await nativeCall("playbackPreferences.load", {}, signal)),
    enabled: !browser,
    retry: false,
  });
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{subtitles ? "الترجمة الافتراضية" : "لغة الصوت الافتراضية"}</CardTitle>
        <CardDescription>
          خاصة بحسابك على هذا الجهاز. تُطبّق عند بدء مصدر جديد؛ التغييرات داخل المشغّل تخص الجلسة
          الحالية.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {browser ? (
          <p className="text-sm text-muted-foreground">
            تُضبط تفضيلات المشغّل في تطبيق Linux. معاينة المتصفح لا تشغّل الفيديو.
          </p>
        ) : query.error ? (
          <Failure error={query.error} retry={() => void query.refetch()} />
        ) : query.data ? (
          <PreferencesForm
            key={JSON.stringify(query.data)}
            initial={query.data}
            subtitles={subtitles}
          />
        ) : (
          <Skeleton className="h-32" />
        )}
      </CardContent>
    </Card>
  );
}
function PreferencesForm({ initial, subtitles }: { initial: Preferences; subtitles: boolean }) {
  const [draft, setDraft] = useState(initial);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async () =>
      playbackPreferencesSchema.parse(
        await nativeCall("playbackPreferences.save", playbackPreferencesSchema.parse(draft)),
      ),
    onSuccess: (value) => client.setQueryData(key, value),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <FieldGroup>
        {subtitles ? (
          <>
            <Field>
              <FieldLabel htmlFor="preferred-subtitle-language">لغة الترجمة المفضلة</FieldLabel>
              <Choice
                id="preferred-subtitle-language"
                label="لغة الترجمة المفضلة"
                value={draft.subtitleLanguage}
                options={languages.filter(({ value }) => value !== "ja" && value !== "ko")}
                onChange={(value) =>
                  setDraft({
                    ...draft,
                    subtitleLanguage: subtitleLanguage.parse(value),
                  })
                }
              />
              <FieldDescription>
                العربية تتبعها الإنجليزية عند توفرها. لا يُنزّل أي ملف ترجمة تلقائيًا.
              </FieldDescription>
            </Field>
            <Field orientation="horizontal">
              <Switch
                id="default-subtitles"
                checked={draft.subtitlesEnabled}
                onCheckedChange={(value) => setDraft({ ...draft, subtitlesEnabled: value })}
              />
              <FieldLabel htmlFor="default-subtitles">تشغيل الترجمة المرفقة افتراضيًا</FieldLabel>
            </Field>
            <Field>
              <FieldLabel htmlFor="default-subtitle-size">حجم الترجمة</FieldLabel>
              <Input
                id="default-subtitle-size"
                type="number"
                min={10}
                max={120}
                value={draft.subtitleSize}
                onChange={(event) =>
                  setDraft({ ...draft, subtitleSize: event.currentTarget.valueAsNumber })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="default-subtitle-position">
                موضع الترجمة · 100 عند الأسفل
              </FieldLabel>
              <Input
                id="default-subtitle-position"
                type="number"
                min={0}
                max={100}
                value={draft.subtitlePosition}
                onChange={(event) =>
                  setDraft({ ...draft, subtitlePosition: event.currentTarget.valueAsNumber })
                }
              />
            </Field>
          </>
        ) : (
          <Field>
            <FieldLabel htmlFor="preferred-audio-language">لغة الصوت المفضلة</FieldLabel>
            <Choice
              id="preferred-audio-language"
              label="لغة الصوت المفضلة"
              value={draft.audioLanguage}
              options={languages}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  audioLanguage: audioLanguage.parse(value),
                })
              }
            />
            <FieldDescription>
              يختار مسارًا متاحًا بهذه اللغة؛ لا يغيّر المصدر ولا يضيف دبلجة غير موجودة.
            </FieldDescription>
          </Field>
        )}
        {save.error && <Failure error={save.error} />}
        <Button
          type="submit"
          disabled={
            save.isPending ||
            !playbackPreferencesSchema.safeParse(draft).success ||
            JSON.stringify(draft) === JSON.stringify(initial)
          }
        >
          حفظ الافتراضيات
        </Button>
      </FieldGroup>
    </form>
  );
}

import type { WorkDocument } from "@arcadia/contracts/work";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup } from "@/components/ui/field";

import { LanguagesField } from "./languages-field";
import { TextField, SelectField } from "./work-fields";
type Update = <K extends keyof WorkDocument>(key: K, value: WorkDocument[K]) => void;
export function PlaybackFields({ draft, update }: { draft: WorkDocument; update: Update }) {
  const trailers = draft.trailers ?? [];
  function change(index: number, patch: Partial<(typeof trailers)[number]>) {
    update(
      "trailers",
      trailers.map((item, i) =>
        i === index
          ? { ...item, ...patch }
          : patch.isPrimary
            ? { ...item, isPrimary: false }
            : item,
      ),
    );
  }
  function move(index: number, delta: number) {
    const next = [...trailers];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update(
      "trailers",
      next.map((item, position) => ({ ...item, position })),
    );
  }
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>التشغيل والدبلجة</CardTitle>
          <CardDescription>
            تسري سياسة التشغيل على العمل كله، بما فيه جميع الأجزاء والحلقات.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SelectField
              label="مصادر التشغيل"
              value={draft.playbackPolicy ?? "torrents-allowed"}
              items={[
                { value: "torrents-allowed", label: "الملفات والتورنت" },
                { value: "files-only", label: "الملفات فقط" },
              ]}
              onChange={(value) => update("playbackPolicy", value)}
            />
            <LanguagesField
              label="لغات الدبلجة المسجّلة"
              values={draft.dubLanguages ?? []}
              onChange={(value) => update("dubLanguages", value)}
            />
            <TextField
              label="ملاحظات الدبلجة"
              value={draft.dubbingNotes}
              multiline
              onChange={(value) => update("dubbingNotes", value)}
            />
            <p className="text-xs text-muted-foreground">
              أضف استوديو الدبلجة من المساهمات، وحدّد لغة مساهمته هناك.
            </p>
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>الإعلانات التشويقية</CardTitle>
          <CardDescription>
            روابط YouTube تُحفظ في نحّاسيو. يمكن ترتيبها وتحديد إعلان رئيسي.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {trailers.map((trailer, index) => (
              <div
                key={trailer.id ?? index}
                className="flex flex-col gap-3 rounded-xl border border-border p-3"
              >
                <TextField
                  label={`معرّف فيديو YouTube ${index + 1}`}
                  value={trailer.youtubeVideoId}
                  onChange={(value) => {
                    let video = value.trim();
                    try {
                      const url = new URL(video);
                      if (
                        ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
                      )
                        video =
                          url.searchParams.get("v") ?? url.pathname.split("/").at(-1) ?? video;
                      else if (url.hostname === "youtu.be") video = url.pathname.slice(1);
                    } catch {
                      /* An ID can be entered directly. */
                    }
                    change(index, { youtubeVideoId: video });
                  }}
                />
                <TextField
                  label="العنوان"
                  value={trailer.title}
                  onChange={(title) => change(index, { title })}
                />
                <TextField
                  label="رمز اللغة"
                  value={trailer.language}
                  onChange={(language) => change(index, { language: language || null })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={trailer.isPrimary ?? false}
                      onCheckedChange={(value) => change(index, { isPrimary: value === true })}
                    />
                    الإعلان الرئيسي
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    aria-label="تقديم الإعلان"
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === trailers.length - 1}
                    aria-label="تأخير الإعلان"
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="إزالة الإعلان"
                    onClick={() =>
                      update(
                        "trailers",
                        trailers.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                {/^[A-Za-z0-9_-]{11}$/.test(trailer.youtubeVideoId) && (
                  <a
                    className="text-sm text-primary underline"
                    href={`https://www.youtube.com/watch?v=${trailer.youtubeVideoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    معاينة في YouTube
                  </a>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update("trailers", [
                  ...trailers,
                  {
                    youtubeVideoId: "",
                    title: "",
                    language: null,
                    isPrimary: trailers.length === 0,
                    position: trailers.length,
                  },
                ])
              }
            >
              <Plus data-icon="inline-start" />
              إضافة إعلان
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function directVideoUrl(value: string) {
  const url = URL.canParse(value) ? new URL(value) : null;
  return url?.protocol === "https:" &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.hash &&
    url.href.length <= 8192
    ? url.href
    : null;
}

export function BrowserVideo({
  url,
  onProgress,
}: {
  url: string;
  onProgress?: (position: number, duration: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative min-h-0 flex-1 bg-background">
      <video
        className="absolute inset-0 block size-full"
        src={url}
        aria-label="مشغّل الفيديو"
        playsInline
        preload="metadata"
        controls
        autoPlay
        onError={() => setFailed(true)}
        onTimeUpdate={(event) =>
          onProgress?.(event.currentTarget.currentTime, event.currentTarget.duration)
        }
      />
      {failed && (
        <div className="absolute inset-x-3 bottom-14">
          <Alert variant="destructive">
            <AlertDescription>تعذّر تشغيل الفيديو في المتصفح.</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

export function DirectLinkForm({ onPlay, busy }: { onPlay: (url: string) => void; busy: boolean }) {
  const [link, setLink] = useState("");
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const url = directVideoUrl(link.trim());
        setInvalid(!url);
        if (url) onPlay(url);
      }}
    >
      <FieldGroup>
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="direct-video-url">رابط الفيديو</FieldLabel>
          <Input
            id="direct-video-url"
            type="url"
            dir="ltr"
            required
            value={link}
            aria-invalid={invalid}
            aria-describedby="direct-video-description"
            onChange={(event) => {
              setLink(event.target.value);
              setInvalid(false);
            }}
          />
          <FieldDescription id="direct-video-description">
            ألصق رابط HTTPS لملف فيديو، مثل MP4.
          </FieldDescription>
        </Field>
      </FieldGroup>
      {invalid && (
        <Alert variant="destructive">
          <AlertDescription>أدخل رابط فيديو مباشر يبدأ بـ HTTPS.</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="self-start" disabled={busy}>
        تشغيل الفيديو
      </Button>
    </form>
  );
}

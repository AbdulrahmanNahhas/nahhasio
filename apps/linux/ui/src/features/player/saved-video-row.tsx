import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { videoTitle, type SavedVideo } from "./download-data";
import { SavedVideoActions } from "./saved-video-actions";
import { formatSourceSize } from "./source-format";

/** Keep file paths available without letting long filenames dominate the library. */
export function SavedVideoRow({ file }: { file: SavedVideo }) {
  return (
    <Collapsible className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium" dir="auto" title={videoTitle(file)}>
          {videoTitle(file)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatSourceSize(file.size)}</span>
          <span>{file.available ? "جاهز للمشاهدة" : "مفقود أو تغيّر"}</span>
        </div>
      </div>
      <SavedVideoActions file={file} />
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
        <FileText data-icon="inline-start" />
        تفاصيل الملف
      </CollapsibleTrigger>
      <CollapsibleContent className="w-full">
        <p
          className="break-all rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"
          dir="ltr"
        >
          {file.path}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

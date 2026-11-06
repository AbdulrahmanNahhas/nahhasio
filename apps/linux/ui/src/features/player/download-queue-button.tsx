import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function DownloadQueueButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            nativeButton={false}
            variant="ghost"
            size="icon-lg"
            aria-label="مكتبة الجهاز"
            render={<a href="#/downloads" />}
          />
        }
      >
        <Download data-icon="inline-start" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="left">مكتبة الجهاز · المحفوظات والتنزيلات</TooltipContent>
    </Tooltip>
  );
}

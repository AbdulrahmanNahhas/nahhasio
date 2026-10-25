import { cn } from "cn";

import logo from "@/assets/brand/nahhasio.png";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-3", className)}>
      <img
        src={logo}
        alt=""
        className={compact ? "size-10 object-contain" : "size-16 object-contain"}
      />
      {!compact && (
        <span className="font-display text-4xl font-semibold tracking-tight">نحّاسيو</span>
      )}
    </span>
  );
}

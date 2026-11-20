import { cn } from "cn";

import { optionLabel } from "../features/catalog/filter-model";
import { Badge } from "./ui/badge";

const tones = new Map([
  ["completed", "bg-success"],
  ["watched", "bg-success"],
  ["ongoing", "bg-primary"],
  ["airing", "bg-primary"],
  ["announced", "bg-warning"],
  ["upcoming", "bg-warning"],
  ["in-progress", "bg-warning"],
]);

export function CatalogStateBadge({ value }: { value: string }) {
  return (
    <Badge variant="secondary" className="bg-card shadow-sm">
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", tones.get(value) ?? "bg-muted-foreground")}
      />
      {optionLabel(value, value)}
    </Badge>
  );
}

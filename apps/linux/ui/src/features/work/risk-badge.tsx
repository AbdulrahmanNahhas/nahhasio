import type { Classification } from "@nahhasio/api-contract";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";

import { riskLabels } from "./format";

type Risk = Classification["sexualityRisk"];
const riskRank = new Map<Risk, number>([
  ["none", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
]);
export function highestRisk(risks: Risk[]) {
  return (
    risks.toSorted((left, right) => (riskRank.get(right) ?? 0) - (riskRank.get(left) ?? 0))[0] ??
    "none"
  );
}
export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto border px-3 py-1 text-sm",
        risk === "low" && "border-success/60 bg-success/10 text-success",
        risk === "medium" && "border-warning/60 bg-warning/10 text-warning",
        risk === "high" && "border-destructive/60 bg-destructive/10 text-destructive",
      )}
    >
      {riskLabels.get(risk)}
    </Badge>
  );
}

import type { WorkDetail } from "@nahhasio/api-contract";

type Installment = WorkDetail["installments"][number];
type Episode = Installment["episodes"][number];

export function isUpcomingTarget(installment: Installment, episode?: Episode) {
  return (
    installment.status === "announced" ||
    installment.releaseState === "upcoming" ||
    episode?.releaseState === "upcoming"
  );
}

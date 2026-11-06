export function matchesVideoTarget(
  file: {
    target?: { workId: string; installmentId?: string | null; episodeId?: string | null } | null;
  },
  target: { workId: string; installmentId?: string | null; episodeId?: string | null },
) {
  return (
    file.target?.workId === target.workId &&
    (file.target.installmentId ?? null) === (target.installmentId ?? null) &&
    (file.target.episodeId ?? null) === (target.episodeId ?? null)
  );
}

import type { AdminWork } from "@nahhasio/api-contract";

export type SelectedRecord = { id: string; name: string };
export function selectedWork(work: AdminWork): SelectedRecord {
  return { id: work.id, name: work.titleAr?.trim() || work.canonicalTitle };
}
/** Page changes add/remove only their own records; hidden selections remain explicit. */
export function changeSelection(
  previous: SelectedRecord[],
  records: SelectedRecord[],
  checked: boolean,
) {
  const ids = new Set(records.map((record) => record.id));
  if (!checked) return previous.filter((record) => !ids.has(record.id));
  const next = new Map(previous.map((record) => [record.id, record]));
  for (const record of records) next.set(record.id, record);
  return [...next.values()];
}

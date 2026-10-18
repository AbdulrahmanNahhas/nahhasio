import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import type { SelectedRecord } from "./catalog-selection-model";

/** Membership is loaded only by an explicit action, shared across page/sort changes. */
export function useMatchingSelection({
  key,
  load,
  selected,
  pageRecords,
  total,
  change,
}: {
  key: QueryKey;
  load: () => Promise<SelectedRecord[]>;
  selected: SelectedRecord[];
  pageRecords: SelectedRecord[];
  total: number;
  change: (records: SelectedRecord[], checked: boolean) => void;
}) {
  const client = useQueryClient();
  const snapshot = useQuery({ queryKey: key, queryFn: load, enabled: false, retry: false });
  const request = useMutation({
    mutationFn: async (input: { key: QueryKey; load: () => Promise<SelectedRecord[]> }) => ({
      records: await input.load(),
      key: input.key,
    }),
    onSuccess: ({ records, key: resultKey }) => {
      client.setQueryData<SelectedRecord[]>(resultKey, records);
      change(records, true);
    },
  });
  const records =
    snapshot.data?.length === total
      ? snapshot.data
      : pageRecords.length === total
        ? pageRecords
        : undefined;
  const selectedIds = new Set(selected.map((record) => record.id));
  const allSelected =
    Boolean(records?.length) && Boolean(records?.every((record) => selectedIds.has(record.id)));
  return {
    allSelected,
    pending: request.isPending,
    error: request.error,
    toggle: () => {
      if (allSelected) change(records ?? [], false);
      else request.mutate({ key, load });
    },
  };
}

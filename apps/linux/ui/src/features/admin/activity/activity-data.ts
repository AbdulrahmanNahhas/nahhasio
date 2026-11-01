import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway } from "@/lib/bridge";

export const jobSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  progress: z.number().int().min(0).max(100),
  created_by_account_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  attempts: z.number().int(),
  max_attempts: z.number().int(),
  run_after: z.string(),
  error: z.string().nullable(),
});
export const auditSchema = z.object({
  id: z.string(),
  actor_account_id: z.string().nullable(),
  action: z.string(),
  target_type: z.string(),
  target_id: z.string().nullable(),
  summary: z.string(),
  created_at: z.string(),
});
export type BackgroundJob = z.infer<typeof jobSchema>;
export type AuditRecord = z.infer<typeof auditSchema>;
export const jobStates = [
  { value: "all", label: "كل الحالات" },
  { value: "queued", label: "في الانتظار" },
  { value: "running", label: "قيد التنفيذ" },
  { value: "completed", label: "مكتملة" },
  { value: "failed", label: "متعذّرة" },
  { value: "cancelled", label: "ملغاة" },
] as const;
export const jobStateLabel = (value: string) =>
  jobStates.find((item) => item.value === value)?.label ?? value;
const actions = {
  "server.rename": "تغيير اسم الخادم",
  "work.create": "إضافة عمل",
  "work.update": "تحديث عمل",
  "work.save": "حفظ عمل",
  "work.delete": "حذف عمل",
  "asset.delete": "حذف صورة",
  "asset.assign": "ربط صورة",
};
export const actionLabel = (value: string) =>
  Object.entries(actions).find(([key]) => key === value)?.[1] ?? value;
export function activityOptions(
  view: "jobs" | "logs",
  page: number,
  q: string,
  state: string,
  descending: boolean,
) {
  const table = view === "jobs" ? "background_jobs" : "audit_logs";
  return queryOptions({
    queryKey: ["admin", "activity", view, page, q, state, descending],
    queryFn: async ({ signal }) => {
      const data = await gateway.databaseRows(
        table,
        page,
        q,
        signal,
        view === "jobs" && state !== "all" ? { column: "status", value: state } : undefined,
        { column: "created_at", descending },
      );
      return view === "jobs"
        ? {
            ...data,
            kind: "jobs" as const,
            rows: data.rows.map((row) => ({ record: jobSchema.parse(row), raw: row })),
          }
        : {
            ...data,
            kind: "logs" as const,
            rows: data.rows.map((row) => ({ record: auditSchema.parse(row), raw: row })),
          };
    },
    staleTime: 15000,
    refetchInterval: 30000,
    retry: false,
  });
}

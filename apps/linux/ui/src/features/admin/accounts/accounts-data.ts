import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { gateway } from "@/lib/bridge";

const date = z.string().nullable();
export const accountSchema = z.object({
  id: z.string().uuid(),
  auth_user_id: z.string().nullable(),
  display_name: z.string(),
  avatar_key: z.string(),
  kind: z.enum(["admin", "family", "personal"]),
  status: z.enum(["active", "invited", "suspended"]),
  bio: z.string(),
  slug: z.string().nullable(),
  is_discoverable: z.boolean(),
  last_seen_at: date,
  created_at: z.string(),
});
export type ManagedAccount = z.infer<typeof accountSchema>;
export const identitySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  role: z.string(),
  banned: z.boolean(),
  ban_expires: date,
});
export const deviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  platform: z.string(),
  last_seen_at: date,
  revoked_at: date,
  created_at: z.string(),
});
export type ManagedDevice = z.infer<typeof deviceSchema>;
export const sessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  device_id: z.string().nullable(),
  expires_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export const inviteSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  username: z.string(),
  role: z.string(),
  kind: z.string(),
  expires_at: z.string(),
  accepted_at: date,
  created_at: z.string(),
});
export const preferenceSchema = z.object({
  account_id: z.string(),
  locale: z.string(),
  theme: z.string(),
  preferred_audio: z.array(z.string()),
  preferred_subtitles: z.array(z.string()),
  autoplay: z.boolean(),
  hide_spoilers: z.boolean(),
  notify_replies: z.boolean(),
  can_switch_tracks: z.boolean(),
});
export const policySchema = z.object({
  account_id: z.string(),
  audience: z.enum(["general", "teen", "young-adult", "adult"]),
  age: z.enum(["all", "7+", "10+", "13+", "16+", "18+"]),
  sexuality_risk: z.enum(["none", "low", "medium", "high"]),
  behavioral_risk: z.enum(["none", "low", "medium", "high"]),
  theology_risk: z.enum(["none", "low", "medium", "high"]),
});
export const capabilitySchema = z.object({ account_id: z.string(), capability: z.string() });

export const accountKinds = { admin: "إداري", family: "عائلي", personal: "شخصي" };
export const accountStatuses = { active: "نشط", invited: "بانتظار التفعيل", suspended: "موقوف" };
export const roles = { owner: "مالك الخادم", admin: "مدير", member: "عضو", editor: "محرّر" };
export function roleLabel(role: string) {
  return Object.entries(roles).find(([key]) => key === role)?.[1] ?? role;
}
export { formatAdminDate as dateLabel } from "../format";
const recordSchemas = {
  accounts: accountSchema,
  auth_users: identitySchema,
  devices: deviceSchema,
  auth_sessions: sessionSchema,
  account_invites: inviteSchema,
  account_preferences: preferenceSchema,
  account_content_policies: policySchema,
  account_admin_restrictions: policySchema,
  account_capabilities: capabilitySchema,
};
export function recordOptions(table: string, page = 1, q = "", column?: string) {
  return queryOptions({
    queryKey: ["admin", "accounts-workspace", table, page, q, column],
    queryFn: async ({ signal }) => {
      const data = await gateway.databaseRows(
        table,
        page,
        column ? "" : q,
        signal,
        column ? { column, value: q } : undefined,
      );
      const schema = Object.entries(recordSchemas).find(([key]) => key === table)?.[1];
      if (schema) for (const row of data.rows) schema.parse(row);
      return data;
    },
    staleTime: 15000,
    retry: false,
  });
}
export function identityOptions(userId: string | null) {
  return queryOptions({
    ...recordOptions("auth_users", 1, userId ?? "", "id"),
    enabled: Boolean(userId),
    select: (data) =>
      data.rows.map((row) => identitySchema.parse(row)).find((row) => row.id === userId) ?? null,
  });
}
export const capabilityChoices = [
  { value: "catalog.view", label: "عرض المكتبة" },
  { value: "catalog.edit", label: "تحرير الأعمال" },
  { value: "people.edit", label: "إدارة الأشخاص" },
  { value: "studios.edit", label: "إدارة الاستوديوهات" },
  { value: "awards.edit", label: "إدارة الجوائز" },
  { value: "accounts.manage", label: "إدارة الحسابات" },
  { value: "policies.manage", label: "إدارة السياسات" },
  { value: "social.moderate", label: "مراجعة التفاعلات" },
  { value: "media.manage", label: "إدارة الوسائط" },
  { value: "analytics.view", label: "عرض الإحصاءات" },
] as const;
export const activityChoices = [
  { value: "account_title_states", label: "المفضلة وحالة الأعمال" },
  { value: "account_playback_states", label: "تقدّم المشاهدة" },
  { value: "account_view_history", label: "سجل المشاهدة" },
  { value: "title_reviews", label: "المراجعات" },
  { value: "title_comments", label: "التعليقات" },
  { value: "collections", label: "المجموعات" },
  { value: "saved_views", label: "طرق العرض المحفوظة" },
  { value: "title_follows", label: "متابعة الأعمال" },
  { value: "account_downloads", label: "التنزيلات المسجّلة" },
  { value: "notifications", label: "الإشعارات" },
] as const;

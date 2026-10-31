import { z } from "zod";

export const sections = [
  { id: "account", label: "الحساب والأمان", description: "حسابات الجهاز وكلمة المرور" },
  { id: "appearance", label: "المظهر", description: "واجهة التطبيق ولغتها وحجم النص" },
  { id: "playback", label: "التشغيل", description: "الصوت والمشغّل وجودة الفيديو" },
  { id: "subtitles", label: "الترجمة", description: "اللغات والمظهر وOpenSubtitles" },
  { id: "sources", label: "المصادر والاتصالات", description: "مصادر الفيديو والتكاملات" },
  { id: "extensions", label: "الإضافات", description: "مصادر Stremio ومراجعة الصلاحيات" },
  { id: "storage", label: "التنزيلات والتخزين", description: "مكتبة الجهاز والذاكرة المؤقتة" },
  { id: "offline", label: "دون اتصال والمزامنة", description: "الأعمال المحفوظة وتتبع المشاهدة" },
  { id: "connection", label: "الخادم والاتصال", description: "الاتصال والثقة بالخادم" },
  { id: "administration", label: "إدارة الخادم", description: "إعدادات المكتبة المشتركة والوصول" },
  { id: "help", label: "المساعدة والتشخيص", description: "الإصدارات والتحديثات والتقارير" },
] as const;
export const sectionSchema = z.enum(sections.map((section) => section.id));
export const clientInfoSchema = z.object({
  version: z.string(),
  platform: z.literal("linux"),
  serverVersion: z.string(),
  apiVersion: z.number().int(),
  videoRoot: z.string(),
  capabilities: z.object({
    nativePlayback: z.literal(true),
    offlineLibrary: z.literal(true),
    artworkVariants: z.boolean(),
    rememberedAccounts: z.boolean(),
    subtitleSearch: z.literal(false),
    debrid: z.literal(false),
  }),
});
export const artworkCacheSchema = z.object({
  bytes: z.number().nonnegative(),
  budgetBytes: z.number().positive(),
  metrics: z.object({
    requests: z.number().nonnegative(),
    cacheHits: z.number().nonnegative(),
    networkBytes: z.number().nonnegative(),
    queueMicros: z.number().nonnegative(),
    responseMicros: z.number().nonnegative(),
  }),
});
export function diagnosticReport(
  info: z.infer<typeof clientInfoSchema>,
  cache?: z.infer<typeof artworkCacheSchema>,
) {
  // An explicit allowlist keeps account identities, URLs, tokens and storage paths out of exports.
  return JSON.stringify(
    {
      app: "Nahhasio",
      version: info.version,
      platform: info.platform,
      serverVersion: info.serverVersion,
      apiVersion: info.apiVersion,
      capabilities: info.capabilities,
      artwork: cache
        ? { bytes: cache.bytes, budgetBytes: cache.budgetBytes, metrics: cache.metrics }
        : null,
    },
    null,
    2,
  );
}

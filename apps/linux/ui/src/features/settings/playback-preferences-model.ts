import { z } from "zod";

export const trackLanguage = z.enum(["auto", "ar", "en", "ja", "ko", "fr", "es"]);
export const subtitleColor = z.enum(["white", "yellow"]);
const trackDelay = z.number().finite().min(-600).max(600);
export const playbackPreferencesSchema = z.strictObject({
  version: z.literal(1),
  startupVolume: z.number().finite().min(0).max(100).default(100),
  startupSpeed: z.number().finite().min(0.25).max(4).default(1),
  audioLanguage: trackLanguage,
  audioDelay: trackDelay.default(0),
  subtitleLanguage: trackLanguage,
  subtitlesEnabled: z.boolean(),
  subtitleSize: z.number().finite().min(10).max(120),
  subtitlePosition: z.number().finite().min(0).max(100),
  subtitleDelay: trackDelay.default(0),
  subtitleColor: subtitleColor.default("white"),
  subtitleBackground: z.boolean().default(false),
  subtitleBold: z.boolean().default(false),
});
export type PlaybackPreferencesData = z.infer<typeof playbackPreferencesSchema>;
// Keep the browser preview and reset aligned with client-core's device defaults.
export const playbackPreferencesDefaults = playbackPreferencesSchema.parse({
  version: 1,
  audioLanguage: "auto",
  subtitleLanguage: "ar",
  subtitlesEnabled: true,
  subtitleSize: 55,
  subtitlePosition: 100,
});

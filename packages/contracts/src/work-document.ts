import { z } from "zod";
const scoreValue = z.number().min(0).max(10).nullable();
export const languageCode = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);
export const languageCodes = z
  .array(languageCode)
  .max(30)
  .refine((values) => new Set(values).size === values.length, "Language codes must be unique");
export const trailerDocument = z.object({
  id: z.string().uuid().optional(),
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string().max(300).optional(),
  language: languageCode.nullable().optional(),
  isPrimary: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});

export const episodeDocument = z.object({
  id: z.string().uuid().optional(),
  number: z.number().positive(),
  position: z.number().int().min(0).optional(),
  title: z.string().nullable().optional(),
  summary: z.string().optional(),
  releaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  runtimeMinutes: z.number().int().min(0).nullable().optional(),
  media: z.partialRecord(z.enum(["still", "poster", "banner"]), z.string().nullable()).optional(),
});

export const installmentDocument = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["season", "movie", "special"]).default("season"),
  position: z.number().int().min(0).optional(),
  title: z.string().min(1),
  summary: z.string().optional(),
  status: z.enum(["announced", "airing", "completed", "unknown"]).optional(),
  releaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  runtimeMinutes: z.number().int().min(0).nullable().optional(),
  audienceOverride: z.string().nullable().optional(),
  ageOverride: z.string().nullable().optional(),
  sexualityRiskOverride: z.string().nullable().optional(),
  behavioralRiskOverride: z.string().nullable().optional(),
  theologyRiskOverride: z.string().nullable().optional(),
  // A movie's IMDb id lives here, on its installment — not on the umbrella title. See the
  // player/torrent roadmap's Phase 0.
  tmdbId: z.number().int().positive().nullable().optional(),
  imdbId: z
    .string()
    .regex(/^tt\d{7,10}$/)
    .nullable()
    .optional(),
  anilistId: z.number().int().positive().nullable().optional(),
  malId: z.number().int().positive().nullable().optional(),
  score: z
    .object({
      story: scoreValue.optional(),
      characters: scoreValue.optional(),
      depth: scoreValue.optional(),
      worldBuilding: scoreValue.optional(),
      originality: scoreValue.optional(),
      craft: scoreValue.optional(),
    })
    .optional(),
  media: z.record(z.string(), z.string().nullable()).optional(),
  episodes: z.array(episodeDocument).optional(),
});

export const creditDocument = z.object({
  entity: z.string().min(1),
  role: z.string().min(1),
  isPrimary: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  languages: languageCodes.optional(),
});

export const awardDocument = z.object({
  id: z.string().uuid().optional(),
  ceremonyId: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  organization: z.string().min(1),
  category: z.string().min(1),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  result: z.enum(["winner", "nominee"]),
  installment: z.union([z.number().int(), z.string()]).nullable().optional(),
  isFeatured: z.boolean().optional(),
  sourceUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const workDocument = z.object({
  id: z.string().uuid().optional(),
  canonicalTitle: z.string().min(1),
  sortTitle: z.string().optional(),
  titleAr: z.string().nullable().optional(),
  summary: z.string().optional(),
  contentWarnings: z.string().nullable().optional(),
  analysisNotes: z.string().nullable().optional(),
  curatorNotes: z.string().optional(),
  releaseYear: z.number().int().min(1800).max(2200).nullable().optional(),
  // Animated vs. live action — the only half of the four-way catalog type that is a real
  // column (`titles.format`). The other half (movie vs. series) is derived from whether the
  // title ends up with a `season` installment, so it is never set directly here.
  format: z.enum(["animated", "live-action"]).optional(),
  isPrivate: z.boolean().optional(),
  workflowStatus: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(),
  playbackPolicy: z.enum(["torrents-allowed", "files-only"]).optional(),
  dubLanguages: languageCodes.optional(),
  dubbingNotes: z.string().max(20000).optional(),
  trailers: z.array(trailerDocument).max(30).optional(),
  qualityScore: z.number().int().min(0).optional(),
  audience: z.enum(["general", "teen", "young-adult", "adult"]).optional(),
  age: z.enum(["all", "7+", "10+", "13+", "16+", "18+"]).optional(),
  sexualityRisk: z.enum(["none", "low", "medium", "high"]).optional(),
  behavioralRisk: z.enum(["none", "low", "medium", "high"]).optional(),
  theologyRisk: z.enum(["none", "low", "medium", "high"]).optional(),
  // A franchise title's own ids (AniList/MAL); a movie installment carries its own
  // tmdbId/imdbId separately (see `installmentDocument`).
  tmdbId: z.number().int().positive().nullable().optional(),
  imdbId: z
    .string()
    .regex(/^tt\d{7,10}$/)
    .nullable()
    .optional(),
  anilistId: z.number().int().positive().nullable().optional(),
  malId: z.number().int().positive().nullable().optional(),
  aliases: z.array(z.string().min(1)).optional(),
  // Ordered — unlike `aliases`, position is meaningful (see the arcadia-cataloging skill's
  // "الأصل والقصة" / "المكان" / "حقائق بارزة" convention). Applying replaces the whole list, in
  // the order given.
  trivia: z.array(z.string().min(1)).optional(),
  genres: z.array(z.string().min(1)).optional(),
  tones: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
  countries: z.array(z.string().min(1)).optional(),
  planets: z.array(z.string().min(1)).max(1).optional(),
  credits: z.array(creditDocument).optional(),
  externalIds: z
    .array(
      z.object({
        provider: z.string().min(1),
        externalId: z.string().min(1),
        url: z.string().nullable().optional(),
      }),
    )
    .optional(),
  relations: z
    .array(
      z.object({
        target: z.string().min(1),
        kind: z.enum([
          "sequel",
          "adaptation",
          "spin-off",
          "side-story",
          "compilation",
          "alternative",
          "related",
        ]),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  media: z.record(z.string(), z.string().nullable()).optional(),
  installments: z.array(installmentDocument).optional(),
  awards: z.array(awardDocument).optional(),
});

export type WorkDocument = z.infer<typeof workDocument>;

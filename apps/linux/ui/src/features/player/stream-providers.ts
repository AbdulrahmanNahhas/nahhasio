import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

import { nativeCall } from "@/lib/bridge";

import type { WatchTarget } from "./watch-request";

const ProviderIdSchema = z.enum([
  "vidsrc",
  "vidlink",
  "vidfast",
  "vidrock",
  "vidnest",
  "vidhawk",
  "cinezo",
  "vidsrcto",
  "superembed",
  "mapple",
  "vixsrc",
  "vidcore",
  "vidzee",
  "cinextream",
  "nontongo",
  "vidapi",
  "primesrc",
]);
const SupportSchema = z.enum(["unknown", "reported", "documented", "notseen"]);
export const CapabilitySchema = z.object({
  subtitles: SupportSchema,
  arabic: SupportSchema,
  upload: SupportSchema,
});
export type ProviderCapabilities = z.infer<typeof CapabilitySchema>;
export const ProviderOfferSchema = z.object({
  provider: ProviderIdSchema,
  name: z.string().max(80),
  audio: z.enum(["dub", "sub", "original"]),
  available: z.boolean(),
  reason: z.string().nullable(),
  tier: z.enum(["tested", "trial", "issues"]).default("trial"),
  notes: z.array(z.string().max(500)).max(8).default([]),
  capabilities: CapabilitySchema.optional(),
  preferred: z.boolean().default(false),
});
export type ProviderOffer = z.infer<typeof ProviderOfferSchema>;
const ProviderListingSchema = z.object({
  filesOnly: z.boolean(),
  anime: z.boolean(),
  providers: z.array(ProviderOfferSchema).max(30),
});
export type ProviderListing = z.infer<typeof ProviderListingSchema>;
export const EmbedStatusSchema = z.object({
  provider: ProviderIdSchema,
  audio: z.enum(["dub", "sub", "original"]),
  sessionId: z.string().nullable(),
  phase: z.enum(["closed", "loading", "loaded", "failed"]),
  blockedPopups: z.number().int().nonnegative(),
  error: z.string().nullable(),
  filterReady: z.boolean().optional(),
});
export type EmbedStatus = z.infer<typeof EmbedStatusSchema>;
export const embedStatusKey = (sessionId: string) => ["native", "embed", sessionId] as const;
export const offerKey = (offer: ProviderOffer) => `${offer.provider}:${offer.audio}`;
const catalogTarget = (target: WatchTarget) => ({
  workId: target.workId,
  installmentId: target.installmentId ?? null,
  episodeId: target.episodeId ?? null,
});

export function providerOptions(sessionId: string, target: WatchTarget | null) {
  return queryOptions({
    queryKey: [
      "native",
      "embed-providers",
      sessionId,
      target?.workId,
      target?.installmentId,
      target?.episodeId,
    ],
    queryFn: async ({ signal }) => {
      if (!target) throw new Error("اختر عملًا أولًا.");
      return ProviderListingSchema.parse(
        await nativeCall("stream.providers", { sessionId, target: catalogTarget(target) }, signal),
      );
    },
    enabled: Boolean(sessionId && target),
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
    networkMode: "always",
  });
}

export function embedStatusOptions(sessionId: string) {
  return queryOptions({
    queryKey: embedStatusKey(sessionId),
    queryFn: async ({ signal }) =>
      EmbedStatusSchema.parse(await nativeCall("stream.status", { sessionId }, signal)),
    enabled: Boolean(sessionId),
    refetchInterval: (query) =>
      query.state.data?.phase === "loading"
        ? 1000
        : query.state.data?.phase === "loaded"
          ? 5000
          : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: false,
    networkMode: "always",
  });
}

export async function openEmbed(sessionId: string, offer: ProviderOffer, target: WatchTarget) {
  return EmbedStatusSchema.parse(
    await nativeCall("stream.open", {
      sessionId,
      provider: offer.provider,
      audio: offer.audio,
      target: catalogTarget(target),
    }),
  );
}

export async function embedAction(sessionId: string, action: "close" | "present") {
  return EmbedStatusSchema.parse(await nativeCall(`stream.${action}`, { sessionId }));
}

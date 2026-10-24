import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { nativeCall } from "@/lib/bridge";

import { PlayerSnapshotSchema, type PlayerSnapshot } from "./bridge";
import { playerSnapshotKey, type PlayerController } from "./use-player-snapshot";
import type { WatchTarget } from "./watch-request";

const TargetSchema = z.object({
  workId: z.string().uuid(),
  installmentId: z.string().uuid(),
  episodeId: z.string().uuid().nullable(),
  title: z.string(),
});
const FileSchema = z.object({
  index: z.number().int().min(0).max(4294967295),
  path: z.string().max(4096),
  size: z.number().finite().nonnegative(),
});
export const CandidateSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  label: z.string(),
  release: z.string(),
  resolution: z.number().int().nullable(),
  codec: z.string().nullable(),
  hdr: z.boolean(),
  sizeBytes: z.number().finite().nonnegative().nullable(),
  seeders: z.number().int().nonnegative().nullable(),
  reportedLanguages: z.array(z.string()),
  available: z.boolean(),
});
export type SourceCandidate = z.infer<typeof CandidateSchema>;

export const SourcesSchema = z.object({
  target: TargetSchema,
  candidates: z.array(CandidateSchema).max(200),
});
const PlaySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("playing"), snapshot: PlayerSnapshotSchema }),
  z.object({ mode: z.literal("downloading"), target: TargetSchema }),
  z.object({
    mode: z.literal("choose_file"),
    files: z.array(FileSchema).max(10000),
    target: TargetSchema,
  }),
]);
export const choiceKey = (sessionId: string) => ["native", "files", sessionId] as const;
export type FileChoice = Extract<z.infer<typeof PlaySchema>, { mode: "choose_file" }> & {
  sourceId: string;
};

export function sourceOptions(sessionId: string, target: WatchTarget) {
  return queryOptions({
    queryKey: [
      "native",
      "sources",
      sessionId,
      target.workId,
      target.installmentId ?? null,
      target.episodeId ?? null,
      target.intent ?? "watch",
    ] as const,
    queryFn: async ({ signal }) =>
      SourcesSchema.parse(
        await nativeCall(
          target.intent === "download" ? "media.downloadSearch" : "media.search",
          {
            sessionId,
            target: {
              workId: target.workId,
              installmentId: target.installmentId ?? null,
              episodeId: target.episodeId ?? null,
            },
          },
          signal,
        ),
      ),
    staleTime: 60000,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    networkMode: "always",
  });
}

export async function playSource(
  client: QueryClient,
  sessionId: string,
  sourceId: string,
  fileIndex?: number,
  intent: "watch" | "download" = "watch",
) {
  if (
    intent === "watch" &&
    client.getQueryData<PlayerSnapshot>(playerSnapshotKey)?.sessionId !== sessionId
  ) {
    throw new Error("انتهت جلسة هذا الفيديو.");
  }
  const reply = PlaySchema.parse(
    await nativeCall(
      intent === "download" ? "media.download" : "media.play",
      { sessionId, sourceId, fileIndex: fileIndex ?? null },
      undefined,
      60000,
    ),
  );
  const current = client.getQueryData<PlayerSnapshot>(playerSnapshotKey);
  if (intent === "watch" && current?.sessionId !== sessionId)
    throw new Error("انتهت جلسة هذا الفيديو.");
  if (reply.mode === "playing") {
    if (reply.snapshot.sessionId !== sessionId) throw new Error("وصل تحديث قديم للمشغّل.");
    client.removeQueries({ queryKey: choiceKey(sessionId), exact: true });
    client.setQueryData(playerSnapshotKey, reply.snapshot);
  } else if (reply.mode === "downloading") {
    client.removeQueries({ queryKey: choiceKey(sessionId), exact: true });
    await client.invalidateQueries({ queryKey: ["native", "downloads"] });
  } else {
    client.setQueryData<FileChoice>(choiceKey(sessionId), { ...reply, sourceId });
  }
  if (intent === "watch")
    await client.invalidateQueries({ queryKey: playerSnapshotKey, exact: true });
  return reply;
}

export async function openWatch(
  target: WatchTarget,
  player: Pick<PlayerController, "commandAsync">,
  client: QueryClient,
) {
  const snapshot = await player.commandAsync({
    command: "player.preview",
    payload: { title: target.title },
  });
  if (!snapshot.sessionId) throw new Error("تعذّر فتح جلسة المشغّل.");
  const sessionId = snapshot.sessionId;
  if (client.getQueryData<PlayerSnapshot>(playerSnapshotKey)?.sessionId !== sessionId) return;
  if (target.intent !== "download") {
    const local = z
      .discriminatedUnion("found", [
        z.object({ found: z.literal(false) }),
        z.object({ found: z.literal(true), snapshot: PlayerSnapshotSchema }),
      ])
      .parse(
        await nativeCall("media.local", {
          sessionId,
          target: {
            workId: target.workId,
            installmentId: target.installmentId ?? null,
            episodeId: target.episodeId ?? null,
          },
        }),
      );
    if (client.getQueryData<PlayerSnapshot>(playerSnapshotKey)?.sessionId !== sessionId) return;
    if (local.found) {
      if (local.snapshot.sessionId !== sessionId) throw new Error("وصل تحديث قديم للمشغّل.");
      client.setQueryData(playerSnapshotKey, local.snapshot);
      return;
    }
  }
  // Discovery is lazy: opening a work must not depend on Torrentio or contact an embed provider.
  // Each provider starts only after the viewer chooses its source type.
}

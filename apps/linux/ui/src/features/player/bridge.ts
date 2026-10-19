import { z } from "zod";

import { nativeCall } from "@/lib/bridge";

const finite = z.number().finite();
const sessionId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/);
const kind = z.enum(["audio", "subtitle"]);
const trackId = finite.int().min(1).max(2147483647);
const volume = finite.min(0).max(100);
const speed = finite.min(0.25).max(4);
const delay = finite.min(-600).max(600);
const subtitleSize = finite.min(10).max(120);
const subtitlePosition = finite.min(0).max(100);
const session = { sessionId };

export const PlayerTrackSchema = z.object({
  id: trackId,
  kind,
  title: z.string().nullable(),
  language: z.string().nullable(),
  codec: z.string().nullable(),
  selected: z.boolean(),
  external: z.boolean(),
});

export const PlayerSnapshotSchema = z
  .object({
    active: z.boolean(),
    sessionId: sessionId.nullable(),
    workId: z.string().uuid().nullable().optional(),
    installmentId: z.string().uuid().nullable().optional(),
    episodeId: z.string().uuid().nullable().optional(),
    title: z.string(),
    sourceKind: z.enum(["local", "torrent", "direct"]).nullable(),
    paused: z.boolean(),
    position: finite.min(0),
    duration: finite.min(0),
    seekable: z.boolean(),
    volume,
    muted: z.boolean(),
    speed,
    buffering: z.boolean(),
    ended: z.boolean(),
    fullscreen: z.boolean(),
    audioDelay: delay,
    subtitleDelay: delay,
    subtitleSize,
    subtitlePosition,
    tracks: z.array(PlayerTrackSchema).max(512),
    hwdec: z.string().nullable(),
    videoCodec: z.string().nullable(),
    error: z.string().nullable(),
  })
  .refine((value) => value.active === (value.sessionId !== null), {
    message: "An active player must own a session.",
  });

export const PlayerRequestSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("player.status"), payload: z.strictObject({}) }),
  z.object({ command: z.literal("player.pickVideo"), payload: z.strictObject({}) }),
  z.object({
    command: z.literal("player.preview"),
    payload: z.strictObject({ title: z.string().trim().min(1).max(1024) }),
  }),
  z.object({
    command: z.literal("player.viewport"),
    payload: z.strictObject({
      ...session,
      x: finite.min(-32768).max(32768),
      y: finite.min(-32768).max(32768),
      width: finite.int().min(1).max(16384),
      height: finite.int().min(1).max(16384),
    }),
  }),
  z.object({ command: z.literal("player.close"), payload: z.strictObject(session) }),
  z.object({
    command: z.literal("player.pause"),
    payload: z.strictObject({ ...session, paused: z.boolean() }),
  }),
  z.object({
    command: z.literal("player.seek"),
    payload: z
      .strictObject({
        ...session,
        seconds: finite.min(-2592000).max(2592000),
        relative: z.boolean(),
      })
      .refine((value) => value.relative || value.seconds >= 0),
  }),
  z.object({
    command: z.literal("player.volume"),
    payload: z.strictObject({ ...session, volume }),
  }),
  z.object({
    command: z.literal("player.mute"),
    payload: z.strictObject({ ...session, muted: z.boolean() }),
  }),
  z.object({ command: z.literal("player.speed"), payload: z.strictObject({ ...session, speed }) }),
  z.object({
    command: z.literal("player.track"),
    payload: z.strictObject({ ...session, kind, trackId: trackId.nullable() }),
  }),
  z.object({ command: z.literal("player.pickSubtitle"), payload: z.strictObject(session) }),
  z.object({
    command: z.literal("player.delay"),
    payload: z.strictObject({ ...session, kind, seconds: delay }),
  }),
  z.object({
    command: z.literal("player.subtitleStyle"),
    payload: z.strictObject({ ...session, size: subtitleSize, position: subtitlePosition }),
  }),
  z.object({
    command: z.literal("player.fullscreen"),
    payload: z.strictObject({ enabled: z.boolean() }),
  }),
]);

export type PlayerTrack = z.infer<typeof PlayerTrackSchema>;
export type PlayerSnapshot = z.infer<typeof PlayerSnapshotSchema>;
export type PlayerRequest = z.infer<typeof PlayerRequestSchema>;

export async function callPlayer(
  request: PlayerRequest,
  signal?: AbortSignal,
): Promise<PlayerSnapshot> {
  const { command, payload } = PlayerRequestSchema.parse(request);
  const reply = await nativeCall(command, payload, signal);
  // A cancelled native file dialog may return no change, rather than a snapshot.
  if (reply === null && (command === "player.pickVideo" || command === "player.pickSubtitle")) {
    return PlayerSnapshotSchema.parse(await nativeCall("player.status", {}, signal));
  }
  return PlayerSnapshotSchema.parse(reply);
}

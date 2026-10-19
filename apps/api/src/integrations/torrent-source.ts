import { createHash } from "node:crypto";

import type { StreamCandidate, StreamQuality } from "@arcadia/contracts";
import { z } from "zod";

/**
 * The family's Torrentio-compatible Stremio addon (see `docs/player-torrent-roadmap.md`, "The
 * stream source"). Discovery lives here rather than in the desktop shell so the server URL — and
 * any future debrid key — stays out of a shipped binary, the account visibility check happens
 * where the session already is, and one addon call serves every family member who opens the same
 * film.
 *
 * Best-effort like the other integrations: a missing configuration or a failed request yields
 * `null`, never a thrown error. `null` means "the source didn't answer"; an empty array means
 * "the source answered, and has nothing" — the route turns those into different HTTP codes
 * because the player UI has to tell the family which one happened.
 */

const defaultTimeoutMs = 8_000;
const defaultCacheTtlMs = 15 * 60 * 1_000;
/**
 * Ranking prefers the highest resolution at or below this height, and treats anything above it
 * as a last resort. A 4K remux is 40 GB and will not reach first frame inside the roadmap's 15 s
 * budget on a family connection, so "highest resolution wins" would quietly break the stated
 * performance target.
 */
const defaultPreferredHeight = 1080;
const cacheEntryLimit = 256;

/**
 * Reads an env var, tolerating surrounding quotes.
 *
 * `.env` may legitimately quote its values, and the two loaders in play disagree about them:
 * Node's `process.loadEnvFile` strips the quotes, devenv's dotenv exports them literally. The same
 * file therefore yields `https://host` under `pnpm dev` and `"https://host"` under `devenv up` —
 * which silently produced a malformed request URL and a failure that looked exactly like the addon
 * being unreachable. Stripping here makes both paths agree.
 */
export function readEnvValue(name: string) {
  const raw = process.env[name]?.trim();
  if (!raw) return "";
  const quoted =
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")));
  return quoted ? raw.slice(1, -1).trim() : raw;
}

/** Warned about once per process, so a misconfiguration is loud but does not spam every request. */
let warnedAboutBaseUrl = false;

function readConfig() {
  const baseUrl = readEnvValue("NAHHASIO_STREAM_ADDON_URL").replace(/\/+$/, "");
  if (!baseUrl) return null;

  let host: string;
  try {
    host = new URL(baseUrl).host;
  } catch {
    // A malformed URL is a deployment mistake, not a provider outage. Saying so beats letting the
    // request fail later with something that reads like "the addon is down".
    if (!warnedAboutBaseUrl) {
      warnedAboutBaseUrl = true;
      console.error(
        `NAHHASIO_STREAM_ADDON_URL is not a valid URL (${JSON.stringify(baseUrl)}); playback is disabled`,
      );
    }
    return null;
  }

  return {
    baseUrl,
    host,
    configSegment: encodeConfigSegment(readEnvValue("NAHHASIO_STREAM_ADDON_CONFIG")),
    timeoutMs: positiveIntEnv("NAHHASIO_STREAM_TIMEOUT_MS", defaultTimeoutMs),
    cacheTtlMs: positiveIntEnv("NAHHASIO_STREAM_CACHE_TTL_MS", defaultCacheTtlMs),
  };
}

function positiveIntEnv(name: string, fallback: number) {
  const parsed = Number(readEnvValue(name));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function streamSourceConfigured() {
  return readConfig() !== null;
}

/** Whether `tmdb:`-prefixed ids may be sent at all — see the roadmap's open question about it. */
export function tmdbStreamIdsAllowed() {
  return readEnvValue("NAHHASIO_STREAM_ALLOW_TMDB_IDS") === "true";
}

/**
 * Torrentio's config is pipe-separated `key=value` options inside one path segment, with the
 * pipes percent-encoded. `=` and `,` are legal path characters and Torrentio expects them
 * literally, so only the separator is encoded — `encodeURIComponent` over the whole segment
 * would mangle it.
 */
export function encodeConfigSegment(raw: string) {
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("%7C");
}

export function buildStreamUrl(input: {
  baseUrl: string;
  configSegment: string;
  type: "movie" | "series";
  id: string;
}) {
  const config = input.configSegment ? `/${input.configSegment}` : "";
  return `${input.baseUrl}${config}/stream/${input.type}/${input.id}.json`;
}

/** `candidates` are the addon's answer as parsed, **unranked** — every caller applies its own
 *  `rankCandidates(candidates, preferredAudio)` on top, since two family members asking for the
 *  same film with different audio preferences must see different orderings from one shared entry. */
type CacheEntry = { expiresAt: number; candidates: StreamCandidate[] };
const responseCache = new Map<string, CacheEntry>();

/** Exposed for tests; the TTL makes stale entries harmless in a running process. */
export function clearStreamCache() {
  responseCache.clear();
}

function readCache(key: string) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }
  return entry.candidates;
}

function writeCache(key: string, candidates: StreamCandidate[], ttlMs: number) {
  if (responseCache.size >= cacheEntryLimit) {
    for (const [oldest] of responseCache) {
      responseCache.delete(oldest);
      break;
    }
  }
  responseCache.set(key, { expiresAt: Date.now() + ttlMs, candidates });
}

/**
 * The addon's wire shape, parsed at the boundary rather than probed field by field downstream.
 *
 * Every field carries `.catch()`, so one malformed value degrades to `null` instead of discarding
 * the whole stream — a provider that changes its wording, or omits `sources`, or writes a size it
 * cannot compute, must not take the response down with it. A stream that is not an object at all
 * becomes `null` and is dropped.
 */
const optionalText = z.string().trim().min(1).nullish().catch(null);

const rawBehaviorHintsSchema = z
  .object({
    bingeGroup: optionalText,
    filename: optionalText,
    videoSize: z.number().int().positive().nullish().catch(null),
    videoHash: optionalText,
  })
  .catch({ bingeGroup: null, filename: null, videoSize: null, videoHash: null });

const rawStreamSchema = z.object({
  name: z.string().catch(""),
  /** Deprecated in favour of `description`, but Torrentio still sends it. */
  title: optionalText,
  description: optionalText,
  infoHash: z
    .string()
    .regex(/^[0-9a-fA-F]{40}$/)
    .transform((hash) => hash.toLowerCase())
    .nullish()
    .catch(null),
  fileIdx: z.number().int().min(0).nullish().catch(null),
  url: z.string().url().nullish().catch(null),
  // A non-string entry collapses to "" and is dropped by the `tracker:` filter below.
  sources: z.array(z.string().catch("")).catch([]),
  behaviorHints: rawBehaviorHintsSchema,
});

export type RawStream = z.infer<typeof rawStreamSchema>;

export const streamEnvelopeSchema = z.object({
  streams: z.array(rawStreamSchema.nullable().catch(null)).default([]),
});

export async function fetchStreamCandidates(input: {
  type: "movie" | "series";
  id: string;
  /** The requesting account's `preferred_audio`, in priority order — see `languagePriorityScore`.
   *  Deliberately **not** part of the cache key: the cache holds the addon's raw, unranked
   *  answer, and every account's own ranking is applied fresh on top of it, so two family members
   *  with different preferences never see each other's ordering. */
  preferredAudio?: readonly string[];
}): Promise<StreamCandidate[] | null> {
  const config = readConfig();
  if (!config) return null;

  const cacheKey = `${config.baseUrl}|${config.configSegment}|${input.type}|${input.id}`;
  const cached = readCache(cacheKey);
  if (cached) return rankCandidates(cached, input.preferredAudio ?? []);

  const url = buildStreamUrl({
    baseUrl: config.baseUrl,
    configSegment: config.configSegment,
    type: input.type,
    id: input.id,
  });

  let body: unknown;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      // Logged because the alternative is a silent 502 that looks identical whether the addon is
      // down, blocked, or simply misconfigured. The host and status are enough to tell those
      // apart; the config segment is deliberately not logged, since it will carry a debrid key
      // once Phase 6 lands.
      console.warn(`stream source ${config.host} answered ${response.status} for ${input.id}`);
      return null;
    }
    body = await response.json();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.warn(`stream source ${config.host} unreachable: ${reason}`);
    return null;
  }

  const envelope = streamEnvelopeSchema.safeParse(body);
  if (!envelope.success) return null;

  const parsed = parseStreams(envelope.data.streams);
  writeCache(cacheKey, parsed, config.cacheTtlMs);
  return rankCandidates(parsed, input.preferredAudio ?? []);
}

/**
 * Maps parsed addon streams onto typed candidates, dropping any that carry neither an `infoHash`
 * nor a `url` — there is nothing to play. Quality, seeders and size exist only as
 * emoji-annotated free text, so reading them is a heuristic that has to survive a provider
 * rewording its descriptions.
 */
export function parseStreams(streams: Array<RawStream | null>): StreamCandidate[] {
  const parsed: StreamCandidate[] = [];
  for (const raw of streams) {
    const candidate = raw && parseStream(raw);
    if (candidate) parsed.push(candidate);
  }
  return parsed;
}

function parseStream(stream: RawStream): StreamCandidate | null {
  const infoHash = stream.infoHash ?? null;
  const url = stream.url ?? null;
  if (!infoHash && !url) return null;

  const description = stream.description ?? stream.title ?? null;
  // Absent per spec means "the largest file in the torrent" — a rule only the desktop shell can
  // apply, since it needs the torrent metadata this endpoint never fetches.
  const fileIdx = stream.fileIdx ?? null;
  const hints = stream.behaviorHints;
  const haystack = `${stream.name}\n${description ?? ""}`;
  const quality = parseQuality(haystack);

  return {
    id: infoHash
      ? `${infoHash}:${fileIdx ?? "auto"}`
      : `direct:${createHash("sha256").update(String(url)).digest("hex").slice(0, 16)}`,
    kind: infoHash ? "torrent" : "direct",
    label: stream.name.split("\n").map(collapse).filter(Boolean).join(" · "),
    description,
    infoHash,
    fileIdx,
    url: infoHash ? null : url,
    filename: hints.filename ?? null,
    trackers: parseTrackers(stream.sources),
    bingeGroup: hints.bingeGroup ?? null,
    videoSize: hints.videoSize ?? null,
    videoHash: hints.videoHash ?? null,
    quality: quality.quality,
    height: quality.height,
    seeders: parseSeeders(haystack),
    sizeBytes: parseSize(haystack),
    provider: parseProvider(haystack),
    isEnglish: looksEnglish(haystack),
    languages: detectLanguages(haystack),
  };
}

function collapse(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * `sources` carries the tracker list. Every `tracker:` entry has to become a `&tr=` on the
 * magnet or peer discovery falls back to DHT alone and start-up is slow or fails outright.
 * `dht:` entries need no handling — librqbit's own DHT covers them.
 */
export function parseTrackers(sources: string[]): string[] {
  const trackers = new Set<string>();
  for (const entry of sources) {
    if (!entry.startsWith("tracker:")) continue;
    const tracker = entry.slice("tracker:".length).trim();
    if (/^(https?|udp|wss?):\/\/\S+$/i.test(tracker)) trackers.add(tracker);
  }
  return [...trackers];
}

/** The vertical resolution behind a quality label; `null` where the label implies none. */
interface ParsedQuality {
  quality: StreamQuality;
  height: number | null;
}

const qualityPatterns: Array<{ pattern: RegExp } & ParsedQuality> = [
  // Checked first: a "CAM 720p" release is a cam, whatever else the name claims.
  { pattern: /\b(cam|camrip|hdcam|telesync|hdts)\b/i, quality: "cam", height: null },
  { pattern: /\b(2160p|4k|uhd)\b/i, quality: "2160p", height: 2160 },
  { pattern: /\b1440p\b/i, quality: "1440p", height: 1440 },
  { pattern: /\b1080p\b/i, quality: "1080p", height: 1080 },
  { pattern: /\b720p\b/i, quality: "720p", height: 720 },
  { pattern: /\b480p\b/i, quality: "480p", height: 480 },
  { pattern: /\b360p\b/i, quality: "360p", height: 360 },
];

export function parseQuality(text: string): ParsedQuality {
  for (const entry of qualityPatterns) {
    if (entry.pattern.test(text)) return { quality: entry.quality, height: entry.height };
  }
  return { quality: "unknown", height: null };
}

export function parseSeeders(text: string): number | null {
  const emoji = text.match(/👤\s*([\d,]+)/u);
  const worded = emoji ? null : text.match(/(\d[\d,]*)\s*seeders?\b/i);
  const raw = emoji?.[1] ?? worded?.[1];
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function bytesPerUnit(prefix: string): number | null {
  switch (prefix.toLowerCase()) {
    case "":
      return 1;
    case "k":
      return 1024;
    case "m":
      return 1024 ** 2;
    case "g":
      return 1024 ** 3;
    case "t":
      return 1024 ** 4;
    default:
      return null;
  }
}

export function parseSize(text: string): number | null {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(T|G|M|K)?i?B\b/i);
  if (!match?.[1]) return null;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const multiplier = bytesPerUnit(match[2] ?? "");
  if (!multiplier) return null;
  const bytes = Math.round(amount * multiplier);
  return bytes > 0 ? bytes : null;
}

export function parseProvider(text: string): string | null {
  const match = text.match(/⚙️?\s*([^\s\n]+)/u);
  return match?.[1] ?? null;
}

/** Flag emoji → ISO 639-1 code, for every country flag Torrentio is known to prefix a release
 *  with. Several codes have more than one flag (Arabic-speaking countries, Spanish-speaking
 *  ones) — any of them is as good a signal as another. */
const flagLanguages = new Map<string, string>([
  ["🇬🇧", "en"],
  ["🇺🇸", "en"],
  ["🇦🇺", "en"],
  ["🇨🇦", "en"],
  ["🇮🇪", "en"],
  ["🇳🇿", "en"],
  ["🇸🇦", "ar"],
  ["🇦🇪", "ar"],
  ["🇪🇬", "ar"],
  ["🇮🇶", "ar"],
  ["🇲🇦", "ar"],
  ["🇶🇦", "ar"],
  ["🇯🇵", "ja"],
  ["🇪🇸", "es"],
  ["🇲🇽", "es"],
  ["🇦🇷", "es"],
  ["🇷🇺", "ru"],
  ["🇫🇷", "fr"],
  ["🇩🇪", "de"],
  ["🇮🇹", "it"],
  ["🇮🇳", "hi"],
  ["🇰🇷", "ko"],
  ["🇵🇹", "pt"],
  ["🇧🇷", "pt"],
  ["🇹🇷", "tr"],
  ["🇵🇱", "pl"],
  ["🇳🇱", "nl"],
  ["🇨🇳", "zh"],
  ["🇮🇷", "fa"],
]);

/** Same language set as the flags above, reached through the addon's free-text words instead. */
const wordLanguages: ReadonlyArray<{ pattern: RegExp; code: string }> = [
  { pattern: /\b(english|eng)\b/i, code: "en" },
  { pattern: /\barabic\b/i, code: "ar" },
  { pattern: /\bjapanese\b/i, code: "ja" },
  { pattern: /\bspanish\b/i, code: "es" },
  { pattern: /\brussian\b/i, code: "ru" },
  { pattern: /\bfrench\b/i, code: "fr" },
  { pattern: /\bgerman\b/i, code: "de" },
  { pattern: /\bitalian\b/i, code: "it" },
  { pattern: /\bhindi\b/i, code: "hi" },
  { pattern: /\btamil\b/i, code: "ta" },
  { pattern: /\btelugu\b/i, code: "te" },
  { pattern: /\bkorean\b/i, code: "ko" },
  { pattern: /\bportuguese\b/i, code: "pt" },
  { pattern: /\bturkish\b/i, code: "tr" },
  { pattern: /\bpolish\b/i, code: "pl" },
  { pattern: /\bdutch\b/i, code: "nl" },
  { pattern: /\bchinese\b/i, code: "zh" },
  { pattern: /\b(persian|farsi)\b/i, code: "fa" },
];

/** Named but not tied to one specific language — almost always includes an English track, so it
 *  widens the "at least English" signal rather than naming a code of its own. */
const multiAudioWords = /\bmulti\b|\bdual\s?audio\b/i;

/**
 * Every language this candidate's free-text name/description claims to carry, best-effort — the
 * addon exposes no structured field, so this reads flag emoji first (Torrentio's own convention
 * for prefixing non-English audio) and language words second. A release naming no language and no
 * "multi"/"dual audio" defaults to English alone: `language=` in the addon config is a *priority*,
 * not a filter, so an unannotated release is the default English one far more often than not.
 */
export function detectLanguages(text: string): string[] {
  const found = new Set<string>();
  const flags = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu) ?? [];
  for (const flag of flags) {
    const code = flagLanguages.get(flag);
    if (code) found.add(code);
  }
  for (const { pattern, code } of wordLanguages) {
    if (pattern.test(text)) found.add(code);
  }
  if (multiAudioWords.test(text)) found.add("en");
  if (found.size === 0) found.add("en");
  return [...found];
}

/** Kept as a thin wrapper — `rankCandidates`'s default (no account preference recorded yet) still
 *  reduces to this same English-first question. */
export function looksEnglish(text: string): boolean {
  return detectLanguages(text).includes("en");
}

function preferredHeight() {
  return positiveIntEnv("NAHHASIO_STREAM_PREFERRED_HEIGHT", defaultPreferredHeight);
}

/**
 * Zero reported seeders is the one signal that reliably predicts "this will never reach first
 * frame", so such a candidate sinks below everything else whatever its resolution.
 */
function isReachable(candidate: StreamCandidate) {
  return candidate.kind === "direct" || candidate.seeders === null || candidate.seeders > 0 ? 1 : 0;
}

function resolutionScore(height: number | null, preferred: number) {
  if (height === null) return 0;
  return height <= preferred ? 10_000 + height : 5_000 - height;
}

/**
 * Lower is better. With no configured preference this reduces to the original rule — an
 * English-carrying candidate (`languages.includes("en")`, true for the vast majority of
 * unannotated releases per `detectLanguages`'s own default) outranks one that doesn't. With a
 * preference recorded (`account_preferences.preferred_audio`, in priority order — e.g. `["en",
 * "ar", "es"]`), a candidate ranks by the *earliest* preferred language it carries; one that
 * carries none of them ranks after every candidate that carries at least one, but still ahead of
 * nothing — resolution/seeders/size still get the final say among same-scored candidates.
 */
function languagePriorityScore(candidate: StreamCandidate, preferredAudio: readonly string[]) {
  if (preferredAudio.length === 0) return candidate.languages.includes("en") ? 0 : 1;
  const index = preferredAudio.findIndex((language) => candidate.languages.includes(language));
  return index === -1 ? preferredAudio.length : index;
}

/**
 * Language → resolution → seeders → size, per the roadmap, with two guards in front of it:
 * a `direct` (debrid) source beats every torrent because it needs no peers at all, and a source
 * the addon reports as having zero seeders sinks to the bottom whatever its resolution — it is
 * the one signal that reliably predicts "this will never reach first frame".
 *
 * Codec is deliberately never a ranking or filtering key: mpv decodes everything ffmpeg does.
 */
export function rankCandidates(
  candidates: StreamCandidate[],
  preferredAudio: readonly string[] = [],
): StreamCandidate[] {
  const preferred = preferredHeight();
  // The spread already copies, so nothing is mutated; `toSorted` needs a newer lib target than
  // this package compiles against.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...candidates].sort((left: StreamCandidate, right: StreamCandidate) => {
    const byDirect = Number(right.kind === "direct") - Number(left.kind === "direct");
    if (byDirect) return byDirect;
    const byAlive = isReachable(right) - isReachable(left);
    if (byAlive) return byAlive;
    const byLanguage =
      languagePriorityScore(left, preferredAudio) - languagePriorityScore(right, preferredAudio);
    if (byLanguage) return byLanguage;
    const byResolution =
      resolutionScore(right.height, preferred) - resolutionScore(left.height, preferred);
    if (byResolution) return byResolution;
    const bySeeders = (right.seeders ?? -1) - (left.seeders ?? -1);
    if (bySeeders) return bySeeders;
    // Same resolution and the same peer health: the smaller file reaches first frame sooner.
    return (
      (left.sizeBytes ?? Number.POSITIVE_INFINITY) - (right.sizeBytes ?? Number.POSITIVE_INFINITY)
    );
  });
}

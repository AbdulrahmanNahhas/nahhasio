import {
  WorkActivityPageSchema,
  WorkDetailSchema,
  WorkViewerStateSchema,
} from "@nahhasio/api-contract";
import type {
  Classification,
  CommentMutation,
  CommentChanged,
  RecommendationPage,
  Episode,
  Installment,
  Session,
  ViewerUnitState,
  Vocabulary,
  WatchSummary,
  WorkActivityItem,
  WorkActivityPage,
  WorkDetail,
  WorkViewerState,
  ServerMediaFile,
  DeviceMediaBatchResult,
} from "@nahhasio/api-contract";
import { expect, test as baseTest } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import type { z } from "zod";

import type { PlayerSnapshot } from "../src/features/player/bridge";
import type { librarySchema } from "../src/features/player/download-data";
import { offlineStatusSchema } from "../src/features/player/saved-works-data";
import type { EmbedStatus, ProviderListing } from "../src/features/player/stream-providers";

const test = baseTest.extend<{
  adminProfile: boolean;
  longSeason: boolean;
  legacyDiscussion: boolean;
}>({
  adminProfile: [true, { option: true }],
  longSeason: [false, { option: true }],
  legacyDiscussion: [false, { option: true }],
});

const inactivePlayer: PlayerSnapshot = {
  active: false,
  sessionId: null,
  title: "",
  sourceKind: null,
  paused: true,
  position: 0,
  duration: 0,
  seekable: false,
  volume: 75,
  muted: false,
  speed: 1,
  buffering: false,
  ended: false,
  fullscreen: false,
  audioDelay: 0,
  subtitleDelay: 0,
  subtitleSize: 55,
  subtitlePosition: 100,
  tracks: [],
  hwdec: null,
  videoCodec: null,
  error: null,
};
const id = (number: number) => `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const workId = id(1);
const workTitle = "مغامرات المكتبة";
const seasonId = id(2);
const futureSeasonId = id(3);
const movieId = id(4);
const timestamp = "2026-10-09T12:00:00Z";
const classification: Classification = {
  audience: "teen",
  age: "13+",
  sexualityRisk: "none",
  behavioralRisk: "low",
  theologyRisk: "medium",
};
const externalIds = { tmdbId: null, imdbId: null, anilistId: null, malId: null };
const summary = Array.from(
  { length: 12 },
  (_, index) => `الفصل ${index + 1}: تستكشف العائلة دروب المكتبة وتتعلم معنى الصداقة والمسؤولية.`,
).join("\n");
const episode = (number: number, future = false): Episode => ({
  id: id(100 + number),
  number: number <= 2 ? `${number}.00` : number === 9 ? "9.5" : String(number),
  position: number,
  title: number === 3 ? null : `رحلة الحلقة ${number}`,
  summary: `نبذة الحلقة ${number}: رحلة طويلة في المكتبة، مع تفاصيل محفوظة لا تختصر في نافذة التفاصيل.`,
  releaseDate: future ? "2099-01-01" : "2021-01-01",
  runtimeMinutes: 24,
  releaseState: future ? "upcoming" : "released",
  hasMediaFile: false,
  classification,
  artwork: [],
  mediaFiles: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});
const installment = (overrides: Partial<Installment>): Installment => ({
  id: seasonId,
  kind: "season",
  position: 1,
  title: "الموسم الأول",
  summary: "حكاية الموسم الأول",
  releaseDate: "2021-01-01",
  runtimeMinutes: null,
  status: "airing",
  externalIds,
  scores: {
    story: 8,
    characters: 8,
    depth: 8,
    worldBuilding: 8,
    originality: 8,
    craft: 8,
    updatedAt: timestamp,
  },
  hasMediaFile: false,
  artwork: [],
  episodes: [],
  classification,
  classificationOverrides: {
    audience: null,
    age: null,
    sexualityRisk: null,
    behavioralRisk: null,
    theologyRisk: null,
  },
  releaseState: "released",
  externalReferences: [],
  mediaFiles: [],
  createdAt: timestamp,
  updatedAt: timestamp,
  ...overrides,
});
const term = (number: number, labelAr: string, slug: string): Vocabulary => ({
  id: id(number),
  slug,
  labelAr,
  labelEn: `English ${slug}`,
  descriptionAr: "",
  descriptionEn: "",
});
const work: WorkDetail = {
  id: workId,
  canonicalTitle: "The family library",
  titleAr: workTitle,
  sortTitle: "The family library",
  dubLanguages: ["ar", "en"],
  dubbingNotes: "دبلجة عربية مسجّلة للمكتبة.",
  trailers: [
    {
      id: id(901),
      position: 1,
      youtubeVideoId: "abcdefghijk",
      title: "الإعلان الأول",
      language: "ar",
      isPrimary: false,
    },
    {
      id: id(902),
      position: 2,
      youtubeVideoId: "lmnopqrstuv",
      title: "الإعلان الرئيسي",
      language: "en",
      isPrimary: true,
    },
  ],
  summary,
  releaseYear: 2021,
  format: "animated",
  ...classification,
  sexualityRisk: "low",
  behavioralRisk: "medium",
  theologyRisk: "high",
  isPrivate: false,
  score: { rating: 8, scored: 2, total: 3 },
  poster: null,
  banner: null,
  logo: null,
  installmentCount: 3,
  episodeCount: 11,
  contentWarnings: "مشاهد توتر قصيرة تستدعي مرافقة الوالدين.",
  analysisNotes: "قراءة نقدية تميز الحكاية الخيالية عن الاعتقاد.",
  curatorNotes: "ملاحظة محفوظة للأسرة.",
  qualityScore: 80,
  verifiedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  externalIds: { tmdbId: 1234, imdbId: "tt1234567", anilistId: 2345, malId: 3456 },
  externalReferences: [
    {
      id: id(40),
      provider: "موقع الحكاية",
      externalId: "family-library",
      url: "https://example.test/library",
    },
    { id: id(41), provider: "مرجع غير آمن", externalId: "unsafe", url: "javascript:alert(1)" },
    {
      id: id(42),
      provider: "IMDb مكرر",
      externalId: "tt1234567",
      url: "https://www.imdb.com/title/tt1234567/",
    },
  ],
  aliases: [
    { id: id(43), title: "اسم بديل لا يعرض هنا", language: "ar", script: "Arab", isPreferred: true },
  ],
  trivia: ["استغرق إعداد الحكاية عامًا كاملًا."],
  genres: [term(20, "مغامرة", "adventure"), term(21, "", "untranslated-genre")],
  tones: [term(22, "متفائل", "optimistic")],
  tags: [term(23, "", "untranslated-tag")],
  countries: [],
  planets: [
    {
      id: id(44),
      slug: "family-fantasy",
      nameAr: "الخيال العائلي",
      nameEn: "Family fantasy",
      icon: "🪄",
      description: "حكايات خيالية تجمع الأسرة وتفتح باب الاكتشاف.",
      primaryColor: "#c6a7ff",
      secondaryColor: "#332454",
      featuredRank: 1,
    },
  ],
  artwork: [
    {
      id: id(45),
      role: "poster",
      isPrimary: true,
      url: "",
      mimeType: "image/png",
      width: 1,
      height: 1,
      byteSize: 68,
      sha256: "fixture-artwork",
      originalFilename: "removed-work-art.png",
      focalX: 50,
      focalY: 50,
    },
  ],
  awards: [],
  relations: [],
  contributions: [
    {
      id: id(30),
      name: "ليلى الكاتبة",
      kind: "person",
      role: "writer",
      roleLabelAr: "كتابة",
      roleLabelEn: "Writer",
      description: "كاتبة الحكاية",
      roleDescriptionAr: "تأليف القصة",
      roleDescriptionEn: "Story writing",
      roleId: id(31),
      aliases: [{ alias: "ليلى المؤلفة", language: "ar" }],
      artwork: [],
      isPrimary: true,
      position: 1,
    },
    {
      id: id(32),
      name: "استوديو المكتبة",
      kind: "organization",
      role: "production",
      roleLabelAr: "إنتاج",
      roleLabelEn: "Production",
      description: "جهة إنتاج حكايات العائلة",
      roleDescriptionAr: "تنفيذ الرسوم وإنتاج الموسم",
      roleDescriptionEn: "Animation production",
      roleId: id(33),
      aliases: [],
      artwork: [],
      isPrimary: false,
      position: 2,
    },
  ],
  installments: [
    installment({
      episodes: Array.from({ length: 9 }, (_, index) => episode(index + 1, index >= 7)),
    }),
    installment({
      id: futureSeasonId,
      position: 2,
      title: "الموسم القادم",
      status: "announced",
      releaseDate: "2099-01-01",
      releaseState: "upcoming",
      scores: null,
      episodes: [episode(10, true), episode(11, true)],
    }),
    installment({
      id: movieId,
      kind: "movie",
      position: 3,
      title: "فيلم المكتبة",
      status: "completed",
      runtimeMinutes: 90,
    }),
  ],
};
const units: ViewerUnitState[] = work.installments.flatMap((item) =>
  (item.kind === "season" ? item.episodes : [null]).map((itemEpisode) => ({
    stateId: itemEpisode?.position === 2 ? id(202) : null,
    installmentId: item.id,
    episodeId: itemEpisode?.id ?? null,
    isReleased: (itemEpisode?.releaseState ?? item.releaseState) === "released",
    positionSeconds: itemEpisode?.position === 2 ? 120 : 0,
    durationSeconds: itemEpisode?.position === 2 ? 1440 : null,
    isPlayed: false,
    playedManually: false,
    playedAt: null,
    subtitleOffsetMs: itemEpisode?.position === 2 ? -250 : null,
    updatedAt: itemEpisode?.position === 2 ? timestamp : null,
  })),
);
function summarize(items: ViewerUnitState[]): WatchSummary {
  const released = items.filter((unit) => unit.isReleased);
  const watched = released.filter((unit) => unit.isPlayed).length;
  const fullyWatched = released.length > 0 && watched === released.length;
  return {
    catalogUnits: items.length,
    releasedUnits: released.length,
    watchedReleasedUnits: watched,
    isFullyWatched: fullyWatched,
    watchState: fullyWatched
      ? "watched"
      : items.some((unit) => unit.isPlayed || unit.positionSeconds > 0)
        ? "in-progress"
        : "unwatched",
  };
}
const initialState: WorkViewerState = {
  workId,
  isFavorite: false,
  units,
  summary: summarize(units),
  installments: work.installments.map((item) => ({
    installmentId: item.id,
    summary: summarize(units.filter((unit) => unit.installmentId === item.id)),
  })),
};
const activity: WorkActivityItem[] = Array.from({ length: 21 }, (_, index) => ({
  id: id(300 + index),
  kind: index === 0 ? "review" : "comment",
  body:
    index === 0
      ? "المفاجأة السرية في نهاية الموسم. <script>window.spoilerExecuted = true</script>"
      : `تعليق العائلة ${index}`,
  containsSpoilers: index === 0,
  rating: index === 0 ? 4 : null,
  parentId: index === 20 ? id(301) : null,
  author: { id: id(400 + index), displayName: `فرد العائلة ${index}`, avatarKey: "default" },
  createdAt: timestamp,
  updatedAt: timestamp,
}));

type BridgeRequest = {
  id: string;
  command: string;
  payload: {
    id?: string;
    workId?: string;
    installmentId?: string | null;
    episodeId?: string | null;
    isPlayed?: boolean;
    isFavorite?: boolean;
    page?: number;
    includeOwnReview?: boolean;
    operation?: string;
    title?: string;
    sessionId?: string;
    data?: CommentMutation;
    width?: number;
    height?: number;
    fileIds?: string[];
    target?: { episodeId?: string | null };
  };
};
type WorkPageFixture = {
  requests: BridgeRequest[];
  state: WorkViewerState;
  favoriteOutcome: "accept" | "retain" | "fail";
  holdFavorite: boolean;
  releaseFavorite: () => void;
  failWatched: boolean;
  homeFiles: boolean;
  deviceUnavailable: boolean;
  savedEpisode: { workId: string; installmentId: string; episodeId: string } | null;
};
declare global {
  interface Window {
    workPageFixture: WorkPageFixture;
  }
}

async function installBridge(
  page: Page,
  testWork: WorkDetail = work,
  isAdmin = true,
  legacyDiscussion = false,
) {
  // Fail closed: these journeys must never fall through to a real catalog API.
  await page.route("**/api/**", (route) => route.abort());
  await page.addInitScript(
    ({
      fixtureWork,
      fixtureState,
      fixtureActivity,
      fixturePlayer,
      fixtureAdmin,
      legacyDiscussion: fixtureLegacyDiscussion,
    }) => {
      let playback = fixturePlayer;
      let playbackGeneration = 0;

      const fixture: WorkPageFixture = {
        requests: [],
        state: structuredClone(fixtureState),
        favoriteOutcome: "accept",
        holdFavorite: false,
        releaseFavorite: () => {},
        failWatched: false,
        homeFiles: false,
        deviceUnavailable: false,
        savedEpisode: null,
      };
      window.workPageFixture = fixture;
      const summaryFor = (installmentId?: string): WatchSummary => {
        const items = fixture.state.units.filter(
          (unit) => !installmentId || unit.installmentId === installmentId,
        );
        const released = items.filter((unit) => unit.isReleased);
        const watched = released.filter((unit) => unit.isPlayed).length;
        const fullyWatched = released.length > 0 && watched === released.length;
        return {
          catalogUnits: items.length,
          releasedUnits: released.length,
          watchedReleasedUnits: watched,
          isFullyWatched: fullyWatched,
          watchState: fullyWatched
            ? "watched"
            : items.some((unit) => unit.isPlayed || unit.positionSeconds > 0)
              ? "in-progress"
              : "unwatched",
        };
      };
      window.webkit = {
        messageHandlers: {
          nahhasio: {
            postMessage(message: string) {
              // SAFETY: only the application's typed gateway sends messages to this isolated fixture.
              const request = JSON.parse(message) as BridgeRequest;
              fixture.requests.push(request);
              const success = (
                result:
                  | PlayerSnapshot
                  | EmbedStatus
                  | ProviderListing
                  | CommentChanged
                  | z.infer<typeof librarySchema>
                  | { found: false }
                  | { found: true; snapshot: PlayerSnapshot }
                  | { target: NonNullable<WorkPageFixture["savedEpisode"]>; available: boolean }[]
                  | []
                  | Session
                  | WorkDetail
                  | WorkViewerState
                  | WorkActivityPage
                  | RecommendationPage
                  | { result: [] }
                  | {
                      result: {
                        revision: string;
                        document: {
                          id: string;
                          canonicalTitle: string;
                          titleAr: string | null;
                          summary: string;
                        };
                      }[];
                    }
                  | ServerMediaFile[]
                  | DeviceMediaBatchResult
                  | z.infer<typeof offlineStatusSchema>,
              ) =>
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: true,
                    result: JSON.parse(JSON.stringify(result)),
                  }),
                );
              const failure = (errorMessage: string, code = "fixture_failure") =>
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { code, message: errorMessage },
                  }),
                );
              switch (request.command) {
                case "homeMedia": {
                  const part = fixtureWork.installments[0];
                  success(
                    fixture.homeFiles && part
                      ? part.episodes.slice(0, 2).map<ServerMediaFile>((mediaEpisode, index) => ({
                          id: `90000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
                          workId: fixtureWork.id,
                          workTitle: fixtureWork.canonicalTitle,
                          installmentId: part.id,
                          installmentTitle: part.title,
                          episodeId: mediaEpisode.id,
                          episodeTitle: mediaEpisode.title,
                          episodeNumber: mediaEpisode.number,
                          relativePath: `series/episode-${index}.mp4`,
                          byteSize: 1000,
                          durationSeconds: 60,
                          availability: "present",
                          revision: "fixture",
                          probeMetadata: {},
                          sha256: "a".repeat(64),
                          lastVerifiedAt: null,
                          isTrashed: false,
                          trashExpiresAt: null,
                        }))
                      : [],
                  );
                  return;
                }
                case "media.homeDownloadBatch":
                  success(
                    (request.payload.fileIds ?? []).map((fileId) => ({
                      id: fileId,
                      queued: true,
                      error: null,
                    })),
                  );
                  return;
                case "player.status":
                case "player.viewport":
                  success(playback);
                  return;
                case "player.preview":
                  playback = {
                    ...fixturePlayer,
                    active: true,
                    sessionId: `watch-fixture-${++playbackGeneration}`,
                    title: request.payload.title ?? "اختبار",
                  };
                  success(playback);
                  return;
                case "player.pickVideo":
                  playback = {
                    ...fixturePlayer,
                    active: true,
                    sessionId: `local-fixture-${++playbackGeneration}`,
                    title: "Frieren.mkv",
                    sourceKind: "local",
                    duration: 1440,
                    seekable: true,
                  };
                  success(playback);
                  return;
                case "player.close":
                  playback = { ...fixturePlayer };
                  success(playback);
                  return;
                case "media.local":
                  if (
                    fixture.savedEpisode &&
                    request.payload.target?.episodeId === fixture.savedEpisode.episodeId
                  ) {
                    playback = {
                      ...playback,
                      ...fixture.savedEpisode,
                      sourceKind: "local",
                      paused: false,
                      duration: 1440,
                      position: 120,
                      seekable: true,
                    };
                    success({ found: true, snapshot: playback });
                    return;
                  }
                  success({ found: false });
                  return;
                case "media.library":
                  if (fixture.deviceUnavailable) {
                    failure("Device inventory unavailable");
                    return;
                  }
                  success({ files: [], root: "fixture", usedBytes: 0, freeBytes: 1024 });
                  return;
                case "media.jobs":
                  success([]);
                  return;
                case "media.saved":
                  success(
                    fixture.savedEpisode ? [{ target: fixture.savedEpisode, available: true }] : [],
                  );
                  return;
                case "stream.status":
                  success({
                    provider: "vidsrc",
                    audio: "original",
                    sessionId: null,
                    phase: "closed",
                    blockedPopups: 0,
                    error: null,
                  });
                  return;
                case "stream.providers":
                  success({
                    filesOnly: fixtureWork.playbackPolicy === "files-only",
                    anime: true,
                    providers: [
                      {
                        provider: "vidsrc",
                        name: "VidSrc",
                        audio: "original",
                        available: true,
                        reason: null,
                        tier: "tested",
                        preferred: false,
                        notes: [],
                      },
                    ],
                  });
                  return;
                case "media.search":
                  playback = {
                    ...playback,
                    workId: fixtureWork.id,
                    installmentId: request.payload.installmentId ?? fixtureWork.installments[0]?.id,
                    episodeId:
                      request.payload.episodeId ?? fixtureWork.installments[0]?.episodes[0]?.id,
                  };
                  failure("تعذّر الوصول إلى Custom. أعد المحاولة لاحقًا.");
                  return;
                case "workComment": {
                  const data = request.payload.data;
                  if (!data) {
                    failure("Missing comment");
                    return;
                  }
                  const commentId = data.commentId ?? crypto.randomUUID();
                  if (data.action === "create")
                    fixtureActivity.unshift({
                      id: commentId,
                      kind: data.kind ?? "comment",
                      body: data.body ?? "",
                      containsSpoilers: data.containsSpoilers ?? false,
                      rating: data.rating ?? null,
                      parentId: data.parentId ?? null,
                      author: {
                        id: "00000000-0000-4000-8000-000000000001",
                        displayName: "العائلة",
                        avatarKey: "default",
                      },
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    });
                  if (data.action === "update") {
                    const item = fixtureActivity.find((entry) => entry.id === commentId);
                    if (item) {
                      item.body = data.body ?? "";
                      item.containsSpoilers = data.containsSpoilers ?? false;
                      if (item.kind === "review") item.rating = data.rating ?? null;
                    }
                  }
                  if (data.action === "delete") {
                    const index = fixtureActivity.findIndex((item) => item.id === commentId);
                    if (index >= 0) fixtureActivity.splice(index, 1);
                  }
                  success({ id: commentId, deleted: data.action === "delete" });
                  return;
                }
                case "session":
                  success({
                    user: {
                      id: "fixture-owner",
                      name: "العائلة",
                      email: "fixture@example.test",
                      role: fixtureAdmin ? "owner" : "member",
                      accountId: "00000000-0000-4000-8000-000000000001",
                      kind: fixtureAdmin ? "admin" : "family",
                      avatarKey: "nahhasio-library.svg",
                      bio: "",
                      isAdmin: fixtureAdmin,
                      updatedAt: "2026-10-12T00:00:00.000000Z",
                    },
                    expiresAt: "2099-10-09T00:00:00Z",
                  });
                  return;
                case "editorCall": {
                  if (fixtureAdmin && request.payload.operation === "vocabulary") {
                    success({ result: [] });
                    return;
                  }
                  if (!fixtureAdmin || request.payload.operation !== "read") {
                    failure("Unexpected editor operation");
                    return;
                  }
                  success({
                    result: [
                      {
                        revision: "f".repeat(64),
                        document: {
                          id: fixtureWork.id,
                          canonicalTitle: fixtureWork.canonicalTitle,
                          titleAr: fixtureWork.titleAr,
                          summary: fixtureWork.summary,
                        },
                      },
                    ],
                  });
                  return;
                }
                case "offline.status":
                  success({
                    scope: null,
                    active: false,
                    offline: false,
                    name: null,
                    pending: 0,
                    conflicts: [],
                    job: null,
                  });
                  return;
                case "recommendations": {
                  const items = Array.from({ length: 10 }, (_, index) => ({
                    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
                    canonicalTitle: `Recommendation ${index + 1}`,
                    titleAr: `اقتراح ${index + 1}`,
                    summary: "",
                    isPrivate: false,
                    score: fixtureWork.score,
                    releaseYear: 2026,
                    format: fixtureWork.format,
                    audience: fixtureWork.audience,
                    age: fixtureWork.age,
                    poster: null,
                    banner: null,
                    logo: null,
                    installmentCount: 1,
                    episodeCount: 12,
                  }));
                  success({
                    items,
                    basis: "related",
                    algorithm: "work-affinity-v1",
                    matches: items.map((item) => ({
                      workId: item.id,
                      percentage: 80,
                      reasons: [
                        {
                          key: "genres",
                          label: "الأنواع الفنية",
                          weight: 22,
                          similarity: 80,
                          shared: ["مغامرة"],
                        },
                      ],
                    })),
                  });
                  return;
                }
                case "work":
                  success(fixtureWork);
                  return;
                case "workState":
                  success(fixture.state);
                  return;
                case "setFavorite": {
                  const respond = () => {
                    if (fixture.favoriteOutcome === "fail") {
                      failure("تعذّر حفظ المفضلة في الخادم التجريبي");
                      return;
                    }
                    if (fixture.favoriteOutcome === "accept")
                      fixture.state.isFavorite = Boolean(request.payload.isFavorite);
                    success(fixture.state);
                  };
                  if (fixture.holdFavorite) fixture.releaseFavorite = respond;
                  else respond();
                  return;
                }
                case "setWatched":
                  if (fixture.failWatched) {
                    failure("تعذّر حفظ المشاهدة في الخادم التجريبي");
                    return;
                  }
                  fixture.state.units = fixture.state.units.map((unit) => {
                    if (
                      (request.payload.installmentId &&
                        unit.installmentId !== request.payload.installmentId) ||
                      (request.payload.episodeId && unit.episodeId !== request.payload.episodeId)
                    )
                      return unit;
                    return {
                      ...unit,
                      isPlayed: Boolean(request.payload.isPlayed),
                      playedManually: Boolean(request.payload.isPlayed),
                      playedAt: request.payload.isPlayed ? "2026-10-09T12:00:00Z" : null,
                    };
                  });
                  fixture.state.summary = summaryFor();
                  fixture.state.installments = fixture.state.installments.map((item) => ({
                    ...item,
                    summary: summaryFor(item.installmentId),
                  }));
                  success(fixture.state);
                  return;
                case "workActivity": {
                  if (fixtureLegacyDiscussion && request.payload.includeOwnReview) {
                    failure("Invalid discussion query", "bad_request");
                    return;
                  }
                  const pageNumber = request.payload.page ?? 1;
                  success({
                    workId: fixtureWork.id,
                    items: fixtureActivity.slice((pageNumber - 1) * 20, pageNumber * 20),
                    total: fixtureActivity.length,
                    page: pageNumber,
                    pageSize: 20,
                    ...(request.payload.includeOwnReview && {
                      ownReview:
                        fixtureActivity.find(
                          (item) =>
                            item.kind === "review" &&
                            item.author.id === "00000000-0000-4000-8000-000000000001",
                        ) ?? null,
                    }),
                  });
                  return;
                }
                default:
                  failure(`Unexpected work-page fixture command: ${request.command}`);
              }
            },
          },
        },
      };
    },
    {
      fixtureWork: testWork,
      fixtureState: initialState,
      fixtureActivity: activity,
      fixturePlayer: inactivePlayer,
      fixtureAdmin: isAdmin,
      legacyDiscussion,
    },
  );
}
async function openWork(page: Page, query = "") {
  await page.goto(`/#/titles/${workId}${query}`);
  await expect(page.getByRole("heading", { name: workTitle, level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "المزيد من إجراءات العمل" })).toBeVisible();
}
async function openEpisodes(page: Page) {
  await page.getByRole("heading", { name: "الحلقات", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("article", { name: "الحلقة 1", exact: true })).toBeVisible();
}
const episodeCard = (page: Page, number: number) =>
  page.getByRole("article", { name: `الحلقة ${number}`, exact: true });
const currentState = (page: Page) => page.evaluate(() => window.workPageFixture.state);
const requests = (page: Page, command: string) =>
  page.evaluate(
    (filterCommand) =>
      window.workPageFixture.requests
        .filter((request) => request.command === filterCommand)
        .map((request) => request.payload),
    command,
  );
async function expectNoOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("The viewing shell must expose #main-content");
    return {
      body: document.body.scrollWidth,
      viewport: window.innerWidth,
      scroll: main.scrollWidth,
      available: main.clientWidth,
    };
  });
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.available);
}
async function expectFocusInside(dialog: Locator) {
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
}

test.beforeEach(async ({ page, adminProfile, longSeason, legacyDiscussion }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  WorkDetailSchema.parse(work);
  WorkViewerStateSchema.parse(initialState);
  WorkActivityPageSchema.parse({
    workId,
    items: activity.slice(0, 20),
    total: 21,
    page: 1,
    pageSize: 20,
  });
  const fixture = longSeason
    ? {
        ...work,
        installments: work.installments.map((part) =>
          part.id === seasonId
            ? { ...part, episodes: [...part.episodes, episode(12), episode(13)] }
            : part,
        ),
      }
    : work;
  await installBridge(page, fixture, adminProfile, legacyDiscussion);
});

test("administrator opens the existing editor on the Work route and keeps a draft when exit is cancelled", async ({
  page,
}) => {
  await openWork(page);
  await page.getByRole("button", { name: "تحرير العمل", exact: true }).click();
  await expect(page).toHaveURL(/edit=1/);
  const title = page.getByRole("textbox", { name: "العنوان العربي" });
  await expect(title).toHaveValue(workTitle);
  await title.fill("مسودة محلية");
  await page.getByRole("tab", { name: "الجوائز", exact: true }).click();
  await expect(page).toHaveURL(/edit=1&section=awards/);
  await page.getByRole("tab", { name: "نظرة عامة", exact: true }).click();
  await expect(title).toHaveValue("مسودة محلية");
  await page.getByRole("button", { name: "العودة إلى عرض العمل" }).click();
  const leave = page.getByRole("alertdialog", { name: "تغييرات غير محفوظة" });
  await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "العودة للمحرر" }).click();
  await expect(title).toHaveValue("مسودة محلية");
  await page.getByRole("button", { name: "العودة إلى عرض العمل" }).click();
  await leave.getByRole("button", { name: "تجاهل ومغادرة" }).click();
  await expect(page.getByRole("button", { name: "تحرير العمل" })).toBeVisible();
  expect(await requests(page, "editorCall")).toContainEqual({
    operation: "read",
    data: { ids: [workId] },
  });
});

test.describe("family viewer", () => {
  test.use({ adminProfile: false });
  test("a viewer cannot open edit mode with a Work page URL", async ({ page }) => {
    await openWork(page, "?edit=1");
    await expect(page.getByRole("button", { name: "تحرير العمل", exact: true })).toHaveCount(0);
    expect(await requests(page, "editorCall")).toEqual([]);
  });
});

test("favorite uses returned server state, blocks pending duplicates, and recovers from failure", async ({
  page,
}) => {
  await openWork(page);
  await page.getByRole("button", { name: "المزيد من إجراءات العمل" }).click();
  const favorite = page.getByRole("menuitemcheckbox", { name: /^(إضافة إلى|إزالة من) المفضلة$/ });
  await expect(favorite).toHaveAccessibleName("إضافة إلى المفضلة");
  await expect(favorite).toBeEnabled();
  await page.evaluate(() => {
    const fixture = window.workPageFixture;
    fixture.favoriteOutcome = "retain";
    fixture.holdFavorite = true;
  });
  await favorite.click();
  await expect(favorite).toBeDisabled();
  await expect(favorite).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("button", { name: "تحديد العمل كمُشاهَد" })).toBeDisabled();
  expect(await requests(page, "setFavorite")).toEqual([{ workId, isFavorite: true }]);
  await page.evaluate(() => window.workPageFixture.releaseFavorite());
  await expect(favorite).toBeEnabled();
  await expect(favorite).toHaveAttribute("aria-checked", "false");
  await page.evaluate(() => {
    const fixture = window.workPageFixture;
    fixture.favoriteOutcome = "accept";
    fixture.holdFavorite = false;
  });
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-checked", "true");
  await expect(favorite).toHaveAccessibleName("إزالة من المفضلة");
  await expect(favorite.locator("svg")).toHaveClass(/fill-current/);
  await page.evaluate(() => {
    window.workPageFixture.favoriteOutcome = "fail";
  });
  await favorite.click();
  await expect(page.getByRole("alert")).toContainText("تعذّر حفظ المفضلة في الخادم التجريبي");
  await expect(favorite).toBeEnabled();
  await expect(favorite).toHaveAttribute("aria-checked", "true");
  expect((await currentState(page)).isFavorite).toBe(true);
  await page.evaluate(() => {
    window.workPageFixture.favoriteOutcome = "accept";
  });
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await requests(page, "setFavorite")).toEqual([
    { workId, isFavorite: true },
    { workId, isFavorite: true },
    { workId, isFavorite: false },
    { workId, isFavorite: false },
  ]);
});

test("episode watched mutation has exact scope, preserves progress and handles failure", async ({
  page,
}) => {
  await openWork(page);
  await openEpisodes(page);
  const card = episodeCard(page, 2);
  const watched = card.getByRole("button", { name: "تحديد الحلقة 2 كمُشاهَد" });
  expect(
    Number(
      await card.getByRole("progressbar", { name: /تقدم.*الحلقة 2/ }).getAttribute("aria-valuenow"),
    ),
  ).toBeCloseTo((120 / 1440) * 100);
  await watched.click();
  await expect(card.getByRole("button", { name: "إلغاء مشاهدة الحلقة 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card.getByRole("progressbar")).toHaveCount(0);
  expect(await requests(page, "setWatched")).toEqual([
    { workId, installmentId: seasonId, episodeId: id(102), isPlayed: true },
  ]);
  const after = await currentState(page);
  expect(after.units.filter((unit) => unit.isPlayed).map((unit) => unit.episodeId)).toEqual([
    id(102),
  ]);
  expect(after.units.find((unit) => unit.episodeId === id(102))).toMatchObject({
    positionSeconds: 120,
    durationSeconds: 1440,
    subtitleOffsetMs: -250,
    playedManually: true,
  });
  await expect(
    page
      .getByRole("region", { name: "الأجزاء والإصدارات" })
      .getByText("شوهد 1 من 7 حلقة", { exact: true }),
  ).toBeVisible();
  expect(after.summary.watchedReleasedUnits).toBe(1);
  await page.evaluate(() => {
    window.workPageFixture.failWatched = true;
  });
  await card.getByRole("button", { name: "إلغاء مشاهدة الحلقة 2" }).click();
  await expect(page.getByRole("alert")).toContainText("تعذّر حفظ المشاهدة في الخادم التجريبي");
  await expect(card.getByRole("button", { name: "إلغاء مشاهدة الحلقة 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() => {
    window.workPageFixture.failWatched = false;
  });
  await card.getByRole("button", { name: "إلغاء مشاهدة الحلقة 2" }).click();
  await expect(watched).toHaveAttribute("aria-pressed", "false");
  expect(Number(await card.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeCloseTo(
    (120 / 1440) * 100,
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await requests(page, "setWatched")).toEqual([
    { workId, installmentId: seasonId, episodeId: id(102), isPlayed: true },
    { workId, installmentId: seasonId, episodeId: id(102), isPlayed: false },
    { workId, installmentId: seasonId, episodeId: id(102), isPlayed: false },
  ]);
});

for (const scope of ["work", "season"] as const) {
  test(`${scope} watched requires confirmation, cancel writes nothing, and includes future registered units`, async ({
    page,
  }) => {
    await openWork(page);
    await openEpisodes(page);
    const label = scope === "work" ? "العمل" : "الموسم الأول";
    const selection = {
      workId,
      installmentId: scope === "work" ? null : seasonId,
      episodeId: null,
    };
    const mark = page.getByRole("button", { name: `تحديد ${label} كمُشاهَد`, exact: true });
    await mark.click();
    const dialog = page.getByRole("dialog", { name: `تحديد ${label} كمُشاهَد`, exact: true });
    await expect(dialog).toContainText("بما فيها القادمة");
    await expect(dialog).toContainText("لا تغيّر تقدم التشغيل أو حالة الإصدار");
    await expectFocusInside(dialog);
    expect(await requests(page, "setWatched")).toEqual([]);
    await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(mark).toBeFocused();
    expect(await requests(page, "setWatched")).toEqual([]);
    await mark.click();
    await dialog.getByRole("button", { name: "تأكيد التغيير" }).click();
    await expect(dialog).toHaveCount(0);
    const undo = page.getByRole("button", { name: `إلغاء مشاهدة ${label}`, exact: true });
    await expect(undo).toHaveAttribute("aria-pressed", "true");
    expect(await requests(page, "setWatched")).toEqual([{ ...selection, isPlayed: true }]);
    const after = await currentState(page);
    expect(after.units.filter((unit) => unit.isPlayed)).toHaveLength(scope === "work" ? 12 : 9);
    expect(after.units.filter((unit) => !unit.isReleased && unit.isPlayed)).toHaveLength(
      scope === "work" ? 4 : 2,
    );
    expect(after.summary.watchedReleasedUnits).toBe(scope === "work" ? 8 : 7);
    expect(
      after.units.map((unit) => ({
        position: unit.positionSeconds,
        duration: unit.durationSeconds,
        offset: unit.subtitleOffsetMs,
        released: unit.isReleased,
      })),
    ).toEqual(
      initialState.units.map((unit) => ({
        position: unit.positionSeconds,
        duration: unit.durationSeconds,
        offset: unit.subtitleOffsetMs,
        released: unit.isReleased,
      })),
    );
    await expect(episodeCard(page, 8).getByText("قادم", { exact: true })).toBeVisible();
    await expect(
      episodeCard(page, 8).getByRole("button", { name: "إلغاء مشاهدة الحلقة 8" }),
    ).toHaveAttribute("aria-pressed", "true");
    await undo.click();
    const undoDialog = page.getByRole("dialog", { name: `إلغاء مشاهدة ${label}`, exact: true });
    await undoDialog.getByRole("button", { name: "تأكيد التغيير" }).click();
    await expect(undoDialog).toHaveCount(0);
    await expect(mark).toHaveAttribute("aria-pressed", "false");
    expect(await requests(page, "setWatched")).toEqual([
      { ...selection, isPlayed: true },
      { ...selection, isPlayed: false },
    ]);
    expect((await currentState(page)).units.every((unit) => !unit.isPlayed)).toBe(true);
  });
}

test("batch home downloads require explicit selection and confirmation without starting playback", async ({
  page,
}) => {
  await openWork(page);
  await page.evaluate(() => {
    window.workPageFixture.homeFiles = true;
  });
  expect(await requests(page, "media.homeDownloadBatch")).toEqual([]);
  await openEpisodes(page);
  await page.getByRole("button", { name: "تنزيل حلقات من مكتبة المنزل", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "تنزيل فيديوهات إلى هذا الجهاز", exact: true });
  await expect(dialog.getByRole("checkbox")).toHaveCount(2);
  await expect(
    dialog.getByRole("button", { name: "تأكيد التنزيل إلى الجهاز", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "تحديد نسخة لكل حلقة أو فيلم — حتى 100", exact: true })
    .click();
  expect(await requests(page, "media.homeDownloadBatch")).toEqual([]);
  await dialog.getByRole("button", { name: "تأكيد التنزيل إلى الجهاز", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("أُضيف 2 فيديو");
  expect(await requests(page, "media.homeDownloadBatch")).toEqual([
    {
      workId,
      fileIds: ["90000000-0000-4000-8000-000000000001", "90000000-0000-4000-8000-000000000002"],
    },
  ]);
  expect(await requests(page, "player.preview")).toEqual([]);
  expect(await requests(page, "media.play")).toEqual([]);
});

test("released dates and completed film are not watched state or playable availability", async ({
  page,
}) => {
  await openWork(page);
  await openEpisodes(page);
  await expect(
    episodeCard(page, 1).getByRole("button", { name: "تحديد الحلقة 1 كمُشاهَد" }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    episodeCard(page, 8).getByRole("button", { name: "تحديد الحلقة 8 كمُشاهَد" }),
  ).toBeEnabled();
  await expect(episodeCard(page, 8).getByText("قادم", { exact: true })).toBeVisible();
  await expect(episodeCard(page, 1).getByRole("button", { name: "تشغيل الحلقة 1" })).toBeEnabled();
  await page.getByRole("button", { name: "الموسم الأول", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /^فيلم المكتبة/ }).click();
  await expect(
    page.getByRole("region", { name: "الأجزاء والإصدارات" }).getByText("مكتمل", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "تحديد فيلم المكتبة كمُشاهَد" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "تشغيل الإصدار" })).toBeEnabled();
  expect(await requests(page, "setWatched")).toEqual([]);
});

test("season selection lives in the URL, survives reload, and keeps all episodes without search", async ({
  page,
}) => {
  await openWork(page, `?installment=${futureSeasonId}`);
  await expect(page.getByRole("region", { name: "الأجزاء والإصدارات" })).toBeVisible();
  await expect(episodeCard(page, 10)).toBeVisible();
  await expect(episodeCard(page, 1)).toHaveCount(0);
  await page.getByRole("button", { name: "الموسم القادم", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /^الموسم الأول 9 حلقة$/ }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${seasonId}$`));
  await expect(page.getByRole("textbox", { name: "ابحث في الحلقات" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "الأجزاء والإصدارات" }).getByRole("article"),
  ).toHaveCount(9);
  await expect(episodeCard(page, 7)).toBeVisible();
  await page.getByRole("button", { name: "الموسم الأول", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /^الموسم القادم 2 حلقة/ }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${futureSeasonId}$`));
  await page.reload();
  await expect(episodeCard(page, 10)).toBeVisible();
  await expect(episodeCard(page, 11)).toBeVisible();
  await page.getByRole("button", { name: "الموسم القادم", exact: true }).click();
  await page.getByRole("menuitemradio", { name: /^الموسم الأول 9 حلقة$/ }).click();
  await expect(page.getByRole("textbox", { name: "ابحث في الحلقات" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "الأجزاء والإصدارات" }).getByRole("article"),
  ).toHaveCount(9);
});

for (const [width, columns] of [
  [360, 1],
  [480, 1],
  [768, 2],
  [1440, 3],
  [1920, 3],
] as const) {
  test(`populated work ${width}: ${columns}-column episodes and no page overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openWork(page);
    await expectNoOverflow(page);
    await expect(page.getByRole("tablist", { name: "أقسام العمل" })).toHaveCount(0);
    await openEpisodes(page);
    const grid = page.locator('[aria-label="حلقات الجزء"]');
    await expect(grid.getByRole("article")).toHaveCount(9);
    const geometry = await grid.getByRole("article").evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width };
      }),
    );
    const firstRow = geometry.filter((box) => Math.abs(box.y - geometry[0].y) < 2);
    expect(firstRow).toHaveLength(columns);
    expect(geometry[columns].y).toBeGreaterThan(geometry[0].y + 10);
    if (columns > 1) expect(firstRow[0].x).toBeGreaterThan(firstRow[1].x);
    expect(geometry.every((box) => box.width > 100)).toBe(true);
    await expectNoOverflow(page);
    for (const [button, title, drawerSlot] of [
      ["تفاصيل العمل", "تفاصيل العمل", "drawer-content"],
      ["تفاصيل تقييم نحّاسيو", "تقييم نحّاسيو", "drawer-popup"],
    ]) {
      const trigger = page.getByRole("button", { name: button, exact: true });
      await trigger.click();
      const overlay = page.getByRole("dialog", { name: title, exact: true });
      await expect(overlay).toBeVisible();
      await expect(overlay).toHaveAttribute(
        "data-slot",
        width < 768 ? drawerSlot : "dialog-content",
      );
      if (title === "تفاصيل العمل") {
        await expect(overlay.getByRole("button", { name: "إغلاق تفاصيل العمل" })).toHaveCount(
          width < 768 ? 0 : 1,
        );
      } else if (width < 768) {
        await expect(overlay.getByRole("img", { name: /^بصمة المعايير الستة/ })).toHaveCount(0);
      }
      const box = await overlay.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width + 1).toBeTruthy();
      await expectNoOverflow(page);
      if (title === "تفاصيل العمل" && width >= 768) {
        await overlay.getByRole("button", { name: "إغلاق تفاصيل العمل" }).click();
      } else {
        await page.keyboard.press("Escape");
      }
      await expect(overlay).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    await episodeCard(page, 2).getByRole("button", { name: "تفاصيل الحلقة 2" }).click();
    const dialog = page.getByRole("dialog", { name: "2 · رحلة الحلقة 2" });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    if (!bounds) throw new Error("Episode details must have a visible bounding box");
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await expectNoOverflow(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}

test("Arabic badges, meaningful populated headings and no headings for absent metadata", async ({
  page,
}) => {
  await openWork(page);
  const profile = page.locator("#work-sections");
  await expect(profile.getByRole("heading", { name: "الحكاية", exact: true })).toHaveCount(0);
  const overviewSummary = profile.getByText(summary, { exact: true });
  await expect(overviewSummary).toBeVisible();
  expect(
    await overviewSummary.evaluate((element) => element.closest('[data-slot="card"]') === null),
  ).toBe(true);
  await expect(page.getByRole("tab", { name: "العائلة", exact: true })).toHaveCount(0);
  await expect(profile.getByRole("heading", { name: "حقائق ومعلومات", exact: true })).toHaveCount(
    0,
  );
  await expect(profile.getByRole("heading", { name: "تنبيه المحتوى", exact: true })).toHaveCount(0);
  await expect(profile.getByRole("heading", { name: "الأعمال المرتبطة", exact: true })).toHaveCount(
    0,
  );
  const genres = page.getByRole("list", { name: "الأنواع الفنية" });
  await expect(genres).toHaveText("مغامرة");
  await expect(genres.locator("svg")).toHaveCount(1);
  const genreLink = await genres
    .getByRole("link", { name: "مغامرة", exact: true })
    .getAttribute("href");
  expect(genreLink).toMatch(/^#\/browse\?/);
  const genreFilters = new URLSearchParams(genreLink?.split("?")[1]).get("filters");
  expect(JSON.parse(genreFilters ?? "{}").facets).toEqual([
    { key: "genres", include: ["adventure"], exclude: [] },
  ]);
  const badges = profile.locator('[aria-label="الطابع والوسوم"]');
  await expect(badges).toHaveText("متفائل");
  const badgeSizes = await badges.locator('[data-slot="badge"]').evaluateAll((items) =>
    items.map((item) => ({
      fontSize: Number.parseFloat(getComputedStyle(item).fontSize),
      height: item.getBoundingClientRect().height,
    })),
  );
  expect(badgeSizes).toHaveLength(1);
  for (const size of badgeSizes) {
    expect(size.fontSize).toBeGreaterThanOrEqual(14);
    expect(size.height).toBeGreaterThanOrEqual(28);
  }
  await expect(profile.getByText(/English|untranslated/)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "الاستوديوهات والأشخاص", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "ليلى الكاتبة", exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "أعمال استوديو المكتبة", exact: true }),
  ).toHaveAttribute("href", `#/studios/${id(32)}`);
  await page.getByRole("button", { name: "تفاصيل العمل", exact: true }).click();
  const data = page.getByRole("dialog", { name: "تفاصيل العمل" });
  await expect(data.getByRole("heading", { name: "لغات العمل", exact: true })).toBeVisible();
  for (const heading of ["الأنواع الفنية", "الطابع", "حقائق ومعلومات"])
    await expect(data.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  for (const heading of [
    "هوية العمل",
    "حجم العمل",
    "الأسماء البديلة",
    "الوسوم",
    "البلدان",
    "الجوائز والتكريمات",
    "الصور المحفوظة",
  ])
    await expect(data.getByRole("heading", { name: heading, exact: true })).toHaveCount(0);
  for (const [group, label, key, value] of [
    ["الطابع", "متفائل", "tones", "optimistic"],
    ["لغات العمل", "العربية", "languages", "ar"],
    ["لغات الدبلجة", "الإنجليزية", "dubLanguages", "en"],
  ]) {
    const href = await data
      .getByRole("list", { name: group, exact: true })
      .getByRole("link", { name: label, exact: true })
      .getAttribute("href");
    expect(href).toMatch(/^#\/browse\?/);
    const filters = new URLSearchParams(href?.split("?")[1]).get("filters");
    expect(JSON.parse(filters ?? "{}").facets).toEqual([{ key, include: [value], exclude: [] }]);
  }
  await expect(data.getByText(/English|untranslated/)).toHaveCount(0);
});

test("full synopsis appears once above the episodes", async ({ page }) => {
  await openWork(page);
  const paragraph = page
    .getByRole("region", { name: "نبذة العمل" })
    .getByText(summary, { exact: true });
  await expect(paragraph).toHaveText(summary);
  expect(await paragraph.evaluate((element) => getComputedStyle(element).webkitLineClamp)).toBe(
    "none",
  );
  const hero = page.getByRole("article", { name: "صفحة العمل" }).locator("header").first();
  await expect(hero.getByText(summary, { exact: true })).toHaveCount(0);
  const episodes = page.getByRole("region", { name: "الأجزاء والإصدارات" });
  const synopsisBounds = await paragraph.boundingBox();
  const episodesBounds = await episodes.boundingBox();
  expect(synopsisBounds && episodesBounds && synopsisBounds.y < episodesBounds.y).toBeTruthy();
  await expect(page.getByRole("button", { name: "قراءة المزيد" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("episode keyboard navigation follows physical RTL directions and details restore focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openWork(page);
  await expect(page.locator("#main-content")).toBeFocused();
  await openEpisodes(page);
  const first = episodeCard(page, 1).locator("[data-episode-primary]");
  const second = episodeCard(page, 2).locator("[data-episode-primary]");
  await first.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(second).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(first).toBeFocused();
  await episodeCard(page, 1).getByRole("button", { name: "تفاصيل الحلقة 1" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    episodeCard(page, 4).getByRole("button", { name: "تشغيل الحلقة 4", exact: true }),
  ).toBeFocused();
  const detailsTrigger = episodeCard(page, 2).getByRole("button", { name: "تفاصيل الحلقة 2" });
  await detailsTrigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "2 · رحلة الحلقة 2" });
  await expect(dialog).toBeVisible();
  await expectFocusInside(dialog);
  await expect(
    dialog.getByText(work.installments[0].episodes[1].summary, { exact: true }),
  ).toBeVisible();
  const field = (label: string) =>
    dialog
      .locator("dl > div")
      .filter({ has: page.locator("dt").filter({ hasText: new RegExp(`^${label}$`) }) })
      .locator("dd");
  await expect(field("حالة الإصدار")).toHaveText("صدر");
  await expect(field("المشاهدة")).toHaveText("لم تُشاهَد");
  await expect(field("علامة يدوية")).toHaveText("لا");
  await expect(field("تقدم التشغيل بالثواني")).toHaveText("120");
  await expect(field("إزاحة الترجمة بالمللي ثانية")).toHaveText("-250");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(detailsTrigger).toBeFocused();
  const noTitle = episodeCard(page, 3);
  await expect(noTitle.getByRole("heading", { name: "الحلقة 3", exact: true })).toBeVisible();
  await noTitle.getByRole("button", { name: "تفاصيل الحلقة 3" }).press("Enter");
  await expect(page.getByRole("dialog", { name: "3 · حلقة بلا عنوان" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(noTitle.getByRole("button", { name: "تفاصيل الحلقة 3" })).toBeFocused();
  const lastVisible = episodeCard(page, 7);
  await lastVisible.locator("[data-episode-primary]").focus();
  await expect
    .poll(() =>
      lastVisible.evaluate((card) => {
        const bounds = card.getBoundingClientRect();
        const main = document.getElementById("main-content")!.getBoundingClientRect();
        return (
          bounds.top >= Math.max(0, main.top) - 1 &&
          bounds.bottom <= Math.min(innerHeight, main.bottom) + 1
        );
      }),
    )
    .toBe(true);
});

test("episode details remain deep links while artwork starts the selected episode", async ({
  page,
}) => {
  await openWork(page, `?installment=${seasonId}`);
  const card = episodeCard(page, 2);
  await openEpisodes(page);
  const link = card.getByRole("button", { name: "تفاصيل الحلقة 2", exact: true });
  await expect(link.locator("button, a, input")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "تشغيل الحلقة 2" })).toBeEnabled();
  await link.focus();
  await link.press("Enter");
  const dialog = page.getByRole("dialog", { name: "2 · رحلة الحلقة 2" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "تنزيل الحلقة 2" })).toBeEnabled();
  await expect(page).toHaveURL(new RegExp(`episode=${id(102)}$`));
  await expect(dialog.getByRole("heading", { name: "2 · رحلة الحلقة 2" })).toBeFocused();
  expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(link).toBeFocused();
  await link.click();
  await page.reload();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).hash).not.toContain("episode=");
  await card.getByRole("button", { name: "تشغيل الحلقة 2", exact: true }).click();
  await expect(page.getByRole("main", { name: "صفحة المشاهدة", exact: true })).toBeVisible();
  await expect
    .poll(() => requests(page, "player.preview"))
    .toContainEqual({ title: `${workTitle} · الحلقة 2` });
  await expect
    .poll(() => requests(page, "media.local"))
    .toContainEqual(
      expect.objectContaining({
        target: { workId, installmentId: seasonId, episodeId: id(102) },
      }),
    );
  await expect(page.getByRole("dialog", { name: "2 · رحلة الحلقة 2" })).toHaveCount(0);
  expect(await requests(page, "setWatched")).toEqual([]);
});

test("work discussion conceals spoilers, paginates and accepts comments", async ({ page }) => {
  await openWork(page, `?installment=${seasonId}`);
  const discussion = page.getByRole("region", { name: "نقاش العائلة", exact: true });
  await expect(discussion).toBeVisible();
  await expect(discussion.getByText(activity[0].body, { exact: true })).toHaveCount(0);
  await expect(discussion.getByText("فرد العائلة 0", { exact: true })).toBeVisible();
  await expect(discussion.getByRole("img", { name: "تقييم 4 من 5", exact: true })).toBeVisible();
  await expect(discussion.getByText("تعليق العائلة 19", { exact: true })).toBeVisible();
  await expect(discussion.getByText("تعليق العائلة 20", { exact: true })).toHaveCount(0);
  // Dev StrictMode may cancel the mount request and send one replacement; neither may preload page 2.
  const firstPageRequests = await requests(page, "workActivity");
  expect(firstPageRequests.length).toBeGreaterThanOrEqual(1);
  expect(firstPageRequests.length).toBeLessThanOrEqual(2);
  for (const request of firstPageRequests)
    expect(request).toEqual({ id: workId, page: 1, includeOwnReview: true });
  const reveal = discussion.getByRole("button", { name: "إظهار تعليق يحوي حرقًا" });
  await reveal.focus();
  await page.keyboard.press("Enter");
  await expect(discussion.getByText(activity[0].body, { exact: true })).toBeVisible();
  await expect(discussion.locator("script")).toHaveCount(0);
  expect(await page.evaluate(() => "spoilerExecuted" in window)).toBe(false);
  const more = discussion.getByRole("button", { name: "تعليقات أقدم", exact: true });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(discussion.getByText("تعليق العائلة 20", { exact: true })).toBeVisible();
  await expect(discussion.getByText("رد", { exact: true }).first()).toBeVisible();
  await expect(more).toHaveCount(0);
  await expect(discussion.getByText(activity[0].body, { exact: true })).toBeVisible();
  expect(await requests(page, "workActivity")).toEqual([
    ...firstPageRequests,
    { id: workId, page: 2 },
  ]);
  for (let index = 0; index < activity.length; index++)
    await expect(discussion.getByText(`فرد العائلة ${index}`, { exact: true })).toHaveCount(1);
  expect(await requests(page, "setWatched")).toEqual([]);
  const composer = discussion.getByRole("textbox", { name: "اكتب تعليقًا للعائلة" });
  await expect(composer).toHaveCount(0);
  await discussion.getByRole("button", { name: "ما رأيك؟ اكتب تعليقًا أو مراجعة…" }).click();
  await expect(composer).toBeFocused();
  await composer.fill("رأيي في مغامرات المكتبة");
  await discussion.getByRole("button", { name: "إرسال التعليق", exact: true }).click();
  await expect(discussion.getByText("رأيي في مغامرات المكتبة", { exact: true })).toBeVisible();
  await expect(composer).toHaveCount(0);

  await discussion.getByRole("button", { name: "ما رأيك؟ اكتب تعليقًا أو مراجعة…" }).click();
  await composer.fill("مراجعة مغامرات المكتبة");
  await discussion.getByRole("radio", { name: "5 من 5", exact: true }).click();
  await discussion.getByRole("button", { name: "طي محرّر النقاش" }).click();
  await discussion.getByRole("button", { name: "متابعة المسودة" }).click();
  await expect(discussion.getByRole("radio", { name: "5 من 5", exact: true })).toBeChecked();
  await discussion.getByRole("button", { name: "نشر المراجعة", exact: true }).click();
  const review = discussion.getByRole("article").filter({ hasText: "مراجعة مغامرات المكتبة" });
  await expect(review.getByRole("img", { name: "تقييم 5 من 5", exact: true })).toBeVisible();
  await discussion.getByRole("button", { name: "تعديل مراجعتك", exact: true }).click();
  await expect(composer).toHaveValue("مراجعة مغامرات المكتبة");
  await discussion.getByRole("radio", { name: "3 من 5", exact: true }).click();
  await discussion.getByRole("button", { name: "حفظ التعديل", exact: true }).click();
  await expect(review.getByRole("img", { name: "تقييم 3 من 5", exact: true })).toBeVisible();
});

test.describe("legacy discussion server", () => {
  test.use({ legacyDiscussion: true });

  test("loads the existing feed when the optional review request is rejected", async ({ page }) => {
    await openWork(page);
    const discussion = page.getByRole("region", { name: "نقاش العائلة", exact: true });
    await expect(discussion.getByText("فرد العائلة 0", { exact: true })).toBeVisible();
    const activityRequests = await requests(page, "workActivity");
    expect(activityRequests).toContainEqual({ id: workId, page: 1, includeOwnReview: true });
    expect(activityRequests).toContainEqual({ id: workId, page: 1 });
    await discussion.getByRole("button", { name: "ما رأيك؟ اكتب تعليقًا…", exact: true }).click();
    await expect(discussion.getByRole("textbox", { name: "اكتب تعليقًا للعائلة" })).toBeFocused();
    await expect(discussion.getByRole("radiogroup", { name: "تقييمك من 5" })).toHaveCount(0);
  });
});

test("parental guide keeps severity colors and both editorial notes", async ({ page }) => {
  await openWork(page);
  const sidebar = page.getByRole("complementary", { name: "لمحة العمل" });
  for (const label of ["المحتوى الجنسي", "العنف والسلوك", "الموضوعات العقدية"]) {
    await expect(sidebar.getByText(label, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "الأجزاء والإصدارات" }).getByText(label, { exact: true }),
    ).toHaveCount(0);
  }
  const colors = [];
  for (const label of ["منخفض", "متوسط", "مرتفع"]) {
    const severity = sidebar.getByText(label, { exact: true });
    colors.push(await severity.evaluate((element) => getComputedStyle(element).color));
  }
  expect(new Set(colors).size).toBe(3);
  for (const title of ["تنبيه المحتوى", "ملاحظات التحليل"])
    await expect(page.locator("#work-sections").getByRole("heading", { name: title })).toHaveCount(
      0,
    );
  await sidebar.getByRole("button", { name: "تفاصيل دليل الوالدين" }).click();
  const guide = page.getByRole("dialog", { name: "دليل الوالدين", exact: true });
  await expect(guide).toContainText(work.contentWarnings!);
  await expect(guide).toContainText(work.analysisNotes!);
});

test("decimal episode labels are normalized everywhere without changing mutation identities", async ({
  page,
}) => {
  await openWork(page, `?installment=${seasonId}`);
  const panel = page.getByRole("region", { name: "الأجزاء والإصدارات" });
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(episodeCard(page, 1).getByText("الحلقة 1", { exact: true })).toBeVisible();
  await expect(episodeCard(page, 2).getByText("الحلقة 2", { exact: true })).toBeVisible();
  await expect(panel.getByText(/^[12]\.00$/)).toHaveCount(0);
  const fractional = page.getByRole("article", { name: "الحلقة 9.5", exact: true });
  await expect(fractional).toBeVisible();
  await expect(fractional.getByText("الحلقة 9.5", { exact: true })).toBeVisible();
  await expect(
    fractional.getByRole("button", { name: "تفاصيل الحلقة 9.5", exact: true }),
  ).toBeVisible();
  await episodeCard(page, 1)
    .getByRole("button", { name: "تفاصيل الحلقة 1", exact: true })
    .press("Enter");
  const dialog = page.getByRole("dialog", { name: "1 · رحلة الحلقة 1", exact: true });
  await expect(dialog).toBeVisible();
  const numberField = dialog
    .locator("dl > div")
    .filter({ has: page.locator("dt").getByText("رقم الحلقة", { exact: true }) })
    .locator("dd");
  await expect(numberField).toHaveText("1");
  await expect(dialog.getByText("1.00", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await fractional.getByRole("button", { name: "تحديد الحلقة 9.5 كمُشاهَد", exact: true }).click();
  await expect(
    fractional.getByRole("button", { name: "إلغاء مشاهدة الحلقة 9.5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await requests(page, "setWatched")).toEqual([
    { workId, installmentId: seasonId, episodeId: id(109), isPlayed: true },
  ]);
});

test.describe("long season", () => {
  test.use({ longSeason: true });

  test("show all opens an episode-only view and can return to the nine-episode preview", async ({
    page,
  }) => {
    await openWork(page, `?installment=${seasonId}`);
    const episodes = page.getByRole("region", { name: "الأجزاء والإصدارات", exact: true });
    await expect(episodes.getByRole("article")).toHaveCount(9);
    await episodes.getByRole("button", { name: /^عرض كل الحلقات/ }).click();
    await expect(page).toHaveURL(/view=episodes/);
    await expect(episodes.getByRole("article")).toHaveCount(11);
    await expect(episodes.getByRole("button", { name: "الموسم الأول", exact: true })).toBeVisible();
    const filters = episodes.getByRole("group", { name: "حالة مشاهدة الحلقات" });
    await filters.getByRole("button", { name: "شُوهدت", exact: true }).click();
    await expect(episodes.getByRole("article")).toHaveCount(0);
    await expect(episodes.getByText("لا توجد حلقات تطابق هذا الفلتر")).toBeVisible();
    await filters.getByRole("button", { name: "لم تُشاهَد", exact: true }).click();
    const first = episodeCard(page, 1);
    await first.getByRole("button", { name: "تحديد الحلقة 1 كمُشاهَد", exact: true }).click();
    await expect(first).toHaveCount(0);
    await filters.getByRole("button", { name: "شُوهدت", exact: true }).click();
    await expect(episodes.getByRole("article")).toHaveCount(1);
    await expect(first).toBeVisible();
    await expect(page.getByRole("region", { name: "أعمال قد تعجبك" })).toHaveCount(0);
    await page.getByRole("button", { name: "العودة إلى العمل", exact: true }).click();
    await expect(episodes.getByRole("article")).toHaveCount(9);
    await expect(page).toHaveURL(new RegExp(`installment=${seasonId}$`));
  });
});

test("short mobile work pages keep details scrollable and use drawers for episode actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await openWork(page, `?installment=${seasonId}`);
  await expect(page.getByRole("navigation", { name: "أقسام العمل" })).toHaveCount(0);
  await page.getByRole("button", { name: "تفاصيل العمل", exact: true }).click();
  const details = page.getByRole("dialog", { name: "تفاصيل العمل", exact: true });
  await expect(details).toHaveAttribute("data-slot", "drawer-content");
  await expect
    .poll(() =>
      details.evaluate((element) =>
        [...element.children].some((child) => {
          child.scrollTop = child.scrollHeight;
          return child.scrollTop > 0;
        }),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);

  const toolbar = page.getByRole("group", { name: "خيارات الإصدار" });
  const season = page.getByRole("region", { name: "الموسم الأول", exact: true });
  const seasonBottom = await season.evaluate((element) => element.getBoundingClientRect().bottom);
  expect(await toolbar.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(
    seasonBottom,
  );
  await toolbar.getByRole("button", { name: "الموسم الأول", exact: true }).click();
  const seasons = page.getByRole("dialog", { name: "المواسم والإصدارات" });
  await expect(seasons).toHaveAttribute("data-slot", "drawer-content");
  await seasons.getByRole("button", { name: /^الموسم الأول/ }).click();
  await expect(seasons).toHaveCount(0);

  await toolbar.getByRole("button", { name: "تنزيل حلقات من مكتبة المنزل" }).click();
  const downloads = page.getByRole("dialog", { name: "تنزيل فيديوهات إلى هذا الجهاز" });
  await expect(downloads).toHaveAttribute("data-slot", "drawer-content");
  await downloads.getByRole("button", { name: "إغلاق", exact: true }).click();

  await episodeCard(page, 1).getByRole("button", { name: "تفاصيل الحلقة 1" }).click();
  const episodeDetails = page.getByRole("dialog", { name: "1 · رحلة الحلقة 1" });
  await expect(episodeDetails).toHaveAttribute("data-slot", "drawer-content");
  await expect(episodeDetails.getByRole("button", { name: "تنزيل الحلقة 1" })).toBeEnabled();
  await expectNoOverflow(page);
});

test("season changes preserve the main scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await openWork(page);
  await openEpisodes(page);
  const scrollTop = () => page.locator("#main-content").evaluate((element) => element.scrollTop);
  const selector = page.getByRole("button", { name: "الموسم الأول", exact: true });
  // Align the selector before measuring so Playwright's ordinary click scrolling isn't mistaken for a route reset.
  await selector.scrollIntoViewIfNeeded();
  const beforeSeason = await scrollTop();
  await selector.click();
  await page.getByRole("menuitemradio", { name: /^الموسم القادم 2 حلقة/ }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${futureSeasonId}$`));
  await expect.poll(async () => Math.abs((await scrollTop()) - beforeSeason)).toBeLessThan(2);
  const nextSelector = page.getByRole("button", { name: "الموسم القادم", exact: true });
  await expect(nextSelector).toBeFocused();
  await nextSelector.click();
  await page.getByRole("menuitemradio", { name: "الموسم الأول 9 حلقة", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${seasonId}$`));
  await expect.poll(async () => Math.abs((await scrollTop()) - beforeSeason)).toBeLessThan(2);
});

test("work sources open in the More submenu and the planet tile stays below the parental guide", async ({
  page,
}) => {
  await page.goto(`/#/titles/${workId}?tab=data`);
  const panel = page.getByRole("dialog", { name: "تفاصيل العمل" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("region", { name: "المصادر الخارجية", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("heading", { name: "الكواكب", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: /الخيال العائلي/ })).toHaveCount(0);
  for (const heading of ["هوية العمل", "الأسماء البديلة", "الصور المحفوظة"])
    await expect(panel.getByRole("heading", { name: heading, exact: true })).toHaveCount(0);
  await expect(panel.getByText("اسم بديل لا يعرض هنا", { exact: true })).toHaveCount(0);
  await expect(panel.getByText(work.canonicalTitle, { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("img")).toHaveCount(0);
  await expect(panel.getByText("removed-work-art.png", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "المزيد من إجراءات العمل", exact: true }).click();
  const sources = page.getByRole("menuitem", { name: "المصادر الخارجية", exact: true });
  await sources.press("ArrowLeft");
  const submenu = page.getByRole("menu", { name: "المصادر الخارجية", exact: true });
  await expect(submenu).toBeVisible();
  for (const [label, href] of [
    ["IMDb", "https://www.imdb.com/title/tt1234567/"],
    ["TMDB", "https://www.themoviedb.org/tv/1234"],
    ["AniList", "https://anilist.co/anime/2345"],
    ["MyAnimeList", "https://myanimelist.net/anime/3456"],
    ["موقع الحكاية", "https://example.test/library"],
  ]) {
    const item = submenu.getByRole("menuitem", { name: label, exact: true });
    await expect(item).toHaveAttribute("href", href);
    await expect(item).toHaveAttribute("target", "_blank");
    await expect(item).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expect(submenu.getByRole("menuitem")).toHaveCount(5);
  await expect(submenu.locator('a[href^="javascript:"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sources).toBeFocused();
  await page.keyboard.press("Escape");
  const sidebar = page.getByRole("complementary", { name: "لمحة العمل" });
  const planet = sidebar.getByRole("link", { name: "الخيال العائلي", exact: true });
  await expect(planet).toHaveAttribute("href", "#/planets/family-fantasy");
  await expect(page.locator('a[href="#/planets/family-fantasy"]')).toHaveCount(1);
  const headings = sidebar.getByRole("heading");
  await expect(headings).toHaveText(["دليل الوالدين", "أقسام العمل"]);
  await expect(planet.locator(":scope > span")).toHaveCSS("border-top-color", "rgb(198, 167, 255)");
  const shortcuts = sidebar.getByRole("navigation", { name: "أقسام العمل", exact: true });
  await shortcuts.getByRole("button", { name: "الأجزاء والإصدارات", exact: true }).click();
  await expect(page.getByRole("region", { name: "الأجزاء والإصدارات", exact: true })).toBeFocused();
});

test("score overview exposes installment breakdowns and a calculation popover", async ({
  page,
}) => {
  await page.goto(`/#/titles/${workId}?tab=scores`);
  const panel = page.getByRole("dialog", { name: "تقييم نحّاسيو" });
  await expect(panel.getByRole("heading", { name: workTitle, exact: true })).toBeVisible();
  await expect(panel.getByRole("img", { name: /^بصمة المعايير الستة/ })).toBeVisible();

  const season = panel.locator("details").filter({ hasText: "الموسم الأول" });
  await season.locator("summary").press("Enter");
  await expect(season.getByText("القصة والحبكة", { exact: true })).toBeVisible();
  await expect(panel.locator("summary").filter({ hasText: "الموسم القادم" })).toContainText(
    "غير مقيّم",
  );

  const method = panel.getByRole("button", { name: "كيف يُحسب التقييم؟", exact: true });
  await method.press("Enter");
  const calculation = page.getByRole("dialog", { name: "كيف يُحسب التقييم؟", exact: true });
  await expect(calculation).toHaveAttribute("data-slot", "popover-content");
  await expect(calculation.getByText(/لا تُعاد موازنة المعايير الناقصة/)).toBeVisible();
  await expect(calculation.getByText(/القصة 25%/)).toBeVisible();
  await expect(calculation.getByText("متوسط المجاميع قبل التقريب")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(calculation).toHaveCount(0);
  await expect(method).toBeFocused();
});

test("shared credits shelf lists studios first and preserves work-specific roles", async ({
  page,
}) => {
  await openWork(page, "?tab=creators");
  const panel = page.locator("#work-sections");
  const person = panel.getByRole("link", { name: "أعمال ليلى الكاتبة", exact: true });
  const organization = panel.getByRole("link", { name: "أعمال استوديو المكتبة", exact: true });
  await expect(person).toHaveAttribute("href", `#/people/${id(30)}`);
  await expect(person).toContainText("كاتبة الحكاية");
  await expect(person).toContainText("تأليف القصة");
  await expect(person.getByText("كتابة", { exact: true })).toBeVisible();
  await expect(person.getByText("دور رئيسي", { exact: true })).toBeVisible();
  await expect(organization).toHaveAttribute("href", `#/studios/${id(32)}`);
  await expect(organization).not.toContainText("جهة إنتاج حكايات العائلة");
  await expect(organization).not.toContainText("تنفيذ الرسوم وإنتاج الموسم");
  await expect(organization).not.toContainText("دور رئيسي");
  const shelf = panel.getByRole("list", { name: "مساهمو العمل", exact: true });
  await expect(shelf.getByRole("link").first()).toHaveAttribute("href", `#/studios/${id(32)}`);
  await expect(person.locator('[data-slot="person-artwork"]')).toBeVisible();
  await expect(organization.locator('[data-slot="studio-artwork"]')).toBeVisible();
  await expect(person.getByText("ليلى المؤلفة", { exact: true })).toHaveCount(0);
  await person.focus();
  await expect(person).toBeFocused();
});

test("arrows reach work actions, watched controls, panel links and disclosures without activating them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWork(page);
  const trailers = page.getByRole("button", { name: "كل الإعلانات التشويقية", exact: true });
  const more = page.getByRole("button", { name: "المزيد من إجراءات العمل", exact: true });
  await trailers.press("ArrowLeft");
  await expect(more).toBeFocused();
  await more.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(more).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(trailers).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect(await requests(page, "setFavorite")).toEqual([]);
  expect(await requests(page, "setWatched")).toEqual([]);
  await openEpisodes(page);
  const selector = page.getByRole("button", { name: "الموسم الأول", exact: true });
  await selector.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("button", { name: "تحديد الموسم الأول كمُشاهَد", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "الأقدم أولًا", exact: true })).toBeFocused();
  const firstWatch = episodeCard(page, 1).getByRole("button", {
    name: "تحديد الحلقة 1 كمُشاهَد",
    exact: true,
  });
  await firstWatch.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(episodeCard(page, 2).locator("[data-episode-primary]")).toBeFocused();
  expect(await requests(page, "setWatched")).toEqual([]);
  const person = page.getByRole("link", { name: "أعمال ليلى الكاتبة", exact: true });
  await person.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("link", { name: "أعمال استوديو المكتبة", exact: true }),
  ).toBeFocused();
  const score = page.getByRole("button", { name: "تفاصيل تقييم نحّاسيو" });
  const details = page.getByRole("button", { name: "تفاصيل العمل", exact: true });
  await details.press("ArrowLeft");
  await expect(score).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await score.press("Enter");
  const dialog = page.getByRole("dialog", { name: "تقييم نحّاسيو" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(score).toBeFocused();
});

for (const width of [520, 1440]) {
  test(`work recommendations ${width}: explanations, equal hero controls and reachable cards`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openWork(page);
    const hero = page.locator("article > header");
    const more = hero.getByRole("button", { name: "المزيد من إجراءات العمل", exact: true });
    const save = hero.getByRole("button", { name: "حفظ بيانات العمل وصوره للجهاز", exact: true });
    await expect(more).toBeVisible();
    await expect(save).toBeVisible();
    expect((await more.boundingBox())?.height).toBe(48);
    expect((await save.boundingBox())?.height).toBe(48);
    await expect(more).toHaveText("");
    const guideTrigger = page.getByRole("button", { name: "تفاصيل دليل الوالدين" });
    await guideTrigger.focus();
    await page.keyboard.press("Enter");
    const guide = page.getByRole("dialog", { name: "دليل الوالدين" });
    await expect(guide).toBeVisible();
    await expect(guide).toHaveAttribute(
      "data-slot",
      width < 768 ? "drawer-content" : "dialog-content",
    );
    await expect(guide.getByText("غير مقيّم", { exact: true })).toHaveCount(1);
    for (const label of [
      "المحتوى الجنسي",
      "العنف والسلوك",
      "الألفاظ النابية والكحول",
      "الموضوعات العقدية",
    ]) {
      await expect(guide.getByText(label, { exact: true })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(guide).toHaveCount(0);
    await expect(guideTrigger).toBeFocused();
    const section = page.getByRole("region", { name: "أعمال قد تعجبك" });
    await section.scrollIntoViewIfNeeded();
    const similarity = section.getByRole("button", { name: "لماذا اقتُرح هذا العمل؟" }).first();
    await expect(similarity).toHaveText("80%");
    await similarity.click();
    await expect(page.getByRole("dialog", { name: "لماذا هذا الاقتراح؟" })).toContainText("مغامرة");
    await page.keyboard.press("Escape");
    const cards = section.getByRole("listitem");
    await expect(cards).toHaveCount(10);
    const tops = await cards.evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(1);
    const shelf = section.getByRole("list", { name: "الأعمال المقترحة" });
    expect(await shelf.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    await cards.last().scrollIntoViewIfNeeded();
    await expect(section.getByRole("link", { name: "تفاصيل اقتراح 10" })).toBeInViewport();
    await expectNoOverflow(page);
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({
        path: `/tmp/nahhasio-work-recommendations-${width}.png`,
        fullPage: true,
      });
  });
}

for (const width of [390, 860, 1440]) {
  test(`watch page ${width}: source failure keeps episodes and discussion usable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 719 });
    await openWork(page);
    await page.getByRole("button", { name: "تابع المشاهدة", exact: true }).click();
    const watch = page.getByRole("main", { name: "صفحة المشاهدة" });
    await expect(watch).toBeVisible();
    const sources = watch.getByLabel("مصادر الفيديو", { exact: true });
    await sources.getByRole("tab", { name: "خوادم الفيديو", exact: true }).click();
    await expect(sources.getByRole("button", { name: "مصدر الفيديو", exact: true })).toBeVisible();
    await sources.getByRole("tab", { name: "تورنت", exact: true }).click();
    await expect(sources).toContainText("تعذّر الوصول إلى Custom");
    await expect(watch.getByLabel("حلقات العمل", { exact: true })).toBeVisible();
    await watch.getByRole("button", { name: "ما رأيك؟ اكتب تعليقًا أو مراجعة…" }).click();
    const composer = watch.getByLabel("اكتب تعليقًا للعائلة", { exact: true });
    await composer.fill("تعليق الاختبار بدون تشغيل");
    await page.keyboard.press("Space");
    await expect(watch).toBeVisible();
    await watch.getByRole("button", { name: "إرسال التعليق", exact: true }).click();
    await expect(
      watch.getByRole("article").getByText("تعليق الاختبار بدون تشغيل", { exact: true }),
    ).toBeVisible();
    const comment = watch
      .getByRole("article")
      .filter({ has: page.getByText("تعليق الاختبار بدون تشغيل", { exact: true }) });
    await comment.getByRole("button", { name: "إجراءات تعليقك", exact: true }).click();
    await watch.getByRole("menuitem", { name: "تعديل", exact: true }).click();
    await composer.fill("تعليق معدّل");
    await watch.getByRole("button", { name: "حفظ التعديل", exact: true }).click();
    await expect(watch.getByText("تعليق معدّل", { exact: true })).toBeVisible();
    await expectNoOverflow(page);
    await expect
      .poll(async () => (await requests(page, "player.viewport")).length)
      .toBeGreaterThan(0);

    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `/tmp/nahhasio-watch-${width}.png`, fullPage: true });
    await expect(
      watch.getByLabel("حلقات العمل", { exact: true }).getByRole("button").first(),
    ).toBeVisible();
    if (width < 1280) {
      await expect(watch.getByRole("button", { name: "إخفاء القائمة الجانبية" })).toBeHidden();
      await expect(watch.getByRole("button", { name: "العودة", exact: true })).toBeHidden();
      const favorite = watch.getByRole("button", { name: "إضافة إلى المفضلة" });
      await expect(favorite).toBeVisible();
      const actions = await favorite.boundingBox();
      const video = await watch.getByLabel("منطقة الفيديو").boundingBox();
      expect(actions!.y + actions!.height).toBeLessThanOrEqual(video!.y);
      const list = watch.getByRole("list", { name: "قائمة الحلقات" });
      await expect(list).toBeVisible();
      if (width < 768) {
        const search = watch.getByRole("textbox", { name: "بحث في الحلقات" });
        await expect(search).toBeHidden();
        await watch.getByRole("button", { name: "إظهار بحث الحلقات" }).click();
        await expect(search).toBeFocused();
        await search.fill("رحلة الحلقة 2");
        await expect(list.getByRole("listitem")).toHaveCount(1);
        await watch.getByRole("button", { name: "إخفاء بحث الحلقات" }).click();
        await expect(list.getByRole("listitem")).toHaveCount(9);
      }
      await watch.getByRole("button", { name: "إخفاء الحلقات" }).click();
      await expect(list).toBeHidden();
      await watch.getByRole("button", { name: "إظهار الحلقات" }).click();
      await expect
        .poll(() => list.evaluate((element) => element.scrollWidth - element.clientWidth))
        .toBeGreaterThan(0);
      await expect
        .poll(() =>
          watch.evaluate((element) => {
            const content = element.lastElementChild;
            const bottom =
              (content?.getBoundingClientRect().bottom ?? 0) -
              element.getBoundingClientRect().top +
              element.scrollTop;
            return element.scrollHeight - bottom;
          }),
        )
        .toBeLessThanOrEqual(1);
    } else {
      await expect(watch.getByRole("button", { name: "العودة", exact: true })).toHaveCount(0);
      const actions = watch.getByLabel("أدوات العمل", { exact: true });
      const hideSidebar = actions.getByRole("button", {
        name: "إخفاء القائمة الجانبية",
        exact: true,
      });
      await expect(hideSidebar).toHaveAttribute("aria-expanded", "true");
      await hideSidebar.click();
      await expect(watch.getByLabel("حلقات العمل", { exact: true })).toHaveCount(0);
      const showSidebar = actions.getByRole("button", {
        name: "إظهار القائمة الجانبية",
        exact: true,
      });
      await expect(showSidebar).toHaveAttribute("aria-expanded", "false");
      await showSidebar.click();
      await expect(watch.getByLabel("حلقات العمل", { exact: true })).toBeVisible();
    }
    const selector = watch
      .getByLabel("حلقات العمل", { exact: true })
      .getByRole("combobox", { name: "الأجزاء والمواسم", exact: true });
    await selector.scrollIntoViewIfNeeded();
    await selector.click();
    await page.getByRole("option", { name: "فيلم المكتبة · فيلم", exact: true }).click();
    const filmInfo = watch.getByLabel("معلومات الفيلم", { exact: true });
    await expect(
      filmInfo.getByRole("heading", { name: "فيلم المكتبة", exact: true }),
    ).toBeVisible();
    await expect(
      filmInfo.getByRole("button", { name: "مشاهدة الفيلم", exact: true }),
    ).toBeEnabled();
    await expect(filmInfo).not.toContainText("0 حلقة");
    await expect(watch.getByLabel("بحث في الحلقات", { exact: true })).toHaveCount(0);
  });
}

test("watch sidebar combines episode states and filters watched episodes in RTL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openWork(page);
  await page.evaluate(
    (target) => {
      window.workPageFixture.savedEpisode = target;
    },
    {
      workId,
      installmentId: seasonId,
      episodeId: id(102),
    },
  );
  await openEpisodes(page);
  await expect(episodeCard(page, 2).getByText("محمّلة على الجهاز", { exact: true })).toBeVisible({
    timeout: 8000,
  });
  await episodeCard(page, 2).locator("[data-episode-primary]").click();
  const watch = page.getByRole("main", { name: "صفحة المشاهدة", exact: true });
  const sidebar = watch.getByRole("complementary", { name: "حلقات العمل", exact: true });
  const list = sidebar.getByRole("list", { name: "قائمة الحلقات", exact: true });
  const active = list.getByRole("button", { name: /رحلة الحلقة 2/ });
  await expect(active).toHaveAttribute("aria-current", "true");
  await expect(active.getByText("قيد التشغيل", { exact: true })).toHaveCount(1);
  await expect(active.getByTitle("محمّلة على الجهاز", { exact: true })).toBeVisible();
  await watch.getByRole("button", { name: "تحديد رحلة الحلقة 2 كمُشاهَد", exact: true }).click();
  await expect(active.getByTitle("تمّت المشاهدة", { exact: true })).toBeVisible();
  await expect(active.getByTitle("محمّلة على الجهاز", { exact: true })).toBeVisible();
  const all = sidebar.getByRole("radio", { name: "الكل", exact: true });
  await all.focus();
  await page.keyboard.press("ArrowLeft");
  const unwatched = sidebar.getByRole("radio", { name: "غير المُشاهَدة", exact: true });
  await expect(unwatched).toBeChecked();
  await expect(active).toHaveCount(0);
  await expect(sidebar.getByRole("status")).toHaveText("8 من 9");
  await all.click();
  await expect(active).toBeVisible();
  const rating = watch
    .getByLabel("تفاصيل المشاهدة", { exact: true })
    .getByRole("link", { name: "تفاصيل التقييم", exact: true });
  await expect(rating).toHaveText(/^الموسم\s*8\s*العمل\s*8$/);
  await expect(rating).toHaveAttribute("href", `#/titles/${workId}?panel=score`);
  await expect(watch.getByRole("region", { name: "تنبيه المحتوى", exact: true })).toContainText(
    "متوسط",
  );
  await expect(watch.getByRole("region", { name: "ملاحظات التحليل", exact: true })).toContainText(
    "مرتفع",
  );
  await expect(
    watch
      .getByRole("navigation", { name: "مراجع العمل", exact: true })
      .getByRole("link", { name: "IMDb", exact: true }),
  ).toBeVisible();
  await watch.getByRole("button", { name: "إضافة إلى المفضلة", exact: true }).click();
  await expect(
    watch.getByRole("button", { name: "إزالة من المفضلة", exact: true }).locator("svg"),
  ).toHaveClass(/fill-current/);
  await expect(list).toHaveClass(/scroll-fade-y/);
  await watch.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(0);
});

for (const width of [520, 1440]) {
  test(`watch page movie ${width}: mixed film details and installment navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openWork(page);
    await page.evaluate(
      ({ workId: selectedWorkId, movieId: selectedMovieId }) => {
        window.dispatchEvent(
          new CustomEvent("nahhasio:watch-request", {
            detail: {
              workId: selectedWorkId,
              installmentId: selectedMovieId,
              title: "فيلم المكتبة",
              intent: "watch",
            },
          }),
        );
      },
      { workId, movieId },
    );
    const watch = page.getByRole("main", { name: "صفحة المشاهدة" });
    await expect(watch).toBeVisible();
    await watch
      .getByLabel("مصادر الفيديو", { exact: true })
      .getByRole("tab", { name: "خوادم الفيديو", exact: true })
      .click();
    await watch
      .getByLabel("مصادر الفيديو", { exact: true })
      .getByRole("tab", { name: "تورنت", exact: true })
      .click();
    await expect(watch.getByLabel("مصادر الفيديو", { exact: true })).toContainText(
      "تعذّر الوصول إلى Custom",
    );
    await expect(watch.getByLabel("حلقات العمل", { exact: true })).toHaveCount(0);
    const theater = watch.getByRole("button", { name: "إخفاء القائمة الجانبية", exact: true });
    if (width === 520) await expect(theater).toBeHidden();
    else await expect(theater).toBeVisible();
    await expect(watch.getByRole("button", { name: "التالية", exact: true })).toHaveCount(0);
    const info = watch.getByLabel("معلومات الفيلم", { exact: true });
    await info.scrollIntoViewIfNeeded();
    await expect(info.getByRole("heading", { name: "فيلم المكتبة", exact: true })).toBeVisible();
    await expect(info).not.toContainText("0 حلقة");
    await expect(info.getByRole("link", { name: /استوديو المكتبة/u })).toBeVisible();
    await expect(info.getByLabel("أعمال مقترحة للمشاهدة")).toHaveCount(0);
    await expect(info.getByRole("button", { name: "الجزء السابق", exact: true })).toBeEnabled();
    await expect(watch.getByRole("heading", { name: "عن الفيلم" })).toBeAttached();
    await expectNoOverflow(page);
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `/tmp/nahhasio-watch-movie-${width}.png`, fullPage: true });
    await info.getByRole("combobox", { name: "الأجزاء والمواسم", exact: true }).click();
    await page.getByRole("option", { name: "الموسم الأول · 9 حلقة", exact: true }).click();
    await expect(watch.getByLabel("حلقات العمل", { exact: true })).toBeAttached();
  });
}

test("watch page special: film-style sidebar distinguishes browsing and selected state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installBridge(page, {
    ...work,
    installments: work.installments.map((item) =>
      item.id === movieId ? { ...item, kind: "special", title: "عرض المكتبة" } : item,
    ),
  });
  await openWork(page);
  await page.getByRole("button", { name: "تابع المشاهدة", exact: true }).click();
  const watch = page.getByRole("main", { name: "صفحة المشاهدة" });
  await watch
    .getByLabel("حلقات العمل", { exact: true })
    .getByRole("combobox", { name: "الأجزاء والمواسم", exact: true })
    .click();
  await page.getByRole("option", { name: "عرض المكتبة · عرض خاص", exact: true }).click();
  const info = watch.getByLabel("معلومات العرض الخاص", { exact: true });
  await expect(info.getByText("تستعرض هذا الجزء", { exact: true })).toBeVisible();
  await expect(info).not.toContainText("0 حلقة");
  await expect(info.getByLabel("أعمال مقترحة للمشاهدة")).toHaveCount(0);
  await info.getByRole("button", { name: "مشاهدة العرض الخاص", exact: true }).click();
  await expect(info.getByText("المحدد للمشاهدة", { exact: true })).toBeVisible();
  await expect(watch.getByRole("heading", { name: "عن العرض الخاص", exact: true })).toBeVisible();
  await info.getByRole("button", { name: "الجزء السابق", exact: true }).click();
  await expect(watch.getByLabel("حلقات العمل", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test("watch page local file: no sidebar, one filename and fullscreen in bottom controls", async ({
  page,
}) => {
  await openWork(page);
  await page.getByRole("button", { name: "تابع المشاهدة", exact: true }).click();
  const watch = page.getByRole("main", { name: "صفحة المشاهدة" });
  await watch.getByRole("button", { name: "خيارات المصدر", exact: true }).click();
  await page.getByRole("menuitem", { name: "فتح فيديو من الجهاز", exact: true }).click();
  await expect(watch.getByRole("heading", { name: "Frieren.mkv", exact: true })).toBeVisible();
  await expect(watch.getByText("Frieren.mkv", { exact: true })).toHaveCount(1);
  await expect(watch.getByLabel("حلقات العمل", { exact: true })).toHaveCount(0);
  await expect(
    watch.getByRole("button", { name: "إخفاء القائمة الجانبية", exact: true }),
  ).toHaveCount(0);
  const player = watch.getByRole("region", { name: "مشغّل الفيديو", exact: true });
  await expect(player.locator("header")).toHaveCount(0);
  await expect(player.getByRole("button", { name: "الحلقات", exact: true })).toHaveCount(0);
  await expect(
    player.locator("footer").getByRole("button", { name: "ملء الشاشة", exact: true }),
  ).toBeVisible();
  await expectNoOverflow(page);
});

test("work media actions stay in context and upcoming episodes cannot start playback", async ({
  page,
}) => {
  await openWork(page);
  const details = page.getByRole("button", { name: "تفاصيل العمل", exact: true });
  await details.click();
  const detailsSheet = page.getByRole("dialog", { name: "تفاصيل العمل", exact: true });
  await expect(detailsSheet.getByText("لغات العمل", { exact: true })).toBeVisible();
  await expect(
    detailsSheet.getByRole("link", { name: "العربية", exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detailsSheet).toHaveCount(0);
  await page.getByRole("button", { name: "كل الإعلانات التشويقية", exact: true }).click();
  const trailer = page.getByRole("menuitem").filter({ hasText: "الإعلان الرئيسي" });
  await expect(trailer).toHaveAttribute("href", "https://www.youtube.com/watch?v=lmnopqrstuv");
  await expect(trailer).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("menuitem").filter({ hasText: "الإعلان الأول" })).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=abcdefghijk",
  );
  await page.keyboard.press("Escape");
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({
      path: "../../../data/previews/work-media-desktop.png",
      animations: "disabled",
    });
  const notes = page.getByText("ملاحظات الدبلجة", { exact: true });
  await notes.click();
  await expect(page.getByText(work.dubbingNotes!, { exact: true })).toBeVisible();
  await openEpisodes(page);
  await expect(
    episodeCard(page, 8).getByRole("button", { name: "الحلقة 8 لم تصدر بعد", exact: true }),
  ).toBeDisabled();
  await episodeCard(page, 1).scrollIntoViewIfNeeded();
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({
      path: "../../../data/previews/work-episodes-desktop.png",
      animations: "disabled",
    });
  await page.setViewportSize({ width: 520, height: 900 });
  await episodeCard(page, 1).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({
      path: "../../../data/previews/work-episodes-narrow.png",
      animations: "disabled",
    });
});

test("device inventory failure prevents duplicate batch acquisition and can retry", async ({
  page,
}) => {
  await openWork(page);
  await page.evaluate(() => {
    window.workPageFixture.homeFiles = true;
    window.workPageFixture.deviceUnavailable = true;
  });
  await openEpisodes(page);
  await page.getByRole("button", { name: "تنزيل حلقات من مكتبة المنزل", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "تنزيل فيديوهات إلى هذا الجهاز", exact: true });
  await expect(dialog.getByText("تعذّر التحقق من تنزيلات الجهاز", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "تأكيد التنزيل إلى الجهاز", exact: true }),
  ).toBeDisabled();
  expect(await requests(page, "media.homeDownloadBatch")).toEqual([]);
  await page.evaluate(() => {
    window.workPageFixture.deviceUnavailable = false;
  });
  await dialog.getByRole("button", { name: "إعادة التحقق", exact: true }).click();
  await dialog
    .getByRole("button", { name: "تحديد نسخة لكل حلقة أو فيلم — حتى 100", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "تأكيد التنزيل إلى الجهاز", exact: true }),
  ).toBeEnabled();
  expect(await requests(page, "media.homeDownloadBatch")).toEqual([]);
});

test("appearance switches immediately and persists on this device after reload", async ({
  page,
}) => {
  await page.goto("/#/settings?section=appearance");
  await page.getByRole("button", { name: "فاتح", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.getByRole("button", { name: "فاتح", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "داكن", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

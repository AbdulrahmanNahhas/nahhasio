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
} from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import type { z } from "zod";

import type { PlayerSnapshot } from "../src/features/player/bridge";
import { offlineStatusSchema } from "../src/features/player/saved-works-data";
import type { EmbedStatus, ProviderListing } from "../src/features/player/stream-providers";

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
    title?: string;
    sessionId?: string;
    data?: CommentMutation;
    width?: number;
    height?: number;
  };
};
type WorkPageFixture = {
  requests: BridgeRequest[];
  state: WorkViewerState;
  favoriteOutcome: "accept" | "retain" | "fail";
  holdFavorite: boolean;
  releaseFavorite: () => void;
  failWatched: boolean;
};
declare global {
  interface Window {
    workPageFixture: WorkPageFixture;
  }
}

async function installBridge(page: Page, testWork: WorkDetail = work) {
  // Fail closed: these journeys must never fall through to a real catalog API.
  await page.route("**/api/**", (route) => route.abort());
  await page.addInitScript(
    ({ fixtureWork, fixtureState, fixtureActivity, fixturePlayer }) => {
      let playback = fixturePlayer;
      let playbackGeneration = 0;

      const fixture: WorkPageFixture = {
        requests: [],
        state: structuredClone(fixtureState),
        favoriteOutcome: "accept",
        holdFavorite: false,
        releaseFavorite: () => {},
        failWatched: false,
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
                  | { found: false }
                  | []
                  | Session
                  | WorkDetail
                  | WorkViewerState
                  | WorkActivityPage
                  | RecommendationPage
                  | z.infer<typeof offlineStatusSchema>,
              ) =>
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: true,
                    result: JSON.parse(JSON.stringify(result)),
                  }),
                );
              const failure = (errorMessage: string) =>
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { code: "fixture_failure", message: errorMessage },
                  }),
                );
              switch (request.command) {
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
                  success({ found: false });
                  return;
                case "media.saved":
                  success([]);
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
                  failure("تعذّر الوصول إلى Torrentio. أعد المحاولة لاحقًا.");
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
                      kind: "comment",
                      body: data.body ?? "",
                      containsSpoilers: data.containsSpoilers ?? false,
                      rating: null,
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
                      role: "owner",
                      accountId: "00000000-0000-4000-8000-000000000001",
                      kind: "admin",
                      avatarKey: "nahhasio-library.svg",
                      bio: "",
                      isAdmin: true,
                      updatedAt: "2026-10-12T00:00:00.000000Z",
                    },
                    expiresAt: "2099-10-09T00:00:00Z",
                  });
                  return;
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
                  const pageNumber = request.payload.page ?? 1;
                  success({
                    workId: fixtureWork.id,
                    items: fixtureActivity.slice((pageNumber - 1) * 20, pageNumber * 20),
                    total: fixtureActivity.length,
                    page: pageNumber,
                    pageSize: 20,
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
    },
  );
}
async function openWork(page: Page, query = "") {
  await page.goto(`/#/titles/${workId}${query}`);
  await expect(page.getByRole("heading", { name: workTitle, level: 1, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "إضافة إلى المفضلة" })).toBeEnabled();
}
async function openEpisodes(page: Page) {
  await page.getByRole("button", { name: "الأجزاء والحلقات", exact: true }).click();
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

test.beforeEach(async ({ page }) => {
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
  await installBridge(page);
});

test("favorite uses returned server state, blocks pending duplicates, and recovers from failure", async ({
  page,
}) => {
  await openWork(page);
  const add = page.getByRole("button", { name: "إضافة إلى المفضلة" });
  await page.evaluate(() => {
    const fixture = window.workPageFixture;
    fixture.favoriteOutcome = "retain";
    fixture.holdFavorite = true;
  });
  await add.click();
  await expect(add).toBeDisabled();
  await expect(add).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "تحديد العمل كمُشاهَد" })).toBeDisabled();
  expect(await requests(page, "setFavorite")).toEqual([{ workId, isFavorite: true }]);
  await page.evaluate(() => window.workPageFixture.releaseFavorite());
  await expect(add).toBeEnabled();
  await expect(add).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => {
    const fixture = window.workPageFixture;
    fixture.favoriteOutcome = "accept";
    fixture.holdFavorite = false;
  });
  await add.click();
  const remove = page.getByRole("button", { name: "إزالة من المفضلة" });
  await expect(remove).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    window.workPageFixture.favoriteOutcome = "fail";
  });
  await remove.click();
  await expect(page.getByRole("alert")).toContainText("تعذّر حفظ المفضلة في الخادم التجريبي");
  await expect(remove).toBeEnabled();
  await expect(remove).toHaveAttribute("aria-pressed", "true");
  expect((await currentState(page)).isFavorite).toBe(true);
  await page.evaluate(() => {
    window.workPageFixture.favoriteOutcome = "accept";
  });
  await remove.click();
  await expect(add).toHaveAttribute("aria-pressed", "false");
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
  await expect(card.getByRole("progressbar", { name: "تقدم الحلقة 2" })).toHaveAttribute(
    "aria-valuenow",
    "120",
  );
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
    page.getByRole("tabpanel").getByText("1 من 7 تمّت مشاهدته", { exact: true }),
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
  await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "120");
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
  await page.getByRole("button", { name: /^فيلم المكتبة/ }).click();
  await expect(page.getByRole("tabpanel").getByText("مكتمل", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("tab", { name: "الأجزاء", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(episodeCard(page, 10)).toBeVisible();
  await expect(episodeCard(page, 1)).toHaveCount(0);
  await page.getByRole("button", { name: "الموسم القادم", exact: true }).click();
  await page.getByRole("button", { name: /^الموسم الأول 9 حلقة$/ }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${seasonId}&tab=installments$`));
  await expect(page.getByRole("textbox", { name: "ابحث في الحلقات" })).toHaveCount(0);
  await expect(page.getByRole("tabpanel").getByRole("article")).toHaveCount(9);
  await expect(episodeCard(page, 7)).toBeVisible();
  await page.getByRole("button", { name: "الموسم الأول", exact: true }).click();
  await page.getByRole("button", { name: /^الموسم القادم 2 حلقة$/ }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${futureSeasonId}&tab=installments$`));
  await page.reload();
  await expect(episodeCard(page, 10)).toBeVisible();
  await expect(episodeCard(page, 11)).toBeVisible();
  await page.getByRole("button", { name: "الموسم القادم", exact: true }).click();
  await page.getByRole("button", { name: /^الموسم الأول 9 حلقة$/ }).click();
  await expect(page.getByRole("textbox", { name: "ابحث في الحلقات" })).toHaveCount(0);
  await expect(page.getByRole("tabpanel").getByRole("article")).toHaveCount(9);
  await page.getByRole("tab", { name: "الملف", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/titles/${workId}$`));
  const tile = page.getByRole("link", { name: "تفاصيل الموسم القادم", exact: true });
  await tile.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`installment=${futureSeasonId}$`));
  await expect(episodeCard(page, 10)).toBeVisible();
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
    const tablist = page.getByRole("tablist", { name: "أقسام العمل" });
    const tabMetrics = await tablist.evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(tabMetrics.scrollWidth).toBeLessThanOrEqual(tabMetrics.width + 1);
    expect(tabMetrics.scrollHeight).toBeLessThanOrEqual(tabMetrics.height + 1);
    await expect(tablist.getByRole("tab")).toHaveCount(5);
    if (width <= 480) {
      const rows = await tablist
        .getByRole("tab")
        .evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
      expect(new Set(rows).size).toBeGreaterThan(1);
    }
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
    for (const tab of ["الصنّاع", "التقييم", "البيانات", "الملف"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
      await expectNoOverflow(page);
    }
    await page.getByRole("tab", { name: "الأجزاء", exact: true }).click();
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
  const profile = page.getByRole("tabpanel");
  await expect(profile.getByRole("heading", { name: "الحكاية", exact: true })).toHaveCount(0);
  const overviewSummary = profile.getByText(summary, { exact: true });
  await expect(overviewSummary).toBeVisible();
  expect(
    await overviewSummary.evaluate((element) => element.closest('[data-slot="card"]') === null),
  ).toBe(true);
  await expect(page.getByRole("tab", { name: "العائلة", exact: true })).toHaveCount(0);
  await expect(profile.getByRole("heading", { name: "حقائق ومعلومات", exact: true })).toBeVisible();
  await expect(profile.getByRole("heading", { name: "تنبيه المحتوى", exact: true })).toBeVisible();
  await expect(profile.getByRole("heading", { name: "الأعمال المرتبطة", exact: true })).toHaveCount(
    0,
  );
  const badges = profile.locator('[aria-label="الأنواع والطابع والوسوم"]');
  await expect(badges).toHaveText("مغامرةمتفائل");
  const badgeSizes = await badges.locator('[data-slot="badge"]').evaluateAll((items) =>
    items.map((item) => ({
      fontSize: Number.parseFloat(getComputedStyle(item).fontSize),
      height: item.getBoundingClientRect().height,
    })),
  );
  expect(badgeSizes).toHaveLength(2);
  for (const size of badgeSizes) {
    expect(size.fontSize).toBeGreaterThanOrEqual(14);
    expect(size.height).toBeGreaterThanOrEqual(28);
  }
  await expect(profile.getByText(/English|untranslated/)).toHaveCount(0);
  await expect(
    profile.getByRole("link", { name: "تفاصيل فيلم المكتبة" }).getByLabel("فيلم", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "الصنّاع", exact: true }).click();
  await expect(page.getByRole("heading", { name: "الأشخاص", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ليلى الكاتبة", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "الاستوديوهات والجهات", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "أعمال استوديو المكتبة", exact: true }),
  ).toHaveAttribute("href", `#/studios/${id(32)}`);
  await page.getByRole("tab", { name: "البيانات", exact: true }).click();
  const data = page.getByRole("tabpanel");
  for (const heading of ["المصادر الخارجية", "الأنواع الفنية", "الطابع", "الكواكب"])
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
  await expect(data.getByText(/English|untranslated/)).toHaveCount(0);
});

test("overview shows the full summary while hero keeps four lines without expansion controls", async ({
  page,
}) => {
  await openWork(page);
  const paragraph = page.getByRole("tabpanel").getByText(summary, { exact: true });
  await expect(paragraph).toHaveText(summary);
  expect(await paragraph.evaluate((element) => getComputedStyle(element).webkitLineClamp)).toBe(
    "none",
  );
  const hero = page.getByRole("article", { name: "صفحة العمل" }).locator("header").first();
  expect(
    await hero
      .getByText(summary, { exact: true })
      .evaluate((element) => getComputedStyle(element).webkitLineClamp),
  ).toBe("4");
  await expect(page.getByRole("button", { name: "قراءة المزيد" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("tabpanel").locator('[data-kind="installment"]')).toHaveCount(3);
});

test("episode keyboard navigation follows physical RTL directions and details restore focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openWork(page);
  await expect(page.locator("#main-content")).toBeFocused();
  await openEpisodes(page);
  await expect(page.locator("#work-sections")).toBeFocused();
  const first = episodeCard(page, 1).getByRole("link", { name: /^فتح الحلقة 1/ });
  const second = episodeCard(page, 2).getByRole("link", { name: /^فتح الحلقة 2/ });
  await first.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(second).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(first).toBeFocused();
  await episodeCard(page, 1).getByRole("button", { name: "تفاصيل الحلقة 1" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(episodeCard(page, 4).getByRole("link", { name: /^فتح الحلقة 4/ })).toBeFocused();
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
});

test("whole episode cards are keyboard links with image focus, scoped actions and reloadable details", async ({
  page,
}) => {
  await openWork(page, `?installment=${seasonId}`);
  const card = episodeCard(page, 2);
  const link = card.getByRole("link", { name: /^فتح الحلقة 2/ });
  const destination = `#/titles/${workId}?installment=${seasonId}&episode=${id(102)}`;
  await expect(link).toHaveAttribute("href", destination);
  await expect(link.locator("button, a, input")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "تشغيل الحلقة 2" })).toBeEnabled();
  await expect(card.getByRole("button", { name: "تنزيل الحلقة 2" })).toBeEnabled();
  const image = link.locator(":scope > span").first();
  const idleShadow = await image.evaluate((element) => getComputedStyle(element).boxShadow);
  await link.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(link).toBeFocused();
  await expect
    .poll(() => image.evaluate((element) => getComputedStyle(element).boxShadow))
    .not.toBe(idleShadow);
  await link.press("Enter");
  const dialog = page.getByRole("dialog", { name: "2 · رحلة الحلقة 2" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`episode=${id(102)}$`));
  await expect(dialog.getByRole("heading", { name: "2 · رحلة الحلقة 2" })).toBeFocused();
  expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(link).toBeFocused();
  expect(new URL((await link.getAttribute("href")) ?? "", "http://localhost").hash).toBe(
    destination,
  );
  await link.click();
  await page.reload();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).hash).not.toContain("episode=");
  expect(await requests(page, "setWatched")).toEqual([]);
});

test("work activity loads on demand, hides spoilers, renders plain text and paginates without duplicates", async ({
  page,
}) => {
  await openWork(page, `?installment=${seasonId}`);
  expect(await requests(page, "workActivity")).toEqual([]);
  await page.getByRole("tab", { name: "الملف", exact: true }).click();
  const discussion = page.getByRole("region", { name: "آراء العائلة ونقاشها", exact: true });
  await expect(discussion).toBeVisible();
  await expect(discussion.getByText(activity[0].body, { exact: true })).toHaveCount(0);
  await expect(discussion.getByText("فرد العائلة 0", { exact: true })).toBeVisible();
  await expect(discussion.getByText("4 / 5", { exact: true })).toBeVisible();
  await expect(discussion.getByText("تعليق العائلة 19", { exact: true })).toBeVisible();
  await expect(discussion.getByText("تعليق العائلة 20", { exact: true })).toHaveCount(0);
  // Dev StrictMode may cancel the mount request and send one replacement; neither may preload page 2.
  const firstPageRequests = await requests(page, "workActivity");
  expect(firstPageRequests.length).toBeGreaterThanOrEqual(1);
  expect(firstPageRequests.length).toBeLessThanOrEqual(2);
  for (const request of firstPageRequests) expect(request).toEqual({ id: workId, page: 1 });
  const reveal = discussion.getByRole("button", { name: "إظهار محتوى يحوي حرقًا للأحداث" });
  await reveal.focus();
  await page.keyboard.press("Enter");
  await expect(discussion.getByText(activity[0].body, { exact: true })).toBeVisible();
  await expect(discussion.locator("script")).toHaveCount(0);
  expect(await page.evaluate(() => "spoilerExecuted" in window)).toBe(false);
  const more = discussion.getByRole("button", { name: "عرض المزيد", exact: true });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(discussion.getByText("تعليق العائلة 20", { exact: true })).toBeVisible();
  await expect(discussion.getByText("ردّ", { exact: true })).toBeVisible();
  await expect(more).toHaveCount(0);
  await expect(discussion.getByText(activity[0].body, { exact: true })).toBeVisible();
  expect(await requests(page, "workActivity")).toEqual([
    ...firstPageRequests,
    { id: workId, page: 2 },
  ]);
  for (let index = 0; index < activity.length; index++)
    await expect(discussion.getByText(`فرد العائلة ${index}`, { exact: true })).toHaveCount(1);
  expect(await requests(page, "setWatched")).toEqual([]);
});

const riskCard = (page: Page, label: string) =>
  page
    .getByRole("tabpanel")
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: label, exact: true }) });

test("risk cards separate sexuality and behavior from theology with distinct severity colors", async ({
  page,
}) => {
  await openWork(page);
  const content = riskCard(page, "تنبيه المحتوى");
  const theology = riskCard(page, "ملاحظات التحليل");
  await expect(content).toHaveCount(1);
  await expect(theology).toHaveCount(1);
  const sidebar = page.getByRole("complementary", { name: "لمحة العمل" });
  for (const label of ["المحتوى الجنسي", "العنف والسلوك", "الموضوعات العقدية"]) {
    await expect(sidebar.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText(label, { exact: true })).toHaveCount(0);
  }
  const low = sidebar.locator('[data-slot="badge"]').filter({ hasText: /^منخفض$/ });
  const medium = content.locator('[data-slot="badge"]').filter({ hasText: /^متوسط$/ });
  const high = theology.locator('[data-slot="badge"]').filter({ hasText: /^مرتفع$/ });
  const palettes = [];
  for (const badge of [low, medium, high]) {
    await expect(badge).toBeVisible();
    palettes.push(
      await badge.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          color: style.color,
          background: style.backgroundColor,
          border: style.borderTopColor,
        };
      }),
    );
  }
  expect(new Set(palettes.map((palette) => palette.color)).size).toBe(3);
  expect(new Set(palettes.map((palette) => palette.background)).size).toBe(3);
  expect(new Set(palettes.map((palette) => palette.border)).size).toBe(3);
});

test("decimal episode labels are normalized everywhere without changing mutation identities", async ({
  page,
}) => {
  await openWork(page, `?installment=${seasonId}`);
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(episodeCard(page, 1).getByText("1", { exact: true })).toBeVisible();
  await expect(episodeCard(page, 2).getByText("2", { exact: true })).toBeVisible();
  await expect(panel.getByText(/^[12]\.00$/)).toHaveCount(0);
  const fractional = page.getByRole("article", { name: "الحلقة 9.5", exact: true });
  await expect(fractional).toBeVisible();
  await expect(fractional.getByText("9.5", { exact: true })).toBeVisible();
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

test("tab and season changes preserve the main scroll position instead of restoring parameter routes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await openWork(page);
  const tablist = page.getByRole("tablist", { name: "أقسام العمل" });
  const before = await tablist.evaluate((element) => {
    const main = document.getElementById("main-content");
    if (!main) throw new Error("Main viewing scroll container missing");
    main.scrollTop += element.getBoundingClientRect().top - main.getBoundingClientRect().top - 24;
    return main.scrollTop;
  });
  expect(before).toBeGreaterThan(300);
  const scrollTop = () => page.locator("#main-content").evaluate((element) => element.scrollTop);
  for (const tab of ["الأجزاء", "التقييم", "البيانات", "الصنّاع", "الملف", "الأجزاء"]) {
    await tablist.getByRole("tab", { name: tab, exact: true }).click();
    await expect(tablist.getByRole("tab", { name: tab, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect.poll(async () => Math.abs((await scrollTop()) - before)).toBeLessThan(2);
  }
  const selector = page.getByRole("button", { name: "الموسم الأول", exact: true });
  // Align the selector before measuring so Playwright's ordinary click scrolling isn't mistaken for a route reset.
  await selector.scrollIntoViewIfNeeded();
  const beforeSeason = await scrollTop();
  await selector.click();
  await page.getByRole("button", { name: "الموسم القادم 2 حلقة", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${futureSeasonId}&tab=installments$`));
  await expect.poll(async () => Math.abs((await scrollTop()) - beforeSeason)).toBeLessThan(2);
  const nextSelector = page.getByRole("button", { name: "الموسم القادم", exact: true });
  await expect(nextSelector).toBeFocused();
  await nextSelector.click();
  await page.getByRole("button", { name: "الموسم الأول 9 حلقة", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`installment=${seasonId}&tab=installments$`));
  await expect.poll(async () => Math.abs((await scrollTop()) - beforeSeason)).toBeLessThan(2);
});

test("data starts with safe direct source links, rich planet navigation, and removes populated identity aliases and artwork", async ({
  page,
}) => {
  await openWork(page, "?tab=data");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading").first()).toHaveText("المصادر الخارجية");
  const sources = panel.getByRole("region", { name: "المصادر الخارجية", exact: true });
  for (const [label, href] of [
    ["IMDb", "https://www.imdb.com/title/tt1234567/"],
    ["TMDB", "https://www.themoviedb.org/tv/1234"],
    ["AniList", "https://anilist.co/anime/2345"],
    ["MyAnimeList", "https://myanimelist.net/anime/3456"],
    ["موقع الحكاية", "https://example.test/library"],
  ]) {
    const link = sources.getByRole("link", { name: new RegExp(`^${label} زيارة صفحة العمل`) });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("rel", /noreferrer/);
  }
  await expect(sources.getByRole("link")).toHaveCount(5);
  await expect(panel.locator('a[href^="javascript:"]')).toHaveCount(0);
  const referenceDetails = sources
    .locator("details")
    .filter({ has: page.locator("summary").getByText("تفاصيل المراجع المسجّلة", { exact: true }) });
  await expect(referenceDetails).not.toHaveAttribute("open", "");
  const planet = panel.getByRole("link", { name: "أعمال كوكب الخيال العائلي", exact: true });
  await expect(planet).toHaveAttribute("href", "#/planets/family-fantasy");
  await expect(planet.getByRole("heading", { name: "الخيال العائلي", exact: true })).toBeVisible();
  await expect(planet).toContainText(work.planets[0].description);
  await expect(planet.getByText("عمل بارز في الكوكب", { exact: true })).toBeVisible();
  expect(
    await planet.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      border: getComputedStyle(element).borderTopColor,
    })),
  ).toEqual({ background: "rgb(51, 36, 84)", border: "rgb(198, 167, 255)" });
  for (const heading of ["هوية العمل", "الأسماء البديلة", "الصور المحفوظة"])
    await expect(panel.getByRole("heading", { name: heading, exact: true })).toHaveCount(0);
  await expect(panel.getByText("اسم بديل لا يعرض هنا", { exact: true })).toHaveCount(0);
  await expect(panel.getByText(work.canonicalTitle, { exact: true })).toHaveCount(0);
  await expect(panel.getByRole("img")).toHaveCount(0);
  await expect(panel.getByText("removed-work-art.png", { exact: true })).toHaveCount(0);
});

test("score explanation and textual score table remain collapsed and keyboard-expandable", async ({
  page,
}) => {
  await openWork(page, "?tab=scores");
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("heading", { name: "بصمة التقييم", exact: true })).toBeVisible();
  const explanation = panel
    .locator("details")
    .filter({ has: page.locator("summary").getByText("كيف يُحسب التقييم؟", { exact: true }) });
  await expect(explanation).toHaveCount(1);
  await expect(explanation).not.toHaveAttribute("open", "");
  await expect(explanation.getByText(/لا تُعاد موازنة المعايير الناقصة/)).toBeHidden();
  const trigger = explanation.locator(":scope > summary");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(explanation).toHaveAttribute("open", "");
  await expect(explanation.getByText(/لا تُعاد موازنة المعايير الناقصة/)).toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(explanation).not.toHaveAttribute("open", "");
  const tableDetails = panel.locator("details").filter({
    has: page.locator("summary").getByText("كل درجات الأجزاء · بديل نصّي للرسوم", { exact: true }),
  });
  await expect(tableDetails).not.toHaveAttribute("open", "");
  await tableDetails.locator("summary").press("Enter");
  const table = tableDetails.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("row").filter({ hasText: "الموسم القادم" })).toContainText(
    "غير مقيّم",
  );
});

test("richer crew cards link the whole summary without extra role disclosures", async ({
  page,
}) => {
  await openWork(page, "?tab=creators");
  const panel = page.getByRole("tabpanel");
  const person = panel.getByRole("link", { name: "أعمال ليلى الكاتبة", exact: true });
  const organization = panel.getByRole("link", { name: "أعمال استوديو المكتبة", exact: true });
  await expect(person).toHaveAttribute("href", `#/people/${id(30)}`);
  await expect(person).toContainText("كاتبة الحكاية");
  await expect(person).toContainText("تأليف القصة");
  await expect(person.getByText("كتابة", { exact: true })).toBeVisible();
  await expect(person.getByText("دور رئيسي", { exact: true })).toBeVisible();
  await expect(organization).toHaveAttribute("href", `#/studios/${id(32)}`);
  await expect(organization).toContainText("جهة إنتاج حكايات العائلة");
  await expect(organization).toContainText("تنفيذ الرسوم وإنتاج الموسم");
  const card = panel.getByRole("article").filter({
    has: page.getByRole("link", { name: "أعمال ليلى الكاتبة", exact: true }),
  });
  await expect(card.locator("details")).toHaveCount(0);
  await expect(card.getByText("ليلى المؤلفة", { exact: true })).toHaveCount(0);
  await person.focus();
  await expect(person).toBeFocused();
});

test("arrows reach work actions, watched controls, panel links and disclosures without activating them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWork(page);
  const episodes = page.getByRole("button", { name: "الأجزاء والحلقات", exact: true });
  const favorite = page.getByRole("button", { name: "إضافة إلى المفضلة", exact: true });
  const watched = page.getByRole("button", { name: "تحديد العمل كمُشاهَد", exact: true });
  await episodes.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(favorite).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(watched).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(favorite).toBeFocused();
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
  await expect(
    episodeCard(page, 2).getByRole("button", { name: "تحديد الحلقة 2 كمُشاهَد", exact: true }),
  ).toBeFocused();
  expect(await requests(page, "setWatched")).toEqual([]);
  const crewTab = page.getByRole("tab", { name: "الصنّاع", exact: true });
  await crewTab.click();
  await crewTab.focus();
  await page.keyboard.press("ArrowDown");
  const person = page.getByRole("link", { name: "أعمال ليلى الكاتبة", exact: true });
  await expect(person).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("link", { name: "أعمال استوديو المكتبة", exact: true }),
  ).toBeFocused();
  const scoreTab = page.getByRole("tab", { name: "التقييم", exact: true });
  await scoreTab.click();
  await scoreTab.focus();
  await page.keyboard.press("ArrowDown");
  const tableDisclosure = page
    .getByRole("tabpanel")
    .locator("details")
    .filter({
      has: page.locator("summary").getByText("كل درجات الأجزاء · بديل نصّي للرسوم", { exact: true }),
    });
  await expect(tableDisclosure.locator(":scope > summary")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const explanation = page
    .getByRole("tabpanel")
    .locator("details")
    .filter({
      has: page.locator("summary").getByText("كيف يُحسب التقييم؟", { exact: true }),
    });
  await expect(explanation.locator(":scope > summary")).toBeFocused();
  await expect(explanation).not.toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(explanation).toHaveAttribute("open", "");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const width of [520, 1440]) {
  test(`work recommendations ${width}: explanations, equal hero controls and reachable cards`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openWork(page);
    const hero = page.locator("article > header");
    const download = hero.getByRole("button", { name: "تنزيل الفيديو", exact: true });
    const save = hero.getByRole("button", { name: "حفظ بيانات العمل وصوره للجهاز", exact: true });
    await expect(download).toBeVisible();
    await expect(save).toBeVisible();
    expect((await download.boundingBox())?.height).toBe(48);
    expect((await save.boundingBox())?.height).toBe(48);
    await expect(download).toHaveText("");
    const section = page.getByRole("region", { name: "أعمال قد تعجبك" });
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByText("80% تشابه").first()).toBeVisible();
    await section.getByRole("button", { name: "لماذا اقتُرح هذا العمل؟" }).first().click();
    await expect(page.getByRole("dialog", { name: "لماذا هذا الاقتراح؟" })).toContainText("مغامرة");
    await page.keyboard.press("Escape");
    const cards = section.getByRole("listitem");
    await expect(cards).toHaveCount(10);
    const tops = await cards.evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(width === 1440 ? 2 : 5);
    await expect(section.getByText("اقتراح 10", { exact: true })).toBeAttached();
    await expectNoOverflow(page);
    await page.screenshot({
      path: `/tmp/nahhasio-work-recommendations-${width}.png`,
      fullPage: true,
    });
  });
}

for (const width of [520, 1440]) {
  test(`watch page ${width}: source failure keeps episodes and discussion usable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openWork(page);
    await page.getByRole("button", { name: "تشغيل", exact: true }).click();
    const watch = page.getByRole("main", { name: "صفحة المشاهدة" });
    await expect(watch).toBeVisible();
    const sources = watch.getByLabel("مصادر الفيديو", { exact: true });
    await sources.getByRole("tab", { name: "خوادم الفيديو", exact: true }).click();
    await sources
      .getByRole("button", { name: /^خيارات إضافية/u })
      .last()
      .click();
    await expect(
      sources.getByRole("button", { name: "المشاهدة عبر VidSrc", exact: true }),
    ).toBeVisible();
    await sources.getByRole("tab", { name: "تورنت", exact: true }).click();
    await expect(sources).toContainText("تعذّر الوصول إلى Torrentio");
    await expect(watch.getByLabel("حلقات العمل", { exact: true })).toBeVisible();
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
    await comment.getByRole("button", { name: "تعديل تعليقك", exact: true }).click();
    await watch.getByLabel("تعديل التعليق", { exact: true }).fill("تعليق معدّل");
    await watch.getByRole("button", { name: "حفظ التعديل", exact: true }).click();
    await expect(watch.getByText("تعليق معدّل", { exact: true })).toBeVisible();
    await expectNoOverflow(page);
    await expect
      .poll(async () => (await requests(page, "player.viewport")).length)
      .toBeGreaterThan(0);
    await watch.getByRole("button", { name: "العودة", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/nahhasio-watch-${width}.png`, fullPage: true });
    await expect(
      watch.getByLabel("حلقات العمل", { exact: true }).getByRole("button").first(),
    ).toBeVisible();
    if (width === 520)
      await watch
        .getByLabel("حلقات العمل", { exact: true })
        .getByRole("button", { name: /^إظهار الحلقات/u })
        .click();
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
      "تعذّر الوصول إلى Torrentio",
    );
    await expect(watch.getByLabel("حلقات العمل", { exact: true })).toHaveCount(0);
    await expect(watch.getByRole("button", { name: "توسيع الفيديو", exact: true })).toBeVisible();
    await expect(watch.getByRole("button", { name: "التالية", exact: true })).toHaveCount(0);
    const info = watch.getByLabel("معلومات الفيلم", { exact: true });
    await info.scrollIntoViewIfNeeded();
    await expect(info.getByRole("heading", { name: "فيلم المكتبة", exact: true })).toBeVisible();
    await expect(info).not.toContainText("0 حلقة");
    await expect(info.getByRole("link", { name: /استوديو المكتبة/u })).toBeVisible();
    await expect(info.getByLabel("أعمال مقترحة للمشاهدة")).toHaveCount(0);
    await expect(info.getByRole("button", { name: "الجزء السابق", exact: true })).toBeEnabled();
    await expect(watch.getByLabel("تفاصيل المشاهدة").locator("details")).toHaveCount(0);
    await expect(
      watch.getByLabel("تفاصيل المشاهدة").getByRole("heading", { name: "عن الفيلم" }),
    ).toBeAttached();
    await expectNoOverflow(page);
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
  await page.getByRole("button", { name: "تشغيل", exact: true }).click();
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
  await expect(
    watch
      .getByLabel("تفاصيل المشاهدة")
      .getByRole("heading", { name: "عن العرض الخاص", exact: true }),
  ).toBeVisible();
  await info.getByRole("button", { name: "الجزء السابق", exact: true }).click();
  await expect(watch.getByLabel("حلقات العمل", { exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test("watch page local file: no sidebar, one filename and fullscreen in bottom controls", async ({
  page,
}) => {
  await openWork(page);
  await page.getByRole("button", { name: "تشغيل", exact: true }).click();
  const watch = page.getByRole("main", { name: "صفحة المشاهدة" });
  await watch.getByRole("button", { name: "خيارات المصدر", exact: true }).click();
  await page.getByRole("menuitem", { name: "فتح فيديو من الجهاز", exact: true }).click();
  await expect(watch.getByRole("heading", { name: "Frieren.mkv", exact: true })).toBeVisible();
  await expect(watch.getByText("Frieren.mkv", { exact: true })).toHaveCount(1);
  await expect(watch.getByLabel("حلقات العمل", { exact: true })).toHaveCount(0);
  await expect(watch.getByRole("button", { name: "توسيع الفيديو", exact: true })).toHaveCount(0);
  const player = watch.getByRole("region", { name: "مشغّل الفيديو", exact: true });
  await expect(player.locator("header")).toHaveCount(0);
  await expect(player.getByRole("button", { name: "الحلقات", exact: true })).toHaveCount(0);
  await expect(
    player.locator("footer").getByRole("button", { name: "ملء الشاشة", exact: true }),
  ).toBeVisible();
  await expectNoOverflow(page);
});

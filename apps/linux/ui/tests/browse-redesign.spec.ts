import type { WorkDetail, WorkSummary } from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";

const work: WorkSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  isPrivate: false,
  score: { rating: 7.1, scored: 1, total: 1 },
  canonicalTitle: "A library work",
  titleAr: "رحلة في المكتبة",
  summary: "حكاية من مكتبة العائلة",
  releaseYear: 2021,
  format: "animated",
  audience: "general",
  age: "7+",
  poster: null,
  banner: null,
  logo: null,
  installmentCount: 1,
  episodeCount: 2,
};
const detail: WorkDetail = {
  ...work,
  contentWarnings: "تنبيه تحريري محفوظ",
  analysisNotes: "قراءة نقدية للعمل",
  sexualityRisk: "none",
  behavioralRisk: "low",
  theologyRisk: "medium",
  externalIds: { tmdbId: null, imdbId: null, anilistId: null, malId: null },
  aliases: [],
  trivia: [],
  genres: [],
  contributions: [],
  relations: [],
  artwork: [],
  installments: [
    {
      id: "00000000-0000-4000-8000-000000000007",
      kind: "season",
      position: 1,
      title: "الموسم القادم",
      summary: "جزء قادم من حكاية العائلة",
      releaseDate: "2027-01-02",
      runtimeMinutes: null,
      status: "announced",
      externalIds: { tmdbId: null, imdbId: null, anilistId: null, malId: null },
      scores: null,
      hasMediaFile: false,
      artwork: [],
      episodes: [],
      classification: {
        audience: "general",
        age: "7+",
        sexualityRisk: "none",
        behavioralRisk: "low",
        theologyRisk: "medium",
      },
      classificationOverrides: {
        audience: null,
        age: null,
        sexualityRisk: null,
        behavioralRisk: null,
        theologyRisk: null,
      },
      releaseState: "upcoming",
      externalReferences: [],
      mediaFiles: [],
      createdAt: "2026-10-08",
      updatedAt: "2026-10-08",
    },
  ],
  curatorNotes: "",
  qualityScore: 80,
  verifiedAt: null,
  createdAt: "2026-10-08",
  updatedAt: "2026-10-08",
  externalReferences: [],
  tones: [],
  tags: [],
  countries: [],
  planets: [],
  awards: [],
  sortTitle: "A library work",
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ work: fixtureWork, detail: fixtureDetail }) => {
      const session = {
        user: {
          id: "test-owner",
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
      };
      let signedIn = false;
      let favorite = false;
      const viewerState = (id: string) => ({
        workId: id,
        isFavorite: favorite,
        units: [],
        summary: {
          catalogUnits: 0,
          releasedUnits: 0,
          watchedReleasedUnits: 0,
          isFullyWatched: false,
          watchState: "unwatched",
        },
        installments: fixtureDetail.installments.map((item) => ({
          installmentId: item.id,
          summary: {
            catalogUnits: 0,
            releasedUnits: 0,
            watchedReleasedUnits: 0,
            isFullyWatched: false,
            watchState: "unwatched",
          },
        })),
      });
      window.webkit = {
        messageHandlers: {
          nahhasio: {
            postMessage: (message: string) => {
              const request = JSON.parse(message);
              let result;
              switch (request.command) {
                case "servers.list":
                  result = {
                    selected: "http://127.0.0.1:23103/",
                    servers: [{ url: "http://127.0.0.1:23103/", name: "مكتبة الاختبار" }],
                  };
                  break;
                case "browsePreferences.load":
                  result = null;
                  break;
                case "browsePreferences.save":
                  result = { ok: true };
                  break;
                case "offline.status":
                  result = {
                    scope: null,
                    active: false,
                    offline: false,
                    name: null,
                    pending: 0,
                    job: null,
                  };
                  break;
                case "session":
                  result = signedIn ? session : null;
                  break;
                case "loginAccounts":
                  result = [];
                  break;
                case "login":
                  if (request.payload.password !== "fixture-password") {
                    window["__nahhasioReply"]?.({
                      id: request.id,
                      ok: false,
                      error: { message: "بيانات الدخول غير صحيحة", code: "unauthorized" },
                    });
                    return;
                  }
                  signedIn = true;
                  result = session;
                  break;
                case "logout":
                  signedIn = false;
                  result = null;
                  break;
                case "home":
                  result = {
                    comments: [
                      {
                        id: "00000000-0000-4000-8000-000000000006",
                        kind: "comment",
                        body: "حرق أحداث محفوظ",
                        containsSpoilers: true,
                        rating: null,
                        createdAt: "2026-10-08T12:00:00Z",
                        authorName: "أحد أفراد العائلة",
                        avatarKey: "default",
                        work: fixtureWork,
                      },
                    ],
                    upcoming: [
                      {
                        id: "00000000-0000-4000-8000-000000000007",
                        workId: fixtureWork.id,
                        workTitle: fixtureWork.canonicalTitle,
                        workTitleAr: fixtureWork.titleAr,
                        title: "الموسم القادم",
                        kind: "season",
                        releaseDate: "2027-01-02",
                        runtimeMinutes: null,
                        episodeCount: 12,
                        poster: null,
                        score: { rating: null, scored: 0, total: 1 },
                      },
                    ],
                  };
                  break;
                case "releases": {
                  const query = request.payload;
                  const base = {
                    workId: fixtureWork.id,
                    workTitle: fixtureWork.canonicalTitle,
                    workTitleAr: fixtureWork.titleAr,
                    installmentId: fixtureDetail.installments[0].id,
                    installmentTitle: "الموسم القادم",
                    installmentKind: "season",
                    episodeNumber: null,
                    runtimeMinutes: 24,
                    status: "announced",
                    episodeCount: 12,
                    poster: null,
                  };
                  let entries = [
                    {
                      ...base,
                      id: fixtureDetail.installments[0].id,
                      kind: "installment",
                      title: "الموسم القادم",
                      releaseDate: "2027-01-02",
                    },
                    {
                      ...base,
                      id: "00000000-0000-4000-8000-000000000008",
                      kind: "episode",
                      title: "بداية جديدة",
                      episodeNumber: "1",
                      episodeCount: null,
                      releaseDate: "2027-01-02",
                    },
                    {
                      ...base,
                      id: "00000000-0000-4000-8000-000000000009",
                      kind: "installment",
                      title: "جزء بلا موعد",
                      releaseDate: null,
                    },
                  ];
                  if (query.kind === "episodes")
                    entries = entries.filter((item) => item.kind === "episode");
                  if (query.kind === "installments")
                    entries = entries.filter((item) => item.kind === "installment");
                  if (query.scope === "undated")
                    entries = entries.filter((item) => item.releaseDate === null);
                  else if (query.scope === "upcoming")
                    entries = entries.filter((item) => item.releaseDate !== null);
                  else
                    entries = entries.filter(
                      (item) =>
                        item.releaseDate !== null &&
                        Number(item.releaseDate.slice(0, 4)) === (query.year ?? 2026) &&
                        (!query.month || Number(item.releaseDate.slice(5, 7)) === query.month) &&
                        (!query.day || Number(item.releaseDate.slice(8)) === query.day),
                    );
                  const counts = new Map<string, number>();
                  for (const item of entries)
                    if (item.releaseDate)
                      counts.set(item.releaseDate, (counts.get(item.releaseDate) ?? 0) + 1);
                  result = {
                    items: entries.slice(0, query.pageSize ?? 24),
                    total: entries.length,
                    page: query.page ?? 1,
                    pageSize: query.pageSize ?? 24,
                    years: [2027],
                    asOf: "2026-10-11",
                    days: [...counts].map(([date, count]) => ({ date, count })),
                  };
                  break;
                }
                case "filters":
                  result = {
                    planets: [
                      {
                        id: "00000000-0000-4000-8000-000000000002",
                        slug: "fantasy",
                        nameAr: "الخيال",
                        nameEn: "Fantasy",
                        icon: "🪄",
                        primaryColor: "#C6A7FF",
                        secondaryColor: "#332454",
                        count: 1,
                      },
                    ],
                    genres: [],
                    formats: ["animated", "live-action"],
                    audiences: ["general"],
                    statuses: ["completed"],
                    yearMin: 2021,
                    yearMax: 2021,
                  };
                  break;
                case "facets":
                  result = {
                    groups: [
                      {
                        key: "watchStates",
                        label: "حالة المشاهدة",
                        options: [{ value: "unwatched", label: "لم يُشاهَد", count: 2 }],
                      },
                      {
                        key: "favoriteStates",
                        label: "المفضلة",
                        options: [
                          { value: "other", label: "خارج المفضلة", count: 2 },
                          { value: "favorite", label: "في المفضلة", count: 0 },
                        ],
                      },
                      {
                        key: "ratingStates",
                        label: "حالة التقييم",
                        options: [{ value: "rated", label: "مقيّم", count: 2 }],
                      },
                      {
                        key: "playableStates",
                        label: "وجود فيديو مسجّل",
                        options: [
                          { value: "missing", label: "لا يوجد فيديو مسجّل", count: 2 },
                          { value: "available", label: "فيديو مسجّل", count: 0 },
                        ],
                      },
                      {
                        key: "genres",
                        label: "الأنواع الفنية",
                        options: [
                          {
                            value: "adventure",
                            label: "مغامرة",
                            count: 18,
                            searchTerms: ["Adventure"],
                          },
                          {
                            value: "science-fiction",
                            label: "خيال علمي",
                            count: 12,
                            searchTerms: ["Science Fiction", "Sci-fi"],
                          },
                          { value: "drama", label: "دراما", count: 24, searchTerms: ["Drama"] },
                          { value: "comedy", label: "كوميديا", count: 16, searchTerms: ["Comedy"] },
                          { value: "mystery", label: "غموض", count: 8, searchTerms: ["Mystery"] },
                          {
                            value: "animation",
                            label: "رسوم متحركة",
                            count: 21,
                            searchTerms: ["Animation"],
                          },
                        ],
                      },
                      {
                        key: "countries",
                        label: "البلدان",
                        options: [
                          { value: "jp", label: "اليابان", count: 18, searchTerms: ["Japan"] },
                          {
                            value: "us",
                            label: "الولايات المتحدة",
                            count: 22,
                            searchTerms: ["United States", "USA"],
                          },
                        ],
                      },
                      {
                        key: "planets",
                        label: "الكواكب",
                        options: [
                          {
                            value: "fantasy",
                            label: "الخيال",
                            count: 1,
                            searchTerms: ["Fantasy", "fantasy-world"],
                          },
                        ],
                      },
                      {
                        key: "formats",
                        label: "الصيغة",
                        options: [
                          { value: "animated", label: "رسوم متحركة", count: 1 },
                          { value: "live-action", label: "تمثيل حي", count: 1 },
                        ],
                      },
                      {
                        key: "releaseStatuses",
                        label: "حالة الإصدار",
                        options: [{ value: "completed", label: "مكتمل", count: 2 }],
                      },
                    ],
                    yearMin: 2021,
                    yearMax: 2021,
                  };
                  break;

                case "browse": {
                  const filters = JSON.parse(request.payload.filters);
                  let items = [
                    fixtureWork,
                    {
                      ...fixtureWork,
                      id: "00000000-0000-4000-8000-000000000003",
                      titleAr: "رحلة أخرى",
                      format: "live-action",
                    },
                    {
                      ...fixtureWork,
                      id: "00000000-0000-4000-8000-000000000004",
                      titleAr: "عمل خاص",
                      isPrivate: true,
                    },
                  ].filter(
                    (item) =>
                      request.payload.privacy === "all" ||
                      item.isPrivate === (request.payload.privacy === "private"),
                  );
                  for (const facet of filters.facets) {
                    items = items.filter((item) => {
                      const value =
                        facet.key === "formats"
                          ? item.format
                          : facet.key === "dubLanguages"
                            ? "ar"
                            : facet.key === "watchStates"
                              ? "unwatched"
                              : facet.key === "favoriteStates"
                                ? "other"
                                : facet.key === "ratingStates"
                                  ? "rated"
                                  : facet.key === "playableStates"
                                    ? "missing"
                                    : facet.key === "kinds"
                                      ? item.id === fixtureWork.id
                                        ? "animated-movie"
                                        : "live-action-series"
                                      : facet.key === "planets"
                                        ? item.id === fixtureWork.id || item.isPrivate
                                          ? "fantasy"
                                          : ""
                                        : facet.key === "releaseStatuses"
                                          ? "completed"
                                          : "";
                      return (
                        (!facet.include.length || facet.include.includes(value)) &&
                        !facet.exclude.includes(value)
                      );
                    });
                  }
                  if (request.payload.yearFrom)
                    items = items.filter(
                      (item) =>
                        item.releaseYear !== null && item.releaseYear >= request.payload.yearFrom,
                    );
                  if (request.payload.yearTo)
                    items = items.filter(
                      (item) =>
                        item.releaseYear !== null && item.releaseYear <= request.payload.yearTo,
                    );
                  if (filters.minimumRating)
                    items = items.filter(
                      (item) =>
                        item.score.rating !== null && item.score.rating >= filters.minimumRating,
                    );
                  if (Object.values(filters.minimumScores).some((minimum) => Number(minimum) > 7))
                    items = [];
                  if (request.payload.sort === "title")
                    items.sort((a, b) =>
                      (a.titleAr ?? a.canonicalTitle).localeCompare(
                        b.titleAr ?? b.canonicalTitle,
                        "ar",
                      ),
                    );
                  if (request.payload.q)
                    items = items.filter((item) =>
                      `${item.titleAr} ${item.canonicalTitle}`.includes(request.payload.q),
                    );
                  result = {
                    items: items
                      .slice(
                        (request.payload.page - 1) * request.payload.pageSize,
                        request.payload.page * request.payload.pageSize,
                      )
                      .map((item) => ({
                        work: item,
                        installment:
                          request.payload.view === "installments"
                            ? {
                                id: item.id,
                                workId: item.id,
                                workTitle: item.canonicalTitle,
                                workTitleAr: item.titleAr,
                                title: fixtureDetail.installments[0].title,
                                kind: fixtureDetail.installments[0].kind,
                                releaseDate: fixtureDetail.installments[0].releaseDate,
                                runtimeMinutes: fixtureDetail.installments[0].runtimeMinutes,
                                score: item.score,
                                episodeCount: 0,
                                poster: item.poster,
                              }
                            : null,
                        classification: {
                          audience: item.audience,
                          age: item.age,
                          sexualityRisk: "none",
                          behavioralRisk: "low",
                          theologyRisk: "medium",
                        },
                        status: "completed",
                        watchState: item.id === fixtureWork.id ? "watched" : "unwatched",
                        criteria: {
                          story: 7,
                          characters: 7,
                          depth: 7,
                          worldBuilding: 7,
                          originality: 8,
                          craft: 7,
                        },
                      })),
                    total: items.length,
                    page: request.payload.page,
                    pageSize: request.payload.pageSize,
                  };
                  break;
                }
                case "works":
                  result = {
                    items:
                      request.payload.q === "missing"
                        ? []
                        : [
                            fixtureWork,
                            ...(request.payload.planet
                              ? []
                              : [
                                  {
                                    ...fixtureWork,
                                    id: "00000000-0000-4000-8000-000000000003",
                                    titleAr: "رحلة أخرى",
                                  },
                                ]),
                            ...(request.payload.includePrivate
                              ? [
                                  {
                                    ...fixtureWork,
                                    id: "00000000-0000-4000-8000-000000000004",
                                    titleAr: "عمل خاص",
                                    isPrivate: true,
                                  },
                                ]
                              : []),
                          ],
                    page: request.payload.page ?? 1,
                    pageSize: request.payload.pageSize ?? 10,
                    total:
                      request.payload.q === "missing"
                        ? 0
                        : (request.payload.planet ? 1 : 2) +
                          (request.payload.includePrivate ? 1 : 0),
                  };
                  break;
                case "workState":
                  result = viewerState(request.payload.id);
                  break;
                case "setFavorite":
                  favorite = request.payload.isFavorite;
                  result = viewerState(request.payload.workId);
                  break;
                case "setWatched":
                  result = viewerState(request.payload.workId);
                  break;
                case "workActivity":
                  result = {
                    workId: request.payload.id,
                    items: [],
                    total: 0,
                    page: request.payload.page ?? 1,
                    pageSize: 20,
                  };
                  break;
                case "work":
                  result = {
                    ...fixtureDetail,
                    id: request.payload.id,
                    titleAr:
                      request.payload.id === fixtureWork.id ? fixtureWork.titleAr : "رحلة أخرى",
                  };
                  break;
                default:
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { message: "Unknown fixture command", code: "bad_request" },
                  });
                  return;
              }
              queueMicrotask(() =>
                window["__nahhasioReply"]?.({ id: request.id, ok: true, result }),
              );
            },
          },
        },
      };
    },
    { work, detail },
  );
  await page.goto("/");
});
test.use({ viewport: { width: 1440, height: 1000 } });
async function openBrowse(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني" }).click();
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "دخول المكتبة", exact: true }).click();
  await expect(page.getByRole("button", { name: "الملف والحساب", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "تصفّح المكتبة", exact: true }).click();
  await expect(page.getByRole("heading", { name: "تصفّح المكتبة", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^المرشحات/ }).click();
  return page.getByRole("dialog");
}
test("multilingual search, three-state cycle, apply/cancel and focus", async ({ page }) => {
  const dialog = await openBrowse(page);
  const search = dialog.getByRole("textbox", { name: "ابحث في المرشحات" });
  await expect(search).toBeFocused();
  await search.fill("FANTASY");
  const include = dialog.getByRole("button", { name: /^الخيال،/ });
  await expect(include).toBeVisible();
  await include.click();
  await expect(include).toHaveAttribute("aria-pressed", "true");
  await include.click();
  await expect(include).toHaveAttribute("aria-pressed", "mixed");
  await include.click();
  await expect(include).toHaveAttribute("aria-pressed", "false");
  await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(page).not.toHaveURL(/fantasy/);
  await expect(page.getByRole("button", { name: /^المرشحات/ })).toBeFocused();
  await page.getByRole("button", { name: /^المرشحات/ }).click();
  await search.fill("fantasy-world");
  await include.click();
  await dialog.getByRole("button", { name: /^تطبيق المرشحات/ }).click();
  await expect(page).toHaveURL(/fantasy/);
  await page.getByRole("button", { name: /^المرشحات/ }).click();
  await dialog.getByRole("button", { name: /مراجعة الاختيارات/ }).click();
  await expect(dialog.getByRole("button", { name: /إزالة.*الخيال/ })).toBeVisible();
  await search.fill("");
  await page.screenshot({
    path: "../../../data/previews/browse-filters-redesign.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: "../../../data/previews/browse-redesign.png",
    animations: "disabled",
  });
});
test("narrow drawer, year slider and empty filter search", async ({ page }) => {
  await page.setViewportSize({ width: 520, height: 900 });
  const dialog = await openBrowse(page);
  await dialog.getByRole("textbox", { name: "ابحث في المرشحات" }).fill("nothing-matches");
  await expect(dialog.getByText("لا توجد مرشحات مطابقة", { exact: true })).toBeVisible();
  await dialog.getByRole("textbox", { name: "ابحث في المرشحات" }).fill("");
  await dialog.getByRole("button", { name: "الإصدار ومكتبتي", exact: true }).click();
  const years = dialog.locator('[data-slot="slider"][aria-label="سنوات الإصدار"]');
  await expect(years).toBeVisible();
  await expect(years.getByRole("slider")).toHaveCount(2);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({
    path: "../../../data/previews/browse-filters-narrow.png",
    animations: "disabled",
  });
});

test("compact toolbar and one-step presentation settings", async ({ page }) => {
  const dialog = await openBrowse(page);
  await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
  const toolbar = await page.getByRole("region", { name: "أدوات التصفح" }).boundingBox();
  expect(toolbar!.height).toBeLessThan(120);
  await page.getByRole("button", { name: "خيارات العرض", exact: true }).click();
  await page.getByRole("button", { name: "جدول", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("cell").filter({ hasText: "A library work" }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: "../../../data/previews/browse-redesign-table.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 520, height: 900 });
  await page.getByRole("button", { name: "خيارات العرض", exact: true }).click();
  const layout = page.getByRole("group", { name: "طريقة العرض", exact: true }).last();
  await expect(layout).toBeVisible();
  expect(await layout.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const bounds = await layout.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(520);
});

test("library navigation preserves presentation and keeps refinements separate", async ({
  page,
}) => {
  const dialog = await openBrowse(page);
  await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
  await page.getByRole("button", { name: "خيارات العرض", exact: true }).click();
  await page.getByRole("button", { name: "جدول", exact: true }).click();
  await page.keyboard.press("Escape");
  const libraries = page.getByRole("navigation", { name: "مكتبات التصفح" });
  for (const name of [
    "كرتون حديث",
    "كرتون عربي",
    "أفلام أنميشن شرقي",
    "أفلام أنميشن غربي",
    "أفلام تمثيل حي",
    "مسلسلات غربية",
    "مسلسلات عربية",
    "كل المكتبة",
  ]) {
    await libraries.getByRole("link", { name, exact: true }).click();
    await expect(libraries.getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByRole("button", { name: "خيارات العرض", exact: true }).click();
    await expect(page.getByRole("button", { name: "جدول", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Escape");
  }
  await libraries.getByRole("link", { name: "مسلسلات عربية", exact: true }).click();
  await page.getByRole("combobox", { name: "حالة المشاهدة", exact: true }).click();
  await page.getByRole("option", { name: "لم يُشاهَد", exact: true }).click();
  await page.getByRole("button", { name: "مسح المرشحات", exact: true }).click();
  await expect(libraries.getByRole("link", { name: "مسلسلات عربية", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({
    path: "../../../data/previews/browse-library-desktop.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 520, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: "../../../data/previews/browse-library-narrow.png",
    animations: "disabled",
  });
});

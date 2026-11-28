import type { WorkDetail, WorkSummary } from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { installArtworkFixture } from "./fixtures/artwork";
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
  await installArtworkFixture(page);
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
                    servers: [
                      {
                        url: "http://127.0.0.1:23103/",
                        name: "مكتبة التجربة",
                        trustedFingerprint: null,
                      },
                    ],
                  };
                  break;
                case "servers.probe":
                  result = {
                    url: request.payload.url,
                    info: {
                      product: "nahhasio",
                      name: "مكتبة التجربة",
                      version: "0.1.0",
                      apiVersion: 1,
                    },
                  };
                  break;
                case "browsePreferences.load":
                  result = null;
                  break;
                case "browsePreferences.save":
                  result = { ok: true };
                  break;
                case "session":
                  result = signedIn ? session : null;
                  break;
                case "loginAccounts":
                  result = [
                    {
                      id: session.user.accountId,
                      name: session.user.name,
                      avatarKey: session.user.avatarKey,
                    },
                  ];
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
                case "episodes":
                case "trailers":
                  result = { items: [], total: 0, page: 1, pageSize: 24 };
                  break;
                case "awards": {
                  const { slug, year = "2025" } = request.payload;
                  const recognition = {
                    id: "recognition-winner",
                    workId: fixtureWork.id,
                    installmentId: fixtureDetail.installments[0].id,
                    title: fixtureWork.titleAr,
                    installmentTitle: fixtureDetail.installments[0].title,
                    category: "أفضل عمل رسوم متحركة",
                    categoryKey: "animation",
                    result: "winner",
                    year: 2025,
                    posterId: fixtureWork.poster?.id ?? null,
                  };
                  const nominee = {
                    ...recognition,
                    id: "recognition-nominee",
                    title: "عمل مرشّح للاختبار",
                    result: "nominee",
                    year: 2024,
                  };
                  result = {
                    totalPrograms: 1,
                    programs: [
                      {
                        slug: "fixture-award",
                        name: "جوائز الخيال",
                        workCount: 2,
                        years: slug ? ["2025", "2024"] : [],
                        selectedYear: slug ? year : null,
                        totalEntries: 1,
                        entries: year === "2024" ? [nominee] : [recognition],
                      },
                    ],
                  };
                  break;
                }
                case "home":
                  result = {
                    resume: sessionStorage.getItem("fixture-home-resume")
                      ? [
                          {
                            work: fixtureWork,
                            installmentId: fixtureDetail.installments[0].id,
                            installmentTitle: fixtureDetail.installments[0].title,
                            episodeId: "00000000-0000-4000-8000-000000000008",
                            episodeNumber: "1",
                            episodeTitle: "بداية جديدة",
                            releaseDate: "2021-10-08",
                            artwork: null,
                            positionSeconds: 10,
                            durationSeconds: 1200,
                            isPlayed: false,
                          },
                        ]
                      : [],
                    featured: [
                      fixtureWork,
                      {
                        ...fixtureWork,
                        id: "00000000-0000-4000-8000-000000000003",
                        titleAr: "رحلة أخرى",
                      },
                    ],
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
                      id: "00000000-0000-4000-8000-000000000010",
                      installmentId: "00000000-0000-4000-8000-000000000010",
                      installmentKind: "movie",
                      installmentTitle: "فيلم الموعد",
                      kind: "installment",
                      title: "فيلم الموعد",
                      releaseDate: "2027-01-02",
                    },
                    {
                      ...base,
                      id: "00000000-0000-4000-8000-000000000009",
                      kind: "installment",
                      title: "جزء بلا موعد",
                      installmentTitle: "جزء بلا موعد",
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
                        (!query.season ||
                          Math.ceil(Number(item.releaseDate.slice(5, 7)) / 3) === query.season) &&
                        (!query.day || Number(item.releaseDate.slice(8)) === query.day),
                    );
                  const counts = new Map<string, number>();
                  for (const item of entries)
                    if (item.releaseDate)
                      counts.set(item.releaseDate, (counts.get(item.releaseDate) ?? 0) + 1);
                  result = {
                    items: entries.slice(0, query.pageSize ?? 24).map((item) => ({
                      ...item,
                      work: fixtureWork,
                      installment: {
                        id: item.installmentId,
                        workId: item.workId,
                        workTitle: item.workTitle,
                        workTitleAr: item.workTitleAr,
                        title: item.title ?? "",
                        kind: item.installmentKind,
                        releaseDate: item.releaseDate,
                        runtimeMinutes: item.runtimeMinutes,
                        episodeCount: item.episodeCount ?? 0,
                        poster: item.poster,
                        score: fixtureWork.score,
                      },
                    })),
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
                        key: "planets",
                        label: "الكواكب",
                        options: [{ value: "fantasy", label: "الخيال", count: 1 }],
                      },
                      {
                        key: "contributors",
                        label: "الصنّاع",
                        options: [
                          {
                            value: "fixture-person",
                            label: "مخرج الخيال",
                            count: 1,
                            roles: [{ value: "director", label: "إخراج" }],
                          },
                        ],
                      },
                      {
                        key: "studios",
                        label: "الاستوديوهات",
                        options: [
                          {
                            value: "fixture-studio",
                            label: "استوديو الخيال",
                            count: 1,
                            artworkId: "00000000-0000-4000-8000-000000000032",
                            roles: [{ value: "production", label: "إنتاج" }],
                          },
                          { value: "studio-no-logo", label: "استوديو آخر", count: 5 },
                        ],
                      },
                      {
                        key: "awardPrograms",
                        label: "جهات الجوائز",
                        options: [{ value: "fixture-award", label: "جوائز الخيال", count: 1 }],
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
                          : facet.key === "kinds"
                            ? item.id === fixtureWork.id
                              ? "animated-movie"
                              : "live-action-series"
                            : facet.key === "planets"
                              ? item.id === fixtureWork.id || item.isPrivate
                                ? "fantasy"
                                : ""
                              : facet.key === "releaseStates"
                                ? "released"
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
                  if (filters.requireBannerAndLogo) {
                    const image = {
                      id: "00000000-0000-4000-8000-000000000081",
                      url: "/api/v1/artwork/00000000-0000-4000-8000-000000000081",
                      mimeType: "image/png",
                      width: 1280,
                      height: 720,
                      byteSize: 100,
                      sha256: "a".repeat(64),
                      originalFilename: "fixture-banner.png",
                      focalX: 50,
                      focalY: 50,
                    };
                    items = items.map((item) => ({ ...item, banner: image, logo: image }));
                  }
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
for (const width of [360, 480, 1440]) {
  test(`IMDb watch design ${width}: validation, series target and honest pending actions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.goto("/#/watch");
    await expect(page.getByRole("heading", { name: "مشاهدة مباشرة", exact: true })).toBeVisible();
    const id = page.getByLabel("معرّف IMDb أو رابط العنوان");
    await id.fill("https://example.test/title/tt1234567");
    await page.getByRole("button", { name: "معاينة الطلب" }).click();
    await expect(id).toHaveAttribute("aria-invalid", "true");
    await expect(id).toBeFocused();
    await id.fill("https://www.imdb.com/title/tt1234567/?ref_=test");
    await page.getByRole("button", { name: "مسلسل", exact: true }).click();
    await page.getByLabel("الموسم", { exact: true }).fill("0");
    await page.getByLabel("الحلقة", { exact: true }).fill("2");
    await page.getByRole("button", { name: "معاينة الطلب" }).click();
    await expect(id).toHaveValue("tt1234567");
    await expect(page.getByRole("heading", { name: "الموسم 0 · الحلقة 2" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "طلب المشاهدة", exact: true })).toBeFocused();
    for (const name of ["البحث عن المصادر", "تنزيل الفيديو", "اختيار ترجمة"])
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    await expect(page.getByRole("link", { name: "عرض على IMDb" })).toHaveAttribute(
      "href",
      "https://www.imdb.com/title/tt1234567/",
    );
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `../../../data/previews/watch-request-${width}.png` });
    await page.getByLabel("الحلقة", { exact: true }).fill("3");
    await expect(page.getByRole("heading", { name: "الموسم 0 · الحلقة 2" })).toHaveCount(0);
    await page.getByRole("button", { name: "فيلم", exact: true }).click();
    await expect(page.getByLabel("الموسم", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "معاينة الطلب" }).click();
    await page.getByRole("button", { name: "طلب جديد", exact: true }).click();
    await expect(id).toHaveValue("");
    await expect(id).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `../../../data/previews/watch-${width}.png` });
  });
}
async function openPublicPage(page: Page, label: string) {
  if ((page.viewportSize()?.width ?? 1440) < 768) {
    await page.getByRole("button", { name: "كل الصفحات", exact: true }).click();
    await page
      .getByRole("dialog", { name: "كل الصفحات", exact: true })
      .getByRole("link", { name: label, exact: true })
      .click();
  } else
    await page
      .getByRole("navigation", { name: "التنقل الرئيسي", exact: true })
      .getByRole("link", { name: label, exact: true })
      .click();
}
async function openSearch(page: Page) {
  const name = (page.viewportSize()?.width ?? 1440) < 768 ? "البحث السريع" : "البحث";
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي", exact: true })
    .getByRole("button", { name, exact: true })
    .click();
  return page.getByRole("dialog", { name: "البحث السريع", exact: true });
}
const searchInput = (dialog: Locator) =>
  dialog.getByRole("combobox", { name: "ابحث في المكتبة والصفحات" });
async function login(page: Page, expectHome = true) {
  const email = page.getByLabel("البريد الإلكتروني", { exact: true });
  const signIn = page.getByRole("button", { name: "الدخول بالبريد الإلكتروني", exact: true });
  await expect(email.or(signIn)).toBeVisible();
  if (!(await email.isVisible())) await signIn.click();
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "دخول المكتبة" }).click();
  await expect(page.getByRole("navigation", { name: "التنقل الرئيسي", exact: true })).toBeVisible();
  if (!expectHome) return;
  await expect(page.getByRole("region", { name: "أحدث الأعمال" })).toBeVisible();
  await expect(releasedRow(page).locator("article").first()).toBeVisible();
  await page.locator("#main-content").evaluate((element) => {
    element.scrollTop = 0;
  });
}
test("releases calendar, timeline, seasons and upcoming use bounded real-shaped data", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "التقويم", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "تقويم المكتبة", exact: true })).toBeVisible();
  await page.goto("/#/releases?year=2027&month=1&view=calendar");
  const second = page.locator('button[data-day="2"]');
  await expect(second).toHaveAccessibleName(/3 موعد/);
  await second.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('button[data-day="3"]')).toBeFocused();
  await second.click();
  const day = page.getByRole("complementary", { name: "مواعيد اليوم المحدّد" });
  await expect(day.getByRole("link", { name: /بداية جديدة/ })).toHaveAttribute(
    "href",
    /episode=00000000-0000-4000-8000-000000000008/,
  );
  await expect(day.getByText("فيلم الموعد", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/day=2/);
  await page.getByRole("tab", { name: "القائمة", exact: true }).click();
  await expect(page.getByRole("heading", { name: "مواعيد 2027" })).toBeVisible();
  await expect(page.getByRole("tabpanel").getByRole("link", { name: /بداية جديدة/ })).toBeVisible();
  await page.getByRole("tab", { name: "المواسم", exact: true }).click();
  await expect(page.getByRole("heading", { name: "الشتاء 2027", exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel").locator("article[data-layout]")).toHaveCount(2);
  await page.getByRole("button", { name: "الربيع", exact: true }).click();
  await expect(page.getByRole("heading", { name: "الربيع 2027", exact: true })).toBeVisible();
  await expect(page.getByText("لا توجد إصدارات", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "السنة كاملة", exact: true }).click();
  await expect(page.getByRole("tabpanel").locator("article[data-layout]")).toHaveCount(2);
  await page.getByRole("tab", { name: "القادم", exact: true }).click();
  await expect(page.getByRole("heading", { name: "القادم من اليوم" })).toBeVisible();
  await expect(page.getByText("جزء بلا موعد", { exact: true })).toBeVisible();
});
for (const width of [360, 480, 1440]) {
  test(`releases responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.goto("/#/releases?year=2027&month=1&view=calendar");
    const selected = page.locator('button[data-day="2"]');
    await expect(selected).toHaveAccessibleName(/3 موعد/);
    await selected.click();
    const dayDetail =
      width < 768
        ? page.getByRole("dialog")
        : page.getByRole("complementary", { name: "مواعيد اليوم المحدّد" });
    await expect(dayDetail.getByText("فيلم الموعد", { exact: true })).toBeVisible();
    await expect(dayDetail.getByRole("link", { name: /بداية جديدة/ })).toBeVisible();
    if (width < 768) {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(selected).toBeFocused();
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({
        path: `../../../data/previews/releases-${width}.png`,
        fullPage: true,
      });
  });
}
async function browse(page: Page) {
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي", exact: true })
    .getByRole("link", {
      name: (page.viewportSize()?.width ?? 1440) < 768 ? "المكتبة" : "تصفّح المكتبة",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#\/browse$/);
  await expect(page.getByRole("heading", { name: "تصفّح المكتبة" })).toBeVisible();
}
async function openFilters(page: Page) {
  await page.getByRole("button", { name: /^تصفية النتائج/ }).click();
  const sheet = page.getByRole("dialog", { name: "تصفية النتائج" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "تفاصيل الإصدار", exact: true }).click();
  return sheet;
}
function releasedRow(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "صدر حديثًا", exact: true }) })
    .locator(":scope > div")
    .last();
}
test("real bridge states: reject login, browse details, family guide, search and logout", async ({
  page,
}) => {
  await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني" }).click();
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "دخول المكتبة" }).click();
  await expect(page.getByRole("alert")).toHaveText("بيانات الدخول غير صحيحة");
  await login(page);
  await page
    .getByRole("region", { name: "أحدث الأعمال" })
    .getByRole("link", { name: "عرض التفاصيل", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("#/titles/" + work.id + "$"));
  const article = page.getByRole("article", { name: "صفحة العمل" });
  await expect(
    article.getByRole("heading", { name: "رحلة في المكتبة", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    article.getByRole("complementary").getByText("الموضوعات العقدية", { exact: true }),
  ).toBeVisible();
  const guideTrigger = article.getByRole("button", { name: "تفاصيل دليل الوالدين" });
  await guideTrigger.click();
  const guide = page.getByRole("dialog", { name: "دليل الوالدين", exact: true });
  await expect(guide.getByText("تنبيه تحريري محفوظ")).toBeVisible();
  await expect(guide.getByText("ملاحظات التحليل", { exact: true })).toBeVisible();
  await expect(guide.getByText("قراءة نقدية للعمل")).toBeVisible();
  await expect(guide.getByText("متوسط", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guideTrigger).toBeFocused();
  await expect(article.getByRole("button", { name: "شاهد الآن", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
  await expect(page.getByRole("region", { name: "أحدث الأعمال" })).toBeVisible();
  await browse(page);
  await page.getByRole("textbox", { name: "ابحث في النتائج" }).fill("missing");
  await expect(page.getByText("لا توجد أعمال مطابقة", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/q=missing/);
  await expect(page.getByRole("link", { name: "مشاهدة مباشرة", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "الملف والحساب" }).click();
  const watch = page.getByRole("menuitem", { name: /^مشاهدة مباشرة/ });
  await expect(watch).toBeDisabled();
  await expect(watch).toContainText("قريبًا");
  await expect(page.getByRole("menuitem", { name: "مكتبة الجهاز", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await expect(page.getByRole("heading", { name: "من يشاهد؟" })).toBeVisible();
});
for (const width of [480, 640, 1024, 1440])
  test("responsive " + width + ": library and work page fit window", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await expect(
      (page.viewportSize()?.width ?? 1440) < 768
        ? page.getByRole("button", { name: "البحث السريع", exact: true })
        : page.getByRole("button", { name: "البحث", exact: true }),
    ).toBeVisible();
    await browse(page);
    await page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).click();
    await expect(
      page.getByRole("article", { name: "صفحة العمل" }).getByRole("heading", { level: 1 }),
    ).toHaveText("رحلة في المكتبة");
    const metrics = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      width: window.innerWidth,
      main: document.getElementById("main-content")?.scrollWidth,
      available: document.getElementById("main-content")?.clientWidth,
    }));
    expect(metrics.body).toBeLessThanOrEqual(metrics.width);
    expect(metrics.main).toBeLessThanOrEqual(metrics.available!);
    await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
    await expect(page).toHaveURL(/#\/browse$/);
    await expect(page.getByRole("article", { name: "صفحة العمل" })).toHaveCount(0);
  });

test("planet navigation, private opt-in and native keyboard links", async ({ page }) => {
  await login(page);
  const row = releasedRow(page);
  await row.getByRole("link", { name: /^تفاصيل رحلة في المكتبة/ }).focus();
  await page.keyboard.press("Tab");
  await expect(row.getByRole("link", { name: /^تفاصيل رحلة أخرى/ })).toBeFocused();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "الكواكب", exact: true })
    .click();
  await page.getByRole("link", { name: /الخيال/ }).click();
  await expect(page).toHaveURL(/#\/planets\/fantasy$/);
  await expect(page.getByRole("heading", { name: "الخيال", exact: true })).toBeVisible();
  await browse(page);
  let dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "العامة والخاصة", exact: true }).click();
  await expect(page).not.toHaveURL(/privacy=all/);
  await expect(dialog.getByRole("button", { name: /^تطبيق التصفية/ })).toContainText("· 3");
  await dialog.getByRole("button", { name: /^تطبيق التصفية/ }).click();
  await expect(page.getByRole("link", { name: "تفاصيل عمل خاص" })).toBeVisible();
  dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "مسح التصفية" }).click();
  await dialog.getByRole("button", { name: "التصنيف", exact: true }).click();
  const live = dialog.getByRole("button", { name: /^تمثيل حي،/ });
  await live.click();
  await expect(dialog.getByRole("button", { name: /^تطبيق التصفية/ })).toContainText("· 1");
  await dialog.getByRole("button", { name: /^تطبيق التصفية/ }).click();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" })).toHaveCount(0);
  dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "التصنيف", exact: true }).click();
  await dialog.getByRole("button", { name: /^تمثيل حي،/ }).click();
  await expect(dialog.getByRole("button", { name: /^تمثيل حي،/ })).toHaveAttribute(
    "aria-pressed",
    "mixed",
  );
  await dialog.getByRole("button", { name: /^تطبيق التصفية/ }).click();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toHaveCount(0);
});

test("filter preview stays bounded and draft privacy reloads vocabulary", async ({ page }) => {
  await login(page);
  await browse(page);
  const requests: string[] = [];
  page.on("console", (message) => {
    if (message.text().startsWith("preview-fixture:")) requests.push(message.text());
  });
  await page.evaluate(() => {
    const handler = window.webkit?.messageHandlers?.nahhasio;
    if (!handler) throw new Error("Fixture bridge missing");
    const original = handler.postMessage.bind(handler);
    handler.postMessage = (message: string) => {
      const request = JSON.parse(message);
      if (request.command === "browse")
        console.debug(`preview-fixture:${request.payload.page}:${request.payload.pageSize}`);
      if (request.command === "facets" && request.payload.privacy === "all") {
        window["__nahhasioReply"]?.({
          id: request.id,
          ok: true,
          result: {
            groups: [
              {
                key: "planets",
                label: "الكواكب",
                options: [{ value: "private-planet", label: "كوكب خاص", count: 1 }],
              },
            ],
            yearMin: 2021,
            yearMax: 2021,
          },
        });
        return;
      }
      original(message);
    };
  });
  const dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "العامة والخاصة", exact: true }).click();
  await dialog.getByRole("button", { name: "التصنيف", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /^كوكب خاص،/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^تطبيق التصفية/ })).toContainText("· 3");
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((request) => request === "preview-fixture:1:1")).toBe(true);
  await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(page).not.toHaveURL(/privacy=all/);
});

test("filter drafts cancel without changing the URL and reset applies atomically", async ({
  page,
}) => {
  await login(page);
  await browse(page);
  const initial = page.url();
  let dialog = await openFilters(page);
  await dialog.getByRole("button", { name: /^مكتمل،/ }).click();
  await expect(dialog.getByRole("button", { name: /^تطبيق التصفية/ })).toContainText("· 2");
  expect(page.url()).toBe(initial);
  await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(page.getByRole("button", { name: /^تصفية النتائج/ })).toBeFocused();
  dialog = await openFilters(page);
  await expect(dialog.getByRole("button", { name: /^مكتمل،/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await dialog.getByRole("button", { name: "العامة والخاصة", exact: true }).click();
  await dialog.getByRole("button", { name: /^تطبيق التصفية/ }).click();
  await expect(page).toHaveURL(/privacy=all/);
  await expect(page.getByRole("link", { name: "تفاصيل عمل خاص", exact: true })).toBeVisible();
  dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "مسح التصفية" }).click();
  await expect(page).toHaveURL(/privacy=all/);
  await dialog.getByRole("button", { name: /^تطبيق التصفية/ }).click();
  await expect(page).not.toHaveURL(/privacy=/);
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(2);
});

for (const width of [480, 1440]) {
  test(`filter layout ${width}: category search, keyboard and URL organization`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await browse(page);
    const dialog = await openFilters(page);
    await dialog.getByLabel("ابحث في خيارات التصفية").fill("تمثيل حي");
    const live = dialog.getByRole("button", { name: /^تمثيل حي،/ });
    await live.focus();
    await page.keyboard.press("Space");
    await expect(live).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("button", { name: /^تطبيق التصفية/ })).toContainText("· 1");
    const bounds = await dialog.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      false,
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^تصفية النتائج/ })).toBeFocused();
    await page.getByRole("combobox", { name: "ترتيب النتائج", exact: true }).click();
    await page.getByRole("option", { name: "الأعلى تقييمًا", exact: true }).click();
    await expect(page).toHaveURL(/sort=score-desc/);
    await page.getByRole("combobox", { name: "تجميع النتائج", exact: true }).click();
    await page.getByRole("option", { name: "حالة الإصدار", exact: true }).click();
    await expect(page).toHaveURL(/group=status/);
    await expect(page.getByRole("heading", { name: "مكتمل", exact: true })).toBeVisible();
    await page.reload();
    await login(page, false);
    await expect(page.getByRole("heading", { name: "مكتمل", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "ترتيب النتائج", exact: true })).toContainText(
      "الأعلى تقييمًا",
    );
  });
}

test("hero has real metadata, manual selection, pause and a working details action", async ({
  page,
}) => {
  await page.clock.install();
  await login(page);
  const hero = page.getByRole("region", { name: "أحدث الأعمال" });
  await expect(hero).toContainText("2021");
  await expect(hero).toContainText("رسوم متحركة");
  await expect(hero).toContainText(work.summary);
  await expect(hero.getByRole("button", { name: "المشاهدة", exact: true })).toBeEnabled();
  await hero.getByRole("button", { name: "إيقاف التبديل التلقائي" }).click();
  await expect(hero.getByRole("button", { name: "تشغيل التبديل التلقائي" })).toBeVisible();
  await hero.getByRole("button", { name: "اعرض رحلة أخرى", exact: true }).click();
  await expect(hero.getByRole("heading", { name: "رحلة أخرى" })).toBeVisible();
  await expect(hero.getByRole("button", { name: "اعرض رحلة أخرى", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const search = page.getByRole("button", { name: "البحث" });
  await search.hover();
  await search.focus();
  await page.clock.fastForward(18000);
  await expect(hero.getByRole("heading", { name: "رحلة أخرى" })).toBeVisible();
  await hero.getByRole("button", { name: "تشغيل التبديل التلقائي" }).click();
  await search.hover();
  await search.focus();
  await page.clock.fastForward(15001);
  await expect(hero.getByRole("heading", { name: "رحلة في المكتبة" })).toBeVisible();
  await hero.getByRole("button", { name: "اعرض رحلة أخرى", exact: true }).focus();
  await page.clock.fastForward(15001);
  await expect(hero.getByRole("heading", { name: "رحلة في المكتبة" })).toBeVisible();
  await hero.getByRole("button", { name: "اعرض رحلة في المكتبة", exact: true }).click();
  const details = hero.getByRole("link", { name: "عرض التفاصيل", exact: true });
  await expect(details).toHaveAttribute("href", "#/titles/" + work.id);
  await details.click();
  await expect(page).toHaveURL(new RegExp("#/titles/" + work.id + "$"));
  await expect(page.getByRole("article", { name: "صفحة العمل" })).toBeVisible();
});

for (const width of [480, 1440]) {
  test(
    "sidebar controls " + width + ": search dialog and keyboard dropdown under packaged CSP",
    async ({ page }) => {
      const cspErrors: string[] = [];
      page.on("console", (message) => {
        if (/Content Security Policy|violates.*policy/i.test(message.text()))
          cspErrors.push(message.text());
      });
      await page.setViewportSize({ width, height: 900 });
      await login(page);
      const search = await openSearch(page);
      const input = searchInput(search);
      await expect(input).toBeFocused();
      await input.fill("missing");
      await expect(search.getByText("لا توجد نتائج مطابقة", { exact: true })).toBeVisible();
      await input.fill("رحلة");
      await expect(
        search.getByRole("option", { name: /رحلة في المكتبة.*رسوم متحركة/ }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(search).toHaveCount(0);
      await browse(page);
      const sort = page.getByRole("combobox", { name: "ترتيب النتائج", exact: true });
      await sort.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sort).toBeFocused();
      const dialog = await openFilters(page);
      await dialog.getByRole("button", { name: /^مكتمل،/ }).click();
      await expect(dialog.getByRole("button", { name: /^مكتمل،/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await dialog.getByRole("button", { name: /^تطبيق التصفية/ }).click();
      await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(2);
      expect(cspErrors).toEqual([]);
    },
  );
}

for (const width of [360, 1440]) {
  test(`awards ${width}: Home opens the directory, years change the archive, and works link to their installment`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page
      .getByRole("region", { name: "الجوائز", exact: true })
      .getByRole("link", { name: "الجوائز", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "الجوائز", level: 1 })).toBeVisible();
    const shelf = page.getByRole("region", { name: "جوائز الخيال" });
    await expect(shelf.getByText("أحدث الفائزين")).toBeVisible();
    await shelf.getByRole("link", { name: "جوائز الخيال" }).click();
    await expect(page.getByRole("heading", { name: "جوائز الخيال", level: 1 })).toBeVisible();
    const category = page.getByRole("region", { name: "أفضل عمل رسوم متحركة" });
    await expect(category.getByText("فائز", { exact: true })).toBeVisible();
    await expect(category.getByRole("link")).toHaveAttribute(
      "href",
      /#\/titles\/.+\?installment=./,
    );
    await page.getByRole("combobox", { name: "سنة الجائزة" }).click();
    await page.getByRole("option", { name: "2024" }).click();
    await expect(page).toHaveURL(/year=2024/);
    await expect(category.getByText("عمل مرشّح للاختبار")).toBeVisible();
    await expect(category.getByText("مرشّح", { exact: true })).toBeVisible();
    expect(
      await page.locator("#main-content").evaluate((main) => main.scrollWidth <= main.clientWidth),
    ).toBe(true);
    await page.getByRole("link", { name: "كل الجوائز" }).click();
    await expect(page.getByRole("heading", { name: "الجوائز", level: 1 })).toBeVisible();
  });
}

test("home logic: scores, planet discovery and installment destination", async ({ page }) => {
  await login(page);
  await expect(releasedRow(page).getByText("71", { exact: true }).first()).toBeVisible();
  await expect(releasedRow(page).locator("article").first()).toHaveAttribute(
    "data-watched",
    "true",
  );
  await expect(releasedRow(page).locator("article").nth(1)).toHaveAttribute(
    "data-watched",
    "false",
  );
  const planets = page.getByRole("region", { name: "استكشف الكواكب" });
  await planets.getByRole("link", { name: "الكواكب", exact: true }).scrollIntoViewIfNeeded();
  await expect(planets.getByRole("link", { name: "الخيال", exact: true })).toHaveAttribute(
    "href",
    "#/planets/fantasy",
  );
  const awards = page.getByRole("region", { name: "الجوائز", exact: true });
  await expect(awards.getByRole("link", { name: /جوائز الخيال/ })).toHaveAttribute(
    "href",
    "#/awards/fixture-award",
  );
  await expect(
    page
      .getByRole("region", { name: "الاستوديوهات", exact: true })
      .getByRole("link", { name: /استوديو الخيال/ }),
  ).toHaveAttribute("href", "#/studios/fixture-studio");
  await expect(
    page
      .getByRole("region", { name: "الصنّاع", exact: true })
      .getByRole("link", { name: /مخرج الخيال/ }),
  ).toHaveAttribute("href", "#/people/fixture-person");
  const upcoming = page.getByRole("region", { name: "قريبًا" });
  await expect(upcoming).toContainText("الموسم القادم");
  await upcoming.getByRole("link", { name: /الموسم القادم/ }).click();
  await expect(page).toHaveURL(
    new RegExp("#/titles/" + work.id + "\\?installment=00000000-0000-4000-8000-000000000007$"),
  );
  await expect(page.getByRole("article", { name: "صفحة العمل" })).toBeVisible();
  const releases = page.getByRole("region", { name: "الأجزاء والإصدارات" });
  const installment = releases.getByRole("region", { name: "الموسم القادم" });
  await expect(
    installment.getByRole("heading", { name: "الموسم القادم", exact: true }),
  ).toBeVisible();
  await expect(installment.getByText("قادم", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
  await expect(upcoming.getByRole("link", { name: /الموسم القادم/ })).toBeVisible();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "الكواكب", exact: true })
    .click();
  await page
    .getByRole("region", { name: "صفحة الكواكب" })
    .getByRole("link", { name: /^الخيال/ })
    .click();
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(1);
  await browse(page);
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(2);
  await page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("article", { name: "صفحة العمل" })
      .getByRole("button", { name: "تفاصيل تقييم نحّاسيو" }),
  ).toContainText("71");
});

for (const width of [480, 1440]) {
  test(`home arrows ${width}: hero controls, section headings and RTL release cards`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const hero = page.getByRole("region", { name: "أحدث الأعمال" });
    const watch = hero.getByRole("button", { name: "المشاهدة", exact: true });
    await watch.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(hero.getByRole("link", { name: "عرض التفاصيل" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(watch).toBeFocused();

    const heading = page.getByRole("link", { name: "صدر حديثًا", exact: true });
    const cards = releasedRow(page).getByRole("link", { name: /^تفاصيل/ });
    await heading.focus();
    await page.keyboard.press("ArrowDown");
    await expect(cards.first()).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(cards.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cards.first()).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(heading).toBeFocused();
  });
}

test("home continuation tabs keep focus across the RTL tab list and its cards", async ({
  page,
}) => {
  await page.evaluate(() => sessionStorage.setItem("fixture-home-resume", "1"));
  await login(page);
  const continuing = page.getByRole("region", { name: "تابع مشاهدتك" });
  const episodes = continuing.getByRole("tab", { name: /^الحلقات/ });
  const films = continuing.getByRole("tab", { name: /^الأفلام/ });
  const resume = continuing.getByRole("button", { name: /^استأنف رحلة/ });
  await episodes.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(films).toBeFocused();
  await expect(films).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(episodes).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(resume).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(episodes).toBeFocused();
});

for (const width of [480, 1440]) {
  test(`sidebar-home-only ${width}: clean header and scrollable shelves keep all cards reachable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((seed) => {
      const handler = window.webkit?.messageHandlers?.nahhasio;
      if (!handler) throw new Error("Fixture bridge missing");
      const original = handler.postMessage.bind(handler);
      handler.postMessage = (message: string) => {
        const request = JSON.parse(message);
        const items = Array.from({ length: 12 }, (_, index) => ({
          ...seed,
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          titleAr: `${seed.titleAr} ${index + 1}`,
        }));
        if (request.command === "works" || request.command === "browse") {
          const result = {
            items: items.slice(0, request.payload.pageSize ?? 12).map((item) =>
              request.command === "browse"
                ? {
                    work: item,
                    installment: null,
                    classification: {
                      audience: item.audience,
                      age: item.age,
                      sexualityRisk: "none",
                      behavioralRisk: "low",
                      theologyRisk: "medium",
                    },
                    status: "completed",
                    watchState: "unwatched",
                    criteria: {
                      story: null,
                      characters: null,
                      depth: null,
                      worldBuilding: null,
                      originality: null,
                      craft: null,
                    },
                  }
                : item,
            ),
            total: 12,
            page: 1,
            pageSize: request.payload.pageSize ?? 12,
          };
          queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
        } else original(message);
      };
    }, work);
    await login(page);
    const rail = page.getByRole("navigation", { name: "التنقل الرئيسي" });
    await expect(rail.getByRole("link", { name: "الرئيسية", exact: true })).toBeVisible();
    await expect(page.locator("#main-content")).toHaveCount(1);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(
      width < 768
        ? rail.getByRole("button", { name: "البحث السريع", exact: true })
        : rail.getByRole("button", { name: "البحث", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: width < 768 ? "كل الصفحات" : "الملف والحساب", exact: true }),
    ).toBeVisible();
    const row = releasedRow(page);
    await expect(row.locator("article").first()).toBeVisible();
    await expect(row.locator("article")).toHaveCount(12);
    const metrics = await row.evaluate((element) => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
      tops: [...element.querySelectorAll("article")].map((card) =>
        Math.round(card.getBoundingClientRect().top),
      ),
    }));
    expect(metrics.scroll).toBeGreaterThan(metrics.width);
    const cards = row.getByRole("link", { name: /^تفاصيل/ });
    await cards.first().focus();
    for (let index = 1; index < 12; index++) await page.keyboard.press("ArrowLeft");
    await expect(cards.last()).toBeFocused();
    await expect(cards.last()).toBeInViewport();
    await expect(row).toHaveCSS("mask-image", /linear-gradient/);
    expect(new Set(metrics.tops).size).toBe(1);
    const hero = await page.getByRole("region", { name: "أحدث الأعمال" }).boundingBox();
    expect(hero?.height).toBeLessThan(width < 600 ? 700 : 900);
    const homeUrl = page.url();
    const search = await openSearch(page);
    await expect(page).toHaveURL(homeUrl);
    await expect(searchInput(search)).toBeFocused();
    await page.keyboard.press("Escape");
    await rail.getByRole("link", { name: "الرئيسية", exact: true }).click();
    await expect(page).toHaveURL(/#\/home$/);
  });
}

for (const width of [360, 640, 1024, 1440]) {
  test(`sidebar consolidation ${width}: full-height content and bottom profile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await login(page);
    const rail = page.getByRole("navigation", { name: "التنقل الرئيسي" });
    await expect(page.locator("#main-content")).toHaveCount(1);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(
      width < 768
        ? rail.getByRole("button", { name: "البحث السريع", exact: true })
        : rail.getByRole("button", { name: "البحث", exact: true }),
    ).toBeVisible();
    await expect(rail.getByRole("link", { name: "الرئيسية", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const profile = rail.getByRole("button", {
      name: width < 768 ? "كل الصفحات" : "الملف والحساب",
      exact: true,
    });
    const box = await profile.boundingBox();
    expect(box?.y).toBeGreaterThan(600);
    const mainBox = await page.locator("#main-content").boundingBox();
    expect(mainBox?.y).toBe(0);
    expect(mainBox?.height).toBe(720);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
    await profile.click();
    if (width < 768) {
      const pages = page.getByRole("dialog", { name: "كل الصفحات", exact: true });
      await expect(pages).toBeVisible();
      await expect(pages.getByRole("button", { name: "تسجيل الخروج", exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole("menu", { name: "الحساب" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "تسجيل الخروج" })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(profile).toBeFocused();
    if (width === 1440)
      if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
        await page.screenshot({ path: test.info().outputPath("sidebar-review.png") });
    await page.setViewportSize({ width, height: 400 });
    await expect(profile).toBeInViewport();
    await rail
      .getByRole("button", { name: width < 768 ? "كل الصفحات" : "صفحات أخرى", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("link", { name: /الصنّاع/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(profile).toBeInViewport();
  });
}

for (const width of [480, 1440]) {
  test(`separate entity pages ${width}: planets, people and studios`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      const handler = window.webkit?.messageHandlers?.nahhasio;
      if (!handler) throw new Error("Fixture bridge missing");
      const original = handler.postMessage.bind(handler);
      handler.postMessage = (message: string) => {
        const request = JSON.parse(message);
        if (request.command === "facets") {
          const result = {
            groups: [
              {
                key: "contributors",
                label: "الصنّاع",
                options: [
                  {
                    value: "person-1",
                    label: "صانع تجريبي",
                    count: 2,
                    artworkId: "00000000-0000-4000-8000-000000000031",
                  },
                  ...Array.from({ length: 24 }, (_, index) => ({
                    value: `person-${index + 2}`,
                    label: `صانع بلا صورة ${String(index + 1).padStart(2, "0")}`,
                    count: 1,
                    artworkId: null,
                  })),
                ],
              },
              {
                key: "studios",
                label: "الاستوديوهات",
                options: [
                  {
                    value: "studio-1",
                    label: "استوديو تجريبي",
                    count: 2,
                    artworkId: "00000000-0000-4000-8000-000000000032",
                    roles: [{ value: "animation_studio", label: "استوديو الرسوم المتحركة" }],
                    searchTerms: [],
                  },
                  {
                    value: "studio-2",
                    label: "استوديو بلا شعار",
                    artworkId: null,
                    searchTerms: ["Unpictured Studio"],
                    count: 1,
                    roles: [{ value: "animation_studio", label: "استوديو الرسوم المتحركة" }],
                  },
                ],
              },
            ],
            yearMin: 2021,
            yearMax: 2021,
          };
          queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
        } else if (request.command === "artwork.url") {
          const result = {
            url: `nahhasio://app/_artwork/0/${request.payload.id}/${request.payload.width}`,
          };
          queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
        } else original(message);
      };
    });
    await login(page);
    const rail = page.getByRole("navigation", { name: "التنقل الرئيسي" });
    await expect(rail.getByRole("link", { name: "اكتشف", exact: true })).toHaveCount(0);
    for (const item of [
      {
        label: "الكواكب",
        page: "صفحة الكواكب",
        name: "الخيال",
        route: "planets/fantasy",
        search: "ابحث في الكواكب",
        back: "العودة إلى الكواكب",
      },
      {
        label: "الصنّاع",
        page: "صفحة الصنّاع",
        name: "صانع تجريبي",
        route: "people/person-1",
        search: "ابحث في الصنّاع",
        back: "العودة إلى الصنّاع",
      },
      {
        label: "الاستوديوهات",
        page: "صفحة الاستوديوهات",
        name: "استوديو تجريبي",
        route: "studios/studio-1",
        search: "ابحث في الاستوديوهات",
        back: "العودة إلى الاستوديوهات",
      },
    ]) {
      await openPublicPage(page, item.label);
      await expect(page.getByRole("region", { name: item.page })).toBeVisible();
      if (width >= 768)
        await expect(rail.getByRole("link", { name: item.label, exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        );
      const input = page.getByRole("textbox", { name: item.search });
      await input.fill("missing");
      await expect(page.getByRole("link", { name: new RegExp(item.name) })).toHaveCount(0);
      await input.fill("");
      if (item.label !== "الكواكب") {
        await page.getByRole("link", { name: new RegExp(item.name) }).scrollIntoViewIfNeeded();
        const image = page.getByRole("region", { name: item.page }).locator("img").first();
        await expect(image).toHaveJSProperty("tagName", "IMG");
        await expect(image).toHaveJSProperty("naturalWidth", 200);
        if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
          await page.screenshot({
            path: `../../../data/previews/${item.route.split("/")[0]}-${width}.png`,
          });
      }
      await page.getByRole("link", { name: new RegExp(item.name) }).click();
      await expect(page).toHaveURL(new RegExp(`#/${item.route}`));
      await expect(page.getByRole("heading", { name: item.name, exact: true })).toBeVisible();
      await page.getByRole("link", { name: item.back, exact: true }).click();
      await expect(page.getByRole("region", { name: item.page })).toBeVisible();
      if (item.label !== "الكواكب") {
        const display = page.getByRole("button", { name: `خيارات عرض ${item.label}` });
        await display.click();
        await expect(page.getByRole("switch", { name: "صور مربعة" })).toBeVisible();
        await expect(page.getByRole("button", { name: "بطاقات متوسطة، 4 في الصف" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(display).toBeFocused();
      }
      if (item.label === "الصنّاع") {
        await expect(page.getByRole("link", { name: /صانع بلا صورة 01/ })).toBeVisible();
        await page.getByRole("combobox", { name: "توفر صورة الصانع" }).click();
        await page.getByRole("option", { name: "بصورة", exact: true }).click();
        await expect(page.getByRole("link", { name: /صانع بلا صورة 01/ })).toHaveCount(0);
        await page.getByRole("button", { name: "مسح التصفية" }).click();
        await expect(page.getByRole("link", { name: /صانع بلا صورة 01/ })).toBeVisible();
        await expect(page.getByRole("link", { name: /صانع بلا صورة 24/ })).toHaveCount(0);
        await page.getByRole("button", { name: "عرض المزيد" }).click();
        await page.getByRole("link", { name: /صانع بلا صورة 24/ }).click();
        await page.getByRole("link", { name: item.back, exact: true }).click();
        await expect(page).toHaveURL(/#\/people$/);
        await expect(page.getByRole("link", { name: /صانع بلا صورة 01/ })).toBeVisible();
      }
      if (item.label === "الاستوديوهات") {
        await expect(page.getByRole("link", { name: /استوديو بلا شعار/ })).toBeVisible();
        await input.fill("Unpictured Studio");
        await expect(page.getByRole("link", { name: /استوديو بلا شعار/ })).toBeVisible();
        await expect(page.getByRole("link", { name: /استوديو تجريبي/ })).toHaveCount(0);
        await page.getByRole("button", { name: "مسح بحث الأسماء", exact: true }).click();
        await expect(input).toHaveValue("");
      }
      expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

for (const width of [480, 1440]) {
  test(`catalog header alignment ${width}: titles and search share the same bounds`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const routes = [
      ["browse", "تصفّح المكتبة", "ابحث في النتائج"],
      ["planets", "الكواكب", "ابحث في الكواكب"],
      ["episodes", "الحلقات", "البحث باسم العمل أو الحلقة أو الفيلم"],
      ["trailers", "الشارات والإعلانات التشويقية", "البحث عن مقطع أو عمل بالعربية أو الإنجليزية"],
      ["people", "الصنّاع", "ابحث في الصنّاع"],
      ["studios", "الاستوديوهات", "ابحث في الاستوديوهات"],
    ];
    const bounds = [];
    for (const [route, title, label] of routes) {
      await page.evaluate((path) => {
        window.location.hash = `/${path}`;
      }, route);
      const heading = page.getByRole("heading", { name: title, exact: true, level: 1 });
      const search = page.getByRole("textbox", { name: label, exact: true });
      await expect(heading).toBeVisible();
      await expect(search).toBeVisible();
      const header = await heading.locator("xpath=ancestor::header").boundingBox();
      const searchGroup = await search
        .locator("xpath=ancestor::*[@data-slot='input-group']")
        .boundingBox();
      expect(header).not.toBeNull();
      expect(searchGroup).not.toBeNull();
      if (!header || !searchGroup) throw new Error("Catalog heading or search has no bounding box");
      bounds.push([
        Math.round(header.x),
        Math.round(header.y),
        Math.round(header.width),
        Math.round(searchGroup.x),
        Math.round(searchGroup.y),
        Math.round(searchGroup.width),
        Math.round(searchGroup.height),
      ]);
    }
    for (const measurement of bounds) expect(measurement).toEqual(bounds[0]);
  });
}

test("sidebar search: legacy links, Arabic keyboard shortcut and history", async ({ page }) => {
  await login(page);
  const query = new URLSearchParams({ q: "رحلة", type: "movies" });
  await page.evaluate((search) => {
    window.location.hash = `/search?${search}`;
  }, query.toString());
  const dialog = page.getByRole("dialog", { name: "البحث السريع", exact: true });
  const input = searchInput(dialog);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("رحلة");
  await expect(dialog.getByRole("tab", { name: "الأفلام", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/home$/);
  await page.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ن",
        code: "KeyK",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await expect(input).toBeFocused();
  await input.fill("رحلة في المكتبة");
  await dialog.getByRole("option", { name: /رحلة في المكتبة.*رسوم متحركة/ }).click();
  await expect(page).toHaveURL(/#\/titles\//);
  await page.goBack();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(dialog).toHaveCount(0);
});

for (const width of [480, 1440]) {
  test(`search scopes ${width}: works, private opt-in and entities`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const dialog = await openSearch(page);
    const input = searchInput(dialog);
    const scope = (name: string) => dialog.getByRole("tab", { name, exact: true });
    const selectType = (name: string) => scope(name).click();
    await input.fill("رحلة");
    await selectType("الأعمال");
    await expect(dialog.getByRole("option")).toHaveCount(2);
    await scope("الأعمال").press("ArrowLeft");
    await expect(scope("الأفلام")).toBeFocused();
    await expect(scope("الأفلام")).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByRole("option")).toHaveCount(1);
    await expect(dialog.getByRole("status")).toHaveText("1 نتيجة");
    await expect(
      dialog.getByRole("option", { name: /رحلة في المكتبة.*رسوم متحركة/ }),
    ).toBeVisible();
    await selectType("المسلسلات");
    await expect(dialog.getByRole("option", { name: /رحلة أخرى/ })).toBeVisible();
    await expect(scope("الأجزاء")).toHaveCount(0);
    await selectType("الكل");
    await expect(dialog.getByRole("option")).toHaveCount(2);
    await input.fill("عمل خاص");
    await expect(dialog.getByText("لا توجد نتائج مطابقة", { exact: true })).toBeVisible();
    await dialog.getByRole("switch", { name: "تضمين الأعمال الخاصة" }).check();
    await expect(dialog.getByRole("option", { name: /عمل خاص.*رسوم متحركة/ })).toBeVisible();
    await input.fill("الخيال");
    await selectType("الكواكب");
    await dialog.getByRole("option", { name: /الخيال.*الكواكب/ }).click();
    await expect(page).toHaveURL(/#\/planets\/fantasy/);
  });
}

for (const width of [480, 1440]) {
  test(`card arrows ${width}: physical RTL directions, native Tab and activation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await browse(page);
    const cards = page.getByRole("link", { name: /^تفاصيل/ });
    await expect(cards).toHaveCount(2);
    await cards.first().focus();
    await page.keyboard.press("ArrowLeft");
    await expect(cards.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(cards.first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(cards.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/titles\/00000000-0000-4000-8000-000000000003$/);
    await expect(page.getByRole("article", { name: "صفحة العمل" })).toBeVisible();
    await page.goBack();
    await expect(cards).toHaveCount(2);
  });
}

for (const width of [480, 1440]) {
  test(`card display settings ${width}: layouts, size, artwork-only and reset`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const upcoming = page.getByRole("region", { name: "قريبًا" });
    await expect(upcoming.getByText("غير مقيّم")).toHaveCount(0);
    await expect(upcoming.getByText("الموسم القادم", { exact: true })).toBeVisible();
    await expect(releasedRow(page).locator("article").first()).toHaveAttribute(
      "data-kind",
      "installment",
    );
    await browse(page);
    const cards = page.locator("#main-content article");
    await page.getByRole("button", { name: "خيارات العرض", exact: true }).click();
    await page
      .getByRole("group", { name: "حجم البطاقات", exact: true })
      .getByRole("button", { name: "كبير", exact: true })
      .click();
    await expect(
      page
        .getByRole("group", { name: "حجم البطاقات", exact: true })
        .getByRole("button", { name: "كبير", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "لافتات", exact: true }).click();
    await expect(cards.first()).toHaveAttribute("data-layout", "banner");
    await page.getByRole("button", { name: "شعارات", exact: true }).click();
    await expect(cards.first()).toHaveAttribute("data-layout", "logo");
    const borderless = page.getByRole("switch", { name: "شعارات دون إطار", exact: true });
    await expect(borderless).toBeChecked();
    await borderless.click();
    await expect(borderless).not.toBeChecked();
    await borderless.click();
    await expect(borderless).toBeChecked();
    const titleSwitch = page.getByRole("switch", { name: "العناوين", exact: true });
    if (await titleSwitch.isChecked()) await titleSwitch.click();
    const display = page.getByRole("button", { name: "خيارات العرض", exact: true });
    await page.keyboard.press("Escape");
    await expect(display).toBeFocused();
    await expect(cards.getByRole("heading")).toHaveCount(0);
    await expect(cards.getByRole("link")).toHaveCount(2);
    await display.click();
    await page.getByRole("button", { name: "استعادة العرض الافتراضي" }).click();
    await expect(cards.first()).toHaveAttribute("data-layout", "poster");
    const titles = page.getByRole("switch", { name: "العناوين", exact: true });
    await expect(titles).not.toBeChecked();
    await titles.click();
    await page.keyboard.press("Escape");
    await expect(cards.getByRole("heading")).toHaveCount(2);
    await cards.first().getByRole("link").focus();
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `test-results/card-refinement-${width}.png` });
    await page.getByRole("button", { name: "خيارات العرض", exact: true }).click();
    await page.getByRole("button", { name: "جدول", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("table")).toBeVisible();
  });
}

for (const width of [360, 520]) {
  test(`quick search mobile ${width}: full-screen layout, menu, result and focus`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 820 });
    await login(page);
    const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
    await expect(nav.getByRole("link", { name: "الرئيسية", exact: true })).toBeVisible();
    expect(await nav.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const trigger = nav.getByRole("button", { name: "البحث السريع", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "البحث السريع", exact: true });
    const input = dialog.getByRole("combobox", { name: "ابحث في المكتبة والصفحات" });
    await expect(input).toBeFocused();
    await expect(dialog.getByRole("region", { name: "أضيف حديثًا" })).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).toEqual({ x: 0, y: 0, width, height: 820 });
    await input.fill("رحلة");
    await expect(
      dialog.getByRole("option", { name: /رحلة في المكتبة.*رسوم متحركة/ }),
    ).toBeVisible();
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `../../../data/previews/mobile-search-${width}.png` });
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await input.fill("رحلة في المكتبة");
    await expect(dialog.getByText("مطابقة تامة", { exact: true }).first()).toBeVisible();
    await dialog.getByRole("option", { name: /رحلة في المكتبة.*رسوم متحركة/ }).click();
    await expect(page).toHaveURL(/#\/titles\//);
    await expect(dialog).toHaveCount(0);
    await nav.getByRole("button", { name: "كل الصفحات", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "كل الصفحات", exact: true });
    await expect(menu.getByRole("link", { name: "الصنّاع", exact: true })).toBeVisible();
    await expect(menu.getByRole("link", { name: "لوحة الإدارة", exact: true })).toBeAttached();
    await expect(menu.locator('a[href^="#/admin/"]')).toHaveCount(0);
    await expect(
      menu
        .getByRole("region", { name: "حسابي والجهاز", exact: true })
        .getByRole("link", { name: "لوحة الإدارة", exact: true }),
    ).toBeAttached();
    await expect(menu.getByRole("region", { name: "الإدارة", exact: true })).toHaveCount(0);
    const viewport = menu.locator('[data-slot="scroll-area-viewport"]');
    await expect(viewport).toBeVisible();
    await expect(viewport).toHaveCSS("scrollbar-width", "none");
    await menu.getByRole("button", { name: "تسجيل الخروج", exact: true }).scrollIntoViewIfNeeded();
    await expect(menu.getByRole("button", { name: "تسجيل الخروج", exact: true })).toBeInViewport();
    await menu.getByRole("link", { name: "تصفّح المكتبة", exact: true }).scrollIntoViewIfNeeded();
    await expect(menu.getByRole("img", { name: "صورة العائلة", exact: true })).toHaveCount(1);
    await expect(menu.getByRole("button", { name: "تبديل الحساب", exact: true })).toBeAttached();
    await expect(menu.getByRole("button", { name: "تسجيل الخروج", exact: true })).toBeAttached();
    await expect(menu.getByRole("button", { name: "الملف والحساب", exact: true })).toHaveCount(0);
    await expect(menu.getByRole("heading", { name: "كل الصفحات", exact: true })).toHaveClass(
      /sr-only/,
    );
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `../../../data/previews/mobile-pages-${width}.png` });
    expect(await menu.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await menu.getByRole("link", { name: "تصفّح المكتبة", exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(/#\/browse/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `../../../data/previews/mobile-navigation-${width}.png` });
  });
}

test("public shell: natural drawer height and nested connection navigation", async ({ page }) => {
  await page.setViewportSize({ width: 520, height: 740 });
  await login(page);
  await page.getByRole("button", { name: "كل الصفحات", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "كل الصفحات", exact: true });
  const scroll = menu.locator('[data-slot="scroll-area-viewport"]');
  expect(await scroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await scroll.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.setViewportSize({ width: 520, height: 1600 });
  const dimensions = await menu.evaluate((element) => ({
    popup: element.getBoundingClientRect().height,
    content: element
      .querySelector('[data-slot="scroll-area-viewport"]')!
      .firstElementChild!.getBoundingClientRect().height,
  }));
  expect(dimensions.popup).toBeLessThanOrEqual(dimensions.content + 32);
  const server = menu.getByRole("button", { name: "الخادم والاتصال", exact: true });
  await server.scrollIntoViewIfNeeded();
  await server.click();
  const nested = page.getByRole("dialog", { name: "اختر مكتبتك", exact: true });
  await expect(nested).toHaveAttribute("data-slot", "drawer-popup");
  await expect(nested.getByRole("button", { name: "إضافة خادم", exact: true })).toBeVisible();
  await nested.hover();
  await expect(nested.getByRole("button", { name: "إضافة خادم", exact: true })).toBeInViewport({
    ratio: 1,
  });
  const nestedSize = await nested.boundingBox();
  expect(nestedSize!.height).toBeLessThan(600);
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/public-nested-drawer.png" });
  await page.keyboard.press("Escape");
  await expect(nested).toHaveCount(0);
  await expect(server).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "كل الصفحات", exact: true })).toBeFocused();
});

test("quick search desktop: pages, content, keyboard selection and private opt-in", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  const home = page.getByRole("link", { name: "الرئيسية", exact: true });
  await home.focus();
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "البحث السريع", exact: true });
  const input = dialog.getByRole("combobox", { name: "ابحث في المكتبة والصفحات" });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("dir", "rtl");
  const clear = dialog.getByRole("button", { name: "مسح البحث", exact: true });
  await expect(clear).toHaveCount(0);
  const all = dialog.getByRole("tab", { name: "الكل", exact: true });
  const recent = dialog.getByRole("region", { name: "أضيف حديثًا" }).getByRole("link");
  await expect(recent).toHaveCount(2);
  await input.press("ArrowDown");
  await expect(all).toBeFocused();
  await all.press("ArrowDown");
  await expect(recent.first()).toBeFocused();
  await recent.first().press("ArrowLeft");
  await expect(recent.nth(1)).toBeFocused();
  await recent.nth(1).press("ArrowUp");
  await expect(all).toBeFocused();
  await all.press("ArrowUp");
  await expect(input).toBeFocused();
  await dialog.getByRole("tab", { name: "الأفلام", exact: true }).click();
  await expect(
    dialog.getByRole("region", { name: "أفلام صدرت حديثًا" }).getByRole("link"),
  ).toHaveCount(1);
  const studiosTab = dialog.getByRole("tab", { name: "الاستوديوهات", exact: true });
  await studiosTab.click();
  const studio = dialog
    .getByRole("region", { name: "الاستوديوهات" })
    .getByRole("link", { name: /استوديو الخيال/ });
  await expect(studio).toBeVisible();
  await expect(studio.locator('[data-slot="studio-artwork"]').first()).toBeVisible();
  const studios = dialog.getByRole("region", { name: "الاستوديوهات" });
  await expect(studios.getByRole("link", { name: /استوديو آخر/ })).toHaveCount(0);
  await expect(studios.getByRole("link", { name: "صفحة الاستوديوهات" })).toHaveAttribute(
    "href",
    "#/studios?shape=banner&size=medium&image=with&role=all",
  );
  await studiosTab.press("ArrowDown");
  await expect(studio).toBeFocused();
  await dialog.getByRole("tab", { name: "الصنّاع", exact: true }).click();
  await expect(
    dialog.getByRole("region", { name: "الصنّاع" }).getByRole("link", { name: /مخرج الخيال/ }),
  ).toHaveAttribute("href", "#/people/fixture-person");
  await dialog.getByRole("tab", { name: "الكواكب", exact: true }).click();
  await expect(
    dialog.getByRole("region", { name: "الكواكب" }).getByRole("link", { name: /الخيال/ }),
  ).toBeVisible();
  await all.click();
  await input.fill("maintenance");
  await expect(clear).toHaveCount(1);
  await expect(dialog.getByRole("option", { name: /صيانة الخادم/ })).toBeVisible();
  await input.fill("عمل خاص");
  await expect(dialog.getByText("لا توجد نتائج مطابقة", { exact: true })).toBeVisible();
  await input.press("Alt+p");
  await expect(dialog.getByRole("switch", { name: "تضمين الأعمال الخاصة" })).toBeChecked();
  await expect(dialog.getByRole("option", { name: /عمل خاص.*رسوم متحركة/ })).toBeVisible();
  await input.fill("الخيال");
  await expect(dialog.getByRole("option", { name: /الخيال.*الكواكب/ })).toBeVisible();
  const preview = dialog.getByRole("complementary", { name: "معاينة النتيجة" });
  await expect(preview.getByRole("heading", { name: "الخيال", exact: true })).toBeVisible();
  await input.press("ArrowDown");
  await all.press("ArrowDown");
  const results = dialog.getByRole("listbox", { name: "نتائج البحث السريع" });
  await expect(results).toBeFocused();
  await results.press("ArrowDown");
  await expect(preview.getByRole("heading", { name: "مخرج الخيال" })).toBeVisible();
  await expect(preview.getByText("إخراج", { exact: true })).toBeVisible();
  await results.press("ArrowDown");
  await expect(preview.getByRole("heading", { name: "استوديو الخيال" })).toBeVisible();
  await expect(preview.getByText("إنتاج", { exact: true })).toBeVisible();
  await input.fill("رحلة في المكتبة");
  await expect(dialog.getByRole("option", { name: /رحلة في المكتبة.*رسوم متحركة/ })).toBeVisible();
  await expect(preview.getByRole("heading", { name: "رحلة في المكتبة" })).toBeVisible();
  await expect(preview.getByText("مطابقة تامة")).toBeVisible();
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/quick-search-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(home).toBeFocused();
  await page.keyboard.press("Control+k");
  await input.fill("calendar");
  // The registry uses the canonical route name as an English search term.
  await input.fill("releases");
  await expect(dialog.getByRole("option", { name: /التقويم/ })).toBeVisible();
  await input.press("Enter");
  await expect(page).toHaveURL(/#\/releases/);
  await expect(dialog).toHaveCount(0);
});

for (const width of [360, 1440]) {
  test(`trailers redesign ${width}: themes, grid and table, including older servers`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((fixture) => {
      const handler = window.webkit?.messageHandlers?.nahhasio;
      if (!handler) throw new Error("Fixture bridge missing");
      const original = handler.postMessage.bind(handler);
      handler.postMessage = (message: string) => {
        const request = JSON.parse(message);
        if (request.command === "trailers") {
          if (request.payload.media && sessionStorage.getItem("fixture-legacy-trailers")) {
            queueMicrotask(() =>
              window["__nahhasioReply"]?.({
                id: request.id,
                ok: false,
                error: { code: "bad_request", message: "Unknown trailer media filter" },
              }),
            );
            return;
          }

          const entries = Array.from({ length: 3 }, (_, index) => ({
            work: {
              ...fixture,
              titleAr: `حكاية ${index + 1}`,
              format: index === 1 ? "live-action" : "animated",
            },
            trailer: {
              id: `00000000-0000-4000-8000-${String(index + 90).padStart(12, "0")}`,
              youtubeVideoId: `video${index}`,
              title: index === 1 ? "الإعلان الرسمي" : `موسيقى حكاية ${index + 1}`,
              language: "ar",
              isPrimary: index === 0,
              position: index,
            },
          })).filter(
            (entry) =>
              (!request.payload.media ||
                (request.payload.media === "music") === entry.trailer.title.startsWith("موسيقى")) &&
              (!request.payload.format || request.payload.format === entry.work.format) &&
              (!request.payload.q || entry.work.titleAr.includes(request.payload.q)),
          );
          const legacy = Boolean(sessionStorage.getItem("fixture-legacy-trailers"));
          const pageNumber = request.payload.page ?? 1;
          const pageSize = legacy ? 1 : 24;
          const ordered = legacy
            ? entries.toSorted(
                (a, b) =>
                  Number(a.work.format === "animated") - Number(b.work.format === "animated"),
              )
            : entries;
          const result = {
            items: ordered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
            total: entries.length,
            page: pageNumber,
            pageSize,
          };
          queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
        } else original(message);
      };
    }, work);
    await login(page);
    await openPublicPage(page, "الشارات والإعلانات التشويقية");
    const categoryLabel = "نوع المقاطع";
    const choose = async (label: string, name: string) => {
      if (width === 360) {
        await page.getByRole("combobox", { name: label }).click();
        await page.getByRole("option", { name, exact: true }).click();
      } else {
        await page
          .getByRole("group", { name: label })
          .getByRole("button", { name, exact: true })
          .click();
      }
    };
    const expectCategory = async (name: string) => {
      if (width === 360) {
        await expect(page.getByRole("combobox", { name: categoryLabel })).toContainText(name);
      } else {
        const category = page.getByRole("group", { name: categoryLabel });
        await expect(category.getByRole("button", { name, exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
    };
    const tracks = page.getByRole("list", { name: "قائمة المقاطع" });
    await expectCategory("الشارات");
    await expect(tracks.getByRole("listitem")).toHaveCount(2);
    expect(
      await tracks.getByRole("listitem").evaluateAll((cards) => {
        const [first, second] = cards.map((card) => card.getBoundingClientRect());
        return first.top === second.top && first.left !== second.left;
      }),
    ).toBe(true);
    const cover = tracks.getByRole("listitem").first().locator("a > span").first();
    await expect(cover).toHaveCSS("aspect-ratio", "1 / 1");
    const display = page.getByRole("group", { name: "خيارات عرض المقاطع" });
    await display.getByRole("button", { name: "جدول", exact: true }).click();
    await expect(page.getByRole("table", { name: "جدول المقاطع" }).getByRole("row")).toHaveCount(3);
    const sizes = display.getByRole("group", { name: "حجم المقاطع" });
    await sizes.getByRole("button", { name: "كبير", exact: true }).click();
    await expect(page).toHaveURL(/size=large/);
    await display.getByRole("button", { name: "شبكة", exact: true }).click();
    await expect(tracks.getByRole("listitem")).toHaveCount(2);
    await expect(tracks.getByRole("link", { name: /تشغيل موسيقى حكاية 1/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=video0",
    );
    await expect(tracks.getByRole("link", { name: "تفاصيل حكاية 1" })).toHaveAttribute(
      "href",
      `#/titles/${work.id}`,
    );
    const sorting = page.getByRole("group", { name: "ترتيب المقاطع" });
    await sorting.getByRole("button", { name: "اسم العمل" }).click();
    await expect(page).toHaveURL(/sort=title/);

    await choose(categoryLabel, "الإعلانات التشويقية");
    await expect(page).toHaveURL(/media=trailer/);
    await expect(tracks.getByRole("listitem")).toHaveCount(1);
    await choose("نوع الأعمال", "تمثيل حي");
    await expect(page).toHaveURL(/format=live-action/);
    await expect(tracks.getByRole("link", { name: /تشغيل الإعلان الرسمي/ })).toBeVisible();
    await page
      .getByRole("textbox", { name: "البحث عن مقطع أو عمل بالعربية أو الإنجليزية" })
      .fill("لا يوجد");
    await expect(page.getByText("لا توجد مقاطع مطابقة", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "مسح الفلاتر", exact: true }).click();
    await expectCategory("الإعلانات التشويقية");
    await expect(tracks.getByRole("listitem")).toHaveCount(1);
    await choose(categoryLabel, "الكل");
    await expect(tracks.getByRole("listitem")).toHaveCount(3);
    await page.evaluate(() => sessionStorage.setItem("fixture-legacy-trailers", "1"));
    await page
      .getByRole("textbox", { name: "البحث عن مقطع أو عمل بالعربية أو الإنجليزية" })
      .fill("حكاية");
    await choose(categoryLabel, "الشارات");
    await expectCategory("الشارات");
    await expect(tracks.getByRole("listitem")).toHaveCount(2);
    await expect(tracks.getByRole("link", { name: /الإعلان الرسمي/ })).toHaveCount(0);
    await choose(categoryLabel, "الإعلانات التشويقية");
    await expectCategory("الإعلانات التشويقية");
    await expect(tracks.getByRole("listitem")).toHaveCount(1);
    await expect(tracks.getByRole("link", { name: /تشغيل الإعلان الرسمي/ })).toBeVisible();

    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const failure of ["network", "not_found", "resource"]) {
  test(`artwork recovery: ${failure}, retry without reload and warm navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 520, height: 1000 });
    if (failure === "resource") {
      let imageRequests = 0;
      await page.route("**/_fixture_artwork/**", (route) => {
        imageRequests++;
        return imageRequests <= 2 ? route.abort() : route.fallback();
      });
    }
    await page.evaluate((code) => {
      const handler = window.webkit?.messageHandlers?.nahhasio;
      if (!handler) throw new Error("Fixture bridge missing");
      const original = handler.postMessage.bind(handler);
      let requests = 0;
      handler.postMessage = (message: string) => {
        const request = JSON.parse(message);
        if (request.command === "facets") {
          const result = {
            groups: [
              {
                key: "contributors",
                label: "الصنّاع",
                options: [
                  {
                    value: "person-1",
                    label: "صانع تجريبي",
                    count: 1,
                    artworkId: "00000000-0000-4000-8000-000000000031",
                  },
                ],
              },
            ],
            yearMin: 2021,
            yearMax: 2021,
          };
          queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
        } else if (request.command === "artwork.url") {
          requests++;
          document.documentElement.dataset.artworkRequests = String(requests);
          queueMicrotask(() =>
            window["__nahhasioReply"]?.(
              requests === 1 && code !== "resource"
                ? { id: request.id, ok: false, error: { code, message: "Artwork fixture failure" } }
                : {
                    id: request.id,
                    ok: true,
                    result: {
                      url: `nahhasio://app/_artwork/0/${request.payload.id}/${request.payload.width}`,
                    },
                  },
            ),
          );
        } else original(message);
      };
    }, failure);
    await login(page);
    await openPublicPage(page, "الصنّاع");
    const recovery = page.getByRole("button", { name: "إعادة تحميل الصور", exact: true });
    if (failure !== "network") {
      await expect(recovery).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-artwork-requests", "1");
      await recovery.click();
    }
    const image = page.locator('img[src*="/_fixture_artwork/"]');
    await expect
      .poll(() =>
        image.evaluateAll((images) =>
          images.some((entry) => entry instanceof HTMLImageElement && entry.naturalWidth === 200),
        ),
      )
      .toBe(true);
    await expect(page.locator("html")).toHaveAttribute("data-artwork-requests", "2");
    await expect(recovery).toHaveCount(0);
    await openPublicPage(page, "الاستوديوهات");
    await openPublicPage(page, "الصنّاع");
    await expect(image).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-artwork-requests", "2");
  });
}

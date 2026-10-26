import type { WorkDetail, WorkSummary } from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
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
                case "home":
                  result = {
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
                    items: entries.slice(0, query.pageSize ?? 24).map((item) => ({
                      ...item,
                      work: fixtureWork,
                      installment: {
                        id: item.installmentId,
                        workId: item.workId,
                        workTitle: item.workTitle,
                        workTitleAr: item.workTitleAr,
                        title: item.title ?? "",
                        kind: "season",
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
for (const width of [480, 1440]) {
  test(`IMDb watch design ${width}: validation, series target and honest pending actions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page
      .getByRole("navigation", { name: "التنقل الرئيسي" })
      .getByRole("link", { name: "مشاهدة مباشرة", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "حكايتك، بمعرّف واحد." })).toBeVisible();
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
    for (const name of ["البحث عن المصادر", "تنزيل الفيديو", "اختيار ترجمة"])
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    await page.getByLabel("الحلقة", { exact: true }).fill("3");
    await expect(page.getByRole("heading", { name: "الموسم 0 · الحلقة 2" })).toHaveCount(0);
    await page.getByRole("button", { name: "فيلم", exact: true }).click();
    await expect(page.getByLabel("الموسم", { exact: true })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: `../../../data/previews/watch-${width}.png` });
  });
}
async function login(page: Page) {
  if ((await page.getByLabel("البريد الإلكتروني").count()) === 0)
    await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني" }).click();
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "دخول المكتبة" }).click();
  await expect(page.getByRole("region", { name: "أحدث الأعمال" })).toBeVisible();
  await expect
    .poll(async () => {
      await page.locator("#main-content").evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      return page.getByRole("heading", { name: "آخر تحديثات المكتبة", exact: true }).count();
    })
    .toBe(1);
  await expect(latestRow(page).locator("article").first()).toBeVisible();
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
  await expect(second).toHaveAccessibleName(/1 حلقة/);
  await second.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('button[data-day="3"]')).toBeFocused();
  await second.click();
  const day = page.getByRole("dialog");
  await expect(day.getByRole("link", { name: /بداية جديدة/ })).toHaveAttribute(
    "href",
    /episode=00000000-0000-4000-8000-000000000008/,
  );
  await day.getByRole("button", { name: "إغلاق حلقات اليوم" }).click();
  await page.getByRole("tab", { name: "الخط الزمني", exact: true }).click();
  await expect(page.getByRole("heading", { name: "على امتداد 2027" })).toBeVisible();
  await expect(page.getByRole("tabpanel").getByRole("link", { name: /بداية جديدة/ })).toBeVisible();
  await page.getByRole("tab", { name: "المواسم", exact: true }).click();
  await expect(page.getByRole("heading", { name: "الشتاء 2027", exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel").locator("article[data-layout]")).toHaveCount(1);
  await page.getByRole("tab", { name: "القادم", exact: true }).click();
  await expect(page.getByRole("heading", { name: "في الأفق" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "جزء بلا موعد", exact: true })).toBeVisible();
});
for (const width of [480, 1440]) {
  test(`releases responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.goto("/#/releases?year=2027&month=1&view=calendar");
    await expect(page.locator('button[data-day="2"]')).toHaveAccessibleName(/1 حلقة/);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: `../../../data/previews/releases-${width}.png`, fullPage: true });
  });
}
async function browse(page: Page) {
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "تصفّح المكتبة" })
    .click();
  await expect(page).toHaveURL(/#\/browse$/);
  await expect(page.getByRole("heading", { name: "تصفّح المكتبة" })).toBeVisible();
}
async function openFilters(page: Page) {
  await page.getByRole("button", { name: /^المرشحات/ }).click();
  const sheet = page.getByRole("dialog", { name: "مرشحات المكتبة" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "الإصدار ومكتبتي", exact: true }).click();
  return sheet;
}
function latestRow(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "آخر تحديثات المكتبة", exact: true }) })
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
  await expect(article.getByRole("tab", { name: "العائلة", exact: true })).toHaveCount(0);
  await expect(article.getByRole("tab", { name: "الملف", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel").getByText("تنبيه تحريري محفوظ")).toBeVisible();
  const theology = page
    .getByRole("tabpanel")
    .locator('[data-slot="card"]')
    .filter({
      has: page.getByRole("heading", { name: "ملاحظات التحليل", exact: true }),
    });
  await expect(
    theology.getByRole("heading", { name: "ملاحظات التحليل", exact: true }),
  ).toBeVisible();
  await expect(
    article.getByRole("complementary").getByText("الموضوعات العقدية", { exact: true }),
  ).toBeVisible();
  await expect(theology.getByText("متوسط", { exact: true })).toBeVisible();
  await expect(article.getByRole("button", { name: "تشغيل", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
  await expect(page.getByRole("region", { name: "أحدث الأعمال" })).toBeVisible();
  await browse(page);
  await page.getByRole("button", { name: "البحث في المكتبة", exact: true }).click();
  await page.getByRole("searchbox", { name: "ابحث في المكتبة" }).fill("missing");
  await expect(page.getByText("لا توجد نتائج مطابقة", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/q=missing/);
  await page.getByRole("button", { name: "الملف والحساب" }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await expect(page.getByRole("heading", { name: "من يشاهد؟" })).toBeVisible();
});
for (const width of [480, 640, 1024, 1440])
  test("responsive " + width + ": library and work page fit window", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await expect(page.getByRole("link", { name: "البحث" })).toBeVisible();
    await browse(page);
    await page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).click();
    await expect(page.getByRole("tab", { name: "العائلة", exact: true })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "الملف", exact: true })).toBeVisible();
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
  const row = latestRow(page);
  await row.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).focus();
  await page.keyboard.press("Tab");
  await expect(row.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toBeFocused();
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
  await expect(dialog.getByText("3 نتيجة مطابقة", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /^تطبيق المرشحات/ }).click();
  await expect(page.getByRole("link", { name: "تفاصيل عمل خاص" })).toBeVisible();
  dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "مسح كل المرشحات" }).click();
  await dialog.getByRole("button", { name: "التصنيف", exact: true }).click();
  const live = dialog.getByRole("button", { name: /^تمثيل حي،/ });
  await live.click();
  await expect(dialog.getByText("1 نتيجة مطابقة", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /^تطبيق المرشحات/ }).click();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toBeVisible();
  await expect(page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" })).toHaveCount(0);
  dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "التصنيف", exact: true }).click();
  await dialog.getByRole("button", { name: /^تمثيل حي،/ }).click();
  await expect(dialog.getByRole("button", { name: /^تمثيل حي،/ })).toHaveAttribute(
    "aria-pressed",
    "mixed",
  );
  await dialog.getByRole("button", { name: /^تطبيق المرشحات/ }).click();
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
  await expect(dialog.getByText("3 نتيجة مطابقة", { exact: true })).toBeVisible();
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
  await expect(dialog.getByText("2 نتيجة مطابقة", { exact: true })).toBeVisible();
  expect(page.url()).toBe(initial);
  await dialog.getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(page.getByRole("button", { name: /^المرشحات/ })).toBeFocused();
  dialog = await openFilters(page);
  await expect(dialog.getByRole("button", { name: /^مكتمل،/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await dialog.getByRole("button", { name: "العامة والخاصة", exact: true }).click();
  await dialog.getByRole("button", { name: /^تطبيق المرشحات/ }).click();
  await expect(page).toHaveURL(/privacy=all/);
  await expect(page.getByRole("link", { name: "تفاصيل عمل خاص", exact: true })).toBeVisible();
  dialog = await openFilters(page);
  await dialog.getByRole("button", { name: "مسح كل المرشحات" }).click();
  await expect(page).toHaveURL(/privacy=all/);
  await dialog.getByRole("button", { name: /^تطبيق المرشحات/ }).click();
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
    await dialog.getByLabel("ابحث في المرشحات").fill("تمثيل حي");
    const live = dialog.getByRole("button", { name: /^تمثيل حي،/ });
    await live.focus();
    await page.keyboard.press("Space");
    await expect(live).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText("1 نتيجة مطابقة", { exact: true })).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(await dialog.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      false,
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^المرشحات/ })).toBeFocused();
    await page.getByRole("combobox", { name: "ترتيب النتائج", exact: true }).click();
    await page.getByRole("option", { name: "الأعلى تقييمًا", exact: true }).click();
    await expect(page).toHaveURL(/sort=score-desc/);
    await page.getByRole("button", { name: "خيارات العرض", exact: true }).click();
    await page.getByRole("combobox", { name: "تجميع النتائج", exact: true }).click();
    await page.getByRole("option", { name: "حالة الإصدار", exact: true }).click();
    await expect(page).toHaveURL(/group=status/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "مكتمل", exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني" }).click();
    await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("fixture-password");
    await page.getByRole("button", { name: "دخول المكتبة" }).click();
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
  await page.getByRole("link", { name: "البحث" }).focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(18000);
  await expect(hero.getByRole("heading", { name: "رحلة أخرى" })).toBeVisible();
  await hero.getByRole("button", { name: "تشغيل التبديل التلقائي" }).click();
  await page.getByRole("link", { name: "البحث" }).focus();
  await page.mouse.move(0, 0);
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
    "sidebar controls " + width + ": search page and keyboard dropdown under packaged CSP",
    async ({ page }) => {
      const cspErrors: string[] = [];
      page.on("console", (message) => {
        if (/Content Security Policy|violates.*policy/i.test(message.text()))
          cspErrors.push(message.text());
      });
      await page.setViewportSize({ width, height: 900 });
      await login(page);
      const search = page.getByRole("link", { name: "البحث" });
      const searchBox = await search.boundingBox();
      expect(searchBox?.height).toBeGreaterThanOrEqual(36);
      await search.click();
      const input = page.getByRole("searchbox", { name: "ابحث في المكتبة" });
      await expect(input).toBeFocused();
      await input.fill("missing");
      await expect(page.getByText("لا توجد نتائج مطابقة", { exact: true })).toBeVisible();
      await input.fill("رحلة");
      await expect(page.getByRole("link", { name: /تفاصيل رحلة في المكتبة/ })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
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
      await dialog.getByRole("button", { name: /^تطبيق المرشحات/ }).click();
      await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(2);
      expect(cspErrors).toEqual([]);
    },
  );
}

test("home logic: scores, planet discovery and installment destination", async ({ page }) => {
  await login(page);
  await expect(latestRow(page).getByText("7.1", { exact: true }).first()).toBeVisible();
  await expect(latestRow(page).locator("article").first()).toHaveAttribute("data-watched", "true");
  await expect(latestRow(page).locator("article").nth(1)).toHaveAttribute("data-watched", "false");
  await expect(
    page.getByRole("heading", { name: "عوالم تستحق الاكتشاف", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "اختر كوكبًا" }).getByRole("button", { name: /الخيال/ }),
  ).toHaveAttribute("aria-pressed", "true");
  const upcoming = page.getByRole("region", { name: "قريبًا" });
  await expect(upcoming).toContainText("الموسم القادم");
  await upcoming.getByRole("link", { name: /الموسم القادم/ }).click();
  await expect(page).toHaveURL(
    new RegExp("#/titles/" + work.id + "\\?installment=00000000-0000-4000-8000-000000000007$"),
  );
  await expect(page.getByRole("article", { name: "صفحة العمل" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "الأجزاء", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("tabpanel").getByRole("heading", { name: "الموسم القادم", exact: true }),
  ).toBeVisible();
  const seasonSelector = page
    .getByRole("tabpanel")
    .getByRole("button", { name: "الموسم القادم", exact: true });
  await seasonSelector.click();
  await expect(
    page.getByRole("button", { name: "الموسم القادم 0 حلقة", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(seasonSelector).toBeFocused();
  await page.getByRole("button", { name: "العودة إلى المكتبة" }).click();
  await expect(upcoming.getByRole("link", { name: /الموسم القادم/ })).toBeVisible();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "الكواكب", exact: true })
    .click();
  await page.getByRole("link", { name: /الخيال/ }).click();
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(1);
  await browse(page);
  await expect(page.getByRole("link", { name: /^تفاصيل/ })).toHaveCount(2);
  await page.getByRole("link", { name: "تفاصيل رحلة في المكتبة" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "صفحة العمل" }).getByText("7.1", { exact: true }).first(),
  ).toBeVisible();
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
    await expect(page.getByRole("link", { name: "البحث", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "الملف والحساب" })).toBeVisible();
    const row = latestRow(page);
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
    await row.locator("article").last().scrollIntoViewIfNeeded();
    await expect(row.locator("article").last()).toBeInViewport();
    expect(new Set(metrics.tops).size).toBe(1);
    const hero = await page.getByRole("region", { name: "أحدث الأعمال" }).boundingBox();
    expect(hero?.height).toBeLessThan(width < 600 ? 700 : 900);
    await page.getByRole("link", { name: "البحث", exact: true }).click();
    await expect(page).toHaveURL(/#\/search$/);
    await expect(page.getByRole("searchbox", { name: "ابحث في المكتبة" })).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("searchbox", { name: "ابحث في المكتبة" })).toBeFocused();
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
    await expect(rail.getByRole("link", { name: "البحث" })).toBeVisible();
    await expect(rail.getByRole("link", { name: "الرئيسية", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const profile = rail.getByRole("button", { name: "الملف والحساب" });
    const box = await profile.boundingBox();
    expect(box?.y).toBeGreaterThan(600);
    const mainBox = await page.locator("#main-content").boundingBox();
    expect(mainBox?.y).toBe(0);
    expect(mainBox?.height).toBe(720);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
    await profile.click();
    await expect(page.getByRole("menu", { name: "الحساب" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "تسجيل الخروج" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(profile).toBeFocused();
    if (width === 1440)
      await page.screenshot({ path: test.info().outputPath("sidebar-review.png") });
    await page.setViewportSize({ width, height: 400 });
    await expect(profile).toBeInViewport();
    await rail.getByRole("button", { name: "صفحات أخرى", exact: true }).click();
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
                  },
                ],
              },
            ],
            yearMin: 2021,
            yearMax: 2021,
          };
          queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
        } else if (request.command === "artwork") {
          const result = {
            dataUrl:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
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
      await rail.getByRole("link", { name: item.label, exact: true }).click();
      await expect(page.getByRole("region", { name: item.page })).toBeVisible();
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
        await expect(image).toHaveJSProperty("naturalWidth", 1);
        await page.screenshot({
          path: `../../../data/previews/${item.route.split("/")[0]}-${width}.png`,
        });
      }
      await page.getByRole("link", { name: new RegExp(item.name) }).click();
      await expect(page).toHaveURL(new RegExp(`#/${item.route}`));
      await expect(page.getByRole("heading", { name: item.name, exact: true })).toBeVisible();
      await page.getByRole("link", { name: item.back, exact: true }).click();
      await expect(page.getByRole("region", { name: item.page })).toBeVisible();
      expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

test("sidebar search: full page, Ctrl+K, Arabic layout and history", async ({ page }) => {
  await login(page);
  const rail = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await rail.getByRole("link", { name: "البحث", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "ابحث في المكتبة" });
  await expect(input).toBeFocused();
  await input.fill("رحلة");
  const result = page.getByRole("link", { name: /تفاصيل رحلة في المكتبة/ });
  await expect(result).toBeVisible();
  await rail.getByRole("link", { name: "الرئيسية", exact: true }).focus();
  await page.keyboard.press("Control+k");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("رحلة");
  await rail.getByRole("link", { name: "الرئيسية", exact: true }).focus();
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
  await result.click();
  await expect(page).toHaveURL(/#\/titles\//);
  await page.goBack();
  await expect(input).toHaveValue("رحلة");
  await rail.getByRole("link", { name: "الرئيسية", exact: true }).click();
  await page.keyboard.press("Control+k");
  await expect(input).toBeFocused();
});

for (const width of [480, 1440]) {
  test(`search page ${width}: quick types, private opt-in and entity navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.getByRole("link", { name: "البحث", exact: true }).click();
    const input = page.getByRole("searchbox", { name: "ابحث في المكتبة" });
    await input.fill("رحلة");
    const results = page.getByRole("region", { name: "الأعمال المطابقة" });
    await expect(results.getByRole("link")).toHaveCount(2);
    await page.getByRole("button", { name: "الأفلام", exact: true }).click();
    await expect(results.getByRole("link")).toHaveCount(1);
    await expect(results.getByRole("link", { name: "تفاصيل رحلة في المكتبة" })).toBeVisible();
    await page.getByRole("button", { name: "المسلسلات", exact: true }).click();
    await expect(results.getByRole("link", { name: "تفاصيل رحلة أخرى" })).toBeVisible();
    await page.getByRole("button", { name: "الأجزاء", exact: true }).click();
    await expect(results.getByRole("link").first()).toHaveAttribute("href", /installment=/);
    await page.getByRole("button", { name: "الكل", exact: true }).click();
    await input.fill("عمل خاص");
    await expect(page.getByText("لا توجد نتائج مطابقة", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "تضمين الأعمال الخاصة" }).check();
    await expect(results.getByRole("link", { name: "تفاصيل عمل خاص" })).toBeVisible();
    await input.fill("الخيال");
    await page.getByRole("button", { name: "الكواكب", exact: true }).click();
    await expect(page.getByRole("link", { name: /الخيال/ })).toBeVisible();
    const metrics = await page.evaluate(() => {
      const main = document.getElementById("main-content")!;
      return { width: main.clientWidth, scroll: main.scrollWidth };
    });
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
    await page.screenshot({ path: `test-results/search-${width}.png` });
    await page.getByRole("link", { name: /الخيال/ }).click();
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
  test(`card display settings ${width}: layouts, size, minimal and reset`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await expect(
      page.getByRole("group", { name: "اختر كوكبًا" }).getByRole("button", { name: /الخيال/ }),
    ).toHaveAttribute("aria-pressed", "true");
    const upcoming = page.getByRole("region", { name: "قريبًا" });
    await expect(upcoming.getByText("غير مقيّم")).toHaveCount(0);
    await expect(upcoming.getByText("الموسم القادم", { exact: true })).toBeVisible();
    await expect(latestRow(page).locator("article").first()).toHaveAttribute("data-kind", "work");
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
    await borderless.click();
    await expect(borderless).toBeChecked();
    await page.getByRole("button", { name: "شعار فقط", exact: true }).click();
    await expect(cards.getByRole("heading")).toHaveCount(0);
    await expect(cards.getByRole("link")).toHaveCount(2);
    await page.getByRole("button", { name: "استعادة العرض الافتراضي" }).click();
    await expect(cards.first()).toHaveAttribute("data-layout", "poster");
    await expect(cards.getByRole("heading")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await cards.first().getByRole("link").focus();
    await page.screenshot({ path: `test-results/card-refinement-${width}.png` });
    await page.getByRole("button", { name: "خيارات العرض", exact: true }).click();
    await page.getByRole("button", { name: "جدول", exact: true }).click();
    await expect(page.getByRole("table")).toBeVisible();
  });
}

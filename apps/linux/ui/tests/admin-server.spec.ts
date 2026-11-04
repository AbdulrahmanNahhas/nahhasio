import type { rpcInputs } from "@arcadia/contracts/editor-rpc";
import type { ServerOperationRequest } from "@nahhasio/api-contract";
import type { z } from "zod";
type LibraryCall = { operation: string; data: z.infer<(typeof rpcInputs)[keyof typeof rpcInputs]> };
declare global {
  interface Window {
    fixtureLibraryCalls: LibraryCall[];
    fixtureMaintenanceCalls: ServerOperationRequest[];
  }
}
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const user = {
      id: "fixture-admin",
      accountId: "00000000-0000-4000-8000-000000000001",
      name: "المدير",
      email: "fixture@example.test",
      role: "owner",
      kind: "admin",
      avatarKey: "cars-1.png",
      bio: "",
      isAdmin: true,
      updatedAt: "2026-10-20T00:00:00Z",
    };
    let server = {
      id: "00000000-0000-4000-8000-000000000009",
      name: "مكتبة العائلة",
      revision: "first",
    };
    let providers = {
      revision: 0,
      editable: true,
      tmdb: { configured: false, source: "environment" },
      fanart: { configured: true, source: "environment" },
    };
    const maintenanceCalls: ServerOperationRequest[] = [];
    window.fixtureMaintenanceCalls = maintenanceCalls;
    const calls: LibraryCall[] = [];
    Object.assign(window, { fixtureLibraryCalls: calls });
    const assets = [1, 2].map((index) => ({
      id: `00000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
      path: `/media/fixture-${index}.jpg`,
      fileName: `fixture-${index}.jpg`,
      mimeType: "image/jpeg",
      byteSize: 100,
      width: 100,
      height: 100,
      sha256: "a".repeat(64),
      createdAt: "2026-10-20T00:00:00Z",
      health: "healthy",
      assignmentCount: 0,
      roles: [],
    }));
    window.webkit = {
      messageHandlers: {
        nahhasio: {
          postMessage(raw: string) {
            const request = JSON.parse(raw);
            let result;
            switch (request.command) {
              case "session":
                result = { user, expiresAt: "2099-01-01T00:00:00Z" };
                break;
              case "adminAccess":
                result = user;
                break;
              case "servers.list":
                result = {
                  selected: "http://127.0.0.1:23103/",
                  servers: [{ url: "http://127.0.0.1:23103/", name: server.name }],
                };
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
              case "serverOperations":
                result = {
                  version: 1,
                  available: true,
                  backups: [
                    {
                      id: "backup-old",
                      createdAt: "2026-10-20T00:00:00Z",
                      reason: "manual",
                      byteSize: 1048576,
                      version: "0.1.1",
                      schema: "fixture-schema",
                    },
                    {
                      id: "backup-new",
                      createdAt: "2026-10-30T12:00:00Z",
                      reason: "manual",
                      byteSize: 2097152,
                      version: "0.1.2",
                      schema: "fixture-schema",
                    },
                  ],
                  update: {
                    state: "available",
                    currentVersion: "0.1.2",
                    availableVersion: "0.1.3",
                    message: "إصدار تجريبي جاهز للمراجعة",
                  },
                  activeJob: maintenanceCalls.length
                    ? {
                        id: maintenanceCalls.at(-1)!.id,
                        operation: maintenanceCalls.at(-1)!.operation,
                        state: "queued",
                        stage: "queued",
                        message: "طلب صيانة تجريبي",
                      }
                    : null,
                  lastJob: null,
                };
                break;
              case "requestServerOperation":
                maintenanceCalls.push(request.payload);
                result = { id: request.payload.id, state: "queued" };
                break;
              case "clientUpdate.status":
                result = {
                  available: true,
                  state: "up-to-date",
                  currentVersion: "0.1.2",
                  availableVersion: null,
                  pendingVersion: null,
                  automatic: true,
                  lastCheck: null,
                  manager: "flatpak",
                  message: "يدير النظام تحديث التطبيق.",
                };
                break;
              case "serverOverview":
                result = {
                  server,
                  version: "0.1.0",
                  apiVersion: 1,
                  uptimeSeconds: 3600,
                  database: "connected",
                  checks: [
                    {
                      key: "database-role",
                      label: "صلاحيات قاعدة البيانات",
                      ok: false,
                      detail: "استخدم دور تشغيل محدوداً عند التثبيت.",
                    },
                  ],
                  schema: { compatible: true, applied: 1, pending: 0 },
                  insights: {
                    formats: [{ key: "animated", value: 252 }],
                    kinds: [
                      { key: "animated-series", value: 100 },
                      { key: "animated-movie", value: 152 },
                    ],
                    workflow: [{ key: "published", value: 252 }],
                    statuses: [{ key: "completed", value: 252 }],
                    languages: [
                      { key: "ar", value: 88 },
                      { key: "en", value: 164 },
                    ],
                    additions: [{ key: "2026-10", value: 252 }],
                    artworkRoles: [{ key: "poster", value: 200 }],
                    genres: [],
                    missing: [{ key: "poster", value: 52 }],
                    unattachedImages: 2,
                    episodesMissing: 1,
                    episodesEligible: 1,
                    people: 20,
                    studios: 10,
                    episodeTargets: [
                      {
                        id: "00000000-0000-4000-8000-000000000050",
                        number: 1,
                        workId: "00000000-0000-4000-8000-000000000060",
                        workName: "عمل تجريبي",
                        tmdbId: 100,
                        season: 1,
                      },
                    ],
                    recentActivity: [],
                  },
                  counts: {
                    works: 252,
                    installments: 421,
                    episodes: 1879,
                    artwork: 1055,
                    artworkBytes: 406936704,
                    accounts: 5,
                    sessions: 4,
                    databaseBytes: 67108864,
                  },
                };
                break;
              case "serverSettings":
                result = { server, providers };
                break;
              case "renameServer":
                server = { ...server, name: request.payload.name, revision: "second" };
                result = server;
                break;
              case "updateProviders": {
                const { provider, action } = request.payload;
                if (action === "set" && request.payload.key !== "fixture-private-key")
                  throw new Error("Unexpected synthetic credential");
                providers = {
                  ...providers,
                  revision: providers.revision + 1,
                  [provider]: {
                    configured: action === "set",
                    source:
                      action === "set"
                        ? "server"
                        : action === "disable"
                          ? "disabled"
                          : "environment",
                  },
                };
                result = providers;
                break;
              }
              case "editorCall": {
                const { operation, data } = request.payload;
                calls.push({ operation, data });
                if (operation === "assets")
                  result = { items: assets, total: 2, page: 1, pageSize: 48 };
                else if (operation === "assetDetail")
                  result = {
                    asset: assets.find((asset) => asset.id === data.id) ?? assets[0],
                    assignments: [],
                    deleteBlockedReason:
                      data.id === assets[1].id ? "Artwork is needed by retained revisions" : null,
                  };
                else if (operation === "assetDelete")
                  result = { removed: true, fileRetained: true };
                else if (operation === "season")
                  result = [
                    {
                      number: 1,
                      title: "الحلقة الأولى",
                      summary: "",
                      releaseDate: null,
                      runtimeMinutes: null,
                      stillUrl: "https://image.tmdb.org/t/p/original/fixture.jpg",
                    },
                  ];
                else if (operation === "ingest")
                  result = { id: assets[0].id, path: assets[0].path };
                else if (operation === "assetAssign")
                  result = { assignmentId: "00000000-0000-4000-8000-000000000070" };
                else if (operation === "preview")
                  result = {
                    dataUrl:
                      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kAAAAABJRU5ErkJggg==",
                  };
                else result = null;
                result = { result };
                break;
              }
              default:
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { code: "unsupported", message: "خارج نطاق الاختبار" },
                  }),
                );
                return;
            }
            queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
          },
        },
      },
    };
  });
});
test("overview uses server status and settings save name and write-only keys", async ({ page }) => {
  await page.goto("/#/admin");
  await expect(page.getByRole("heading", { name: "نظرة عامة", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "فحوص تجهيز الخادم", exact: true }).click();
  await expect(
    page.getByText("استخدم دور تشغيل محدوداً عند التثبيت.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "تفاصيل الخادم", exact: true }).click();
  await expect(page.getByText("متوافق", { exact: true })).toBeVisible();
  await expect(page.getByText("يحتاج إلى تجهيز", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "../../../data/previews/admin-server-overview.png" });
  await page.getByRole("link", { name: "إعدادات الخادم", exact: true }).click();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByLabel("عنوان خادم Jellyfin", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("رمز الوصول", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "مطابقة المكتبات", exact: true })).toBeDisabled();
  await expect(page.getByLabel("مفتاح Fanart", { exact: true })).toBeVisible();
  await page.getByLabel("اسم الخادم", { exact: true }).fill("مكتبة أكوا");
  await page.getByRole("button", { name: "حفظ الاسم", exact: true }).click();
  await expect(page.getByLabel("اسم الخادم", { exact: true })).toHaveValue("مكتبة أكوا");
  const tmdb = page.getByLabel("رمز الوصول للقراءة من TMDB", { exact: true });
  await tmdb.fill("fixture-private-key");
  const card = page.locator('[data-slot="card"]').filter({ has: tmdb });
  await card.getByRole("button", { name: "حفظ المفتاح", exact: true }).click();
  await expect(tmdb).toHaveValue("");
  await expect(card.getByText("مفتاح مضبوط", { exact: true })).toBeVisible();
  await expect(card.getByRole("status")).toHaveText("حُفظت إعدادات TMDB.");
  await expect(page.locator("body")).not.toContainText("fixture-private-key");
  await card.getByRole("button", { name: "تعطيل المصدر", exact: true }).click();
  await expect(card.getByText("غير مفعّل", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "استخدام إعداد البيئة", exact: true }).click();
  await expect(card.getByText("يستخدم إعداد بيئة الخادم إن وُجد.", { exact: true })).toBeVisible();
  await page.screenshot({ path: "../../../data/previews/admin-server-settings.png" });
  await page.setViewportSize({ width: 520, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../../../data/previews/admin-server-settings-narrow.png" });
  await page.setViewportSize({ width: 360, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("failed services show retry and unprepared credential storage disables writes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command === "serverOverview")
        return queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: false,
            error: { code: "unavailable", message: "Fixture unavailable" },
          }),
        );
      if (request.command === "serverSettings")
        return queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: true,
            result: {
              server: { id: "fixture", name: "مكتبة", revision: "first" },
              providers: {
                editable: false,
                revision: 0,
                tmdb: { configured: false, source: "environment" },
                fanart: { configured: false, source: "environment" },
              },
            },
          }),
        );
      original(raw);
    };
  });
  await page.goto("/#/admin");
  await expect(page.getByRole("button", { name: "إعادة المحاولة", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "الإعدادات والاتصالات", exact: true }).click();
  await expect(page.getByText("مجلد الإعدادات الخاص غير مجهّز", { exact: true })).toBeVisible();
  await expect(page.getByLabel("رمز الوصول للقراءة من TMDB", { exact: true })).toBeDisabled();
});

test("a stale server name can reload the current settings", async ({ page }) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    let changed = false;
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command === "renameServer") {
        changed = true;
        return queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: false,
            error: { code: "conflict", message: "Fixture revision changed" },
          }),
        );
      }
      if (changed && request.command === "serverSettings")
        return queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: true,
            result: {
              server: { id: "fixture", name: "اسم غيّره مدير آخر", revision: "newer" },
              providers: {
                editable: true,
                revision: 0,
                tmdb: { configured: false, source: "environment" },
                fanart: { configured: false, source: "environment" },
              },
            },
          }),
        );
      original(raw);
    };
  });
  await page.goto("/#/admin/settings");
  await page.getByLabel("اسم الخادم", { exact: true }).fill("اسمي المؤقت");
  await page.getByRole("button", { name: "حفظ الاسم", exact: true }).click();
  await page.getByRole("button", { name: "إعادة تحميل الإعدادات", exact: true }).click();
  await expect(page.getByLabel("اسم الخادم", { exact: true })).toHaveValue("اسم غيّره مدير آخر");
});

test("library actions cleanup requires preview and confirmation and excludes protected images", async ({
  page,
}) => {
  await page.goto("/#/admin/maintenance?tab=actions");
  await page.getByRole("button", { name: "معاينة التنظيف", exact: true }).click();
  await page.getByRole("button", { name: "معاينة الصور", exact: true }).click();
  await expect(page.getByText("1 صورة قابلة للحذف · 1 صورة محمية")).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.fixtureLibraryCalls.filter(
        (call: { operation: string }) => call.operation === "assetDelete",
      ),
    ),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "حذف 1 صورة", exact: true }).click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.fixtureLibraryCalls.filter(
        (call: { operation: string }) => call.operation === "assetDelete",
      ),
    ),
  ).toHaveLength(0);
  await confirmation.getByRole("button", { name: "تأكيد الحذف", exact: true }).click();
  await expect(page.getByText("انتهت العملية", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.fixtureLibraryCalls.filter(
        (call: { operation: string }) => call.operation === "assetDelete",
      ),
    ),
  ).toEqual([
    {
      operation: "assetDelete",
      data: { id: "00000000-0000-4000-8000-000000000021", expectedSha256: "a".repeat(64) },
    },
  ]);
});

test("library actions episode images require source preview and only assign after confirmation", async ({
  page,
}) => {
  await page.goto("/#/admin/maintenance?tab=actions");
  await page.getByRole("button", { name: "تجهيز دفعة صور", exact: true }).click();
  await expect(page.getByLabel("رقم موسم TMDB", { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "معاينة الصور", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "تأكيد استيراد 1 صورة", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(() =>
      window.fixtureLibraryCalls.filter((call: { operation: string }) =>
        ["ingest", "assetAssign"].includes(call.operation),
      ),
    ),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "تأكيد استيراد 1 صورة", exact: true }).click();
  await expect(page.getByText("انتهت الدفعة", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.fixtureLibraryCalls.filter(
        (call: { operation: string }) => call.operation === "assetAssign",
      ),
    ),
  ).toEqual([
    {
      operation: "assetAssign",
      data: {
        assetId: "00000000-0000-4000-8000-000000000021",
        ownerKind: "episode",
        ownerId: "00000000-0000-4000-8000-000000000050",
        role: "still",
        expectedPrimaryId: null,
        expectedPrimaryAssetId: null,
      },
    },
  ]);
});

test("library actions reports a concurrent episode assignment conflict", async ({ page }) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command === "editorCall" && request.payload.operation === "assetAssign") {
        queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: false,
            error: { code: "conflict", message: "تغيّرت الصورة الأساسية" },
          }),
        );
        return;
      }
      original(raw);
    };
  });
  await page.goto("/#/admin/maintenance?tab=actions");
  await page.getByRole("button", { name: "تجهيز دفعة صور", exact: true }).click();
  await page.getByRole("button", { name: "معاينة الصور", exact: true }).click();
  await page.getByRole("button", { name: "تأكيد استيراد 1 صورة", exact: true }).click();
  await expect(page.getByText("انتهت الدفعة", { exact: true })).toBeVisible();
  await expect(
    page.getByText("عمل تجريبي · 1: تغيّرت الصورة الأساسية", { exact: true }),
  ).toBeVisible();
});

test("overview prioritizes editorial work, provides useful links and reveals details on demand", async ({
  page,
}) => {
  await page.goto("/#/admin");
  await expect(page.getByRole("heading", { name: "يحتاج إلى استكمال", exact: true })).toBeVisible();
  const missing = page.getByRole("link", { name: /الملصقات/ });
  await expect(missing).toContainText(new Intl.NumberFormat("ar").format(52));
  await expect(missing).toHaveAttribute("href", "#/admin/works?gap=poster");
  await expect(page.getByRole("link", { name: /قيد المراجعة/ })).toHaveAttribute(
    "href",
    "#/admin/works?workflow=in_review",
  );
  await expect(page.getByRole("link", { name: /الحسابات النشطة/ })).toHaveAttribute(
    "href",
    "#/admin/accounts",
  );
  await expect(page.getByText("00000000-0000-4000-8000-000000000009", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: /^فيلم رسوم متحركة/ })).toHaveAttribute(
    "href",
    "#/admin/works?format=animated&structure=movie",
  );
  await expect(page.getByRole("link", { name: /^مسلسل واقعي/ })).toHaveAttribute(
    "href",
    "#/admin/works?format=live-action&structure=series",
  );
  await expect(page.getByRole("link", { name: /^فيلم واقعي/ })).toHaveAttribute(
    "href",
    "#/admin/works?format=live-action&structure=movie",
  );
  await expect(page.getByRole("link", { name: /^مستمر/ })).toHaveAttribute(
    "href",
    "#/admin/works?status=ongoing",
  );
  await expect(page.getByRole("link", { name: /^قادم/ })).toHaveAttribute(
    "href",
    "#/admin/works?status=announced",
  );
  const distributions = page.getByRole("button", { name: "توزيع محتوى المكتبة", exact: true });
  await expect(distributions).toHaveAttribute("aria-expanded", "false");
  await distributions.press("Enter");
  await expect(distributions).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /^مسلسل رسوم متحركة/ })).toHaveAttribute(
    "href",
    "#/admin/works?format=animated&structure=series",
  );
  await distributions.press("Enter");
  await page.getByRole("heading", { name: "نظرة عامة", exact: true }).scrollIntoViewIfNeeded();
  const card = (title: string) =>
    page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  for (const [left, right] of [
    ["يحتاج إلى استكمال", "مسار التحرير"],
    ["إضافات المكتبة", "آخر نشاط إداري"],
    ["نوع الإنتاج", "حالة الإصدار"],
  ]) {
    const first = await card(left).boundingBox();
    const second = await card(right).boundingBox();
    expect(Math.abs(first!.height - second!.height)).toBeLessThanOrEqual(1);
  }
  const readiness = await page
    .getByRole("button", { name: "فحوص تجهيز الخادم", exact: true })
    .boundingBox();
  const serverDetails = await page
    .getByRole("button", { name: "تفاصيل الخادم", exact: true })
    .boundingBox();
  expect(readiness!.height).toBeLessThanOrEqual(48);
  expect(serverDetails!.height).toBeLessThanOrEqual(48);
  await expect(page.getByLabel("توزيع مراحل التحرير", { exact: true })).toBeVisible();
  await page.screenshot({ path: "../../../data/previews/admin-overview-redesign.png" });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("link", { name: "عمل جديد", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "تفاصيل الخادم", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "تفاصيل الخادم", exact: true }).click();
  await page.getByRole("heading", { name: "نظرة عامة", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../../../data/previews/admin-overview-redesign-narrow.png" });
});

test("overview makes incompatible schema prominent and handles an empty library", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command !== "serverOverview") return original(raw);
      const reply = window["__nahhasioReply"];
      window["__nahhasioReply"] = (message) => {
        if (message.id === request.id && message.ok) {
          const value = JSON.parse(JSON.stringify(message.result));
          value.schema = { compatible: false, applied: 1, pending: 1 };
          value.counts.works = 0;
          value.insights.missing = value.insights.missing.map(
            (row: { key: string; value: number }) => ({ ...row, value: 0 }),
          );
          value.insights.workflow = [];
          value.insights.additions = [];
          message = { ...message, result: value };
        }
        reply?.(message);
      };
      original(raw);
    };
  });
  await page.goto("/#/admin");
  await expect(page.getByRole("alert")).toContainText("قاعدة البيانات تحتاج إلى مراجعة");
  await expect(page.getByRole("alert")).toContainText("لا تُنفّذ تلقائيًا");
  await expect(page.getByRole("link", { name: "إضافة أول عمل", exact: true })).toHaveAttribute(
    "href",
    "#/admin/works/new",
  );
  await expect(page.getByText("لا توجد بيانات عن الإضافات بعد.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "تفاصيل الخادم", exact: true }).click();
  await expect(page.getByText("الترقيات المعلّقة", { exact: true })).toBeVisible();
});

test("failed overview refresh preserves the last data and labels it as stale", async ({ page }) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    let disconnected = false;
    window.addEventListener("fixture:disconnect", () => {
      disconnected = true;
    });
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command === "serverOverview" && disconnected) {
        queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: false,
            error: { code: "unavailable", message: "Fixture disconnected" },
          }),
        );
      } else original(raw);
    };
  });
  await page.goto("/#/admin");
  await expect(page.getByRole("heading", { name: "يحتاج إلى استكمال", exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("fixture:disconnect")));
  await page.getByRole("button", { name: "تحديث الحالة", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "تعذّر تحديث الحالة" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("بيانات سابقة", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /الأعمال.*252/ })).toHaveAttribute(
    "href",
    "#/admin/works",
  );
  await expect(page.getByRole("button", { name: "تحديث الحالة", exact: true })).toBeEnabled();
});

test("maintenance tasks have compact navigation and retain typed restore confirmation", async ({
  page,
}) => {
  await page.goto("/#/admin/maintenance");
  await expect(page.getByRole("heading", { name: "صيانة الخادم", exact: true })).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "معاينة التنظيف", exact: true })).toBeEnabled();
  await page.screenshot({ path: "../../../data/previews/admin-maintenance-library.png" });
  await page.getByRole("link", { name: "النسخ والاستعادة", exact: true }).click();
  await expect(page).toHaveURL(/tab=backups/);
  await expect(page.getByRole("button", { name: "إنشاء نسخة الآن", exact: true })).toBeEnabled();
  await expect(page.getByText("backup-new", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "تفاصيل النسخة", exact: true }).first().click();
  await expect(page.getByText("backup-new", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "تفاصيل النسخة", exact: true }).first().click();
  await page.screenshot({ path: "../../../data/previews/admin-maintenance-backups.png" });
  const restore = page.getByRole("button", { name: /^استعادة نسخة/ }).first();
  await restore.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "استعادة النسخة", exact: true })).toBeDisabled();
  await dialog.getByLabel(/اكتب معرّف النسخة للتأكيد/).fill("wrong");
  await expect(dialog.getByRole("button", { name: "استعادة النسخة", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.fixtureMaintenanceCalls)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(restore).toBeFocused();
  await restore.click();
  await dialog.getByLabel(/اكتب معرّف النسخة للتأكيد/).fill("backup-new");
  await dialog.getByRole("button", { name: "استعادة النسخة", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.fixtureMaintenanceCalls.map(({ operation, backupId, confirmation }) => ({
          operation,
          backupId,
          confirmation,
        })),
      ),
    )
    .toEqual([{ operation: "restore", backupId: "backup-new", confirmation: "backup-new" }]);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "إنشاء نسخة الآن", exact: true })).toBeDisabled();
});

test("maintenance separates server and app updates and reviews installation first", async ({
  page,
}) => {
  await page.goto("/#/admin/maintenance?tab=updates");
  for (const label of ["تنزيلات الخادم", "مكتبة الملفات", "جميع الجداول", "سجل التعديلات"]) {
    await expect(
      page.getByRole("button", { name: `${label} — غير متاح بعد`, exact: true }),
    ).toBeDisabled();
  }
  await expect(page.getByRole("heading", { name: "تحديث الخادم", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "تحديث تطبيق Linux", exact: true })).toBeVisible();
  const cards = page.locator('[data-slot="card"]');
  const server = cards.filter({
    has: page.getByRole("heading", { name: "تحديث الخادم", exact: true }),
  });
  const app = cards.filter({
    has: page.getByRole("heading", { name: "تحديث تطبيق Linux", exact: true }),
  });
  const first = await server.boundingBox();
  const second = await app.boundingBox();
  expect(Math.abs(first!.height - second!.height)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "../../../data/previews/admin-maintenance-updates.png" });
  await page.getByRole("button", { name: "تثبيت التحديث", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("0.1.3");
  expect(await page.evaluate(() => window.fixtureMaintenanceCalls)).toEqual([]);
  await dialog.getByRole("button", { name: "تأكيد تثبيت التحديث", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.fixtureMaintenanceCalls.map(({ operation }) => operation)),
    )
    .toEqual(["update"]);
  await expect(page.getByText("طلب صيانة تجريبي", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "فحص التحديثات", exact: true })).toBeDisabled();
});

test("unconfigured maintenance keeps library tools available, disables host actions and fits narrow screens", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command === "serverOperations")
        return queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: true,
            result: {
              version: 1,
              available: false,
              backups: [],
              update: { state: "unmanaged", currentVersion: "0.1.2" },
              activeJob: null,
              lastJob: null,
            },
          }),
        );
      original(raw);
    };
  });
  await page.goto("/#/admin/maintenance");
  await expect(page.getByText("غير مُعدّة", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "معاينة التنظيف", exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 360, height: 800 });
  for (const name of ["أدوات المكتبة", "النسخ والاستعادة", "التحديثات", "الفحوص والسلامة"]) {
    await page.getByRole("link", { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await expect(page.getByText("متوافق", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "فحص الملفات", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "معاينة الإصلاح", exact: true })).toBeDisabled();
  await page.screenshot({ path: "../../../data/previews/admin-maintenance-checks-narrow.png" });
  await page.getByRole("link", { name: "النسخ والاستعادة", exact: true }).click();
  await expect(page.getByRole("button", { name: "إنشاء نسخة الآن", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "خيارات النسخ القادمة", exact: true }).click();
  await expect(page.getByRole("switch", { name: /نسخ احتياطية مجدولة/ })).toBeDisabled();
  await expect(page.getByLabel(/عدد النسخ المحتفَظ بها/)).toBeDisabled();
  expect(await page.evaluate(() => window.fixtureMaintenanceCalls)).toEqual([]);
  await page.getByRole("link", { name: "التحديثات", exact: true }).click();
  await expect(page.getByRole("button", { name: "فحص التحديثات", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "تثبيت التحديث", exact: true })).toBeDisabled();
});

test("maintenance connection errors recover without blocking library inspection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    let recovered = false;
    window.addEventListener("fixture:maintenance-recover", () => {
      recovered = true;
    });
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command === "serverOperations" && !recovered)
        return queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: false,
            error: { code: "unavailable", message: "خدمة الصيانة غير متصلة" },
          }),
        );
      original(raw);
    };
  });
  await page.goto("/#/admin/maintenance");
  await expect(page.getByText("تعذّر الاتصال", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "معاينة التنظيف", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "النسخ والاستعادة", exact: true }).click();
  await expect(page.getByText("خدمة الصيانة غير متصلة", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.fixtureMaintenanceCalls)).toEqual([]);
  await page.evaluate(() => window.dispatchEvent(new Event("fixture:maintenance-recover")));
  await page.getByRole("button", { name: "إعادة الاتصال", exact: true }).click();
  await expect(page.getByRole("button", { name: "إنشاء نسخة الآن", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "إنشاء نسخة الآن", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.fixtureMaintenanceCalls.map(({ operation }) => operation)),
    )
    .toEqual(["backup"]);
  await expect(page.getByRole("button", { name: "إنشاء نسخة الآن", exact: true })).toBeDisabled();
});

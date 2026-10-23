import type { rpcInputs } from "@arcadia/contracts/editor-rpc";
import type { z } from "zod";
type LibraryCall = { operation: string; data: z.infer<(typeof rpcInputs)[keyof typeof rpcInputs]> };
declare global {
  interface Window {
    fixtureLibraryCalls: LibraryCall[];
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
  await expect(page.getByText("متوافق", { exact: true })).toBeVisible();
  await expect(page.getByText("فحوص تجهيز الخادم", { exact: true })).toBeVisible();
  await expect(page.getByText("يحتاج إلى تجهيز", { exact: true })).toBeVisible();
  await page.screenshot({ path: "../../../data/previews/admin-server-overview.png" });
  await page.getByRole("link", { name: "إعدادات الخادم", exact: true }).click();
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

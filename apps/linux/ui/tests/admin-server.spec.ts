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
  await page.getByRole("link", { name: "الإعدادات", exact: true }).click();
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

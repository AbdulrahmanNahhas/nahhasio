import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const admin =
      new URLSearchParams(location.hash.split("?")[1] ?? "").get("fixtureAdmin") === "1";
    const user = {
      id: "test-member",
      name: "حساب تجريبي",
      email: "fixture@example.test",
      role: admin ? "admin" : "member",
      accountId: "00000000-0000-4000-8000-000000000001",
      kind: "family",
      avatarKey: "anon-1.png",
      bio: "",
      isAdmin: admin,
      updatedAt: "2026-10-31T00:00:00Z",
    };
    let signedIn = true;
    let savedServerName = "مكتبة تجريبية";
    const secondId = "00000000-0000-4000-8000-000000000002";
    let remembered = [
      { id: user.accountId, name: user.name, avatarKey: user.avatarKey },
      { id: secondId, name: "حساب ثانٍ", avatarKey: "anon-2.png" },
    ];
    const requests: string[] = [];
    window.webkit = {
      messageHandlers: {
        nahhasio: {
          postMessage(raw: string) {
            const request = JSON.parse(raw);
            requests.push(request.command);
            sessionStorage.setItem("fixture-commands", JSON.stringify(requests));
            let result;
            switch (request.command) {
              case "session":
                result = signedIn ? { user, expiresAt: "2099-01-01T00:00:00Z" } : null;
                break;
              case "accounts.switch":
                signedIn = false;
                result = null;
                break;
              case "loginAccounts":
                result = remembered;
                break;
              case "browsePreferences.load":
                result = JSON.parse(sessionStorage.getItem("fixture-preferences") ?? "null");
                break;
              case "browsePreferences.save":
                sessionStorage.setItem("fixture-preferences", JSON.stringify(request.payload));
                result = { ok: true };
                break;
              case "accounts.forget":
                remembered = remembered.filter(
                  (account) => account.id !== request.payload.accountId,
                );
                if (request.payload.accountId === user.accountId) signedIn = false;
                result = signedIn ? { user, expiresAt: "2099-01-01T00:00:00Z" } : null;
                break;
              case "servers.list":
              case "servers.save":
                if (request.command === "servers.save") savedServerName = request.payload.name;
                result = {
                  selected: "https://fixture.invalid/",
                  servers: [
                    {
                      url: "https://fixture.invalid/",
                      name: savedServerName,
                      trustedFingerprint: null,
                    },
                  ],
                };
                break;
              case "servers.probe":
                if (sessionStorage.getItem("fixture-probe-error")) {
                  queueMicrotask(() =>
                    window["__nahhasioReply"]?.({
                      id: request.id,
                      ok: false,
                      error: { code: "unavailable", message: "الخادم غير متاح الآن" },
                    }),
                  );
                  return;
                }
                result = {
                  url: request.payload.url,
                  info: {
                    product: "nahhasio",
                    name: savedServerName,
                    version: "0.1.2",
                    apiVersion: 1,
                    capabilities: { artworkVariants: true, rememberedAccounts: true },
                  },
                };
                break;
              case "client.info":
                result = {
                  version: "0.1.2",
                  platform: "linux",
                  serverVersion: "0.1.2",
                  apiVersion: 1,
                  videoRoot: "/private/videos",
                  capabilities: {
                    nativePlayback: true,
                    offlineLibrary: true,
                    artworkVariants: true,
                    rememberedAccounts: true,
                    subtitleSearch: false,
                    debrid: false,
                  },
                };
                break;
              case "artworkCache.status":
              case "artworkCache.clear":
                result = {
                  bytes: request.command.endsWith("clear") ? 0 : 1048576,
                  budgetBytes: 536870912,
                  metrics: {
                    requests: 2,
                    cacheHits: 1,
                    networkBytes: 512,
                    queueMicros: 10,
                    responseMicros: 20,
                  },
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
              case "clientUpdate.status":
                result = {
                  available: false,
                  state: "unavailable",
                  availableVersion: null,
                  pendingVersion: null,
                  automatic: null,
                  lastCheck: null,
                  manager: "development",
                  currentVersion: "0.1.2",
                  message: "Fixture",
                };
                break;
              default:
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: {
                      code: "fixture",
                      message: `Unexpected fixture command: ${request.command}`,
                    },
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

test("appearance contains application controls without library presentation settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/settings?section=appearance");
  await expect(page.getByRole("button", { name: "خيارات العرض", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "واجهة التطبيق", exact: true })).toBeVisible();
  await expect(page.getByText("طريقة عرض المكتبة", { exact: true })).toHaveCount(0);
  await expect(page.getByText("جدول المكتبة", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "../../../data/previews/settings-appearance-desktop.png" });
});

test("password change is a compact action with clean dismissal and focus restoration", async ({
  page,
}) => {
  await page.goto("/#/settings?section=account");
  await expect(page.getByLabel("كلمة المرور الحالية", { exact: true })).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "تغيير كلمة المرور", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "تغيير كلمة المرور", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("كلمة المرور الحالية", { exact: true }).fill("synthetic-password");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByLabel("كلمة المرور الحالية", { exact: true })).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByText("جلساتك وأجهزتك", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "../../../data/previews/settings-account-desktop.png" });
});

test("connection management tests and renames the saved server inline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/settings?section=connection");
  await expect(page.getByText("متصل", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "اختبار الاتصال", exact: true }).click();
  await expect(page.getByText("متصل", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "تسمية مكتبة تجريبية", exact: true }).click();
  await page.getByLabel("اسم الاتصال", { exact: true }).fill("مكتبتي المنزلية");
  await page.getByRole("button", { name: "حفظ الاسم", exact: true }).click();
  await expect(page.getByText("مكتبتي المنزلية", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "إضافة خادم", exact: true }).click();
  await expect(page.getByLabel("عنوان الخادم", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "رجوع", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "../../../data/previews/settings-connection-desktop.png" });
});

test("all upcoming categories expose disabled controls without invoking integrations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  for (const section of [
    "account",
    "appearance",
    "playback",
    "subtitles",
    "sources",
    "extensions",
    "storage",
    "offline",
    "connection",
    "help",
  ]) {
    await page.goto(`/#/settings?section=${section}`);
    const panels = page.locator('[data-upcoming="true"]');
    await expect(panels.first()).toBeVisible();
    const controls = panels.locator("button, input");
    expect(await controls.count()).toBeGreaterThan(0);
    for (const control of await controls.all()) await expect(control).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
  }
  await page.goto("/#/settings?section=administration");
  await expect(page.getByRole("heading", { name: "الحساب والأمان", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "دعوات الأصدقاء", exact: true })).toHaveCount(0);
  await page.goto("/#/settings?section=subtitles");
  await page.screenshot({ path: "../../../data/previews/settings-subtitles-360.png" });
});

test("inline connection status recovers from a failed recheck at narrow width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/#/settings?section=connection");
  await expect(page.getByText("متصل", { exact: true })).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("fixture-probe-error", "1"));
  await page.getByRole("button", { name: "اختبار الاتصال", exact: true }).click();
  await expect(page.getByText("تعذّر الاتصال", { exact: true })).toBeVisible();
  await expect(page.getByText("متصل", { exact: true })).toHaveCount(0);
  await page.evaluate(() => sessionStorage.removeItem("fixture-probe-error"));
  await page.getByRole("button", { name: "اختبار الاتصال", exact: true }).click();
  await expect(page.getByText("متصل", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../../../data/previews/settings-connection-360.png" });
});

test("desktop settings, private diagnostic preview and cache control", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/settings?section=help");
  await expect(page.getByRole("heading", { name: "الإعدادات والمساعدة" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "المساعدة والتشخيص", exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "أقسام الإعدادات" }).locator('[aria-current="page"]'),
  ).toHaveAttribute("href", "#/settings?section=help");
  await expect(page.getByRole("link", { name: "إدارة الخادم" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "../../../data/previews/settings-desktop.png" });
  await page.getByRole("button", { name: "معاينة تقرير التشخيص" }).click();
  const report = page.getByLabel("تقرير التشخيص", { exact: true });
  await expect(report).toContainText('"app": "Nahhasio"');
  expect(await report.inputValue()).not.toMatch(/private|fixture\.invalid|fixture@example/);
  await page.getByRole("link", { name: "التنزيلات والتخزين", exact: false }).click();
  await page.getByRole("button", { name: "إفراغ ذاكرة الصور المؤقتة" }).click();
  await expect(page.getByText(/^[٠0] ميغابايت مستخدمة من (?:٥١٢|512)$/)).toBeVisible();
});

test("administrators can review future server controls without starting operations", async ({
  page,
}) => {
  await page.goto("/#/settings?section=administration&fixtureAdmin=1");
  await expect(
    page.getByRole("link", { name: "فتح إعدادات إدارة الخادم", exact: true }),
  ).toHaveAttribute("href", "#/admin/settings");
  const controls = page.locator('[data-upcoming="true"]').locator("button, input");
  expect(await controls.count()).toBeGreaterThan(10);
  for (const control of await controls.all()) await expect(control).toBeDisabled();
  await expect(page.getByRole("button", { name: "دعوات الأصدقاء", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const width of [360, 520]) {
  test(`narrow settings and five destinations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/settings");
    const dock = page.getByRole("navigation", { name: "التنقل الرئيسي", exact: true });
    await expect(dock).toBeVisible();
    await expect(dock.getByRole("link")).toHaveCount(5);
    await page.getByRole("link", { name: "الخادم والاتصال", exact: false }).click();
    await expect(page.getByRole("button", { name: "اختبار الاتصال", exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.getByRole("link", { name: "جميع الإعدادات" }).click();
    await expect(page.getByRole("navigation", { name: "أقسام الإعدادات" })).toBeVisible();
    await expect(page.getByRole("link", { name: "الخادم والاتصال", exact: false })).toBeFocused();
    await page.screenshot({ path: `../../../data/previews/settings-${width}.png` });
  });
}

test("forgetting another account preserves the active account; forgetting the active account signs out", async ({
  page,
}) => {
  await page.goto("/#/settings?section=account");
  await page.getByRole("button", { name: "نسيان حساب ثانٍ من الجهاز", exact: true }).click();
  await page.getByRole("button", { name: "تأكيد نسيان الحساب", exact: true }).click();
  await expect(page.getByRole("heading", { name: "الإعدادات والمساعدة" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "نسيان حساب ثانٍ من الجهاز", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "نسيان حساب تجريبي من الجهاز", exact: true }).click();
  await page.getByRole("button", { name: "تأكيد نسيان الحساب", exact: true }).click();
  await expect(page.getByRole("heading", { name: "من يشاهد؟" })).toBeVisible();
});

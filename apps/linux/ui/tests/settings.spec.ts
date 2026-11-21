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
              case "updateProfile":
                Object.assign(user, request.payload, { updatedAt: "2026-10-31T00:01:00Z" });
                sessionStorage.setItem("fixture-profile-update", JSON.stringify(request.payload));
                result = user;
                break;
              case "accounts.switch":
                sessionStorage.setItem("fixture-switch-account", JSON.stringify(request.payload));
                signedIn = false;
                result = null;
                break;
              case "loginAccounts":
                result = remembered;
                break;
              case "playbackPreferences.load":
                result = JSON.parse(
                  sessionStorage.getItem("fixture-playback") ??
                    '{"version":1,"audioLanguage":"auto","subtitleLanguage":"ar","subtitlesEnabled":true,"subtitleSize":55,"subtitlePosition":100}',
                );
                break;
              case "playbackPreferences.save":
                sessionStorage.setItem("fixture-playback", JSON.stringify(request.payload));
                result = request.payload;
                break;
              case "opensubtitles.status":
                result = {
                  connected: sessionStorage.getItem("fixture-subtitle-connected") === "1",
                  secureStorage: true,
                };
                break;
              case "opensubtitles.login":
                sessionStorage.setItem("fixture-subtitle-connected", "1");
                result = { connected: true, secureStorage: true };
                break;
              case "opensubtitles.disconnect":
                sessionStorage.removeItem("fixture-subtitle-connected");
                result = { ok: true };
                break;
              case "opensubtitles.test":
                result = { username: "fixture-subs", remaining: 7, limit: 10 };
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

test("Settings sidebar keeps appearance, hides retired panels and disables extensions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/settings");
  const navigation = page.getByRole("navigation", { name: "أقسام الإعدادات" });
  await expect(navigation.getByRole("link", { name: "الحساب", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(navigation.getByRole("link", { name: "نظرة عامة", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "الملف والصورة", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "أمان الحساب", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "الجهاز", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "حفظ التغييرات", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "تغيير الصورة", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "صورة الحساب", exact: true });
  await expect(
    picker.getByRole("searchbox", { name: "اختر صورة حسابك", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "الرموز", exact: true }).click();
  await expect(page.getByRole("radio", { name: "سونيك 2", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "الشخصيات", exact: true }).click();
  await page.getByTitle("سونيك 2", { exact: true }).click();
  await page.getByRole("button", { name: "تم الاختيار", exact: true }).click();
  await expect(page.getByRole("button", { name: "تغيير الصورة", exact: true })).toBeFocused();
  await page.getByRole("textbox", { name: "الاسم", exact: true }).fill("اسم تجريبي جديد");
  await page.getByRole("button", { name: "حفظ التغييرات", exact: true }).click();
  await expect(page.getByText("تم حفظ ملفك الشخصي", { exact: true })).toBeVisible();
  expect(
    JSON.parse(await page.evaluate(() => sessionStorage.getItem("fixture-profile-update") ?? "{}")),
  ).toMatchObject({
    name: "اسم تجريبي جديد",
    avatarKey: "sonic-2.png",
  });
  await navigation.getByRole("link", { name: "المظهر", exact: true }).click();
  await expect(navigation.getByRole("link", { name: "المظهر", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(navigation.getByRole("link", { name: "الحساب", exact: true })).toBeVisible();
  await expect(navigation.getByRole("button", { name: /^الإضافات/ })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "الإعدادات", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "فاتح", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "داكن", exact: true })).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "حسب النظام", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const root = page.locator("html");
  await expect(root).toHaveCSS("font-size", "16px");
  await page.getByRole("button", { name: "كبير", exact: true }).click();
  await expect(root).toHaveCSS("font-size", "18px");
  await page.reload();
  await expect(page.getByRole("button", { name: "كبير", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(root).toHaveCSS("font-size", "18px");
  await page.setViewportSize({ width: 360, height: 860 });
  await expect(page.getByRole("button", { name: "حسب النظام", exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.querySelector("main")!.scrollWidth),
  ).toBeLessThanOrEqual(await page.locator("main").evaluate((element) => element.clientWidth));
  await page.getByRole("button", { name: "افتراضي", exact: true }).click();
  await expect(root).toHaveCSS("font-size", "16px");
  await expect(page.getByText("واجهة التطبيق", { exact: true })).toHaveCount(0);
  await expect(page.getByText("الأجهزة وأمان الحساب", { exact: true })).toHaveCount(0);
});

test("password change is a compact action with clean dismissal and focus restoration", async ({
  page,
}) => {
  await page.goto("/#/settings?section=account");
  await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
  const logout = page.getByRole("alertdialog", { name: "تسجيل الخروج من هذا الجهاز؟" });
  await expect(logout).toBeVisible();
  await logout.getByRole("button", { name: "إلغاء", exact: true }).click();
  await expect(logout).toBeHidden();
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
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
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
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/settings-connection-desktop.png" });
});

test("an old extensions link returns to the narrow Settings menu", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/#/settings?section=extensions");
  const navigation = page.getByRole("navigation", { name: "أقسام الإعدادات" });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole("button", { name: /^الإضافات/ })).toBeDisabled();
  await expect(navigation.getByRole("link", { name: "إعدادات الخادم", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
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
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/settings-connection-360.png" });
});

test("desktop settings, private diagnostic preview and cache control", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#/settings?section=help");
  await expect(page.getByRole("heading", { name: "المساعدة والتشخيص", exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "أقسام الإعدادات" }).locator('[aria-current="page"]'),
  ).toHaveAttribute("href", "#/settings?section=help");
  await expect(page.getByRole("link", { name: "إعدادات الخادم" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/settings-desktop.png" });
  await page.getByRole("button", { name: "معاينة تقرير التشخيص" }).click();
  const report = page.getByLabel("تقرير التشخيص", { exact: true });
  await expect(report).toContainText('"app": "Nahhasio"');
  expect(await report.inputValue()).not.toMatch(/private|fixture\.invalid|fixture@example/);
  await page.getByRole("link", { name: "التنزيلات والتخزين", exact: false }).click();
  await page.getByRole("button", { name: "إفراغ ذاكرة الصور المؤقتة" }).click();
  await expect(page.getByText(/^[٠0] ميغابايت مستخدمة من (?:٥١٢|512)$/)).toBeVisible();
});

test("administrators can open the existing server settings", async ({ page }) => {
  await page.goto("/#/settings?section=help&fixtureAdmin=1");
  await expect(page.getByRole("link", { name: "إعدادات الخادم", exact: true })).toHaveAttribute(
    "href",
    "#/admin/settings",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const width of [360, 520]) {
  test(`narrow settings and five destinations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/settings");
    const dock = page.getByRole("navigation", { name: "التنقل الرئيسي", exact: true });
    await expect(dock).toBeVisible();
    for (const name of ["الرئيسية", "المكتبة", "مكتبة الجهاز"]) {
      await expect(dock.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(dock.getByRole("button", { name: "البحث السريع", exact: true })).toBeVisible();
    await expect(dock.getByRole("button", { name: "كل الصفحات", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "الخادم والاتصال", exact: false }).click();
    await expect(page.getByRole("button", { name: "اختبار الاتصال", exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.getByRole("link", { name: "جميع الإعدادات" }).click();
    await expect(page.getByRole("navigation", { name: "أقسام الإعدادات" })).toBeVisible();
    await expect(page.getByRole("link", { name: "الخادم والاتصال", exact: false })).toBeFocused();
    if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
      await page.screenshot({ path: `../../../data/previews/settings-${width}.png` });
  });
}

test("forgetting another account preserves the active account; forgetting the active account signs out", async ({
  page,
}) => {
  await page.goto("/#/settings?section=account");
  await page.getByRole("button", { name: "نسيان حساب ثانٍ من الجهاز", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "نسيان حساب ثانٍ؟" })).toBeVisible();
  await page.getByRole("button", { name: "تأكيد نسيان الحساب", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "نسيان حساب ثانٍ من الجهاز", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "الجهاز", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "نسيان حساب تجريبي من الجهاز", exact: true }).click();
  await page.getByRole("button", { name: "تأكيد نسيان الحساب", exact: true }).click();
  await expect(page.getByRole("heading", { name: "من يشاهد؟" })).toBeVisible();
});

test("switching from a saved account row requests that account", async ({ page }) => {
  await page.goto("/#/settings?section=account");
  await page.getByRole("button", { name: "التبديل إلى حساب ثانٍ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "من يشاهد؟" })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem("fixture-switch-account") ?? "{}")),
  ).toMatchObject({ accountId: "00000000-0000-4000-8000-000000000002" });
});

test("player defaults persist and personal subtitle setup stays explicit", async ({ page }) => {
  await page.goto("/#/settings?section=playback");
  await expect(page.getByRole("heading", { name: "الصوت والتشغيل", exact: true })).toHaveCount(0);
  await page.evaluate(() =>
    sessionStorage.setItem(
      "fixture-playback",
      '{"version":1,"startupVolume":35,"startupSpeed":1.25,"audioLanguage":"ja","audioDelay":0.1,"subtitleLanguage":"ar","subtitlesEnabled":true,"subtitleSize":55,"subtitlePosition":100}',
    ),
  );
  await page.reload();
  const language = page.getByRole("combobox", { name: "لغة الترجمة المفضلة", exact: true });
  const enabled = page.getByRole("switch", { name: "إظهار الترجمة عند بدء التشغيل", exact: true });
  await language.click();
  await page.getByRole("option", { name: "اليابانية", exact: true }).click();
  await enabled.click();
  const subtitleSize = page.getByLabel("حجم الترجمة", { exact: true });
  const subtitleDelay = page.getByLabel("مزامنة الترجمة (ثانية)", { exact: true });
  const color = page.getByRole("combobox", { name: "لون النص", exact: true });
  const background = page.getByRole("switch", { name: "خلفية داكنة خلف النص", exact: true });
  const bold = page.getByRole("switch", { name: "خط عريض", exact: true });
  await subtitleSize.fill("42");
  await subtitleDelay.fill("-0.25");
  await color.click();
  await page.getByRole("option", { name: "أصفر", exact: true }).click();
  await background.click();
  await bold.click();
  await page.getByRole("button", { name: "حفظ الافتراضيات", exact: true }).click();
  await expect(page.getByText("تم حفظ افتراضيات التشغيل")).toBeVisible();
  await page.reload();
  await expect(subtitleSize).toHaveValue("42");
  await expect(subtitleDelay).toHaveValue("-0.25");
  await expect(language).toContainText("اليابانية");
  await expect(enabled).not.toBeChecked();
  await expect(color).toContainText("أصفر");
  await expect(background).toBeChecked();
  await expect(bold).toBeChecked();
  await page.getByRole("button", { name: "استعادة الافتراضيات", exact: true }).click();
  await expect(subtitleSize).toHaveValue("55");
  await expect(subtitleDelay).toHaveValue("0");
  await expect(language).toContainText("العربية");
  await expect(enabled).toBeChecked();
  await expect(color).toContainText("أبيض");
  await expect(background).not.toBeChecked();
  await expect(bold).not.toBeChecked();
  await page.getByRole("button", { name: "حفظ الافتراضيات", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("fixture-playback") ?? "{}")))
    .toMatchObject({
      subtitleSize: 55,
      subtitleLanguage: "ar",
      startupVolume: 35,
      startupSpeed: 1.25,
      audioLanguage: "ja",
      audioDelay: 0.1,
    });
  await page.goto("/#/settings?section=subtitles");
  await expect(page.getByRole("heading", { name: "التشغيل", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "OpenSubtitles", exact: true })).toBeFocused();
  await expect(page.getByText("غير مربوط", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("fixture-commands") ?? "[]").some(
        (name: string) => name === "opensubtitles.search" || name === "opensubtitles.apply",
      ),
    ),
  ).toBe(false);
  await page.getByLabel("مفتاح OpenSubtitles API", { exact: true }).fill("synthetic-api-key");
  await page.getByLabel("اسم المستخدم (اختياري)", { exact: true }).fill("fixture-subs");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "ربط الحساب", exact: true }).click();
  await expect(page.getByText("حساب مربوط على هذا الجهاز", { exact: true })).toBeVisible();
  await expect(page.getByLabel("مفتاح OpenSubtitles API", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "اختبار الاتصال والحصة", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("7");
  await page.getByRole("button", { name: "إزالة الاتصال من هذا الجهاز", exact: true }).click();
  await expect(page.getByText("غير مربوط", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

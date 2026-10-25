import { expect, test } from "@playwright/test";

const familyId = "a921104d-f15f-4141-8a0b-0b1d4e80fa9b";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let selected = "http://127.0.0.1:23103/";
    const accounts = [
      {
        id: "a921104d-f15f-4141-8a0b-0b1d4e80fa9b",
        name: "عائلة النحاس",
        avatarKey: "avatar-1.png",
      },
      { id: "b984c9e1-9ac2-4467-a12a-010dde42c028", name: "المشرف", avatarKey: "anon-1.png" },
    ];
    window.webkit = {
      messageHandlers: {
        nahhasio: {
          postMessage(raw: string) {
            const request = JSON.parse(raw);
            let result;
            switch (request.command) {
              case "session":
                result = null;
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
              case "servers.list":
                result = {
                  selected,
                  servers: [{ url: selected, name: "مكتبة العائلة", trustedFingerprint: null }],
                };
                break;
              case "servers.probe":
                result = {
                  url: request.payload.url,
                  info: {
                    product: "nahhasio",
                    name: "مكتبة العائلة",
                    version: "0.1.0",
                    apiVersion: 1,
                  },
                };
                break;
              case "loginAccounts":
                result = selected.endsWith("23103/")
                  ? accounts
                  : [{ ...accounts[1], name: "حساب الخادم الآخر" }];
                break;
              case "login":
                sessionStorage.setItem("last-login-request", JSON.stringify(request.payload));
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: false,
                  error: { code: "unauthorized", message: "كلمة المرور غير صحيحة." },
                });
                return;
              default:
                throw new Error(`Unexpected fixture command ${request.command}`);
            }
            queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
          },
        },
      },
    };
    window.addEventListener("fixture:change-server", () => {
      selected = "http://127.0.0.1:23104/";
      window.dispatchEvent(new Event("nahhasio:server-changed"));
    });
  });
  await page.goto("/#/login");
});

for (const width of [1440, 520, 360]) {
  test(`account picker and password keyboard flow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const family = page.getByRole("button", { name: "عائلة النحاس", exact: true });
    await expect(family).toBeVisible();
    await expect(page.getByRole("button", { name: "المشرف", exact: true })).toBeVisible();
    await expect(page.getByLabel("البريد الإلكتروني")).toHaveCount(0);
    await expect(page.locator("main img").first()).toHaveJSProperty("complete", true);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: `../../../data/previews/login-picker-${width}.png` });
    await family.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "عائلة النحاس" });
    await expect(dialog).toBeVisible();
    const password = dialog.getByLabel("كلمة المرور", { exact: true });
    await expect(password).toBeFocused();
    await password.fill("fixture-wrong-password");
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("alert")).toContainText("كلمة المرور غير صحيحة");
    const payload = await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("last-login-request") ?? "null"),
    );
    expect(payload).toEqual({ accountId: familyId, password: "fixture-wrong-password" });
    await page.screenshot({ path: `../../../data/previews/login-password-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(family).toBeFocused();
    await page.getByRole("button", { name: "المشرف", exact: true }).click();
    await expect(page.getByRole("dialog").getByLabel("كلمة المرور", { exact: true })).toHaveValue(
      "",
    );
  });
}

test("manual login keeps the existing email path", async ({ page }) => {
  await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني" }).click();
  await page.getByLabel("البريد الإلكتروني").fill("fixture@example.test");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "دخول المكتبة", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("كلمة المرور غير صحيحة");
  expect(
    await page.evaluate(() => JSON.parse(sessionStorage.getItem("last-login-request") ?? "null")),
  ).toEqual({ email: "fixture@example.test", password: "fixture-password" });
});

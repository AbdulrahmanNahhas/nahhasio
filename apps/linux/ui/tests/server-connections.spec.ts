import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let selected = "http://127.0.0.1:23103/";
    const servers: { url: string; name: string; trustedFingerprint: string | null }[] = [
      { url: selected, name: "مكتبة التجربة", trustedFingerprint: null },
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
                result = { selected, servers };
                break;
              case "servers.probe":
                result = {
                  url: request.payload.url,
                  info: {
                    product: "nahhasio",
                    name: "مكتبة البيت",
                    version: "0.1.0",
                    apiVersion: 1,
                  },
                };
                break;
              case "servers.select":
                if (
                  request.payload.trust?.certificate !== "fixture-public-certificate" ||
                  request.payload.trust?.fingerprint !== "a".repeat(64)
                )
                  throw new Error("Expected explicit fixture trust");
                selected = request.payload.url;
                servers.push({
                  url: selected,
                  name: "مكتبة البيت",
                  trustedFingerprint: "a".repeat(64),
                });
                result = { selected, servers };
                break;
              default:
                throw new Error(`Unexpected fixture command ${request.command}`);
            }
            queueMicrotask(() => window["__nahhasioReply"]?.({ id: request.id, ok: true, result }));
          },
        },
      },
    };
  });
});

for (const width of [1440, 520]) {
  test(`home certificate enrollment and saved fingerprint at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/login");
    await page.getByRole("button", { name: "تغيير", exact: true }).click();
    await page.getByRole("button", { name: "إضافة خادم", exact: true }).click();
    await page.getByLabel("عنوان الخادم", { exact: true }).fill("https://192.168.1.50:8443/");
    await page.getByRole("button", { name: "شهادة خادم منزلي", exact: true }).click();
    await page.getByLabel("شهادة الجذر العامة (PEM)").fill("fixture-public-certificate");
    await page.getByLabel("بصمة شهادة الجذر SHA-256").fill("a".repeat(64));
    await page
      .getByRole("dialog")
      .screenshot({ path: `../../../data/previews/server-trust/enroll-${width}.png` });
    await page.getByRole("button", { name: "اختبار الاتصال", exact: true }).click();
    await expect(page.getByText("الخادم جاهز للاتصال", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "اتصال بالمكتبة", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: "تغيير", exact: true }).click();
    await page.getByRole("button", { name: "تسمية مكتبة البيت", exact: true }).click();
    await expect(page.getByText("ثقة خاصة بهذا الخادم", { exact: true })).toBeVisible();
    await expect(page.getByText("a".repeat(64), { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page
      .getByRole("dialog")
      .screenshot({ path: `../../../data/previews/server-trust/home-trust-${width}.png` });
  });
}

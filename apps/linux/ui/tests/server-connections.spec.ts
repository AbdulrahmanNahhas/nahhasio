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
            const failure = (message: string) =>
              queueMicrotask(() =>
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: false,
                  error: { code: "server_identity", message },
                }),
              );
            switch (request.command) {
              case "loginAccounts":
                result = [
                  {
                    id: "91000000-0000-4000-8000-000000000001",
                    name: selected.startsWith("https:")
                      ? "حساب المكتبة الجديدة"
                      : "حساب المكتبة السابقة",
                    avatarKey: "anon-1.png",
                  },
                ];
                break;
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
              case "servers.addressProbe":
              case "servers.addressUpdate": {
                if (request.payload.trust)
                  throw new Error("Address changes must reuse native trust");
                if (
                  request.payload.url.includes("wrong") ||
                  (request.command === "servers.addressUpdate" &&
                    request.payload.url.includes("changed"))
                ) {
                  failure(
                    "هذا العنوان لا يطابق هوية المكتبة المحفوظة. بقي الاتصال السابق دون تغيير.",
                  );
                  return;
                }
                if (request.command === "servers.addressProbe") {
                  result = {
                    url: request.payload.url,
                    info: {
                      serverId: "97900000-0000-4000-8000-000000000001",
                      product: "nahhasio",
                      name: "مكتبة البيت",
                      version: "0.1.2",
                      apiVersion: 1,
                    },
                  };
                } else {
                  const server = servers.find((item) => item.url === request.payload.previousUrl);
                  if (!server) throw new Error("Missing saved source");
                  if (selected === server.url) selected = request.payload.url;
                  server.url = request.payload.url;
                  result = { selected, servers };
                }
                break;
              }
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
    await expect(
      page.getByRole("button", { name: "حساب المكتبة السابقة", exact: true }),
    ).toBeVisible();
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
    await expect(
      page.getByRole("button", { name: "حساب المكتبة الجديدة", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "حساب المكتبة السابقة", exact: true }),
    ).toHaveCount(0);
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

for (const width of [1440, 520]) {
  test(`verified server address update ${width}: saved trust, mismatch recovery and reauthentication`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/#/home");
    await page.getByRole("button", { name: "تغيير", exact: true }).click();
    await page.getByRole("button", { name: "تحديث عنوان مكتبة التجربة", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "تحديث عنوان المكتبة", exact: true });
    const url = dialog.getByLabel("العنوان الجديد", { exact: true });
    const verify = dialog.getByRole("button", { name: "تحقق من العنوان", exact: true });
    const save = dialog.getByRole("button", { name: "حفظ العنوان", exact: true });
    await expect(save).toBeDisabled();
    await expect(dialog.getByLabel("شهادة الجذر العامة (PEM)")).toHaveCount(0);
    await url.fill("https://wrong.home/");
    await verify.click();
    await expect(dialog.getByText(/لا يطابق هوية المكتبة/)).toBeVisible();
    await expect(save).toBeDisabled();
    await url.fill("https://changed.home/");
    await verify.click();
    await expect(dialog.getByText("تم التحقق من المكتبة", { exact: true })).toBeVisible();
    await save.click();
    await expect(dialog.getByText(/لا يطابق هوية المكتبة/)).toBeVisible();
    await url.fill("https://library.home:8443/");
    await expect(save).toBeDisabled();
    await verify.click();
    await expect(save).toBeEnabled();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await dialog.screenshot({ path: `../../../data/previews/server-address-${width}.png` });
    await save.click();
    await expect(
      page.getByRole("button", { name: "حساب المكتبة الجديدة", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "تغيير", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByText("https://library.home:8443/", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "تحديث عنوان مكتبة التجربة", exact: true }),
    ).toBeVisible();
  });
}

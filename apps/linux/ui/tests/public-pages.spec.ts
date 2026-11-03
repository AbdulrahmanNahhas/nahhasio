import { expect, test } from "@playwright/test";

test.skip(
  process.env.NAHHASIO_BROWSER_DEVELOPMENT_TEST !== "1",
  "Read-only acceptance against the dedicated local demo catalog.",
);

test.beforeEach(async ({ request }) => {
  const response = await request.get("/__development_api/v1/server/info");
  expect(
    (await response.json()).serverId,
    "Demo credentials must never be sent to a real server",
  ).toBe("97900000-0000-4000-8000-000000000001");
});

for (const width of [360, 1440]) {
  test(`public page review ${width}: navigation, consistent framing and honest states`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto("/#/home");
    await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني", exact: true }).click();
    await page.getByLabel("البريد الإلكتروني", { exact: true }).fill("admin@demo.local");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("demo12345");
    await page.getByRole("button", { name: "دخول المكتبة", exact: true }).click();
    await expect(page.getByRole("region", { name: "أحدث الأعمال", exact: true })).toBeVisible({
      timeout: 25000,
    });
    await expect(
      page
        .getByRole("region", { name: "أحدث الأعمال", exact: true })
        .getByText("للجميع", { exact: true }),
    ).toBeVisible();
    const destinations = [
      ["تصفّح المكتبة", "تصفّح المكتبة"],
      ["البحث", "البحث في المكتبة"],
      ["الكواكب", "الكواكب"],
      ["الصنّاع", "الصنّاع"],
      ["الاستوديوهات", "الاستوديوهات"],
      ["الحلقات", "الحلقات"],
      ["التقويم", "تقويم المكتبة"],
      ["الإعلانات التشويقية", "الإعلانات التشويقية"],
      ["مشاهدة مباشرة", "مشاهدة مباشرة"],
    ];
    for (const [label, heading] of destinations) {
      const catalogPath =
        label === "الحلقات"
          ? "/__development_api/v1/catalog/episodes"
          : label === "الإعلانات التشويقية"
            ? "/__development_api/v1/catalog/trailers"
            : null;
      const catalogResponse = catalogPath
        ? page.waitForResponse((response) => new URL(response.url()).pathname === catalogPath)
        : null;
      if (width < 768) {
        await page.getByRole("button", { name: "كل الصفحات", exact: true }).click();
        await page
          .getByRole("dialog", { name: "كل الصفحات", exact: true })
          .getByRole("link", { name: label, exact: true })
          .click();
        await expect(
          page.locator('[data-slot="drawer-popup"][aria-label="كل الصفحات"]'),
        ).toHaveCount(0);
      } else
        await page
          .getByRole("navigation", { name: "التنقل الرئيسي", exact: true })
          .getByRole("link", { name: label, exact: true })
          .click();
      await expect(
        page.getByRole("heading", { name: heading, exact: true, level: 1 }),
      ).toBeVisible();
      if (catalogResponse) expect((await catalogResponse).status()).toBe(200);
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(
        await page
          .locator("#main-content")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (["الكواكب", "الصنّاع", "مشاهدة مباشرة"].includes(label))
        await page.screenshot({
          path: `../../../data/previews/public-${label === "الكواكب" ? "planets" : label === "الصنّاع" ? "people" : "watch"}-${width}.png`,
        });
    }
    expect(failures).toEqual([]);
  });
}

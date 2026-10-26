import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    fixtureFailSave: () => void;
  }
}

test.use({ viewport: { width: 1440, height: 1000 } });
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
    const prefix = "00000000-0000-4000-8000-";
    const id = (n: number) => `${prefix}${String(n).padStart(12, "0")}`;
    const timestamp = { created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-22T00:00:00Z" };
    const organizations = [
      {
        id: id(10),
        slug: "academy",
        name_ar: "أكاديمية فنون وعلوم الصور المتحركة",
        name_en: "Academy Awards",
        description:
          "تكرّم الإنجاز السينمائي في الإخراج والكتابة والأداء والصورة والموسيقى. تُحفظ النتائج مع مصدرها، سواء كانت فوزاً أو ترشيحاً.",
        website_url: "https://example.invalid/academy",
        logo_path: null,
        is_active: true,
        ...timestamp,
      },
      {
        id: id(11),
        slug: "annie",
        name_ar: "جوائز آني",
        name_en: "Annie Awards",
        description: "التميّز في فن الرسوم المتحركة.",
        website_url: null,
        logo_path: null,
        is_active: true,
        ...timestamp,
      },
      {
        id: id(12),
        slug: "emmy",
        name_ar: "جوائز إيمي",
        name_en: "Emmy Awards",
        description: "الإنجاز التلفزيوني",
        website_url: null,
        logo_path: null,
        is_active: true,
        ...timestamp,
      },
    ];
    const categories = [
      {
        id: id(20),
        organization_id: id(10),
        slug: "animated-feature",
        name_ar: "أفضل فيلم رسوم متحركة",
        name_en: "Animated feature film",
        description: "جائزة الفيلم الطويل في الرسوم المتحركة.",
        is_active: true,
        ...timestamp,
      },
      {
        id: id(21),
        organization_id: id(10),
        slug: "original-score",
        name_ar: "أفضل موسيقى تصويرية",
        name_en: "Original score",
        description: "الموسيقى الأصلية المكتوبة للعمل.",
        is_active: true,
        ...timestamp,
      },
    ];
    const ceremonies = [
      {
        id: id(30),
        organization_id: id(10),
        year: 2024,
        edition: 96,
        label: "الدورة السادسة والتسعون",
        held_on: "2024-03-10",
        source_url: "https://example.invalid/2024",
        ...timestamp,
      },
    ];
    const recognitions = [
      {
        id: id(40),
        title_id: id(100),
        installment_id: null,
        organization_id: id(10),
        category_id: id(20),
        ceremony_id: id(30),
        organization_slug: "academy",
        organization_name: "جوائز الأوسكار",
        category: "أفضل فيلم رسوم متحركة",
        year: 2024,
        result: "winner",
        is_featured: true,
        source_url: "https://example.invalid/2024",
        notes: "فوز موثق من الجهة المانحة",
        position: 0,
        work_name: "الفتى ومالك الحزين",
        installment_name: null,
        ...timestamp,
      },
      {
        id: id(41),
        title_id: id(101),
        installment_id: null,
        organization_id: id(10),
        category_id: id(20),
        ceremony_id: id(30),
        organization_slug: "academy",
        organization_name: "جوائز الأوسكار",
        category: "أفضل فيلم رسوم متحركة",
        year: 2024,
        result: "nominee",
        is_featured: false,
        source_url: null,
        notes: null,
        position: 0,
        work_name: "سبايدرمان: عبر عالم العنكبوت",
        installment_name: null,
        ...timestamp,
      },
      {
        id: id(42),
        title_id: id(102),
        installment_id: null,
        organization_id: id(10),
        category_id: id(21),
        ceremony_id: null,
        organization_slug: "academy",
        organization_name: "جوائز الأوسكار",
        category: "أفضل موسيقى تصويرية",
        year: 2021,
        result: "winner",
        is_featured: false,
        source_url: null,
        notes: null,
        position: 0,
        work_name: "روح",
        installment_name: null,
        ...timestamp,
      },
    ].map((record, index) => ({
      ...record,
      poster_id: id(70 + index),
      work_year: index === 2 ? 2020 : 2023,
      work_english_name: ["The Boy and the Heron", "Across the Spider-Verse", "Soul"][index],
    }));
    const tables = new Map<
      string,
      typeof organizations | typeof categories | typeof ceremonies | typeof recognitions
    >([
      ["award_organizations", organizations],
      ["award_categories", categories],
      ["award_ceremonies", ceremonies],
      ["award_recognitions", recognitions],
    ]);
    let revision = "a".repeat(64);
    let failSave = false;
    Object.assign(window, {
      fixtureFailSave: () => {
        failSave = true;
      },
    });
    window.webkit = {
      messageHandlers: {
        nahhasio: {
          postMessage(raw: string) {
            const request = JSON.parse(raw);
            let result;
            switch (request.command) {
              case "artwork": {
                const record =
                  recognitions.find((entry) => entry.poster_id === request.payload.id) ??
                  recognitions[0];
                const canvas = document.createElement("canvas");
                canvas.width = 360;
                canvas.height = 540;
                const context = canvas.getContext("2d")!;
                const colors =
                  request.payload.id === id(70)
                    ? ["#143e43", "#81ac9e"]
                    : request.payload.id === id(71)
                      ? ["#4f1c49", "#de746e"]
                      : ["#182e62", "#75b9da"];
                context.fillStyle = colors[0];
                context.fillRect(0, 0, 360, 540);
                context.fillStyle = colors[1];
                context.beginPath();
                context.arc(240, 150, 110, 0, Math.PI * 2);
                context.fill();
                context.fillStyle = colors[0];
                context.beginPath();
                context.moveTo(0, 400);
                context.lineTo(210, 160);
                context.lineTo(360, 370);
                context.lineTo(360, 540);
                context.lineTo(0, 540);
                context.fill();
                context.fillStyle = "#ffffff";
                context.font = "bold 24px sans-serif";
                context.textAlign = "center";
                context.fillText(record.work_name, 180, 420, 320);
                context.font = "14px sans-serif";
                context.fillText("ملصق اختباري", 180, 465);
                result = { dataUrl: canvas.toDataURL("image/png") };
                break;
              }
              case "session":
                result = { user, expiresAt: "2099-01-01T00:00:00Z" };
                break;
              case "adminAccess":
                result = user;
                break;
              case "servers.list":
                result = {
                  selected: "http://127.0.0.1:23103/",
                  servers: [{ url: "http://127.0.0.1:23103/", name: "مكتبة العائلة" }],
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
              case "editorCall": {
                const { operation, data } = request.payload;
                let value;
                if (operation === "awardList") {
                  const all = tables.get(data.table) ?? [];
                  const rows = all.filter(
                    (row) =>
                      (!data.organization ||
                        !("organization_id" in row) ||
                        row.organization_id === data.organization) &&
                      (!data.q || JSON.stringify(row).includes(data.q)) &&
                      (data.result === "all" || !("result" in row) || row.result === data.result) &&
                      (!data.category ||
                        !("category_id" in row) ||
                        row.category_id === data.category) &&
                      (!data.ceremony ||
                        !("ceremony_id" in row) ||
                        row.ceremony_id === data.ceremony) &&
                      (!data.year || !("result" in row) || row.year === data.year) &&
                      (!data.featured || !("is_featured" in row) || row.is_featured) &&
                      (data.source === "all" ||
                        !("result" in row) ||
                        (data.source === "missing") === (row.source_url === null)),
                  );
                  value = {
                    rows: rows.slice((data.page - 1) * 25, data.page * 25),
                    total: rows.length,
                    counts: Object.fromEntries(
                      [...tables].map(([table, entries]) => [table, entries.length]),
                    ),
                  };
                } else if (operation === "refs") {
                  const rows = (tables.get(data.table) ?? []).filter((row) =>
                    Object.entries(data.filters ?? {}).every(([key, filterValue]) =>
                      key === "id"
                        ? row.id === filterValue
                        : key === "organization_id" && "organization_id" in row
                          ? row.organization_id === filterValue
                          : true,
                    ),
                  );
                  value = { rows, total: rows.length, offset: 0 };
                } else if (operation === "awardDetail")
                  value = {
                    row: (tables.get(data.table) ?? []).find((row) => row.id === data.id) ?? null,
                    revision,
                    links: [],
                  };
                else if (operation === "awardSave") {
                  if (failSave) {
                    queueMicrotask(() =>
                      window["__nahhasioReply"]?.({
                        id: request.id,
                        ok: false,
                        error: { code: "conflict", message: "تغيّر السجل؛ أعد فتحه قبل الحفظ." },
                      }),
                    );
                    return;
                  }
                  const rows = tables.get(data.table) ?? [];
                  const row = rows.find((entry) => entry.id === data.id);
                  if (row) Object.assign(row, data.draft);
                  revision = "b".repeat(64);
                  value = { id: data.id ?? id(99), created: !data.id };
                } else if (operation === "planetOptions")
                  value = {
                    planets: [
                      {
                        id: id(60),
                        name: "المغامرة",
                        englishName: "Adventure",
                        icon: "🧭",
                        description: "رحلات واكتشافات وعوالم جديدة.",
                        active: true,
                        count: 28,
                        displayOrder: 1,
                      },
                      {
                        id: id(61),
                        name: "الخيال",
                        englishName: "Fantasy",
                        icon: "✨",
                        description: "حكايات السحر والخيال والعوالم البعيدة.",
                        active: true,
                        count: 35,
                        displayOrder: 2,
                      },
                      {
                        id: id(62),
                        name: "العلوم",
                        englishName: "Science",
                        icon: "🔬",
                        description: "الفضول والمعرفة والتجربة.",
                        active: true,
                        count: 12,
                        displayOrder: 3,
                      },
                    ],
                    unassigned: 7,
                  };
                else if (operation === "planetWorks") value = { items: [], total: 0 };
                else {
                  queueMicrotask(() =>
                    window["__nahhasioReply"]?.({
                      id: request.id,
                      ok: false,
                      error: { code: "fixture", message: "خارج نطاق الاختبار" },
                    }),
                  );
                  return;
                }
                result = { result: value };
                break;
              }
              default:
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { code: "fixture", message: "خارج نطاق الاختبار" },
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

test("awards navigate, filter, inspect all data and review a definition save", async ({ page }) => {
  await page.goto("/#/admin/awards");
  await expect(page.getByRole("heading", { name: "الجوائز", exact: true })).toBeVisible();
  await expect(page.getByText("الفتى ومالك الحزين", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /أكاديمية فنون/ }).click();
  await expect(page.getByRole("button", { name: "تحرير الجهة", exact: true })).toBeVisible();
  await page.screenshot({
    path: "../../../data/previews/admin-awards-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "التفاصيل", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText("فوز موثق من الجهة المانحة");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "تحرير الجهة", exact: true }).click();
  await page
    .getByLabel("الاسم الإنجليزي", { exact: true })
    .fill("Academy of Motion Picture Arts and Sciences");
  await page.getByRole("button", { name: "مراجعة التغييرات", exact: true }).click();
  await expect(page.getByRole("dialog").last()).toContainText(
    "Academy of Motion Picture Arts and Sciences",
  );
  await page.getByRole("button", { name: "حفظ التغييرات", exact: true }).click();
  await expect(page.getByLabel("الاسم العربي", { exact: true })).toBeHidden();
  await expect(
    page.getByText("Academy of Motion Picture Arts and Sciences", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: /الفئات/ }).click();
  await expect(
    page.getByRole("button", { name: "أفضل فيلم رسوم متحركة", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /الدورات/ }).click();
  await expect(page.getByText("الدورة السادسة والتسعون", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /الجوائز والترشيحات/ }).click();
  await page.getByRole("button", { name: "مرشح", exact: true }).click();
  await expect(page.getByText("سبايدرمان: عبر عالم العنكبوت", { exact: true })).toBeVisible();
  await expect(page.getByText("الفتى ومالك الحزين", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 520, height: 900 });
  await expect(page.getByRole("button", { name: /اختيار الجهة/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../../../data/previews/admin-awards-narrow.png", fullPage: true });
});

test("failed saves retain draft and Escape asks before discarding", async ({ page }) => {
  await page.goto("/#/admin/awards");
  await page.getByRole("button", { name: /أكاديمية فنون/ }).click();
  await page.getByRole("button", { name: "تحرير الجهة", exact: true }).click();
  await page.getByLabel("الاسم العربي", { exact: true }).fill("مسودة محفوظة");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "إلغاء", exact: true }).last().click();
  await expect(page.getByLabel("الاسم العربي", { exact: true })).toHaveValue("مسودة محفوظة");
  await page.evaluate(() => {
    window.fixtureFailSave();
  });
  await page.getByRole("button", { name: "مراجعة التغييرات", exact: true }).click();
  await page.getByRole("button", { name: "حفظ التغييرات", exact: true }).click();
  await expect(page.getByRole("dialog").last()).toContainText("تغيّر السجل");
  await page.getByRole("button", { name: "العودة للتحرير", exact: true }).click();
  await expect(page.getByLabel("الاسم العربي", { exact: true })).toHaveValue("مسودة محفوظة");
});

test("planet destination search keeps selected destination and keyboard radio selection", async ({
  page,
}) => {
  await page.goto("/#/admin/planets");
  await page.getByRole("radio", { name: /الخيال/ }).check();
  await expect(page.getByRole("radio", { name: /الخيال/ })).toBeChecked();
  await page.getByLabel("البحث عن وجهة", { exact: true }).fill("العلوم");
  await expect(page.getByRole("radio", { name: /الخيال/ })).toHaveCount(0);
  await page.getByLabel("البحث عن وجهة", { exact: true }).fill("");
  await expect(page.getByRole("radio", { name: /الخيال/ })).toBeChecked();
  await page.getByRole("radio", { name: /الخيال/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /العلوم/ })).toBeChecked();
  await page.screenshot({
    path: "../../../data/previews/admin-planets-sidebar.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 520, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("left rail, poster browsing, category and year drilldowns and reversible filters", async ({
  page,
}) => {
  await page.goto("/#/admin/awards");
  const rail = await page.getByRole("complementary", { name: "جهات الجوائز" }).boundingBox();
  const results = await page.getByRole("region", { name: "نتائج الجوائز" }).boundingBox();
  expect(rail!.x + rail!.width).toBeLessThanOrEqual(results!.x);
  await expect(page.getByRole("img", { name: "الفتى ومالك الحزين", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /أكاديمية فنون/ }).click();
  await page.getByRole("tab", { name: /الدورات/ }).click();
  await page.getByRole("button", { name: "كل جوائز سنة 2024", exact: true }).click();
  await expect(page).toHaveURL(/year=2024/);
  await expect(page.getByText("روح", { exact: true })).toHaveCount(0);
  await expect(page.getByText("سبايدرمان: عبر عالم العنكبوت", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "أفضل فيلم رسوم متحركة", exact: true }).first().click();
  await expect(page).toHaveURL(/category=/);
  await page.getByRole("button", { name: /^المرشحات/ }).click();
  await page.getByRole("switch", { name: "الجوائز البارزة فقط", exact: true }).check();
  await expect(page.getByText("سبايدرمان: عبر عالم العنكبوت", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "جدول الجوائز", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "مسح الكل", exact: true }).click();
  await expect(page.getByText("روح", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("switch", { name: "الجوائز البارزة فقط", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "بطاقات الجوائز", exact: true }).click();
  await page.getByRole("button", { name: "مسح الكل", exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "الجوائز البارزة فقط", exact: true }),
  ).not.toBeChecked();
  await page.screenshot({
    animations: "disabled",
    path: "../../../data/previews/admin-awards-explore.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 520, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /^المرشحات/ }).click();
  await expect(page.getByRole("button", { name: /^المرشحات/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.screenshot({
    animations: "disabled",
    path: "../../../data/previews/admin-awards-explore-narrow.png",
    fullPage: true,
  });
});

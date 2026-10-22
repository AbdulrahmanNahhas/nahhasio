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
      avatarKey: "nahhasio-library.svg",
      bio: "",
      isAdmin: true,
      updatedAt: "2026-10-18T00:00:00Z",
    };
    const works = Array.from({ length: 31 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      canonicalTitle: `Work ${index + 1}`,
      titleAr: `عنوان ${index + 1}`,
      releaseYear: 2020,
      format: "animated",
      workflow: "published",
      isPrivate: false,
      updatedAt: "2026-10-18T00:00:00Z",
      verifiedAt: null,
      isSeries: false,
      installmentCount: 1,
      episodeCount: 0,
      posterId: null,
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
                  servers: [{ url: "http://127.0.0.1:23103/", name: "مكتبة الاختبار" }],
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
                const entities = Array.from({ length: 55 }, (_, index) => ({
                  id: `00000000-0000-4000-${data.kind === "person" ? "8000" : "8001"}-${String(index + 1).padStart(12, "0")}`,
                  kind: data.kind,
                  name: `${data.kind === "person" ? "شخص" : "استوديو"} ${index + 1}`,
                  sortName: `Entity ${index + 1}`,
                  description: "",
                  artworkId: null,
                  workCount: 1,
                  roles: [],
                  updatedAt: "2026-10-18T00:00:00Z",
                }));
                const matches = entities.filter((item) => !data.q || item.name.includes(data.q));
                if (operation === "entityList") {
                  const currentPage = data.page ?? 1;
                  result = {
                    items: matches.slice((currentPage - 1) * 24, currentPage * 24),
                    total: matches.length,
                  };
                } else if (operation === "entitySelection") {
                  result = matches.map(({ id, name }) => ({ id, name }));
                } else if (operation === "entityJsonRead") {
                  sessionStorage.setItem("fixture-entity-json-ids", JSON.stringify(data.ids));
                  const chosen = entities.filter((item) => data.ids.includes(item.id));
                  result = {
                    document: {
                      schemaVersion: 1,
                      target: data.kind === "person" ? "people" : "studios",
                      records: chosen.map(({ id, name, sortName, description }) => ({
                        id,
                        name,
                        sortName,
                        description,
                        aliases: [],
                        profileImage: null,
                        credits: [],
                      })),
                    },
                    originals: chosen.map(({ id }) => ({ id, revision: "a".repeat(64) })),
                    previews: chosen,
                  };
                } else if (operation === "entityOptions") {
                  result = { works: [], roles: [] };
                } else {
                  throw new Error(`Unexpected fixture editor operation: ${operation}`);
                }
                result = { result };
                break;
              }
              case "adminWorksSelection":
                result = works
                  .filter((work) => !request.payload.q || work.titleAr.includes(request.payload.q))
                  .map((work) => ({ id: work.id, name: work.titleAr }));
                break;
              case "adminWorks": {
                const matches = works.filter(
                  (work) => !request.payload.q || work.titleAr.includes(request.payload.q),
                );
                const currentPage = request.payload.page ?? 1;
                result = {
                  items: matches.slice((currentPage - 1) * 30, currentPage * 30),
                  total: matches.length,
                  page: currentPage,
                  pageSize: 30,
                };
                break;
              }
              default:
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { code: "unsupported", message: "خارج نطاق اختبار التحديد" },
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

test("selection survives pagination, empty search, display changes and leaving the admin Works route", async ({
  page,
}) => {
  await page.goto("/#/admin/works");
  await page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await page.getByRole("checkbox", { name: "تحديد عنوان 31", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "تحديد عنوان 31", exact: true })).toBeChecked();
  const actions = page.getByRole("region", { name: "إجراءات الأعمال المحددة" });
  await expect(actions.getByText("2 عمل محدّد")).toBeVisible();
  await expect(actions.getByRole("link", { name: "تحرير JSON", exact: true })).toHaveAttribute(
    "href",
    "#/admin/json?selection=works",
  );
  await page.getByLabel("البحث في الأعمال", { exact: true }).fill("غير موجود");
  await page.getByRole("button", { name: "بحث", exact: true }).click();
  await expect(page.getByText("لا توجد أعمال مطابقة", { exact: true })).toBeVisible();
  await actions.getByRole("button", { name: "مراجعة التحديد" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("عنوان 1", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "إلغاء تحديد عنوان 31", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "مسح البحث", exact: true }).click();
  await page.getByRole("button", { name: "ملصقات مصغّرة", exact: true }).click();
  await page.evaluate(() => {
    window.location.hash = "/admin";
  });
  await expect(page.getByRole("heading", { name: "نظرة عامة", exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = "/admin/works";
  });
  await expect(page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "ملصقات مصغّرة", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("deselecting a page preserves selections from another page", async ({ page }) => {
  await page.goto("/#/admin/works");
  await page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await page.getByRole("checkbox", { name: "تحديد كل أعمال هذه الصفحة" }).click();
  await expect(page.getByRole("checkbox", { name: "تحديد كل أعمال هذه الصفحة" })).toBeChecked();
  await page.getByRole("checkbox", { name: "تحديد كل أعمال هذه الصفحة" }).click();
  await expect(page.getByRole("checkbox", { name: "تحديد كل أعمال هذه الصفحة" })).not.toBeChecked();
  await expect(
    page.getByRole("region", { name: "إجراءات الأعمال المحددة" }).getByText("1 عمل محدّد"),
  ).toBeVisible();
  await page.getByRole("button", { name: "السابق", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true })).toBeChecked();
});

test("select all includes all matching pages without the old thirty-work cap", async ({ page }) => {
  await page.goto("/#/admin/works");
  await page.getByRole("button", { name: "تحديد الكل", exact: true }).click();
  const actions = page.getByRole("region", { name: "إجراءات الأعمال المحددة" });
  await expect(actions.getByText("31 عمل محدّد")).toBeVisible();
  await page.screenshot({ path: "../../../data/previews/works-selection-compact-1440.png" });
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "تحديد عنوان 31", exact: true })).toBeChecked();
  await actions.getByRole("link", { name: "تحرير JSON", exact: true }).click();
  await expect(page.getByText("31 عمل في نطاق التحرير.", { exact: true })).toBeVisible();
});

test("the compact selection bar remains usable in a narrow desktop window", async ({ page }) => {
  await page.setViewportSize({ width: 520, height: 800 });
  await page.goto("/#/admin/works");
  await page.getByRole("button", { name: "تحديد الكل", exact: true }).click();
  const actions = page.getByRole("region", { name: "إجراءات الأعمال المحددة" });
  await expect(actions.getByText("31 عمل محدّد")).toBeVisible();
  await expect(actions.getByRole("link", { name: "تحرير JSON", exact: true })).toBeVisible();
  const bounds = await actions.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(520);
  await page.screenshot({ path: "../../../data/previews/works-selection-compact-520.png" });
});

test("filters stay compact, update directly and reset without clearing search or selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 520, height: 800 });
  await page.goto("/#/admin/works");
  await page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true }).click();
  await page.getByLabel("البحث في الأعمال", { exact: true }).fill("عنوان");
  await page.getByRole("button", { name: "بحث", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "نوع الإنتاج", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "المرشحات", exact: true }).click();
  await page.getByRole("combobox", { name: "نوع الإنتاج", exact: true }).click();
  await page.getByRole("option", { name: "رسوم متحركة", exact: true }).click();
  await expect(page).toHaveURL(/format=animated/);
  await expect(page.getByRole("button", { name: /^المرشحات/ })).toContainText("1");
  await page.screenshot({ path: "../../../data/previews/works-filters-compact-520.png" });
  await page.getByRole("button", { name: "إعادة ضبط المرشحات", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "نوع الإنتاج", exact: true })).toContainText(
    "كل الأنواع",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("البحث في الأعمال", { exact: true })).toHaveValue("عنوان");
  await expect(page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true })).toBeChecked();
});

test("select all toggles across pages and only deselects the current filtered results", async ({
  page,
}) => {
  await page.goto("/#/admin/works");
  await page.getByRole("button", { name: "تحديد الكل", exact: true }).click();
  await expect(page.getByRole("button", { name: "إلغاء تحديد الكل", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(page.getByRole("button", { name: "إلغاء تحديد الكل", exact: true })).toBeVisible();
  await page.getByLabel("البحث في الأعمال", { exact: true }).fill("عنوان 31");
  await page.getByRole("button", { name: "بحث", exact: true }).click();
  await page.getByRole("button", { name: "إلغاء تحديد الكل", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "تحديد عنوان 31", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("region", { name: "إجراءات الأعمال المحددة" }).getByText("30 عمل محدّد"),
  ).toBeVisible();
  await page.getByRole("button", { name: "مسح البحث", exact: true }).click();
  await page.getByRole("button", { name: "تحديد الكل", exact: true }).click();
  await page.getByRole("button", { name: "إلغاء تحديد الكل", exact: true }).click();
  await expect(page.getByRole("region", { name: "إجراءات الأعمال المحددة" })).not.toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "تحديد عنوان 1", exact: true }),
  ).not.toBeChecked();
});

for (const [path, name] of [
  ["people", "شخص"],
  ["studios", "استوديو"],
] as const) {
  test(`${path}: matching selection crosses pages, survives navigation and forwards all IDs`, async ({
    page,
  }) => {
    await page.goto(`/#/admin/${path}`);
    await page.getByRole("checkbox", { name: `تحديد ${name} 1`, exact: true }).click();
    await page.getByRole("button", { name: "التالي", exact: true }).click();
    await page.getByRole("checkbox", { name: `تحديد ${name} 25`, exact: true }).click();
    await page.evaluate(() => {
      window.location.hash = "/admin/works";
    });
    await expect(page.getByRole("heading", { name: "الأعمال", exact: true })).toBeVisible();
    await page.evaluate((target) => {
      window.location.hash = `/admin/${target}`;
    }, path);
    await expect(
      page.getByRole("region", { name: "إجراءات السجلات المحددة" }).getByText("2 سجل محدّد"),
    ).toBeVisible();
    await page.getByRole("button", { name: "تحديد الكل", exact: true }).click();
    const actions = page.getByRole("region", { name: "إجراءات السجلات المحددة" });
    await expect(actions.getByText("55 سجل محدّد")).toBeVisible();
    await page.getByRole("button", { name: "المزيد من إجراءات التحديد" }).click();
    await expect(
      page.getByRole("menuitem", { name: "الحذف متاح حتى 50 سجلاً في الدفعة" }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `../../../data/previews/admin-${path}-compact-1440.png` });
    await actions.getByRole("link", { name: "تحرير JSON" }).click();
    await expect
      .poll(async () =>
        page.evaluate(
          () => JSON.parse(sessionStorage.getItem("fixture-entity-json-ids") ?? "[]").length,
        ),
      )
      .toBe(55);
    await page.evaluate((target) => {
      window.location.hash = `/admin/${target}`;
    }, path);
    await page.getByRole("button", { name: "إلغاء تحديد الكل", exact: true }).click();
    await expect(actions).not.toBeVisible();
  });
}

test("entity filters and selection review work in a narrow window with isolated selections", async ({
  page,
}) => {
  await page.setViewportSize({ width: 520, height: 800 });
  await page.goto("/#/admin/people");
  await page.getByRole("checkbox", { name: "تحديد شخص 1", exact: true }).click();
  await page.getByRole("button", { name: "المرشحات", exact: true }).click();
  await page.getByRole("combobox", { name: "توفر الصورة", exact: true }).click();
  await page.getByRole("option", { name: "بدون صورة", exact: true }).click();
  await expect(page).toHaveURL(/image=without/);
  await page.screenshot({ path: "../../../data/previews/admin-people-filters-520.png" });
  await page.getByRole("button", { name: "إعادة ضبط المرشحات", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "مراجعة التحديد" }).click();
  await expect(page.getByRole("dialog").getByText("شخص 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "إلغاء تحديد شخص 1", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("checkbox", { name: "تحديد شخص 2", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.evaluate(() => {
    window.location.hash = "/admin/studios";
  });
  await expect(page.getByRole("heading", { name: "الاستوديوهات", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "إجراءات السجلات المحددة" })).not.toBeVisible();
});

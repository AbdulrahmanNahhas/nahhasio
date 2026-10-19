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
                } else if (operation === "entitySave") {
                  sessionStorage.setItem("studio-saved-draft", JSON.stringify(data.draft));
                  result = { id: entities[0].id, created: true };
                } else if (operation === "entityDetail") {
                  const entity = entities.find((item) => item.id === data.id) ?? entities[0];
                  const draft = JSON.parse(
                    sessionStorage.getItem("studio-saved-draft") ?? "null",
                  ) ?? {
                    name: entity.name,
                    sortName: entity.sortName,
                    description: "",
                    aliases: [],
                    credits: [],
                    profileAssetId: null,
                    urls: [],
                    relations: [],
                  };
                  result = { entity, draft, revision: "a".repeat(64), links: [], imageCount: 0 };
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

for (const width of [1440, 520]) {
  test(`Studios editor ${width}: links, relationships, review and save`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#/admin/studios?person=new");
    const drawer = page.getByRole("dialog", { name: "إضافة استوديو", exact: true });
    await drawer.getByLabel("الاسم", { exact: true }).fill("جهة الاختبار");
    await drawer.getByRole("tab", { name: "الروابط", exact: true }).click();
    await drawer.getByRole("button", { name: "إضافة رابط", exact: true }).click();
    await drawer.getByLabel("اسم الرابط", { exact: true }).fill("الموقع الرسمي");
    await drawer.getByLabel("الرابط", { exact: true }).fill("https://example.test/studio");
    await page.screenshot({
      path: `../../../data/previews/studio-editor/links-${width}.png`,
      fullPage: true,
    });
    await drawer.getByRole("tab", { name: "علاقات الجهات", exact: true }).click();
    await drawer.getByRole("button", { name: "إضافة علاقة", exact: true }).click();
    await page
      .getByRole("dialog", { name: "اختيار جهة مرتبطة", exact: true })
      .getByRole("button", { name: "استوديو 2", exact: true })
      .click();
    await drawer.getByLabel("نوع العلاقة", { exact: true }).fill("تابعة لـ");
    await drawer.getByLabel("التاريخ (اختياري)", { exact: true }).fill("2020-01-02");
    await drawer.getByLabel("ملاحظات العلاقة", { exact: true }).fill("علاقة اختبار");
    await page.screenshot({
      path: `../../../data/previews/studio-editor/relations-${width}.png`,
      fullPage: true,
    });
    await drawer.getByRole("tab", { name: "الهوية", exact: true }).click();
    await expect(drawer.getByLabel("الاسم", { exact: true })).toHaveValue("جهة الاختبار");
    await page.screenshot({
      path: `../../../data/previews/studio-editor/identity-${width}.png`,
      fullPage: true,
    });
    await drawer.getByRole("button", { name: "مراجعة التغييرات", exact: true }).click();
    const review = page.getByRole("dialog", { name: "مراجعة السجل والمساهمات", exact: true });
    await expect(
      review.getByText("الموقع الرسمي: https://example.test/studio", { exact: true }),
    ).toBeVisible();
    await expect(review.getByText("علاقات الجهات", { exact: true })).toBeVisible();
    await review.getByRole("button", { name: "تأكيد الحفظ", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(sessionStorage.getItem("studio-saved-draft") ?? "null")),
      )
      .toMatchObject({
        urls: [{ label: "الموقع الرسمي", url: "https://example.test/studio" }],
        relations: [
          { entityName: "استوديو 2", relationType: "تابعة لـ", occurredOn: "2020-01-02" },
        ],
      });
  });
}

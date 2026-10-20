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

test("admin sidebar is right inset and collapses to icons with Ctrl+B", async ({ page }) => {
  await page.goto("/#/admin/works");
  const sidebar = page.locator('[data-slot="sidebar"][data-side="right"]');
  await expect(sidebar).toHaveAttribute("data-variant", "inset");
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  const expanded = await sidebar.boundingBox();
  expect(expanded?.x).toBeGreaterThan(1100);
  await page.keyboard.press("Control+b");
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect(sidebar).toHaveAttribute("data-collapsible", "icon");
  await page.getByRole("link", { name: "الأشخاص", exact: true }).click();
  await expect(page).toHaveURL(/admin\/people/);
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeLessThan(80);
  await page.screenshot({ path: "../../../data/previews/admin-sidebar-icons.png" });
  await page.keyboard.press("Control+b");
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeGreaterThan(240);
  await page.screenshot({ path: "../../../data/previews/admin-sidebar-inset.png" });
  await page.setViewportSize({ width: 520, height: 900 });
  await page.getByRole("button", { name: "إظهار أو إخفاء القائمة", exact: true }).click();
  const mobile = page.locator('[data-slot="sidebar"][data-mobile="true"]');
  await expect(mobile).toBeVisible();
  await mobile.getByRole("link", { name: "الأعمال", exact: true }).click();
  await expect(mobile).not.toBeVisible();
  await expect(page).toHaveURL(/admin\/works/);
});

import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let user = {
      id: "fixture-user",
      accountId: "00000000-0000-4000-8000-000000000001",
      name: "أكوا",
      email: "private@example.test",
      role: "owner",
      kind: "admin",
      avatarKey: "cars-1.png",
      bio: "أحب الحكايات التي تبقى معنا، من أفلام الطفولة إلى عوالم الأنمي.",
      isAdmin: true,
      updatedAt: "2026-10-20T00:00:00.000000Z",
    };
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
              case "profile":
                result = user;
                break;
              case "publicProfile":
                result = {
                  id: request.payload.id,
                  name: user.name,
                  avatarKey: user.avatarKey,
                  bio: user.bio,
                  joinedAt: "2026-02-14",
                };
                break;
              case "profileOverview": {
                const owner = request.payload.id === user.accountId;
                const sections = [
                  ["watched", "المشاهدة المكتملة"],
                  ["watching", "قيد المشاهدة"],
                  ["favorites", "المفضلة"],
                  ["ratings", "التقييمات الشخصية"],
                  ["follows", "الأعمال المتابَعة"],
                  ["saved", "علامات الحفظ"],
                  ["comments", "التعليقات"],
                  ["reviews", "المراجعات"],
                  ["collections", "القوائم"],
                  ["notes", "الملاحظات الشخصية"],
                  ["history", "زيارات صفحات الأعمال"],
                  ["saved-views", "طرق العرض المحفوظة"],
                  ["downloads", "التنزيلات المسجلة"],
                  ["recommendations", "الترشيحات"],
                  ["events", "جلسات المشاهدة"],
                  ["reactions", "التفاعلات"],
                  ["notifications", "الإشعارات"],
                  ["preferences", "التفضيلات"],
                  ["devices", "الأجهزة"],
                  ["policies", "سياسة المحتوى"],
                ];
                result = {
                  owner,
                  stats: sections
                    .filter(
                      ([key]) => owner || ["comments", "reviews", "collections"].includes(key),
                    )
                    .map(([key, label]) => ({ key, label, value: key === "comments" ? 24 : 4 })),
                  viewing: owner
                    ? { works: 3, episodes: 2, movies: 1, recordedSeconds: 5600 }
                    : null,
                };
                break;
              }
              case "profileEntries": {
                const section = request.payload.section;
                const currentPage = request.payload.page;
                const total = section === "comments" ? 24 : 4;
                const entries = Array.from({ length: total }, (_, index) => ({
                  id: `entry-${index}`,
                  name: `حكاية ${index + 1}`,
                  body: section === "comments" ? `تعليق محفوظ ${index + 1}` : null,
                  workId: "93000000-0000-4000-8000-000000000001",
                  artworkId: null,
                  createdAt: "2026-10-20T00:00:00Z",
                  detail: section === "watched" ? "الفيلم" : null,
                  value: section === "watched" ? 1200 : null,
                  spoiler: section === "comments" && index === 0,
                  status: section === "comments" ? "published" : null,
                }));
                result = {
                  items: entries.slice((currentPage - 1) * 20, currentPage * 20),
                  total,
                  page: currentPage,
                  pageSize: 20,
                };
                break;
              }
              case "updateProfile":
                sessionStorage.setItem("fixture-profile-update", JSON.stringify(request.payload));
                user = { ...user, ...request.payload, updatedAt: "2026-10-20T01:00:00.000000Z" };
                result = user;
                break;
              case "avatar":
                result = {
                  dataUrl:
                    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
                };
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
              default:
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: {
                      code: "unsupported",
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

test("public profile, separate editor and supplied avatars work without exposing account fields", async ({
  page,
}) => {
  await page.goto("/#/profile");
  await expect(page.getByRole("heading", { name: "أكوا", exact: true })).toBeVisible();
  await expect(page.getByText("private@example.test")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "الاسم", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "../../../data/previews/account-profile.png" });
  await page.getByRole("button", { name: "الملف والحساب", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "الملف الشخصي", exact: true })).toHaveCount(1);
  await expect(page.getByRole("menuitem", { name: "تعديل الملف والصورة" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "إعدادات الحساب" })).toHaveCount(0);
  await page.screenshot({ path: "../../../data/previews/account-menu.png" });
  await page.getByRole("menuitem", { name: "الملف الشخصي", exact: true }).click();
  await expect(page).toHaveURL(/profiles\/00000000-0000-4000-8000-000000000001/);
  await expect(page.getByRole("button", { name: "تعديل الملف", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "تعديل الملف", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "إعداداتك", exact: true });
  await expect(editor).toBeVisible();
  await page.getByRole("textbox", { name: "الاسم", exact: true }).fill("أكوا الجديد");
  await page.getByRole("searchbox", { name: "اختر صورة حسابك" }).fill("سونيك");
  await page.getByTitle("سونيك 2", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "سونيك 2", exact: true })).toBeChecked();
  await page.screenshot({ path: "../../../data/previews/account-profile-editor.png" });
  await page.getByRole("button", { name: "حفظ التغييرات", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "أكوا الجديد", exact: true })).toBeVisible();
  expect(
    JSON.parse(await page.evaluate(() => sessionStorage.getItem("fixture-profile-update") ?? "{}")),
  ).toMatchObject({ name: "أكوا الجديد", avatarKey: "sonic-2.png" });
  await page.goto("/#/profiles/00000000-0000-4000-8000-000000000002?edit=profile");
  await expect(page.getByRole("heading", { name: "أكوا الجديد", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "إعداداتك", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "تعديل الملف", exact: true })).toHaveCount(0);
  await expect(page.getByText("private@example.test")).toHaveCount(0);
  await page.setViewportSize({ width: 520, height: 900 });
  await page.screenshot({ path: "../../../data/previews/account-profile-public-520.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("discard restores the saved profile and keyboard can open and close settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 520, height: 900 });
  await page.goto("/#/profile?edit=profile");
  const editor = page.getByRole("dialog", { name: "إعداداتك", exact: true });
  await expect(page.getByRole("radio")).toHaveCount(111);
  const scroll = page.locator("#profile-editor-form");
  const save = page.getByRole("button", { name: "حفظ التغييرات", exact: true });
  const before = await save.boundingBox();
  await scroll.hover();
  await page.mouse.wheel(0, 1400);
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(save).toBeVisible();
  const after = await save.boundingBox();
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);

  await expect(page.getByRole("radio", { name: "المكتبة", exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "العوالم", exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "الاسم", exact: true }).fill("غير محفوظ");
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  await page.getByRole("button", { name: "تجاهل التغييرات" }).click();
  await expect(editor).not.toBeVisible();
  await page.getByRole("button", { name: "تعديل الملف", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "الاسم", exact: true })).toHaveValue("أكوا");
  await page.screenshot({ path: "../../../data/previews/account-profile-editor-520.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await expect(editor).not.toBeVisible();
});

test("tab switching keeps one panel and Drawer enter/exit transitions run", async ({ page }) => {
  await page.goto("/#/profile");
  await expect(page.getByRole("button", { name: "تعديل الملف", exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.addEventListener("transitionrun", (event) => {
      if (
        !(event.target instanceof HTMLElement) ||
        event.target.dataset.slot !== "drawer-popup" ||
        event.propertyName !== "transform"
      )
        return;
      const entries = JSON.parse(sessionStorage.getItem("drawer-transitions") ?? "[]");
      entries.push(event.target.hasAttribute("data-ending-style") ? "exit" : "enter");
      sessionStorage.setItem("drawer-transitions", JSON.stringify(entries));
    });
  });
  await page.getByRole("button", { name: "تعديل الملف", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "إعداداتك", exact: true });
  await expect(editor).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("drawer-transitions")))
    .toContain("enter");
  for (const name of [
    "أمان الحساب",
    "الجهاز",
    "الملف والصورة",
    "الجهاز",
    "أمان الحساب",
    "الملف والصورة",
  ]) {
    await editor.getByRole("tab", { name, exact: true }).click();
    await expect(editor.getByRole("tab", { name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(editor.locator('[role="tabpanel"]')).toHaveCount(1);
    await expect(editor.getByRole("tabpanel", { name, exact: true })).toBeVisible();
  }
  await editor.getByRole("button", { name: "إغلاق الإعدادات" }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("drawer-transitions")))
    .toContain("exit");
  await expect(editor).not.toBeVisible();
});

test("profile activity paginates discussion, protects spoilers and shows viewing statistics", async ({
  page,
}) => {
  await page.goto("/#/profile");
  await expect(page.getByRole("tab", { name: "المشاهدة", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "حكاية 1", exact: true })).toBeVisible();
  await page.screenshot({ path: "../../../data/previews/profile-activity-watched.png" });
  await page.getByRole("tab", { name: "الآراء والقوائم", exact: true }).click();
  await expect(page.getByText("تعليق محفوظ 1", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "إظهار محتوى يحوي حرقًا", exact: true }).click();
  await expect(page.getByText("تعليق محفوظ 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "عرض المزيد", exact: true }).click();
  await expect(page.getByText("تعليق محفوظ 24", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "الإحصاءات", exact: true }).click();
  await expect(page.getByRole("tab", { name: "الإحصاءات", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "الآراء والقوائم", exact: true })).toHaveAttribute(
    "aria-selected",
    "false",
  );
  await expect(page.getByText("أعمال مكتملة", { exact: true })).toBeVisible();
  await page.screenshot({ path: "../../../data/previews/profile-activity-statistics.png" });
  await page.setViewportSize({ width: 520, height: 900 });
  await page.screenshot({ path: "../../../data/previews/profile-activity-520.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto("/#/profiles/00000000-0000-4000-8000-000000000002");
  await expect(page.getByRole("tab", { name: "الآراء والقوائم", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "المشاهدة", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "الحساب", exact: true })).toHaveCount(0);
});

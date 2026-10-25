import type { User } from "@nahhasio/api-contract";
import { test, expect } from "@playwright/test";

const admin: User = {
  id: "fixture-admin",
  accountId: "00000000-0000-4000-8000-000000000001",
  name: "المدير",
  email: "admin@nahhasio.local",
  role: "owner",
  kind: "admin",
  avatarKey: "nahhasio-library.svg",
  bio: "",
  isAdmin: true,
  updatedAt: "2026-10-12T00:00:00.000000Z",
};
const member: User = {
  ...admin,
  id: "fixture-member",
  accountId: "00000000-0000-4000-8000-000000000002",
  name: "المستخدم",
  email: "user@nahhasio.local",
  role: "member",
  kind: "personal",
  avatarKey: "nahhasio-orbit.svg",
  isAdmin: false,
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ admin: adminFixture, member: memberFixture }) => {
      let current: typeof adminFixture | null = null;
      let sequence = 0;
      window.webkit = {
        messageHandlers: {
          nahhasio: {
            postMessage(raw: string) {
              const request = JSON.parse(raw);
              const success = (
                result: import("zod").z.input<ReturnType<typeof import("zod").z.json>>,
              ) =>
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({ id: request.id, ok: true, result }),
                );
              const failure = (code: string, message: string) =>
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { code, message },
                  }),
                );
              switch (request.command) {
                case "loginAccounts":
                  success([]);
                  return;
                case "servers.list":
                  success({
                    selected: "http://127.0.0.1:23103/",
                    servers: [
                      {
                        url: "http://127.0.0.1:23103/",
                        name: "مكتبة التجربة",
                        trustedFingerprint: null,
                      },
                    ],
                  });
                  return;
                case "servers.probe":
                  success({
                    url: request.payload.url,
                    info: {
                      product: "nahhasio",
                      name: "مكتبة التجربة",
                      version: "0.1.0",
                      apiVersion: 1,
                    },
                  });
                  return;
                case "session":
                  success(current ? { user: current, expiresAt: "2099-01-01T00:00:00Z" } : null);
                  return;
                case "login":
                  if (request.payload.password !== "123456") {
                    failure("unauthorized", "بيانات الدخول غير صحيحة");
                    return;
                  }
                  current =
                    request.payload.email === memberFixture.email
                      ? { ...memberFixture }
                      : { ...adminFixture };
                  success({ user: current, expiresAt: "2099-01-01T00:00:00Z" });
                  return;
                case "logout":
                  current = null;
                  success(null);
                  return;
                case "profile":
                  success(current);
                  return;
                case "updateProfile":
                  if (!current) {
                    failure("unauthorized", "انتهت الجلسة");
                    return;
                  }
                  current = {
                    ...current,
                    ...request.payload,
                    updatedAt: `2026-10-12T00:00:0${++sequence}.000000Z`,
                  };
                  success(current);
                  return;
                case "updatePassword":
                  if (request.payload.currentPassword !== "123456") {
                    failure("bad_request", "كلمة المرور الحالية غير صحيحة");
                    return;
                  }
                  success({ message: "Password updated" });
                  return;
                case "adminAccess":
                  if (!current?.isAdmin) {
                    failure("forbidden", "هذه الصفحة للمدير فقط");
                    return;
                  }
                  success(current);
                  return;
                case "avatar":
                  success({
                    dataUrl:
                      "data:image/svg+xml;base64," +
                      btoa(
                        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#aa9aff"/></svg>',
                      ),
                  });
                  return;
                case "home":
                  success({ comments: [], upcoming: [] });
                  return;
                default:
                  failure("unsupported", "عملية خارج نطاق حسابات الاختبار");
              }
            },
          },
        },
      };
    },
    { admin, member },
  );
});

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني" }).click();
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "إظهار كلمة المرور" }).click();
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "إخفاء كلمة المرور" }).click();
  await page.getByRole("button", { name: "دخول المكتبة" }).click();
  await expect(page.getByRole("button", { name: "الملف والحساب" })).toBeVisible();
}
for (const width of [520, 1440]) {
  test(`account menu and profile ${width}: real fields, avatar, save and password feedback`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, admin.email);
    await page.getByRole("button", { name: "الملف والحساب" }).click();
    await expect(page.getByRole("menuitem", { name: "لوحة الإدارة" })).toBeVisible();
    const menu = page.getByRole("menu", { name: "الحساب" });
    await expect(menu).toHaveCSS("opacity", "1");
    await menu.screenshot({ path: `../../../data/previews/account-menu-${width}.png` });
    await page.getByRole("menuitem", { name: "الملف الشخصي" }).click();
    await expect(page.getByRole("article", { name: "الملف الشخصي" })).toBeVisible();
    await page.getByLabel("الاسم", { exact: true }).fill("اسم الحساب الجديد");
    await page.getByLabel("نبذة عنك", { exact: true }).fill("مكتبتي الخاصة");
    await page.getByRole("radio", { name: /العوالم/ }).check();
    await page.getByRole("button", { name: "حفظ التغييرات" }).click();
    await expect(
      page.getByRole("heading", { name: "اسم الحساب الجديد", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("تم حفظ الملف الشخصي.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "حفظ التغييرات" })).toBeDisabled();
    await page.getByLabel("كلمة المرور الحالية", { exact: true }).fill("wrong");
    await page.getByLabel("كلمة المرور الجديدة", { exact: true }).fill("new-password");
    await page.getByLabel("تأكيد كلمة المرور", { exact: true }).fill("not-matching");
    await expect(
      page.getByRole("button", { name: "تغيير كلمة المرور", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("تأكيد كلمة المرور", { exact: true }).fill("new-password");
    await page.getByRole("button", { name: "تغيير كلمة المرور", exact: true }).click();
    await expect(page.getByText("كلمة المرور الحالية غير صحيحة", { exact: true })).toBeVisible();
    await page.getByLabel("كلمة المرور الحالية", { exact: true }).fill("123456");
    await page.getByRole("button", { name: "تغيير كلمة المرور", exact: true }).click();
    await expect(
      page.getByText("تغيّرت كلمة المرور وانتهت الجلسات الأخرى.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("كلمة المرور الجديدة", { exact: true })).toHaveValue("");
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(width);
    await page.locator("#main-content").evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({
      path: `../../../data/previews/account-profile-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: "لوحة الإدارة" }).click();
    await expect(page.getByRole("region", { name: "لوحة الإدارة" })).toBeVisible();
    await expect(page.getByText("مساحتك لإدارة المكتبة.", { exact: false })).toBeVisible();
  });
}
test("ordinary account has its own profile, no admin entry, and direct admin navigation is denied", async ({
  page,
}) => {
  await login(page, member.email);
  await page.getByRole("button", { name: "الملف والحساب" }).click();
  await expect(page.getByRole("menuitem", { name: "لوحة الإدارة" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "الملف الشخصي" }).click();
  await expect(page.getByRole("heading", { name: member.name, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "لوحة الإدارة" })).toHaveCount(0);
  await page.goto("/#/admin/works");
  await expect(page.getByText("هذه الصفحة للمدير فقط", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "الملف والحساب" }).click();
  await page.getByRole("menuitem", { name: "تسجيل الخروج" }).click();
  await expect(page.getByRole("heading", { name: "من يشاهد؟" })).toBeVisible();
});

test("admin navigation has guarded empty pages for every dashboard section", async ({ page }) => {
  await login(page, admin.email);
  await page.getByRole("button", { name: "الملف والحساب" }).click();
  await page.getByRole("menuitem", { name: "لوحة الإدارة" }).click();
  const navigation = page.getByRole("navigation", { name: "التنقل الإداري" });
  await expect(navigation).toBeVisible();
  const links = await navigation.locator('a[href^="#/admin/"]').evaluateAll((elements) =>
    elements.map((element) => ({
      href: element.getAttribute("href")!,
      title: element.textContent!.trim(),
    })),
  );
  expect(links).toHaveLength(31);
  for (const link of links) {
    await navigation.locator(`a[href="${link.href}"]`).click();
    await expect(page.getByText(link.title, { exact: true }).last()).toBeVisible();
    await expect(page.getByText("قيد التجهيز", { exact: true })).toBeVisible();
    await expect(navigation.locator(`a[href="${link.href}"]`)).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  await navigation.getByRole("link", { name: "نظرة عامة" }).click();
  await page.screenshot({ path: "../../../data/previews/admin-layout.png" });
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const accountId = "00000000-0000-4000-8000-000000000001";
    const otherId = "00000000-0000-4000-8000-000000000002";
    const deviceId = "00000000-0000-4000-8000-000000000003";
    const date = "2026-10-20T00:00:00Z";
    const user = {
      id: "fixture-admin",
      accountId,
      name: "المدير",
      email: "fixture@example.test",
      role: "owner",
      kind: "admin",
      avatarKey: "cars-1.png",
      bio: "",
      isAdmin: true,
      updatedAt: date,
    };
    const account = {
      id: accountId,
      auth_user_id: user.id,
      display_name: "المدير",
      avatar_key: user.avatarKey,
      kind: "admin",
      status: "active",
      bio: "",
      slug: null,
      is_discoverable: false,
      last_seen_at: null,
      created_at: date,
    };
    const records = {
      accounts: [
        account,
        {
          ...account,
          id: otherId,
          display_name: "حساب موقوف",
          status: "suspended",
          auth_user_id: null,
        },
      ],
      auth_users: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          email_verified: true,
          role: "owner",
          banned: false,
          ban_expires: null,
          password: "[protected]",
        },
      ],
      devices: [
        {
          id: deviceId,
          name: "حاسوب العائلة",
          platform: "linux",
          last_seen_at: date,
          revoked_at: null,
          created_at: date,
        },
      ],
      auth_sessions: [
        {
          id: "session-1",
          user_id: user.id,
          device_id: deviceId,
          expires_at: "2099-01-01T00:00:00Z",
          created_at: date,
          updated_at: date,
          token: "[protected]",
        },
      ],
      account_capabilities: [{ account_id: accountId, capability: "catalog.view" }],
      account_content_policies: [],
      account_admin_restrictions: [],
      account_preferences: [],
      notifications: [
        {
          id: "notification-1",
          account_id: accountId,
          actor_account_id: otherId,
          title_id: null,
          message: "إشعار المدير فقط",
          created_at: date,
        },
        {
          id: "notification-2",
          account_id: otherId,
          actor_account_id: accountId,
          title_id: null,
          message: "إشعار حساب آخر",
          created_at: date,
        },
      ],
      account_invites: [
        {
          id: deviceId,
          display_name: "ضيف المكتبة",
          username: "guest",
          role: "member",
          kind: "personal",
          accepted_at: null,
          expires_at: "2099-01-01T00:00:00Z",
          created_at: date,
          token_hash: "[protected]",
        },
      ],
    };
    window.webkit = {
      messageHandlers: {
        nahhasio: {
          postMessage(raw: string) {
            const request = JSON.parse(raw);
            let result;
            if (request.command === "session") result = { user, expiresAt: "2099-01-01T00:00:00Z" };
            else if (request.command === "adminAccess") result = user;
            else if (request.command === "offline.status")
              result = {
                scope: null,
                active: false,
                offline: false,
                name: null,
                pending: 0,
                job: null,
              };
            else if (request.command === "databaseRows") {
              const { table, q, filterColumn, filterValue, page: resultPage = 1 } = request.payload;
              const source = Object.entries(records).find(([key]) => key === table)?.[1] ?? [];
              const rows = source.filter(
                (row) =>
                  (!q || JSON.stringify(row).includes(q)) &&
                  (!filterColumn ||
                    Object.entries(row).some(
                      ([key, value]) => key === filterColumn && value === filterValue,
                    )),
              );
              result = {
                table,
                page: resultPage,
                pageSize: 1,
                total: rows.length,
                rows: rows.slice(resultPage - 1, resultPage),
              };
            } else {
              queueMicrotask(() =>
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: false,
                  error: { code: "unsupported", message: "خارج نطاق الاختبار" },
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

test("account directory scopes details, sessions and viewing records without exposing secrets", async ({
  page,
}) => {
  await page.goto("/#/admin/accounts");
  await expect(page.getByRole("heading", { name: "الحسابات والوصول", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "إنشاء حساب", exact: true })).toBeDisabled();
  const opener = page.getByRole("button", { name: "فتح حساب المدير", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("fixture@example.test", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "الجلسات", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "إلغاء الجلسة", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "الصلاحيات والمحتوى", exact: true }).click();
  await expect(dialog.getByRole("switch", { name: "عرض المكتبة", exact: true })).toBeChecked();
  await expect(dialog.getByRole("switch", { name: "عرض المكتبة", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "المشاهدة والتفاعل", exact: true }).click();
  await dialog.getByRole("combobox", { name: "نوع البيانات", exact: true }).click();
  await page.getByRole("option", { name: "الإشعارات", exact: true }).click();
  await expect(dialog.getByText("إشعار المدير فقط", { exact: true })).toBeVisible();
  await expect(dialog).not.toContainText("إشعار حساب آخر");
  await expect(dialog).not.toContainText("[protected]");
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "فتح حساب حساب موقوف", exact: true }),
  ).toBeVisible();
  await page.getByLabel("البحث بالاسم أو المعرّف", { exact: true }).fill("المدير");
  await page.getByRole("button", { name: "بحث", exact: true }).click();
  await expect(opener).toBeVisible();
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/admin-accounts.png" });
});

test("devices and invitations have their own compact views and narrow details fit", async ({
  page,
}) => {
  await page.goto("/#/admin/accounts?tab=devices");
  await page.getByRole("button", { name: "فتح جهاز حاسوب العائلة", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("المدير", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "إلغاء وصول الجهاز", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/admin-accounts-narrow.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "الدعوات", exact: true }).click();
  await expect(page.getByText("ضيف المكتبة", { exact: true })).toBeVisible();
  await expect(page.getByText("بانتظار القبول", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "إلغاء الدعوة", exact: true })).toBeDisabled();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("failed permission reads show an error rather than unchecked grants", async ({ page }) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command === "databaseRows" && request.payload.table === "account_capabilities")
        return queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: false,
            error: { code: "unavailable", message: "تعذّرت قراءة الصلاحيات" },
          }),
        );
      original(raw);
    };
  });
  await page.goto("/#/admin/accounts?tab=policies");
  await page.getByRole("button", { name: "فتح حساب المدير", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("تعذّرت قراءة الصلاحيات", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("switch")).toHaveCount(0);
});

test("malformed account records fail inside the query with a recoverable message", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const handler = window.webkit!.messageHandlers!.nahhasio!;
    const original = handler.postMessage.bind(handler);
    handler.postMessage = (raw: string) => {
      const request = JSON.parse(raw);
      if (request.command === "databaseRows" && request.payload.table === "accounts")
        return queueMicrotask(() =>
          window["__nahhasioReply"]?.({
            id: request.id,
            ok: true,
            result: {
              table: "accounts",
              page: 1,
              pageSize: 25,
              total: 1,
              rows: [{ id: "invalid" }],
            },
          }),
        );
      original(raw);
    };
  });
  await page.goto("/#/admin/accounts");
  await expect(page.getByRole("heading", { name: "الحسابات والوصول", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("تعذّر قراءة استجابة الخادم");
  await expect(page.getByRole("button", { name: "إعادة المحاولة", exact: true })).toBeEnabled();
});

import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const accountId = "00000000-0000-4000-8000-000000000001";
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
      updatedAt: "2026-10-20T00:00:00Z",
    };
    const base = {
      type: "catalog.refresh",
      progress: 0,
      created_by_account_id: accountId,
      updated_at: "2026-11-01T00:00:00Z",
      started_at: null,
      finished_at: null,
      attempts: 1,
      max_attempts: 3,
      run_after: "2026-10-20T00:00:00Z",
      error: null,
      payload: { apiToken: "[protected]" },
      result: null,
    };
    const jobs = [
      { ...base, id: "a-old", status: "completed", created_at: "2026-10-20T00:00:00Z" },
      {
        ...base,
        id: "b-failed",
        status: "failed",
        created_at: "2026-10-30T00:00:00Z",
        error: "تعذّر الاتصال بمصدر الصور",
      },
      { ...base, id: "c-new", status: "running", progress: 40, created_at: "2026-11-01T00:00:00Z" },
    ];
    const audits = [
      {
        id: "audit-old",
        actor_account_id: null,
        action: "work.save",
        target_type: "title",
        target_id: "fixture-work",
        summary: "حفظ بيانات عمل",
        created_at: "2026-10-20T00:00:00Z",
        changes: { name: null, token: "[protected]" },
      },
      {
        id: "audit-new",
        actor_account_id: accountId,
        action: "server.rename",
        target_type: "server",
        target_id: null,
        summary: "تغيير اسم المكتبة",
        created_at: "2026-11-01T00:00:00Z",
        changes: { name: "مكتبة التجربة", token: "[protected]" },
      },
    ];
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
            else if (request.command === "serverOperations")
              result = {
                version: 1,
                available: false,
                backups: [],
                update: { state: "unmanaged", currentVersion: "0.1.2" },
                activeJob: null,
                lastJob: null,
              };
            else if (request.command === "databaseRows") {
              const {
                table,
                q,
                page: resultPage = 1,
                filterColumn,
                filterValue,
                sortColumn,
                sortDescending,
              } = request.payload;
              if (table === "accounts")
                result = {
                  table,
                  page: resultPage,
                  pageSize: 2,
                  total: 1,
                  rows: [{ id: accountId, display_name: "المدير" }],
                };
              else {
                const rows = (table === "background_jobs" ? jobs : audits)
                  .filter(
                    (row) =>
                      (!q || JSON.stringify(row).includes(q)) &&
                      (!filterColumn ||
                        Object.entries(row).some(
                          ([key, value]) => key === filterColumn && value === filterValue,
                        )),
                  )
                  .toSorted((a, b) =>
                    sortColumn === "created_at"
                      ? a.created_at.localeCompare(b.created_at) * (sortDescending ? -1 : 1)
                      : a.id.localeCompare(b.id),
                  );
                result = {
                  table,
                  page: resultPage,
                  pageSize: 2,
                  total: rows.length,
                  rows: rows.slice((resultPage - 1) * 2, resultPage * 2),
                };
              }
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

test("activity orders and filters jobs, preserves URL history, and opens read-only details", async ({
  page,
}) => {
  await page.goto("/#/admin/activity");
  await expect(page.getByRole("heading", { name: "نشاط الخادم", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  const records = page.getByRole("button", { name: "تفاصيل المهمة catalog.refresh", exact: true });
  await records.first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("c-new");
  await expect(
    dialog.getByRole("button", { name: "طلب إلغاء المهمة", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByText("المدير", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(records.first()).toBeFocused();
  await page.getByRole("button", { name: "التالي", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await records.first().click();
  await expect(dialog).toContainText("a-old");
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "حالة المهمة", exact: true }).click();
  await page.getByRole("option", { name: "متعذّرة", exact: true }).click();
  await expect(page).toHaveURL(/jobState=failed/);
  await expect(records).toHaveCount(1);
  await records.first().click();
  await expect(dialog).toContainText("تعذّر الاتصال بمصدر الصور");
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(page).toHaveURL(/page=2/);
  await page.screenshot({ path: "../../../data/previews/admin-activity-jobs.png" });
});

test("audit timeline opens masked details and the full activity layout fits narrow windows", async ({
  page,
}) => {
  await page.goto("/#/admin/activity?tab=logs");
  await page.getByRole("button", { name: "تفاصيل العملية تغيير اسم المكتبة", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("المدير", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "البيانات المسجّلة كاملة", exact: true }).click();
  await expect(dialog).toContainText("[protected]");
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "../../../data/previews/admin-activity-logs.png" });
  await page.getByRole("combobox", { name: "الترتيب", exact: true }).click();
  await page.getByRole("option", { name: "الأقدم أولًا", exact: true }).click();
  await expect(page).toHaveURL(/order=oldest/);
  await page.getByRole("button", { name: "تفاصيل العملية حفظ بيانات عمل", exact: true }).click();
  await expect(dialog).toContainText("audit-old");
  await expect(dialog.getByText("دون حساب مرتبط", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("البحث في سجل العمليات", { exact: true }).fill("غير موجود");
  await page.getByRole("button", { name: "بحث", exact: true }).click();
  await expect(page.getByText("لا توجد سجلات مطابقة", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "مسح المرشحات", exact: true }).click();
  await expect(page.getByRole("button", { name: /تفاصيل العملية/ })).toHaveCount(2);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../../../data/previews/admin-activity-narrow.png" });
});

import { LoginResponseSchema, ServerOverviewSchema } from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";

test.skip(
  process.env.NAHHASIO_BROWSER_DEVELOPMENT_TEST !== "1",
  "Opt in to the dedicated local demo API; ordinary UI tests remain isolated fixtures.",
);

test.beforeEach(async ({ request }) => {
  const response = await request.get("/__development_api/v1/server/info");
  expect(
    (await response.json()).serverId,
    "Mutation acceptance requires the synthetic demo server",
  ).toBe("97900000-0000-4000-8000-000000000001");
});

test("local browser signs in, edits demo settings, displays artwork and keeps sessions transient", async ({
  page,
}) => {
  await page.goto("/#/admin/settings");
  await expect(page.getByRole("heading", { name: "من يشاهد؟", exact: true })).toBeVisible();
  await expect(page.getByText("متصل بالمكتبة", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني", exact: true }).click();
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill("admin@demo.local");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("demo12345");
  await page.getByRole("button", { name: "دخول المكتبة", exact: true }).click();
  await expect(page.getByRole("heading", { name: "الإعدادات والاتصالات", exact: true })).toBeVisible({
    timeout: 25000,
  });
  await expect(page.getByRole("note")).toContainText("معاينة تطوير محلية");
  expect(await page.evaluate(() => Boolean(window.webkit?.messageHandlers?.nahhasio))).toBe(false);
  const name = page.getByLabel("اسم الخادم", { exact: true });
  const original = await name.inputValue();
  try {
    await name.fill(`${original} — اختبار المتصفح`);
    await page.getByRole("button", { name: "حفظ الاسم", exact: true }).click();
    await expect(name).toBeEnabled();
    await expect(name).toHaveValue(`${original} — اختبار المتصفح`);
  } finally {
    await name.fill(original);
    await page.getByRole("button", { name: "حفظ الاسم", exact: true }).click();
    await expect(name).toBeEnabled();
    await expect(name).toHaveValue(original);
  }
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/browser-development-admin.png" });
  await page.getByRole("link", { name: "العودة إلى المكتبة", exact: true }).click();
  await expect.poll(() => page.locator('img[src^="blob:"]').count()).toBeGreaterThan(0);
  const images = page.locator('img[src^="blob:"]');
  await expect
    .poll(() =>
      images.evaluateAll((items) =>
        items.some((item) => item instanceof HTMLImageElement && item.naturalWidth > 0),
      ),
    )
    .toBe(true);
  const stored = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(stored).not.toMatch(/demo12345|nh1_|nhr1_|Bearer/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "من يشاهد؟", exact: true })).toBeVisible();
});

test("local proxy preserves authentication, member permissions and origin restrictions", async ({
  request,
}) => {
  const anonymous = await request.get("/__development_api/v1/catalog/home");
  expect(anonymous.status()).toBe(401);
  const foreignOrigin = await request.get("/__development_api/v1/server/info", {
    headers: { Origin: "https://untrusted.invalid" },
  });
  expect(foreignOrigin.status()).toBe(403);
  const foreignHost = await request.get("/__development_api/v1/server/info", {
    headers: { Host: "untrusted.invalid" },
  });
  expect(foreignHost.status()).toBe(403);
  const login = await request.post("/__development_api/v1/auth/login", {
    data: { email: "friend@demo.local", password: "demo12345", remember: false },
  });
  const session = LoginResponseSchema.parse(await login.json());
  const headers = { Authorization: `Bearer ${session.token}` };
  try {
    expect((await request.get("/__development_api/v1/catalog/home", { headers })).status()).toBe(
      200,
    );
    expect((await request.get("/__development_api/v1/admin/access", { headers })).status()).toBe(
      403,
    );
    expect(
      (await request.get("/__development_api/v1/admin/server/settings", { headers })).status(),
    ).toBe(403);
  } finally {
    await request.post("/__development_api/v1/auth/logout", { headers, data: {} });
  }
});

test("accounts workspace uses exact, protected-column-safe admin reads against the demo API", async ({
  page,
  request,
}) => {
  const login = await request.post("/__development_api/v1/auth/login", {
    data: { email: "admin@demo.local", password: "demo12345", remember: false },
  });
  const session = LoginResponseSchema.parse(await login.json());
  const headers = { Authorization: `Bearer ${session.token}` };
  const endpoint = "/__development_api/v1/admin/database/accounts";
  try {
    const exact = await request.get(endpoint, {
      headers,
      params: { filterColumn: "id", filterValue: session.user.accountId },
    });
    expect(exact.status()).toBe(200);
    const result = await exact.json();
    expect(result.total).toBe(1);
    expect(result.rows.map((row: { id: string }) => row.id)).toEqual([session.user.accountId]);
    expect(
      (await request.get(endpoint, { headers, params: { filterColumn: "id" } })).status(),
    ).toBe(400);
    expect(
      (
        await request.get(endpoint, {
          headers,
          params: { filterColumn: "id);select", filterValue: "x" },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.get("/__development_api/v1/admin/database/auth_sessions", {
          headers,
          params: { filterColumn: "token", filterValue: "x" },
        })
      ).status(),
    ).toBe(400);
    expect((await request.get(endpoint)).status()).toBe(401);
  } finally {
    await request.post("/__development_api/v1/auth/logout", { headers, data: {} });
  }
  await page.goto("/#/admin/accounts");
  await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني", exact: true }).click();
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill("admin@demo.local");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("demo12345");
  await page.getByRole("button", { name: "دخول المكتبة", exact: true }).click();
  await expect(page.getByRole("heading", { name: "حسابات المكتبة", exact: true })).toBeVisible({
    timeout: 25000,
  });
  await page
    .getByRole("button", { name: /فتح حساب/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/@demo.local/, { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "الجلسات", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "الجلسات المسجّلة", exact: true })).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "الصلاحيات والمحتوى", exact: true }).click();
  await expect(dialog.getByRole("switch", { name: "عرض المكتبة", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "المشاهدة والتفاعل", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "بيانات المشاهدة والتفاعل", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await page.keyboard.press("Escape");
  if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
    await page.screenshot({ path: "../../../data/previews/browser-development-accounts.png" });
});

test("overview type counts agree with combined administrative Browse-equivalent filters", async ({
  request,
}) => {
  const login = await request.post("/__development_api/v1/auth/login", {
    data: { email: "admin@demo.local", password: "demo12345", remember: false },
  });
  const session = LoginResponseSchema.parse(await login.json());
  const headers = { Authorization: `Bearer ${session.token}` };
  try {
    const response = await request.get("/__development_api/v1/admin/server/overview", { headers });
    expect(response.status()).toBe(200);
    const overview = ServerOverviewSchema.parse(await response.json());
    expect(overview.insights.kinds).toBeDefined();
    expect(overview.insights.kinds?.reduce((sum, row) => sum + row.value, 0)).toBe(
      overview.counts.works,
    );
    for (const format of ["animated", "live-action"]) {
      for (const structure of ["movie", "series"]) {
        const list = await request.get("/__development_api/v1/admin/works", {
          headers,
          params: { format, structure, page: 1, pageSize: 25 },
        });
        expect(list.status()).toBe(200);
        const result = await list.json();
        expect(result.total).toBe(
          overview.insights.kinds?.find((row) => row.key === `${format}-${structure}`)?.value ?? 0,
        );
      }
    }
  } finally {
    await request.post("/__development_api/v1/auth/logout", { headers, data: {} });
  }
});

test("activity sorting is stable, chronological and rejects protected or invalid columns", async ({
  request,
}) => {
  const login = await request.post("/__development_api/v1/auth/login", {
    data: { email: "admin@demo.local", password: "demo12345", remember: false },
  });
  const session = LoginResponseSchema.parse(await login.json());
  const headers = { Authorization: `Bearer ${session.token}` };
  const endpoint = "/__development_api/v1/admin/database/audit_logs";
  try {
    const params = { sortColumn: "created_at", sortDescending: true, page: 1, pageSize: 5 };
    const response = await request.get(endpoint, { headers, params });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.rows.length).toBeGreaterThan(0);
    const timestamps = data.rows.map((row: { created_at: string }) => Date.parse(row.created_at));
    expect(timestamps).toEqual(timestamps.toSorted((a: number, b: number) => b - a));
    const repeat = await request.get(endpoint, { headers, params });
    expect((await repeat.json()).rows.map((row: { id: string }) => row.id)).toEqual(
      data.rows.map((row: { id: string }) => row.id),
    );
    const ascending = await request.get(endpoint, {
      headers,
      params: { ...params, sortDescending: false },
    });
    const ascendingRows = (await ascending.json()).rows.map((row: { created_at: string }) =>
      Date.parse(row.created_at),
    );
    expect(ascendingRows).toEqual(ascendingRows.toSorted((a: number, b: number) => a - b));
    expect(
      (
        await request.get(endpoint, { headers, params: { sortColumn: "created_at;drop table" } })
      ).status(),
    ).toBe(400);
    expect(
      (await request.get(endpoint, { headers, params: { sortDescending: true } })).status(),
    ).toBe(400);
    expect(
      (
        await request.get("/__development_api/v1/admin/database/auth_sessions", {
          headers,
          params: { sortColumn: "token" },
        })
      ).status(),
    ).toBe(400);
    expect((await request.get(endpoint, { params })).status()).toBe(401);
  } finally {
    await request.post("/__development_api/v1/auth/logout", { headers, data: {} });
  }
});

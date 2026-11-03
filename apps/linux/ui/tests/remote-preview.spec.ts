import { expect, test } from "@playwright/test";

test.skip(
  process.env.NAHHASIO_BROWSER_REMOTE_TEST !== "1",
  "Explicit read-only remote preview acceptance; never authenticates or mutates catalog data.",
);

test("remote preview verifies the selected library and preserves authentication and origin guards", async ({
  page,
  request,
}) => {
  const server = await request.get("/__development_api/v1/server/info");
  expect(server.status()).toBe(200);
  expect((await server.json()).serverId).toBe(process.env.NAHHASIO_BROWSER_SERVER_ID);
  const anonymous = await request.get("/__development_api/v1/catalog/home");
  expect(anonymous.status()).toBe(401);
  const foreign = await request.get("/__development_api/v1/server/info", {
    headers: { Origin: "https://untrusted.invalid" },
  });
  expect(foreign.status()).toBe(403);
  await page.goto("/#/home");
  await expect(page.getByRole("heading", { name: "من يشاهد؟", exact: true })).toBeVisible();
  await expect(page.getByText("متصل بالمكتبة", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

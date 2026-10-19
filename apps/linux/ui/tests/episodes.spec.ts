import type { HomeViewingItem, WorkSummary } from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";

const work: WorkSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  canonicalTitle: "Family library",
  titleAr: "مكتبة العائلة",
  summary: "",
  isPrivate: false,
  score: { rating: null, scored: 0, total: 1 },
  releaseYear: 2026,
  format: "animated",
  audience: "general",
  age: "7+",
  poster: null,
  banner: null,
  logo: null,
  installmentCount: 2,
  episodeCount: 8,
};
const items: HomeViewingItem[] = Array.from({ length: 12 }, (_, index) => ({
  work,
  installmentId: `00000000-0000-4000-8000-${String(index + 20).padStart(12, "0")}`,
  installmentTitle: index % 3 === 0 ? `فيلم ${index + 1}` : "الموسم الأول",
  episodeId:
    index % 3 === 0 ? null : `00000000-0000-4000-8000-${String(index + 40).padStart(12, "0")}`,
  episodeNumber: index % 3 === 0 ? null : String(index + 1),
  episodeTitle: index % 3 === 0 ? null : `حكاية ${index + 1}`,
  releaseDate: "2026-10-01",
  artwork: {
    id: "00000000-0000-4000-8000-000000000099",
    url: "/api/v1/artwork/00000000-0000-4000-8000-000000000099",
    mimeType: "image/png",
    width: 200,
    height: 300,
    byteSize: 1,
    sha256: "fixture",
    originalFilename: "fixture.png",
    focalX: 50,
    focalY: 50,
  },
  positionSeconds: 0,
  durationSeconds: null,
  isPlayed: false,
}));

for (const width of [520, 1440]) {
  test(`episodes grid ${width}: contained movie posters and ordered releases`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((entries) => {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 300;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#544a87";
      context.fillRect(0, 0, 200, 300);
      context.fillStyle = "#dbb26b";
      context.fillRect(30, 35, 140, 180);
      context.fillStyle = "#19182b";
      context.fillRect(65, 70, 70, 140);
      const dataUrl = canvas.toDataURL("image/png");
      window.webkit = {
        messageHandlers: {
          nahhasio: {
            postMessage(message: string) {
              const request = JSON.parse(message);
              let result;
              if (request.command === "session") {
                result = {
                  user: {
                    id: "fixture-owner",
                    name: "العائلة",
                    email: "fixture@example.test",
                    role: "owner",
                    accountId: "00000000-0000-4000-8000-000000000001",
                    kind: "admin",
                    avatarKey: "nahhasio-library.svg",
                    bio: "",
                    isAdmin: true,
                    updatedAt: "2026-10-12T00:00:00Z",
                  },
                  expiresAt: "2099-10-09T00:00:00Z",
                };
              } else if (request.command === "episodes") {
                const kind =
                  request.payload.kind ?? (request.payload.includeMovies ? "all" : "episodes");
                let filtered = entries.filter(
                  (item) =>
                    kind === "all" ||
                    (kind === "movies" ? item.episodeId === null : item.episodeId !== null),
                );
                if (request.payload.visibility === "private") filtered = [];
                if (request.payload.q)
                  filtered = filtered.filter((item) =>
                    item.installmentTitle.includes(request.payload.q),
                  );
                result = { items: filtered, page: 1, pageSize: 36, total: filtered.length };
              } else if (request.command === "artwork") {
                result = { dataUrl };
              } else {
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: false,
                  error: { message: "Unsupported fixture command", code: "bad_request" },
                });
                return;
              }
              queueMicrotask(() =>
                window["__nahhasioReply"]?.({ id: request.id, ok: true, result }),
              );
            },
          },
        },
      };
    }, items);
    await page.goto("/#/episodes");
    const grid = page.locator('div[aria-label="الحلقات والأفلام"]');
    await expect(grid.locator("article")).toHaveCount(8);
    const type = page.getByRole("radiogroup", { name: "نوع الإصدار" });
    const movies = type.getByRole("radio", { name: "الحلقات والأفلام", exact: true });
    await expect(movies).not.toBeChecked();
    await expect(grid.getByRole("heading", { name: "فيلم 1", exact: true })).toHaveCount(0);
    await movies.click();
    await expect(movies).toBeChecked();
    await expect(page).toHaveURL(/kind=all/);
    await expect(grid.locator("article")).toHaveCount(items.length);
    const movie = grid
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "فيلم 1", exact: true }) });
    await expect(movie.getByRole("link")).toHaveText("مكتبة العائلة");
    await expect(movie.locator("button > span").filter({ hasText: /^فيلم 1$/ })).toHaveCount(0);
    await expect(movie.locator("img")).toHaveCount(2);
    await expect(movie.locator("img.object-contain")).toBeVisible();
    const poster = movie.locator("img.object-contain");
    await expect
      .poll(() =>
        poster.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    const paintedPoster = await poster.screenshot();
    await poster.hover();
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await poster.scrollIntoViewIfNeeded();
    expect(await poster.screenshot()).toEqual(paintedPoster);
    expect(
      await movie.locator("img.blur-xl").evaluate((element) => getComputedStyle(element).filter),
    ).toContain("blur");
    const bounds = await grid.locator("article").evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return { top: rect.top, left: rect.left };
      }),
    );
    if (width === 1440) {
      expect(bounds[0].top).toBe(bounds[3].top);
      expect(bounds[0].left).toBeGreaterThan(bounds[1].left);
      expect(bounds[4].top).toBeGreaterThan(bounds[0].top);
    }
    const ratios = await grid.locator("article button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width / rect.height;
      }),
    );
    expect(ratios[0]).toBeCloseTo(16 / 9, 1);
    expect(ratios[1]).toBeCloseTo(16 / 9, 1);
    expect(
      await grid.evaluate(
        (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
      ),
    ).toBe(width === 520 ? 1 : 4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const play = movie.getByRole("button");
    await play.focus();
    await play.press(width === 520 ? "ArrowDown" : "ArrowLeft");
    await expect(play).not.toBeFocused();
    await expect(grid.locator("button:focus, a:focus")).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath("grid.png"), fullPage: true });
    await type.getByRole("radio", { name: "الأفلام", exact: true }).click();
    await expect(grid.locator("article")).toHaveCount(4);
    const visibility = page.getByRole("radiogroup", { name: "ظهور الأعمال" });
    await visibility.getByRole("radio", { name: "المخفية", exact: true }).click();
    await expect(grid.locator("article")).toHaveCount(0);
    await visibility.getByRole("radio", { name: "الظاهرة والمخفية", exact: true }).click();
    await expect(grid.locator("article")).toHaveCount(4);
    const search = page.getByRole("textbox", { name: "البحث باسم العمل أو الحلقة أو الفيلم" });
    await search.fill("no match");
    await expect(grid.locator("article")).toHaveCount(0);
    await page.getByRole("button", { name: "مسح البحث", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(movies).not.toBeChecked();
    await expect(type.getByRole("radio", { name: "الأفلام", exact: true })).toBeChecked();
    await expect(
      visibility.getByRole("radio", { name: "الظاهرة والمخفية", exact: true }),
    ).toBeChecked();
    await expect(grid.locator("article")).toHaveCount(4);
    await type.getByRole("radio", { name: "الحلقات", exact: true }).click();
    await expect(grid.locator("article")).toHaveCount(8);
  });
}

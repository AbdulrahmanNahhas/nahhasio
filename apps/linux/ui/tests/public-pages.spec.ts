import {
  TrackingChangeSchema,
  WorkDetailSchema,
  WorkViewerStateSchema,
} from "@nahhasio/api-contract";
import { expect, test } from "@playwright/test";

test.skip(
  process.env.NAHHASIO_BROWSER_DEVELOPMENT_TEST !== "1",
  "Read-only acceptance against the dedicated local demo catalog.",
);

test.beforeEach(async ({ request }) => {
  const response = await request.get("/__development_api/v1/server/info");
  expect(
    (await response.json()).serverId,
    "Demo credentials must never be sent to a real server",
  ).toBe("97900000-0000-4000-8000-000000000001");
});

for (const width of [360, 1440]) {
  test(`public page review ${width}: navigation, consistent framing and honest states`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto("/#/home");
    await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني", exact: true }).click();
    await page.getByLabel("البريد الإلكتروني", { exact: true }).fill("admin@demo.local");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("demo12345");
    await page.getByRole("button", { name: "دخول المكتبة", exact: true }).click();
    await expect(page.getByRole("region", { name: "أحدث الأعمال", exact: true })).toBeVisible({
      timeout: 25000,
    });
    await expect(
      page
        .getByRole("region", { name: "أحدث الأعمال", exact: true })
        .getByText("للجميع", { exact: true }),
    ).toBeVisible();
    const destinations = [
      ["تصفّح المكتبة", "تصفّح المكتبة"],
      ["البحث", "البحث في المكتبة"],
      ["الكواكب", "الكواكب"],
      ["الصنّاع", "الصنّاع"],
      ["الاستوديوهات", "الاستوديوهات"],
      ["الحلقات", "الحلقات"],
      ["التقويم", "تقويم المكتبة"],
      ["الشارات والإعلانات التشويقية", "الشارات والإعلانات التشويقية"],
    ];
    for (const [label, heading] of destinations) {
      const catalogPath =
        label === "الحلقات"
          ? "/__development_api/v1/catalog/episodes"
          : label === "الشارات والإعلانات التشويقية"
            ? "/__development_api/v1/catalog/trailers"
            : null;
      const catalogResponse = catalogPath
        ? page.waitForResponse((response) => new URL(response.url()).pathname === catalogPath)
        : null;
      if (width < 768) {
        await page.getByRole("button", { name: "كل الصفحات", exact: true }).click();
        await page
          .getByRole("dialog", { name: "كل الصفحات", exact: true })
          .getByRole("link", { name: label, exact: true })
          .click();
        await expect(
          page.locator('[data-slot="drawer-popup"][aria-label="كل الصفحات"]'),
        ).toHaveCount(0);
      } else
        await page
          .getByRole("navigation", { name: "التنقل الرئيسي", exact: true })
          .getByRole("link", { name: label, exact: true })
          .click();
      await expect(
        page.getByRole("heading", { name: heading, exact: true, level: 1 }),
      ).toBeVisible();
      if (catalogResponse) expect((await catalogResponse).status()).toBe(200);
      await expect(page.getByRole("alert")).toHaveCount(0);
      expect(
        await page
          .locator("#main-content")
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (["الكواكب", "الصنّاع"].includes(label))
        if (process.env.NAHHASIO_UI_SCREENSHOTS === "1")
          await page.screenshot({
            path: `../../../data/previews/public-${label === "الكواكب" ? "planets" : "people"}-${width}.png`,
          });
    }
    expect(failures).toEqual([]);
  });
}

test("episode cards on both surfaces open the selected episode in the player page", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let fixtureWork: ReturnType<typeof WorkDetailSchema.parse> | undefined;
  await page.route(/\/__development_api\/v1\/works\/[0-9a-f-]+$/, async (route) => {
    const response = await route.fetch();
    const work = WorkDetailSchema.parse(await response.json());
    fixtureWork = work;
    await route.fulfill({ response, json: work });
  });
  let viewerState: ReturnType<typeof WorkViewerStateSchema.parse> | undefined;
  const trackingWrites: ReturnType<typeof TrackingChangeSchema.parse>[] = [];
  await page.route(/\/__development_api\/v1\/works\/[0-9a-f-]+\/state$/, async (route) => {
    const response = await route.fetch();
    const state = WorkViewerStateSchema.parse(await response.json());
    state.units = state.units.map((unit) => ({ ...unit, isPlayed: false, playedManually: false }));
    viewerState = state;
    await route.fulfill({ response, json: state });
  });
  await page.route(/\/__development_api\/v1\/works\/[0-9a-f-]+\/tracking$/, async (route) => {
    const body = TrackingChangeSchema.parse(route.request().postDataJSON());
    trackingWrites.push(body);
    const state = WorkViewerStateSchema.parse(viewerState);
    await route.fulfill({
      json: {
        ...state,
        units: state.units.map((unit) =>
          unit.episodeId === body.episodeId
            ? {
                ...unit,
                isPlayed: true,
                positionSeconds: body.positionSeconds,
                durationSeconds: body.durationSeconds,
              }
            : unit,
        ),
      },
    });
  });
  const fileId = "11111111-1111-4111-8111-111111111111";
  await page.route(/\/__development_api\/v1\/works\/[0-9a-f-]+\/media$/, async (route) => {
    if (!fixtureWork) return route.fulfill({ json: [] });
    const work = fixtureWork;
    await route.fulfill({
      json: work.installments.flatMap((part) =>
        part.episodes.map((episode) => ({
          id: fileId,
          workId: work.id,
          workTitle: work.canonicalTitle,
          installmentId: part.id,
          installmentTitle: part.title,
          episodeId: episode.id,
          episodeTitle: episode.title,
          episodeNumber: episode.number,
          relativePath: null,
          byteSize: null,
          durationSeconds: null,
          availability: "present",
          probeMetadata: {},
          lastVerifiedAt: null,
          sha256: null,
          isTrashed: false,
          trashExpiresAt: null,
        })),
      ),
    });
  });
  await page.route(
    /^https:\/\/(vidora\.ac|embed\.vidrift\.net|vidsrc\.sh|vidnest\.fun|cinextream\.cc|vidlink\.pro|player\.vidzee\.wtf)\//,
    (route) => route.fulfill({ contentType: "text/html", body: "<p>Embed fixture</p>" }),
  );
  await page.goto("/#/episodes");
  await page.getByRole("button", { name: "الدخول بالبريد الإلكتروني", exact: true }).click();
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill("admin@demo.local");
  await page.getByLabel("كلمة المرور", { exact: true }).fill("demo12345");
  await page.getByRole("button", { name: "دخول المكتبة", exact: true }).click();

  const card = page.locator("[data-episode-card]").first();
  const thumbnail = card.locator("button[data-episode-primary]");
  const catalogTitle = await card.getByRole("heading").innerText();
  const player = page.getByRole("main", { name: "صفحة المشاهدة", exact: true });
  await thumbnail.focus();
  await page.keyboard.down("Enter");
  await expect(thumbnail.locator("..")).toHaveCSS("scale", "0.98");
  await expect(player).toHaveCount(0);
  await page.keyboard.up("Enter");
  await expect(player.getByRole("heading", { name: catalogTitle, exact: true })).toBeVisible();
  await expect(player.getByText("لم يُستورد فيديو لهذه الحلقة إلى مكتبة المنزل.")).toHaveCount(0);
  const iframe = player.locator('iframe[title="Vidora"]');
  await expect(iframe).toHaveAttribute(
    "src",
    /anime\/23273\/\d+\/dub\?autoplay=false&nextbutton=false$/,
  );
  await expect(iframe).not.toHaveAttribute("sandbox");
  await expect(iframe.contentFrame().getByText("Embed fixture")).toBeVisible();
  await expect.poll(() => Boolean(viewerState)).toBe(true);
  const vidora = page.frames().find((frame) => frame.url().startsWith("https://vidora.ac/"))!;
  const episodeNumber = Number(new URL(vidora.url()).pathname.split("/")[3]);
  const report = (position: number, reportedEpisode: number) =>
    vidora.evaluate(
      ({ time, episode }) => {
        parent.postMessage(
          {
            type: "PLAYER_EVENT",
            data: {
              event: "timeupdate",
              currentTime: time,
              duration: 100,
              mediaType: "tv",
              tmdbId: 61663,
              season: 1,
              episode,
            },
          },
          "http://127.0.0.1:23110",
        );
      },
      { time: position, episode: reportedEpisode },
    );
  await report(89, episodeNumber);
  await report(95, episodeNumber - 1);
  await expect(player.getByText("انتقل المشغّل إلى حلقة أخرى.")).toBeVisible();
  expect(trackingWrites).toHaveLength(0);
  await player.getByRole("button", { name: "العودة إلى الحلقة المحددة", exact: true }).click();
  await expect(iframe.contentFrame().getByText("Embed fixture")).toBeVisible();
  const retryFrame = page.frames().find((frame) => frame.url().startsWith("https://vidora.ac/"))!;
  await retryFrame.evaluate((episode) => {
    parent.postMessage(
      {
        type: "PLAYER_EVENT",
        data: {
          event: "timeupdate",
          currentTime: 90,
          duration: 100,
          mediaType: "tv",
          tmdbId: 61663,
          season: 1,
          episode,
        },
      },
      "http://127.0.0.1:23110",
    );
  }, episodeNumber);
  await expect.poll(() => trackingWrites.length).toBe(1);
  expect(trackingWrites[0]).toMatchObject({
    isPlayed: null,
    positionSeconds: 90,
    durationSeconds: 100,
  });
  const sourceMenu = player.getByRole("button", { name: "مصدر الفيديو", exact: true });
  const videoFrame = player.getByLabel("منطقة الفيديو", { exact: true });
  const previous = player.getByRole("button", { name: "السابقة", exact: true });
  await expect(player.getByRole("link", { name: "تفاصيل التقييم", exact: true })).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const video = (await videoFrame.boundingBox())!;
    const menu = (await sourceMenu.boundingBox())!;
    const arrows = (await previous.boundingBox())!;
    expect(video.width / video.height).toBeCloseTo(16 / 9, 1);
    expect(menu.y).toBeGreaterThanOrEqual(video.y + video.height);
    expect(Math.abs(menu.y + menu.height / 2 - arrows.y - arrows.height / 2)).toBeLessThan(2);
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width);
  }
  await expect(previous.getByText("السابقة", { exact: true })).toBeVisible();
  await sourceMenu.click();
  await expect(
    page.getByRole("menuitem", { name: "تورنت تطبيق Linux", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await player.getByRole("button", { name: "المصدر التالي", exact: true }).click();
  await expect(player.locator('iframe[title="VidRift"]')).toHaveAttribute(
    "src",
    /embed\.vidrift\.net.*dub=1$/,
  );
  await expect(
    player.locator('iframe[title="VidRift"]').contentFrame().getByText("Embed fixture"),
  ).toBeVisible();
  const vidrift = page
    .frames()
    .find((candidate) => candidate.url().startsWith("https://embed.vidrift.net/"))!;
  await vidrift.evaluate((episode) => {
    parent.postMessage(
      { type: "vidrift:episode", mediaType: "tv", tmdbId: 61663, season: 1, episode },
      "http://127.0.0.1:23110",
    );
  }, episodeNumber - 1);
  await expect(player.getByText("انتقل المشغّل إلى حلقة أخرى.")).toBeVisible();
  await sourceMenu.click();
  await page.getByRole("menuitemradio", { name: "Cinextream دبلجة", exact: true }).click();
  const cinextream = player.locator('iframe[title="Cinextream"]');
  await expect(cinextream.contentFrame().getByText("Embed fixture")).toBeVisible();
  const pageFrame = page
    .frames()
    .find((frame) => frame.url().startsWith("https://cinextream.cc/"))!;
  await pageFrame.evaluate(() =>
    parent.postMessage(
      { event: "player_error", reason: "all_servers_failed" },
      "http://127.0.0.1:23110",
    ),
  );
  await expect(player.locator('iframe[title="VidSrc"]')).toBeVisible();
  await sourceMenu.click();
  await page.getByRole("menuitem", { name: "مصادر مترجمة", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Vidora ترجمة", exact: true }).click();
  await expect(iframe).toHaveAttribute("src", /\/sub\?/);
  await sourceMenu.click();
  await page.getByRole("menuitem", { name: "فتح رابط فيديو", exact: true }).click();
  const videoUrl = player.getByLabel("رابط الفيديو", { exact: true });
  const play = player.getByRole("button", { name: "تشغيل الفيديو", exact: true });
  await videoUrl.fill("http://video.example/episode.mp4");
  await play.click();
  await expect(player.getByRole("alert")).toContainText("HTTPS");
  const clip = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const recorded = new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (event) => resolve(event.data);
    });
    recorder.start();
    context.fillRect(0, 0, canvas.width, canvas.height);
    await new Promise((resolve) => setTimeout(resolve, 250));
    recorder.stop();
    const blob = await recorded;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.route("https://video.example/episode.webm", (route) =>
    route.fulfill({ contentType: "video/webm", body: Buffer.from(clip) }),
  );
  await videoUrl.fill("https://video.example/episode.webm");
  await play.click();
  await expect(player.locator("video")).toHaveAttribute(
    "src",
    "https://video.example/episode.webm",
  );
  await expect
    .poll(() => player.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeGreaterThan(0);
  await player.getByRole("button", { name: "خوادم الفيديو", exact: true }).click();
  await expect(player.locator("video")).toHaveCount(0);
  await page.route(/\/__development_video\/[a-f0-9-]{36}$/, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ contentType: "video/webm", body: Buffer.from(clip) })
      : route.continue(),
  );
  const granted = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/__development_video/${fileId}`),
  );
  await sourceMenu.click();
  await page.getByRole("menuitem", { name: "تشغيل من المنزل", exact: true }).click();
  const grant = await granted;
  expect(grant.status()).toBe(201);
  expect(await grant.headerValue("set-cookie")).toContain("HttpOnly");
  const { url } = await grant.json();
  expect((await request.get(url)).status()).toBe(404);
  expect(
    (
      await request.post(`/__development_video/${fileId}`, {
        headers: { Origin: "http://127.0.0.1:23110" },
      })
    ).status(),
  ).toBe(401);
  await expect(player.locator("video")).toHaveAttribute("src", url);
  await expect
    .poll(() => player.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeGreaterThan(0);
  const revoked = page.waitForResponse(
    (response) => response.request().method() === "DELETE" && response.url().endsWith(url),
  );
  await player.getByRole("button", { name: "خوادم الفيديو", exact: true }).click();
  expect((await revoked).status()).toBe(204);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const workTitle = fixtureWork!.titleAr || fixtureWork!.canonicalTitle;
  const backToWork = player.getByRole("button", { name: workTitle, exact: true });
  await backToWork.click();
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي", exact: true })
    .getByRole("link", { name: "الحلقات", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/episodes$/);

  await card.getByRole("link").click();
  const installmentCard = page.getByRole("article", { name: /^الحلقة / }).first();
  const installmentTitle = await installmentCard.getByRole("heading").innerText();
  await installmentCard.locator("button[data-episode-primary]").click();
  await expect(player.getByRole("heading", { name: installmentTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await backToWork.click();
  await expect(player).toHaveCount(0);
});

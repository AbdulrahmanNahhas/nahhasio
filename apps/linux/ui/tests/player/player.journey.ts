import { expect, test, type Page } from "@playwright/test";

import type { PlayerRequest, PlayerSnapshot } from "../../src/features/player/bridge";

type TestRequest =
  | PlayerRequest
  | { command: "media.search" | "media.downloadSearch"; payload: { sessionId: string } }
  | {
      command: "media.play" | "media.download";
      payload: { sessionId: string; sourceId: string; fileIndex: number | null };
    }
  | { command: "media.jobs"; payload: Record<string, never> }
  | { command: "media.pause" | "media.resume"; payload: { id: string } }
  | { command: "media.keep"; payload: { sessionId: string } }
  | { command: "media.local"; payload: { sessionId: string } }
  | { command: "media.deleteCache"; payload: Record<string, never> }
  | { command: "artwork"; payload: { id: string } };

declare global {
  interface Window {
    playerTest: { calls: TestRequest[]; update: (changes: Partial<PlayerSnapshot>) => void };
  }
}

const initial: PlayerSnapshot = {
  active: true,
  sessionId: "test-1",
  title: "فيديو الاختبار المحلي",
  sourceKind: "local",
  paused: true,
  position: 20,
  duration: 120,
  seekable: true,
  volume: 75,
  muted: false,
  speed: 1,
  buffering: false,
  ended: false,
  fullscreen: false,
  audioDelay: 0,
  subtitleDelay: 0,
  subtitleSize: 55,
  subtitlePosition: 100,
  tracks: [
    {
      id: 1,
      kind: "audio",
      title: null,
      language: "ara",
      codec: "aac",
      selected: true,
      external: false,
    },
    {
      id: 2,
      kind: "subtitle",
      title: "ترجمة الملف",
      language: "en",
      codec: "srt",
      selected: true,
      external: false,
    },
  ],
  hwdec: null,
  videoCodec: "h264",
  error: null,
};

async function mock(page: Page, snapshot = initial, scenario = "") {
  await page.addInitScript((fixture: PlayerSnapshot) => {
    let state = fixture;
    let staleAfterClose: PlayerSnapshot | null = null;
    const requests: TestRequest[] = [];
    Object.assign(window, {
      playerTest: {
        calls: requests,
        update: (changes: Partial<PlayerSnapshot>) => {
          state = { ...state, ...changes };
        },
      },
    });
    window.webkit = {
      messageHandlers: {
        nahhasio: {
          postMessage: (message: string) => {
            // SAFETY: this isolated fixture bridge receives only the typed player/media/artwork callers.
            const request = JSON.parse(message) as { id: string } & TestRequest;
            requests.push(request);
            switch (request.command) {
              case "artwork": {
                const canvas = document.createElement("canvas");
                canvas.width = 320;
                canvas.height = 180;
                const ctx = canvas.getContext("2d")!;
                const hue = Number(request.payload.id.slice(-3)) * 27;
                const gradient = ctx.createLinearGradient(0, 0, 320, 180);
                gradient.addColorStop(0, `hsl(${hue}, 40%, 18%)`);
                gradient.addColorStop(1, `hsl(${hue + 70}, 55%, 55%)`);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 320, 180);
                ctx.fillStyle = "rgba(255,255,255,.3)";
                ctx.beginPath();
                ctx.arc(245, 65, 35, 0, Math.PI * 2);
                ctx.fill();
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: true,
                  result: { dataUrl: canvas.toDataURL("image/png") },
                });
                return;
              }
              case "media.deleteCache":
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: true,
                  result: { removed: 2, skipped: 1 },
                });
                return;
              case "media.local":
                if (window.location.search.includes("scenario=saved")) {
                  state = {
                    ...state,
                    sourceKind: "local",
                    buffering: false,
                    duration: 120,
                    workId: "00000000-0000-4000-8000-000000000001",
                  };
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: true,
                    result: { found: true, snapshot: state },
                  });
                } else {
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: true,
                    result: { found: false },
                  });
                }
                return;
              case "media.downloadSearch":
              case "media.search":
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: true,
                  result: {
                    target: {
                      workId: "00000000-0000-4000-8000-000000000001",
                      installmentId: "00000000-0000-4000-8000-000000000002",
                      episodeId: null,
                      title: fixture.title,
                    },
                    candidates: [
                      {
                        id: "a".repeat(64),
                        label: "Torrentio 1080p",
                        release:
                          "Synthetic Season 1 📁 Synthetic.S01E05.1080p.AV1.mkv 👤 146 💾 279.86 MB ⚙ NyaaSi Audio: English",
                        resolution: 1080,
                        codec: "AV1",
                        hdr: false,
                        sizeBytes: 279860000,
                        seeders: 146,
                        reportedLanguages: ["en", "ar"],
                        available: true,
                      },
                      {
                        id: "b".repeat(64),
                        label: "Torrentio 720p",
                        release:
                          "Synthetic alternative 📁 Synthetic.S01E05.720p.mp4 👤 12 💾 150 MB",
                        resolution: 720,
                        codec: "H.264",
                        hdr: false,
                        sizeBytes: 150000000,
                        seeders: 12,
                        reportedLanguages: [],
                        available: true,
                      },
                    ],
                  },
                });
                return;
              case "media.jobs":
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: true,
                  result: [
                    {
                      id: "download-job",
                      selected: [0],
                      files: [{ index: 0, path: "Synthetic.mkv", size: 1000000 }],
                      status: {
                        verified: 250000,
                        total: 1000000,
                        complete: false,
                        paused: false,
                        error: null,
                        state: "downloading",
                        download_rate: 100000,
                        peers: 4,
                      },
                      exports: [
                        {
                          file: 0,
                          path: "Videos/nahhasio/Synthetic.mkv",
                          available: false,
                          published: false,
                          error: null,
                        },
                      ],
                    },
                  ],
                });
                return;
              case "media.pause":
              case "media.resume":
                window["__nahhasioReply"]?.({ id: request.id, ok: true, result: { ok: true } });
                return;
              case "media.download":
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: true,
                  result: {
                    mode: "downloading",
                    target: {
                      workId: "00000000-0000-4000-8000-000000000001",
                      installmentId: "00000000-0000-4000-8000-000000000002",
                      episodeId: null,
                      title: fixture.title,
                    },
                  },
                });
                return;
              case "media.play":
                state = {
                  ...fixture,
                  active: true,
                  sessionId: state.sessionId,
                  sourceKind: "torrent",
                  buffering: false,
                };
                window["__nahhasioReply"]?.({
                  id: request.id,
                  ok: true,
                  result: { mode: "playing", snapshot: state },
                });
                return;
              case "media.keep":
                window["__nahhasioReply"]?.({ id: request.id, ok: true, result: { ok: true } });
                return;
              case "player.preview":
                state = {
                  ...fixture,
                  active: true,
                  sessionId: "preview-1",
                  sourceKind: null,
                  title: request.payload.title,
                  duration: 0,
                  position: 0,
                  seekable: false,
                  tracks: [],
                };
                staleAfterClose = null;
                break;
              case "player.status":
                break;
              case "player.pickVideo":
                state = { ...fixture, sessionId: "test-2" };
                staleAfterClose = null;
                break;
              case "player.close":
                staleAfterClose = state;
                state = { ...state, active: false, sessionId: null };
                break;
              case "player.pause":
                state = { ...state, paused: request.payload.paused };
                break;
              case "player.seek":
                state = {
                  ...state,
                  position: Math.max(
                    0,
                    Math.min(
                      state.duration,
                      request.payload.seconds + (request.payload.relative ? state.position : 0),
                    ),
                  ),
                };
                break;
              case "player.mute":
                state = { ...state, muted: request.payload.muted };
                break;
              case "player.volume":
                state = { ...state, volume: request.payload.volume };
                break;
              case "player.speed":
                state = { ...state, speed: request.payload.speed };
                break;
              case "player.fullscreen":
                state = { ...state, fullscreen: request.payload.enabled };
                break;
              case "player.track":
                state = {
                  ...state,
                  tracks: state.tracks.map((track) =>
                    track.kind === request.payload.kind
                      ? { ...track, selected: track.id === request.payload.trackId }
                      : track,
                  ),
                };
                break;
              case "player.delay":
                state =
                  request.payload.kind === "audio"
                    ? { ...state, audioDelay: request.payload.seconds }
                    : { ...state, subtitleDelay: request.payload.seconds };
                break;
              case "player.subtitleStyle":
                state = {
                  ...state,
                  subtitleSize: request.payload.size,
                  subtitlePosition: request.payload.position,
                };
                break;
              case "player.pickSubtitle":
                window["__nahhasioReply"]?.({ id: request.id, ok: true, result: null });
                return;
            }
            window["__nahhasioReply"]?.({
              id: request.id,
              ok: true,
              result:
                request.command === "player.status" && staleAfterClose ? staleAfterClose : state,
            });
          },
        },
      },
    };
  }, snapshot);
  await page.goto(`/tests/player/?scenario=${scenario}`);
  if (scenario === "download") await expect(page.getByRole("dialog")).toBeVisible();
  else if (snapshot.active)
    await expect(page.getByRole("region", { name: "مشغّل الفيديو", exact: true })).toBeVisible();
  else await expect(page.getByRole("button", { name: "Watch test work" })).toBeVisible();
}

async function update(page: Page, changes: Partial<PlayerSnapshot>) {
  await page.evaluate((next) => {
    window.playerTest.update(next);
  }, changes);
}
async function calls(page: Page, command: TestRequest["command"]) {
  return page.evaluate((name) => {
    return window.playerTest.calls.filter((call) => call.command === name);
  }, command);
}

test("typed controls and keyboard use native commands, not HTML video", async ({ page }) => {
  await mock(page);
  await expect(page.locator("video")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "إيقاف مؤقت", exact: true })).toBeVisible();
  await page.keyboard.press("l");
  await expect
    .poll(() => calls(page, "player.seek"))
    .toEqual([
      expect.objectContaining({ payload: { sessionId: "test-1", seconds: 10, relative: true } }),
    ]);
  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: "إلغاء كتم الصوت" })).toBeVisible();
  await page.keyboard.press("f");
  await expect(page.getByRole("button", { name: "الخروج من ملء الشاشة" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "ملء الشاشة", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "الصوت", exact: true }).click();
  await expect(page.getByRole("radio", { name: /العربية/ })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "الصوت", exact: true })).toBeFocused();
  expect(await calls(page, "player.close")).toHaveLength(0);
});

test("preview panels never invent playback progress or tracks", async ({ page }) => {
  await mock(page, {
    ...initial,
    sourceKind: null,
    position: 0,
    duration: 0,
    seekable: false,
    tracks: [],
    hwdec: null,
    videoCodec: null,
  });
  await expect(page.getByText("اختر مصدر الفيديو", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "تشغيل", exact: true })).toBeDisabled();
  await expect(page.getByRole("slider", { name: "موضع التشغيل" })).toBeDisabled();
  await page.keyboard.press("Space");
  await page.keyboard.press("m");
  expect(await calls(page, "player.pause")).toHaveLength(0);
  expect(await calls(page, "player.mute")).toHaveLength(0);
  await page.getByRole("button", { name: "الترجمة", exact: true }).click();
  await expect(page.getByRole("button", { name: "إضافة ملف ترجمة" })).toBeDisabled();
  await expect(page.getByText("تظهر المسارات الفعلية بعد فتح الفيديو.")).toBeVisible();
});

test("honest source, episode, subtitle and codec panels", async ({ page }) => {
  await mock(page);
  await page.getByRole("button", { name: "الحلقات", exact: true }).click();
  await expect(page.getByText("هذا الملف غير مرتبط بحلقات")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "مصدر الفيديو", exact: true }).click();
  await expect(page.getByText("مصادر الشبكة غير متاحة في هذا الإصدار.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "الترجمة", exact: true }).click();
  await page.getByRole("radio", { name: "إيقاف الترجمة", exact: true }).check();
  await expect
    .poll(() => calls(page, "player.track"))
    .toEqual([
      expect.objectContaining({
        payload: { sessionId: "test-1", kind: "subtitle", trackId: null },
      }),
    ]);
  await page.getByRole("button", { name: "إضافة ملف ترجمة" }).click();
  await expect.poll(async () => (await calls(page, "player.pickSubtitle")).length).toBe(1);
  await expect(page.getByRole("region", { name: "مشغّل الفيديو", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "إعدادات التشغيل" }).click();
  await expect(page.getByText("h264")).toBeVisible();
  await expect(page.getByText("غير متاح", { exact: true })).toBeVisible();
});

test("saved video plays locally before any Torrentio lookup", async ({ page }) => {
  await mock(page, { ...initial, active: false, sessionId: null }, "saved");
  await page.getByRole("button", { name: "Watch test work" }).click();
  await expect(page.getByRole("button", { name: "مصدر الفيديو", exact: true })).toBeVisible();
  await expect.poll(async () => (await calls(page, "media.local")).length).toBe(1);
  expect(await calls(page, "media.search")).toHaveLength(0);
  expect(await calls(page, "media.play")).toHaveLength(0);
});

test("cache cleanup requires confirmation and reports skipped jobs", async ({ page }) => {
  await mock(page, { ...initial, active: false, sessionId: null }, "cache");
  await page.getByRole("button", { name: "حذف الذاكرة المؤقتة للتنزيلات" }).click();
  expect(await calls(page, "media.deleteCache")).toHaveLength(0);
  await page.getByRole("button", { name: "تأكيد حذف الذاكرة المؤقتة" }).click();
  await expect(page.getByText("اكتمل التنظيف", { exact: true })).toBeVisible();
  await expect.poll(async () => (await calls(page, "media.deleteCache")).length).toBe(1);
});

test("download intent chooses a torrent without starting playback", async ({ page }) => {
  await mock(
    page,
    {
      ...initial,
      active: false,
      sessionId: null,
      sourceKind: null,
      duration: 0,
      tracks: [],
      seekable: false,
    },
    "download",
  );
  await expect(page.getByRole("button", { name: "تنزيل هذا المصدر" })).toHaveCount(2);
  expect(await calls(page, "media.download")).toHaveLength(0);
  await page.getByRole("button", { name: "تنزيل هذا المصدر" }).first().click();
  await expect(page.getByText("جارٍ التنزيل", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  await page.screenshot({ path: test.info().outputPath("download-progress.png") });
  await page.setViewportSize({ width: 520, height: 760 });
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("download-progress-narrow.png") });
  await page.getByRole("button", { name: "إيقاف مؤقت", exact: true }).click();
  await expect.poll(async () => (await calls(page, "media.pause")).length).toBe(1);
  expect(await calls(page, "player.preview")).toHaveLength(0);
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(async () => (await calls(page, "media.download")).length).toBe(1);
  expect(await calls(page, "media.play")).toHaveLength(0);
});

test("radio values select numeric native audio and subtitle tracks", async ({ page }) => {
  await mock(page, {
    ...initial,
    tracks: [
      ...initial.tracks,
      {
        id: 7,
        kind: "audio",
        title: "English dub",
        language: "en",
        codec: "aac",
        selected: false,
        external: false,
      },
    ],
  });
  await page.getByRole("button", { name: "الصوت", exact: true }).click();
  await page.getByRole("button", { name: /الإنجليزية · 1 مسارات/ }).click();
  const dub = page.getByRole("radio", { name: /English dub/ });
  await dub.check();
  await expect(dub).toBeChecked();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "الترجمة", exact: true }).click();
  await page.getByRole("radio", { name: "إيقاف الترجمة", exact: true }).check();
  const subtitle = page.getByRole("radio", { name: /ترجمة الملف/ });
  await subtitle.check();
  await expect(subtitle).toBeChecked();
  await expect
    .poll(() => calls(page, "player.track"))
    .toEqual([
      expect.objectContaining({ payload: { sessionId: "test-1", kind: "audio", trackId: 7 } }),
      expect.objectContaining({
        payload: { sessionId: "test-1", kind: "subtitle", trackId: null },
      }),
      expect.objectContaining({ payload: { sessionId: "test-1", kind: "subtitle", trackId: 2 } }),
    ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("closed sessions cannot be reopened by late snapshots; fresh picker can open", async ({
  page,
}) => {
  await mock(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open test video" })).toBeVisible();
  await page.waitForTimeout(1300);
  await expect(page.locator(".player-host")).toHaveCount(0);
  await page.getByRole("button", { name: "Open test video" }).click();
  await expect(page.getByRole("region", { name: "مشغّل الفيديو", exact: true })).toBeVisible();
});

test("scrubbing retains draft over remote polling and focused slider consumes arrows", async ({
  page,
}) => {
  await mock(page);
  const slider = page.getByRole("slider", { name: "موضع التشغيل" });
  const track = page.locator(".player-timeline .player-slider-track");
  const bounds = await track.boundingBox();
  if (!bounds) throw new Error("Missing timeline");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + 2);
  const draft = await slider.getAttribute("aria-valuenow");
  await update(page, { position: 5 });
  await page.waitForTimeout(500);
  await expect(slider).toHaveAttribute("aria-valuenow", draft!);
  await page.mouse.up();
  await expect.poll(async () => (await calls(page, "player.seek")).length).toBe(1);
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await calls(page, "player.seek")).length).toBe(2);
  const commands = await calls(page, "player.seek");
  expect(
    commands.every((command) => command.command === "player.seek" && !command.payload.relative),
  ).toBe(true);
});

test("auto hide protects menus, focus, pause, ended and errors at 480px RTL", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 720 });
  await mock(page, { ...initial, paused: false });
  await page.waitForTimeout(3200);
  await expect(page.locator(".player-host")).toHaveAttribute("data-controls-hidden", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("slider", { name: "موضع التشغيل", exact: true })).toBeFocused();
  await expect(page.locator(".player-host")).toHaveAttribute("data-controls-hidden", "false");
  await page.mouse.move(200, 300);
  await page.getByRole("button", { name: "الصوت", exact: true }).click();
  await page.waitForTimeout(3200);
  await expect(page.locator(".player-host")).toHaveAttribute("data-controls-hidden", "false");
  await page.keyboard.press("Escape");
  await update(page, { paused: true });
  await page.waitForTimeout(3200);
  await expect(page.locator(".player-host")).toHaveAttribute("data-controls-hidden", "false");
  await update(page, { paused: false, ended: true, seekable: false, duration: 0 });
  await expect(page.getByText("انتهى الفيديو")).toBeVisible();
  await expect(page.getByRole("button", { name: "تقديم 10 ثوانٍ" })).toBeDisabled();
  await update(page, { error: "خطأ الاختبار" });
  await expect(page.getByRole("alert")).toContainText("خطأ الاختبار");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/player-480.png" });
});

test("request and snapshot schemas reject out-of-range, non-finite and path-bearing input", async ({
  page,
}) => {
  await mock(page);
  const results = await page.evaluate((fixture) => {
    const valid = window.playerValidation;
    return [
      valid.request({ command: "player.volume", payload: { sessionId: "test-1", volume: 101 } }),
      valid.request({ command: "player.speed", payload: { sessionId: "test-1", speed: 0 } }),
      valid.request({
        command: "player.delay",
        payload: { sessionId: "test-1", kind: "subtitle", seconds: 601 },
      }),
      valid.request({
        command: "player.track",
        payload: { sessionId: "test-1", kind: "audio", trackId: -1 },
      }),
      valid.request({ command: "player.pickVideo", payload: { path: "/private/video.mkv" } }),
      valid.request({
        command: "player.seek",
        payload: { sessionId: "test-1", seconds: -1, relative: false },
      }),
      valid.snapshot({ ...fixture, duration: Infinity }),
      valid.snapshot({ ...fixture, active: false }),
      valid.request({
        command: "player.subtitleStyle",
        payload: { sessionId: "test-1", size: 55, position: 100 },
      }),
    ];
  }, initial);
  expect(results).toEqual([false, false, false, false, false, false, false, false, true]);
});

test("wide episode shelf shows artwork, exact labels and RTL keyboard navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mock(page, initial, "episodes");
  await expect(page.locator(".player-host header")).toHaveCount(0);
  await page.getByRole("button", { name: "الحلقات", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "الحلقات", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "الموسم الأول" })).toBeVisible();
  await expect(panel.locator("img").first()).toBeVisible();
  await expect(panel).not.toContainText(".00");
  const bounds = await panel.boundingBox();
  const footer = await page.locator(".player-bottom").boundingBox();
  expect(bounds!.width).toBeGreaterThan(1300);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(footer!.y);
  await expect(panel.getByRole("button", { name: "عنوان الحلقة 5", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(panel.getByRole("button", { name: "عنوان الحلقة 6", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(panel.getByRole("button", { name: "عنوان الحلقة 5", exact: true })).toBeFocused();
  await page.screenshot({ path: "test-results/player-episodes-1440.png" });
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "الحلقات", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "الحلقات", exact: true })).toBeFocused();
  await expect(page.getByRole("status", { name: "الحلقة المختارة" })).toHaveText("episode-6");
});

test("episode panel remains contained at narrow width and blocks upcoming episodes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 480, height: 720 });
  await mock(page, initial, "episodes");
  await page.getByRole("button", { name: "الحلقات", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "الحلقات", exact: true });
  const bounds = await panel.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(480);
  await expect(panel.getByRole("button", { name: "عنوان الحلقة 12", exact: true })).toBeDisabled();
  await page.screenshot({ path: "test-results/player-episodes-480.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "الحلقات", exact: true })).toBeFocused();
});

test("Watch opens the right source drawer and never auto-selects a torrent", async ({ page }) => {
  await mock(page, { ...initial, active: false, sessionId: null });
  await page.getByRole("button", { name: "Watch test work" }).click();
  const drawer = page.getByRole("dialog", { name: "مصدر الفيديو", exact: true });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("heading", { name: "Synthetic Season 1", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(700);
  expect(await calls(page, "media.play")).toHaveLength(0);
  const bounds = await drawer.boundingBox();
  const viewport = page.viewportSize()!;
  // The approved floating Drawer has an 8px inset, rather than the old flush Sheet.
  expect(bounds!.x + bounds!.width).toBeCloseTo(viewport.width - 8, 0);
  await expect(drawer.getByText("AV1", { exact: true })).toBeVisible();
  await drawer.getByRole("searchbox", { name: "البحث في المصادر" }).fill("1080");
  await expect(drawer.getByText("1 من 2 مصدر")).toBeVisible();
  await page.screenshot({ path: "test-results/player-sources.png" });
  await drawer.getByRole("button", { name: "تشغيل هذا المصدر", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  expect(await calls(page, "media.play")).toHaveLength(1);
  await expect(page.getByRole("button", { name: "مصدر الفيديو", exact: true })).toBeFocused();
});

test("grouped subtitles search and customization use actual tracks and bounded commands", async ({
  page,
}) => {
  await mock(page, {
    ...initial,
    tracks: [
      ...initial.tracks,
      {
        id: 3,
        kind: "subtitle",
        title: "Forced English",
        language: "en",
        codec: "ass",
        selected: false,
        external: false,
      },
      {
        id: 4,
        kind: "subtitle",
        title: "ترجمة عربية",
        language: "ar",
        codec: "srt",
        selected: false,
        external: true,
      },
    ],
  });
  await page.getByRole("button", { name: "الترجمة", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "الترجمة", exact: true });
  await expect(panel.getByRole("button", { name: /الإنجليزية · 2 مسارات/ })).toBeVisible();
  await panel.getByRole("searchbox", { name: "البحث في الترجمات" }).fill("العربية");
  await expect(panel.getByRole("button", { name: /الإنجليزية · 2 مسارات/ })).toHaveCount(0);
  await panel.getByRole("button", { name: /العربية · 1 مسارات/ }).click();
  await panel.getByRole("radio", { name: /ترجمة عربية/ }).check();
  await expect
    .poll(() => calls(page, "player.track"))
    .toEqual([
      expect.objectContaining({ payload: { sessionId: "test-1", kind: "subtitle", trackId: 4 } }),
    ]);
  await page.screenshot({ path: "test-results/player-subtitles.png" });
  await panel.getByRole("button", { name: "تخصيص الترجمة" }).click();
  const size = panel.getByRole("slider", { name: "حجم الترجمة" });
  await size.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await calls(page, "player.subtitleStyle")).length).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "الترجمة", exact: true })).toBeFocused();
});

test("speed presets, bottom fullscreen control and torrent keep-download remain functional", async ({
  page,
}) => {
  await mock(page, { ...initial, sourceKind: "torrent" });
  await expect(
    page.locator(".player-bottom").getByRole("button", { name: "ملء الشاشة", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".player-tools").getByRole("button", { name: "البث إلى جهاز آخر غير متاح" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "إعدادات التشغيل", exact: true }).click();
  await page.getByRole("button", { name: "السرعة 1.5×", exact: true }).click();
  await expect
    .poll(() => calls(page, "player.speed"))
    .toEqual([expect.objectContaining({ payload: { sessionId: "test-1", speed: 1.5 } })]);
  await page.screenshot({ path: "test-results/player-settings.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "تنزيل الفيديو", exact: true }).click();
  await page.getByRole("button", { name: "الاحتفاظ بتنزيل الفيديو", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "أُضيف إلى قائمة التنزيل", exact: true }),
  ).toBeDisabled();
  expect(await calls(page, "media.keep")).toHaveLength(1);
});

test("native-closed sessions stay closed even without a UI close command", async ({ page }) => {
  await mock(page);
  await update(page, { active: false, sessionId: null });
  await expect(page.locator(".player-host")).toHaveCount(0);
  await update(page, { active: true, sessionId: "test-1" });
  await page.waitForTimeout(1300);
  await expect(page.locator(".player-host")).toHaveCount(0);
});

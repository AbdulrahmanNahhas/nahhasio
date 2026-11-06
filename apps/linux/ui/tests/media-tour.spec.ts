import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { installArtworkFixture } from "./fixtures/artwork";

const reviewRoot = resolve(process.cwd(), "../../../data/previews/media-full-review-2026-11-06");
async function capture(page: Page, name: string) {
  if (process.env.NAHHASIO_MEDIA_SCREENSHOTS !== "1") return;
  await mkdir(reviewRoot, { recursive: true });
  await page.screenshot({ path: resolve(reviewRoot, name), animations: "disabled" });
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installArtworkFixture(page);
  await page.addInitScript(() => {
    const prefix = "b0000000-0000-4000-8000-";
    const id = (number: number) => `${prefix}${String(number).padStart(12, "0")}`;
    const timestamp = "2026-11-06T08:00:00Z";
    const classification = {
      audience: "general",
      age: "all",
      sexualityRisk: "none",
      behavioralRisk: "none",
      theologyRisk: "none",
    };
    const externalIds = { tmdbId: null, imdbId: null, anilistId: null, malId: null };
    const summary = {
      catalogUnits: 6,
      releasedUnits: 6,
      watchedReleasedUnits: 1,
      isFullyWatched: false,
      watchState: "watching",
    };
    const episodes = Array.from({ length: 3 }, (_, index) => ({
      id: id(20 + index),
      number: String(index + 1),
      position: index,
      title: ["حكاية البداية", "يوم في الحي", "لقاء الأصدقاء"][index],
      summary: "حلقة من مكتبة الأسرة.",
      releaseDate: "2026-01-01",
      runtimeMinutes: 25,
      releaseState: "released",
      hasMediaFile: index < 2,
      classification,
      artwork: [],
      mediaFiles: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      still: null,
    }));
    const installments = [
      {
        id: id(11),
        kind: "season",
        position: 1,
        title: "الموسم الأول",
        summary: "",
        releaseDate: "2026-01-01",
        runtimeMinutes: null,
        status: "completed",
        externalIds,
        scores: null,
        hasMediaFile: true,
        artwork: [],
        episodes,
        classification,
        classificationOverrides: {
          audience: null,
          age: null,
          sexualityRisk: null,
          behavioralRisk: null,
          theologyRisk: null,
        },
        releaseState: "released",
        externalReferences: [],
        mediaFiles: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        languages: ["ar"],
      },
    ];
    const work = {
      id: id(10),
      canonicalTitle: "Family stories",
      titleAr: "حكايات العائلة",
      sortTitle: "Family stories",
      summary:
        "مكتبة تجريبية لاستعراض إدارة الفيديوهات والحلقات، الاستيراد، والحفظ المستقل على الجهاز.",
      releaseYear: 2026,
      format: "live-action",
      ...classification,
      poster: null,
      banner: null,
      logo: null,
      installmentCount: 1,
      episodeCount: 3,
      score: { rating: null, scored: 0, total: 1 },
      contentWarnings: null,
      analysisNotes: null,
      externalIds,
      aliases: [],
      trivia: [],
      genres: [],
      contributions: [],
      relations: [],
      artwork: [],
      installments,
      curatorNotes: "",
      qualityScore: 80,
      verifiedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      externalReferences: [],
      tones: [],
      tags: [],
      countries: [],
      planets: [],
      awards: [],
      isPrivate: false,
      playbackPolicy: "torrents-allowed",
      languages: ["ar"],
      dubLanguages: ["ar"],
      dubbingNotes: "",
      trailers: [],
    };
    const document = {
      id: id(10),
      canonicalTitle: work.canonicalTitle,
      titleAr: work.titleAr,
      languages: ["ar"],
      playbackPolicy: "torrents-allowed",
      installments: [
        {
          id: id(11),
          kind: "season",
          position: 1,
          title: "الموسم الأول",
          languages: null,
          episodes: episodes.map((episode) => ({
            id: episode.id,
            number: Number(episode.number),
            position: episode.position,
            title: episode.title,
            summary: episode.summary,
          })),
        },
      ],
    };
    const probeStreams: Record<string, string | number | Record<string, string>>[] = [
      { index: 0, codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
      { index: 1, codec_type: "audio", codec_name: "aac", tags: { language: "ar" } },
    ];
    const files = episodes.slice(0, 2).map((episode, index) => ({
      id: id(100 + index),
      workId: id(10),
      workTitle: work.titleAr,
      installmentId: id(11),
      installmentTitle: "الموسم الأول",
      episodeId: episode.id,
      episodeTitle: episode.title,
      episodeNumber: episode.number,
      relativePath: `series/family-stories/season-1/E00${index + 1}.mkv`,
      byteSize: 800000000,
      durationSeconds: 1500,
      availability: "present",
      probeMetadata: {
        source: index ? "youtube" : "upload",
        probe: {
          streams: probeStreams,
        },
      },
      lastVerifiedAt: timestamp,
      sha256: "a".repeat(64),
      isTrashed: false,
      trashExpiresAt: null,
      revision: "fixture-revision",
    }));
    const viewer = {
      workId: id(10),
      isFavorite: false,
      units: [],
      summary,
      installments: [{ installmentId: id(11), summary }],
    };
    let previewed = false;
    const playlist = {
      phase: "preview",
      title: "حكايات العائلة — قائمة تجريبية",
      entries: [
        {
          videoId: "abcdefghijk",
          title: "الحكاية الأولى",
          durationSeconds: 1500,
          available: true,
        },
        {
          videoId: "lmnopqrstuv",
          title: "الحكاية الثانية",
          durationSeconds: 1520,
          available: true,
        },
        {
          videoId: null,
          title: "فيديو غير متاح",
          durationSeconds: null,
          available: false,
        },
      ],
    };
    const jobs = [
      {
        id: id(200),
        type: "media.import",
        status: "running",
        progress: 55,
        result: {
          phase: "verifying",
          processed: 1,
          total: 2,
          items: [{ fileId: id(100), name: "E001.mp4", status: "completed", error: null }],
        },
        error: null,
        label: "استيراد الموسم الأول",
        createdAt: timestamp,
        cancelRequested: false,
      },
      ...(previewed
        ? [
            {
              id: id(201),
              type: "media.youtube.preview",
              status: "completed",
              progress: 100,
              result: playlist,
              error: null,
              label: "معاينة قائمة YouTube",
              createdAt: timestamp,
              cancelRequested: false,
            },
          ]
        : []),
    ];
    const user = {
      id: "fixture-owner",
      accountId: id(1),
      name: "المدير",
      email: "fixture@example.invalid",
      role: "owner",
      kind: "admin",
      avatarKey: "cars-1.png",
      bio: "",
      isAdmin: true,
      updatedAt: timestamp,
    };
    const savedVideo = {
      id: `home:${id(100)}`,
      file: 0,
      path: "/device/videos/Family-stories/E001.mkv",
      size: 800000000,
      available: true,
      published: true,
      error: null,
      target: { workId: id(10), installmentId: id(11), episodeId: id(20) },
      title: "حكاية البداية",
      workTitle: work.titleAr,
      posterId: null,
    };
    window.webkit = {
      messageHandlers: {
        nahhasio: {
          postMessage(raw: string) {
            const request = JSON.parse(raw);
            const payload = request.payload;
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
                  servers: [{ url: "http://127.0.0.1:23103/", name: "مكتبة التجربة" }],
                };
                break;
              case "offline.status":
                result = {
                  scope: "fixture-device",
                  active: true,
                  offline: false,
                  name: "الأسرة",
                  pending: 0,
                  job: null,
                  conflicts: [],
                };
                break;
              case "offline.list":
                result = [
                  {
                    id: id(10),
                    title: work.titleAr,
                    posterId: null,
                    savedAt: timestamp,
                    images: 12,
                    pending: 0,
                    conflict: false,
                  },
                ];
                break;
              case "work":
                result = work;
                break;
              case "workState":
                result = viewer;
                break;
              case "homeMedia":
                result = files;
                break;
              case "adminWorks":
                result = {
                  items: [
                    {
                      id: id(10),
                      canonicalTitle: work.canonicalTitle,
                      titleAr: work.titleAr,
                      releaseYear: 2026,
                      format: "live-action",
                      workflow: "published",
                      isPrivate: false,
                      updatedAt: timestamp,
                      verifiedAt: null,
                      isSeries: true,
                      installmentCount: 1,
                      episodeCount: 3,
                      posterId: null,
                    },
                  ],
                  page: 1,
                  pageSize: 30,
                  total: 1,
                };
                break;
              case "adminMediaCoverage":
                result = {
                  items: [
                    {
                      workId: id(10),
                      workTitle: work.titleAr,
                      expectedUnits: 3,
                      availableUnits: 2,
                      missingUnits: 1,
                      fileCount: 2,
                    },
                  ],
                  page: 1,
                  pageSize: 30,
                  total: 1,
                };
                break;
              case "adminMedia":
                result = {
                  items: files,
                  page: 1,
                  pageSize: 30,
                  total: files.length,
                  trashBytes: 0,
                  trashFiles: 0,
                };
                break;
              case "adminMediaIncoming":
                result = {
                  files: [
                    {
                      relativePath: payload.q === "uploads" ? "uploads/E001.mp4" : "E001.mp4",
                      byteSize: 800000000,
                      modifiedSeconds: 1793952000,
                    },
                    {
                      relativePath: payload.q === "uploads" ? "uploads/E002.mp4" : "E002.mp4",
                      byteSize: 820000000,
                      modifiedSeconds: 1793952000,
                    },
                  ],
                  folders: [],
                  page: 1,
                  pageSize: 100,
                  total: 2,
                  truncated: false,
                };
                break;
              case "adminMediaJobs":
                result = previewed
                  ? [
                      ...jobs,
                      {
                        id: id(201),
                        type: "media.youtube.preview",
                        status: "completed",
                        progress: 100,
                        result: playlist,
                        error: null,
                        label: "قائمة تجريبية",
                        createdAt: timestamp,
                        cancelRequested: false,
                      },
                    ]
                  : jobs;
                break;
              case "adminMediaYoutube":
                previewed = true;
                result = { id: id(201) };
                break;
              case "media.uploadStatus":
                result = [
                  {
                    id: "upload-scene",
                    name: "E001.mp4",
                    bytes: 800000000,
                    offset: 800000000,
                    status: "completed",
                    error: null,
                  },
                  {
                    id: "upload-active",
                    name: "E002.mp4",
                    bytes: 820000000,
                    offset: 410000000,
                    status: "uploading",
                    error: null,
                  },
                ];
                break;
              case "media.library":
                result = {
                  files: [savedVideo],
                  root: "/device/videos",
                  usedBytes: 800000000,
                  freeBytes: 200000000000,
                };
                break;
              case "media.jobs":
                result = [
                  {
                    id: `home:${id(101)}`,
                    selected: [0],
                    files: [{ index: 0, path: "يوم في الحي", size: 800000000 }],
                    status: {
                      verified: 400000000,
                      total: 800000000,
                      complete: false,
                      paused: true,
                      error: null,
                      state: "paused",
                      download_rate: 0,
                      peers: 0,
                    },
                    exports: [],
                  },
                ];
                break;
              case "editorCall":
                if (payload.operation === "read")
                  result = { result: [{ document, revision: "a".repeat(64) }] };
                else if (payload.operation === "media") result = { result: { id: id(300) } };
                else if (payload.operation === "preview")
                  result = {
                    result: {
                      dataUrl:
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kAAAAABJRU5ErkJggg==",
                    },
                  };
                else result = { result: [] };
                break;
              case "artwork.url":
                result = { url: `nahhasio://app/_artwork/0/${payload.id}/640` };
                break;
              default:
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: {
                      code: "fixture",
                      message: `Unsupported review fixture command: ${request.command}`,
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

test("media tour: work library, folder mapping, uploads, YouTube and durable jobs", async ({
  page,
}) => {
  await page.goto("/#/admin/library");
  await expect(page.getByText("2 متاحًا من 3 حلقة أو فيلم", { exact: false })).toBeVisible();
  await capture(page, "01-admin-work-library.png");
  await page.getByRole("button", { name: "استيراد فيديوهات", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "استيراد فيديوهات إلى الخادم" });
  const workPicker = dialog.getByRole("combobox", { name: "البحث عن عمل", exact: true });
  await workPicker.fill("حكايات");
  await page.getByRole("option", { name: /حكايات العائلة/ }).click();
  await expect(dialog.getByText("E001.mp4", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "ربط تلقائي من أسماء الملفات", exact: true }).click();
  await dialog.getByRole("button", { name: "مراجعة الاستيراد", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "تأكيد الاستيراد", exact: true })).toBeVisible();
  await capture(page, "02-server-folder-review.png");
  await dialog.getByRole("button", { name: "رفع من الجهاز", exact: true }).click();
  await expect(
    dialog.getByText("تم الرفع إلى المجلد المؤقت · حدّد الحلقة أدناه لإكمال الاستيراد.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "حلقة الملف uploads/E001.mp4", exact: true }),
  ).toHaveCount(0);
  await capture(page, "03-client-upload-and-mapping.png");
  await dialog.getByRole("button", { name: "YouTube", exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "رابط فيديو أو قائمة YouTube", exact: true })
    .fill("https://www.youtube.com/playlist?list=PLfixture");
  await dialog.getByRole("button", { name: "معاينة الفيديوهات", exact: true }).click();
  await expect(dialog.getByText("فيديو غير متاح", { exact: true })).toBeVisible();
  await capture(page, "04-youtube-preview-and-mapping.png");
  await page.keyboard.press("Escape");
  await page.goto("/#/admin/downloads");
  await expect(page.getByRole("heading", { name: "مهام وسائط الخادم", exact: true })).toBeVisible();
  await expect(page.getByText("استيراد الموسم الأول", { exact: true })).toBeVisible();
  await capture(page, "05-server-jobs.png");
});

test("media tour: independent saved works, device videos and storage", async ({ page }) => {
  await page.goto("/#/downloads");
  await expect(page.getByRole("heading", { name: "مكتبة الجهاز", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /^الأعمال/ }).click();
  await expect(page.getByText("بيانات العمل كاملة", { exact: true })).toBeVisible();
  await capture(page, "06-device-saved-works.png");
  await page.getByRole("tab", { name: /الفيديوهات/ }).click();
  await expect(page.getByRole("button", { name: "تشغيل", exact: true })).toBeVisible();
  await capture(page, "07-device-videos.png");
  await page.getByRole("tab", { name: "التخزين", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "التخزين", exact: true })).toBeVisible();
  await capture(page, "08-device-storage.png");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

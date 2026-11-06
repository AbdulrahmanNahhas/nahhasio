import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { installArtworkFixture } from "./fixtures/artwork";

for (const width of [1440, 520, 360]) {
  test(`shared episode and file workspace ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await installArtworkFixture(page);
    const captureRoot = resolve(process.cwd(), "../../../data/previews/editor-polish-2026-11-06");
    const capture = async (name: string) => {
      if (process.env.NAHHASIO_MEDIA_SCREENSHOTS !== "1") return;
      await mkdir(captureRoot, { recursive: true });
      await page.screenshot({ path: resolve(captureRoot, name), animations: "disabled" });
    };
    await page.addInitScript(() => {
      const prefix = "00000000-0000-4000-8000-";
      const id = (number: number) => `${prefix}${String(number).padStart(12, "0")}`;
      const user = {
        id: "fixture-admin",
        accountId: id(1),
        name: "المدير",
        email: "fixture@example.test",
        role: "owner",
        kind: "admin",
        avatarKey: "cars-1.png",
        bio: "",
        isAdmin: true,
        updatedAt: "2026-11-06T00:00:00Z",
      };
      let trashed = true;
      const episodes = Array.from({ length: 6 }, (_, i) => ({
        id: id(i + 20),
        number: i + 1,
        position: i,
        title: `حكاية ${i + 1}`,
        summary: "البيانات الأصلية للحلقة",
        releaseDate: "2026-01-01",
        runtimeMinutes: 24,
        media: i === 3 ? {} : { still: "/media/fixture.jpg" },
      }));
      const document = {
        id: id(10),
        canonicalTitle: "Mixed-source show",
        titleAr: "عمل متعدد المصادر",
        languages: ["ar"],
        tmdbId: 321,
        playbackPolicy: "torrents-allowed",
        isPrivate: false,
        workflowStatus: "draft",
        aliases: ["اسم بحث"],
        trivia: ["معلومة عن العمل"],
        installments: [
          {
            id: id(11),
            title: "الموسم الأول",
            kind: "season",
            score: {
              story: 8,
              characters: 7,
              depth: 6,
              worldBuilding: 8,
              originality: 7,
              craft: 8,
            },
            episodes,
          },
          {
            id: id(12),
            title: "الموسم السادس",
            languages: ["en", "ja"],
            kind: "season",
            episodes: [{ id: id(30), number: 1, title: "حلقة من الإنترنت" }],
          },
          { id: id(13), title: "فيلم", kind: "movie", episodes: [] },
        ],
      };
      const files = (episodeId: string) => {
        const index = episodes.findIndex((e) => e.id === episodeId);
        const count = index === 2 ? 2 : [1, 3, 5].includes(index) ? 1 : 0;
        return Array.from({ length: count }, (_, i) => ({
          id: id(100 + index * 10 + i),
          workId: id(10),
          workTitle: "عمل متعدد المصادر",
          installmentId: id(11),
          installmentTitle: "الموسم الأول",
          episodeId,
          episodeTitle: episodes[index]?.title,
          episodeNumber: String(index + 1),
          relativePath: `series/fixture/E00${index + 1}-copy${i}.mkv`,
          byteSize: 1000,
          durationSeconds: 1440,
          availability: index === 3 || (index === 5 && trashed) ? "missing" : "present",
          probeMetadata: {
            source: "server-folder",
            probe: {
              streams: [
                { index: 0, codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
                {
                  index: 1,
                  codec_type: "audio",
                  codec_name: "aac",
                  tags: { language: "ar", title: "الدبلجة العربية" },
                },
                {
                  index: 2,
                  codec_type: "subtitle",
                  codec_name: "subrip",
                  tags: { language: "ar" },
                },
              ],
            },
          },
          lastVerifiedAt: "2026-11-06T00:00:00Z",
          sha256: "a".repeat(64),
          revision: "file-revision",
          isTrashed: index === 5 && trashed,
          trashExpiresAt: index === 5 && trashed ? "2026-11-13T00:00:00Z" : null,
        }));
      };
      window.webkit = {
        messageHandlers: {
          nahhasio: {
            postMessage(raw: string) {
              const request = JSON.parse(raw);
              let result;
              if (request.command === "session")
                result = { user, expiresAt: "2099-01-01T00:00:00Z" };
              else if (request.command === "adminAccess") result = user;
              else if (request.command === "servers.list")
                result = {
                  selected: "http://127.0.0.1:23103/",
                  servers: [{ url: "http://127.0.0.1:23103/", name: "Fixture" }],
                };
              else if (request.command === "offline.status")
                result = {
                  scope: null,
                  active: false,
                  offline: false,
                  name: null,
                  pending: 0,
                  job: null,
                };
              else if (request.command === "editorCall")
                result = {
                  result:
                    request.payload.operation === "read"
                      ? [{ document, revision: "a".repeat(64) }]
                      : request.payload.operation === "episodeImages"
                        ? Array.from({ length: 6 }, (_, index) => ({
                            url: `https://image.tmdb.org/t/p/original/still${index}.jpg`,
                            previewUrl: `https://image.tmdb.org/t/p/w780/still${index}.jpg`,
                            width: 1920,
                            height: 1080,
                          }))
                        : request.payload.operation === "search"
                          ? {
                              candidates: [
                                { provider: "tmdb", language: "ar" },
                                { provider: "fanart", language: "en" },
                                { provider: "tmdb", language: "ja" },
                                { provider: "fanart", language: null },
                                { provider: "anilist", language: "ar" },
                              ].map((candidate, index) => ({
                                ...candidate,
                                externalId: String(index),
                                role: request.payload.data.role,
                                previewUrl: `https://image.tmdb.org/t/p/w500/poster${index}.jpg`,
                                downloadUrl: `https://image.tmdb.org/t/p/original/poster${index}.jpg`,
                                width: 1000,
                                height: 1500,
                                matchLabel: `خيار ${index + 1}`,
                              })),
                              warnings: [],
                            }
                          : request.payload.operation === "preview"
                            ? {
                                dataUrl:
                                  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kAAAAABJRU5ErkJggg==",
                              }
                            : request.payload.operation === "media"
                              ? { id: id(300) }
                              : [],
                };
              else if (request.command === "artwork.url")
                result = { url: `nahhasio://app/_artwork/0/${request.payload.id}/640` };
              else if (request.command === "adminMediaUnits")
                result = (
                  request.payload.episodeIds === "none"
                    ? [null]
                    : request.payload.episodeIds.split(",")
                ).map((episodeId: string | null) => {
                  const copies = episodeId ? files(episodeId) : [];
                  return {
                    episodeId,
                    totalFiles: copies.length,
                    availableFiles: copies.filter(
                      (f) => f.availability === "present" && !f.isTrashed,
                    ).length,
                    missingFiles: copies.filter((f) => f.availability === "missing" && !f.isTrashed)
                      .length,
                    reviewFiles: 0,
                    trashedFiles: copies.filter((f) => f.isTrashed).length,
                    activeImports: episodeId === id(24) ? 1 : 0,
                  };
                });
              else if (request.command === "adminMedia") {
                const items = files(request.payload.episodeIds);
                result = {
                  items,
                  page: 1,
                  pageSize: 10,
                  total: items.length,
                  trashBytes: trashed ? 1000 : 0,
                  trashFiles: trashed ? 1 : 0,
                };
              } else if (request.command === "adminMediaFile") {
                if (request.payload.action === "restore") trashed = false;
                else if (request.payload.action === "trash") trashed = true;
                result = { id: id(200) };
              } else {
                queueMicrotask(() =>
                  window["__nahhasioReply"]?.({
                    id: request.id,
                    ok: false,
                    error: { code: "fixture", message: `Unexpected command ${request.command}` },
                  }),
                );
                return;
              }
              queueMicrotask(() =>
                window["__nahhasioReply"]?.({ id: request.id, ok: true, result }),
              );
            },
          },
        },
      };
    });
    await page.goto("/#/admin/library?workId=00000000-0000-4000-8000-000000000010");
    await expect(page).toHaveURL(/admin\/works\/.*section=structure/);
    await expect(page.getByRole("tab", { name: "الوسائط", exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "بلا ملف على الخادم", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "ملف متاح", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "2 نسخ متاحة", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ملف مفقود من القرص", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "جارٍ الاستيراد", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "في المحذوفات", exact: true })).toBeVisible();
    await expect(page.getByText("حكاية 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "تغيير صورة الحلقة" })).toHaveCount(5);
    await page.getByRole("button", { name: "تورنت / مزوّدون", exact: true }).click();
    await expect(page.getByRole("button", { name: "ملف متاح", exact: true })).toHaveCount(0);
    await expect(page.getByText("حكاية 1", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "الجزء", exact: true }).click();
    await page.getByRole("option", { name: "الموسم السادس", exact: true }).click();
    await expect(page.getByRole("button", { name: "ملفات", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("combobox", { name: "الجزء", exact: true }).click();
    await page.getByRole("option", { name: "الموسم الأول", exact: true }).click();
    await expect(page.getByRole("button", { name: "تورنت / مزوّدون", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "ملفات", exact: true }).click();
    await page.getByRole("tab", { name: "نظرة عامة", exact: true }).click();
    await expect(page.getByRole("button", { name: "عام", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText("مصادر المشاهدة للعمل كله.", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/تظهر كشارات للعمل/)).toHaveCount(0);
    await expect(page.getByRole("progressbar")).toHaveCount(6);
    const facts = page.getByLabel("حقائق ومعلومات", { exact: true });
    await facts.getByRole("button", { name: "تحرير", exact: true }).click();
    await expect(facts.getByRole("textbox", { name: "الحقائق 1", exact: true })).toHaveValue(
      "معلومة عن العمل",
    );
    await facts.getByRole("button", { name: "تحرير", exact: true }).click();
    await expect(page.getByRole("button", { name: "إزالة اسم بحث", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "خاص", exact: true }).click();
    await expect(page.getByRole("button", { name: "خاص", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "عام", exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (process.env.NAHHASIO_MEDIA_SCREENSHOTS === "1")
      await page.screenshot({
        path: resolve(captureRoot, `10-overview-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    await page.getByRole("tab", { name: "البنية", exact: true }).click();
    if (width === 1440) {
      await page.getByRole("tab", { name: "نظرة عامة", exact: true }).click();
      await page.getByRole("button", { name: "ملفات فقط", exact: true }).click();
      await page.getByRole("tab", { name: "البنية", exact: true }).click();
      await expect(page.getByRole("button", { name: "تورنت / مزوّدون", exact: true })).toHaveCount(
        0,
      );
      await expect(page.getByRole("button", { name: "ملف متاح", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "نظرة عامة", exact: true }).click();
      await page.getByRole("button", { name: "ملفات + إنترنت", exact: true }).click();
      await page.getByRole("tab", { name: "البنية", exact: true }).click();
      await capture("00-compact-editor-toolbar.png");
      await page.getByRole("button", { name: "تغيير صورة الحلقة", exact: true }).first().click();
      const artwork = page.getByRole("dialog", { name: "صورة الحلقة 1", exact: true });
      await artwork.getByRole("button", { name: "خيارات TMDB", exact: true }).click();
      await expect(artwork.getByRole("button", { name: /اختيار الصورة ·/ })).toHaveCount(6);
      const bounds = await artwork.boundingBox();
      expect(bounds?.width).toBeGreaterThan(1000);
      await capture("08-expanded-episode-artwork.png");
      await page.keyboard.press("Escape");
    }
    if (process.env.NAHHASIO_MEDIA_SCREENSHOTS === "1") {
      await page.setViewportSize({ width, height: 1000 });
      await page
        .getByText("الحلقات", { exact: true })
        .evaluate((element) => element.scrollIntoView({ block: "start" }));
      await expect(
        page.getByRole("img", { name: "صورة الموسم الأول · 1", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("img", { name: "صورة الموسم الأول · 1", exact: true })
        .evaluate((image) =>
          image instanceof HTMLImageElement ? image.decode() : Promise.resolve(),
        );
      await capture(
        width === 1440
          ? "01-episodes-desktop.png"
          : width === 520
            ? "06-episodes-narrow.png"
            : "07-episodes-360.png",
      );
      await page.setViewportSize({ width, height: 1000 });
    }
    await page.getByRole("button", { name: "2 نسخ متاحة", exact: true }).click();
    const copies = page.getByRole("dialog", { name: "ملفات الحلقة 3" });
    await expect(copies.getByRole("button", { name: "تفاصيل الملف" })).toHaveCount(2);
    if (width === 1440) {
      await capture("02-multiple-copies.png");
      await copies.getByRole("button", { name: "تفاصيل الملف", exact: true }).first().click();
      await expect(page.getByRole("dialog", { name: "تفاصيل الفيديو والتحقق" })).toContainText(
        "1920 × 1080",
      );
      await capture("03-file-details-and-tracks.png");
      await page.keyboard.press("Escape");
    }
    await page.keyboard.press("Escape");
    await expect(copies).not.toBeVisible();
    await expect(page.getByRole("button", { name: "2 نسخ متاحة", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "ملف مفقود من القرص", exact: true }).click();
    const missing = page.getByRole("dialog", { name: "ملفات الحلقة 4", exact: true });
    await missing.getByRole("button", { name: "المزيد من إجراءات الفيديو" }).click();
    await page.getByRole("menuitem", { name: "إزالة تسجيل الملف المفقود", exact: true }).click();
    const cleanup = page.getByRole("dialog", { name: "إزالة تسجيل الملف المفقود", exact: true });
    await expect(cleanup).toContainText("الاستعادة لا تُنشئ فيديو مفقودًا");
    await cleanup.getByRole("button", { name: "إلغاء", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "في المحذوفات", exact: true }).click();
    const retired = page.getByRole("dialog", { name: "ملفات الحلقة 6" });
    if (width === 1440) await capture("04-trash-and-restore.png");
    await retired.getByRole("button", { name: "استعادة", exact: true }).click();
    await retired.getByRole("button", { name: "المزيد من إجراءات الفيديو" }).click();
    await expect(page.getByRole("menuitem", { name: "نقل إلى المحذوفات" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    const restored = page.getByRole("article", { name: "الحلقة 6", exact: true });
    await expect(restored.getByRole("button", { name: "ملف متاح", exact: true })).toBeVisible();
    await expect(restored.getByText("حكاية 6", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "الجزء", exact: true }).click();
    await page.getByRole("option", { name: "الموسم السادس", exact: true }).click();
    await expect(page.getByText("حلقة من الإنترنت", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "بلا ملف على الخادم", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "تورنت / مزوّدون", exact: true })).toBeVisible();
    if (width === 1440) {
      await page
        .getByText("الحلقات", { exact: true })
        .evaluate((element) => element.scrollIntoView({ block: "center" }));
      await capture("05-internet-only-season.png");
    }
    await page.getByRole("combobox", { name: "الجزء", exact: true }).click();
    await page.getByRole("option", { name: "فيلم", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "بلا ملف على الخادم", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "إضافة حلقة", exact: true })).toHaveCount(0);
    await page.getByRole("combobox", { name: "الجزء", exact: true }).click();
    await page.getByRole("option", { name: "الموسم الأول", exact: true }).click();
    await page.getByRole("button", { name: "إضافة حلقة", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "إضافة حلقة", exact: true });
    await editor.getByRole("button", { name: "تطبيق على المسودة" }).click();
    await expect(page.getByRole("button", { name: "احفظ الجزء أو الحلقة أولًا" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "استيراد وسائط", exact: true })).toBeDisabled();
    await page
      .getByRole("article", { name: "الحلقة 2", exact: true })
      .getByRole("button", { name: "ملف متاح", exact: true })
      .click();
    const draftFiles = page.getByRole("dialog", { name: "ملفات الحلقة 2" });
    await expect(
      draftFiles.getByRole("button", { name: "استيراد ملف", exact: true }),
    ).toBeDisabled();
    await draftFiles.getByRole("button", { name: "المزيد من إجراءات الفيديو" }).click();
    await expect(page.getByRole("menuitem", { name: "تحقق من الملف", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width === 1440) {
      await page.getByRole("tab", { name: "البنية", exact: true }).click();
      const override = page.getByRole("switch", { name: "لغات مخصّصة لهذا الجزء", exact: true });
      await expect(override).not.toBeChecked();
      await page.getByRole("tab", { name: "الصور والمراجع", exact: true }).click();
      for (const roleIndex of [0, 1, 2]) {
        await page
          .getByRole("button", { name: "المصادر أو رفع صورة", exact: true })
          .nth(roleIndex)
          .click();
        await page.getByRole("button", { name: "البحث عن الصور", exact: true }).click();
        const results = page.getByRole("dialog", { name: "نتائج البحث عن الصور", exact: true });
        await expect(
          results.getByRole("button", { name: "استيراد واختيار", exact: true }),
        ).toHaveCount(3);
        if (roleIndex === 0) {
          await capture("09-artwork-language-filters.png");
          await results.getByRole("combobox", { name: "مصادر الصور", exact: true }).click();
          await page.getByRole("option", { name: "TMDB", exact: true }).click();
          await page.keyboard.press("Escape");
          await expect(
            results.getByRole("button", { name: "استيراد واختيار", exact: true }),
          ).toHaveCount(1);
          await results.getByRole("combobox", { name: "لغات الصور", exact: true }).click();
          await page.getByRole("option", { name: "اليابانية", exact: true }).click();
          await page.keyboard.press("Escape");
          await expect(
            results.getByRole("button", { name: "استيراد واختيار", exact: true }),
          ).toHaveCount(2);
          await results.getByRole("button", { name: "عرض الكل", exact: true }).click();
          await expect(
            results.getByRole("button", { name: "استيراد واختيار", exact: true }),
          ).toHaveCount(5);
          await results.getByRole("combobox", { name: "لغات الصور", exact: true }).click();
          await page.getByRole("option", { name: "اليابانية", exact: true }).click();
          await page.keyboard.press("Escape");
          await results.getByRole("combobox", { name: "مصادر الصور", exact: true }).click();
          await page.getByRole("option", { name: "Fanart", exact: true }).click();
          await page.keyboard.press("Escape");
          await expect(
            results.getByText("لا توجد صور تطابق المرشحات", { exact: true }),
          ).toBeVisible();
        }
        await results.getByRole("button", { name: "Close", exact: true }).click();
        await expect(results).not.toBeVisible();
        await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      await page.getByRole("tab", { name: "البنية", exact: true }).click();
      await override.click();
      const languages = page.getByRole("combobox", { name: "لغات هذا الجزء", exact: true });
      await languages.click();
      await page.getByRole("option").filter({ hasText: "الإنجليزية" }).click();
      await page.keyboard.press("Escape");
      await expect(languages.locator("..")).toContainText("الإنجليزية");
      await override.click();
      await expect(languages).toHaveCount(0);
      await expect(override).not.toBeChecked();
    }
  });
}

import { describe, expect, it } from "vitest";

import type { SourceCandidate } from "./playback";
import { formatSource, formatSourceSize, sourceLanguageLabel } from "./source-format";

const candidate: SourceCandidate = {
  id: "a".repeat(64),
  provider: "Torrentio",
  label: "Torrentio",
  release: "A release",
  resolution: null,
  codec: null,
  hdr: false,
  sizeBytes: null,
  seeders: null,
  reportedLanguages: [],
  available: true,
};

describe("source display hints", () => {
  it("separates a flattened release title, filename, and provider metadata", () => {
    const release =
      "🎬 A Film 2024 📁 A.Film.2024.2160p.HEVC.HDR10+.mkv 👤 42 💾 2.5 GB 🌐 English 🇬🇧";
    const source = { ...candidate, label: "Torrentio\n4K", release };
    const result = formatSource(source);
    expect(result).toMatchObject({
      providerLabel: "Torrentio 4K",
      releaseTitle: "A Film 2024",
      filename: "A.Film.2024.2160p.HEVC.HDR10+.mkv",
      resolution: 2160,
      codec: "HEVC",
      hdr: "HDR10+",
      sizeBytes: 2500000000,
      seeders: 42,
      reportedLanguages: [],
    });
    expect(source.release).toBe(release);
  });

  it("handles provider newlines and explicit filename labels", () => {
    expect(
      formatSource({
        ...candidate,
        release: "A release\nFilename: My Film 1080p.mkv\nSeeders: 9\nSize: 1 GiB",
      }),
    ).toMatchObject({
      releaseTitle: "A release",
      filename: "My Film 1080p.mkv",
      seeders: 9,
      sizeBytes: 1073741824,
    });
  });

  it("does not turn an unmarked filename into an invented work title", () => {
    expect(formatSource({ ...candidate, release: "Film.2024.720p.mp4 👤 7" })).toMatchObject({
      releaseTitle: null,
      filename: "Film.2024.720p.mp4",
    });
  });

  it("does not treat a folder/pack name as a filename", () => {
    expect(formatSource({ ...candidate, release: "Season pack 📁 Season 1 👤 3" })).toMatchObject({
      releaseTitle: "Season pack",
      filename: null,
    });
  });

  it("prioritizes structured native metadata, including explicit zero values", () => {
    expect(
      formatSource({
        ...candidate,
        release: "Film 2160p HEVC 9 GB 👤 50",
        resolution: 720,
        codec: "AV1",
        sizeBytes: 0,
        seeders: 0,
        reportedLanguages: ["ar"],
      }),
    ).toMatchObject({
      resolution: 720,
      codec: "AV1",
      sizeBytes: 0,
      seeders: 0,
      reportedLanguages: ["ar"],
    });
  });

  it("keeps unknown metadata unknown and does not equate missing HDR with SDR", () => {
    expect(formatSource(candidate)).toMatchObject({
      filename: null,
      resolution: null,
      codec: null,
      hdr: null,
      sizeBytes: null,
      seeders: null,
      reportedLanguages: [],
    });
  });

  it("uses boundaries rather than codec/resolution substrings", () => {
    expect(
      formatSource({ ...candidate, release: "MyAV1Film 1080pixels 14K HDRama" }),
    ).toMatchObject({
      codec: null,
      resolution: null,
      hdr: null,
    });
  });

  it("reports explicit HDR variants, without assuming Dolby Vision from DV", () => {
    expect(formatSource({ ...candidate, release: "Film Dolby Vision HDR10" }).hdr).toBe(
      "Dolby Vision · HDR10",
    );
    expect(formatSource({ ...candidate, release: "Film DV" }).hdr).toBeNull();
    expect(formatSource({ ...candidate, release: "Film no-HDR" }).hdr).toBeNull();
    expect(formatSource({ ...candidate, hdr: true }).hdr).toBe("HDR");
  });

  it("does not add languages from country flags, title words, or dual audio", () => {
    expect(
      formatSource({ ...candidate, release: "Johnny English 🇬🇧 🇯🇵 Dual Audio" }).reportedLanguages,
    ).toEqual([]);
    expect(
      formatSource({ ...candidate, release: "🇸🇦", reportedLanguages: ["ar"] }).reportedLanguages,
    ).toEqual(["ar"]);
  });

  it("adds only explicit language labels and deduplicates native reports", () => {
    expect(
      formatSource({
        ...candidate,
        release: "A Film 📁 Film.mkv Languages: Arabic / Japanese\nSubtitles: English",
        reportedLanguages: ["ar"],
      }).reportedLanguages,
    ).toEqual(["ar", "ja", "en"]);
  });

  it("rejects implausible numeric hints rather than inventing useful values", () => {
    expect(
      formatSource({ ...candidate, release: "Film 999999 TB 👤 999999999999999999" }),
    ).toMatchObject({
      sizeBytes: null,
      seeders: null,
    });
    expect(formatSource({ ...candidate, release: "Film seeders: 0 Size: 0 MB" })).toMatchObject({
      sizeBytes: 0,
      seeders: 0,
    });
  });

  it("does not salvage malformed numeric hints as valid measurements", () => {
    for (const release of ["Film -2.5 GB 👤 3.5", "Film 2,5 GB seeders: -1"]) {
      expect(formatSource({ ...candidate, release })).toMatchObject({
        sizeBytes: null,
        seeders: null,
      });
    }
  });

  it("does not present negated language hints or filename extension prefixes as facts", () => {
    expect(
      formatSource({ ...candidate, release: "Film Subtitles: No English" }).reportedLanguages,
    ).toEqual([]);
    expect(formatSource({ ...candidate, release: "Film 📁 Video.mkv.part" }).filename).toBeNull();
  });

  it("preserves text as text rather than interpreting HTML", () => {
    expect(
      formatSource({ ...candidate, release: "<script>alert(1)</script> 📁 Film.mkv" }).releaseTitle,
    ).toBe("<script>alert(1)</script>");
  });

  it("formats sizes with explicit units and unknown language tags safely", () => {
    expect(formatSourceSize(0)).toBe("0 B");
    expect(formatSourceSize(2500000000)).toBe("2.5 GB");
    expect(formatSourceSize(2000000000)).toBe("2 GB");
    expect(sourceLanguageLabel("ar")).toBe("العربية");
    expect(sourceLanguageLabel("not_a_language")).toBe("not_a_language");
  });
});

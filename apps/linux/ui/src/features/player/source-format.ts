import type { SourceCandidate } from "./playback";

// Rust currently flattens provider newlines; markers also delimit the flattened descriptions.
const metadataStart =
  /[📁💾👤⚙🌐]|[\u{1F1E6}-\u{1F1FF}]|\b(?:file(?:name)?|size|seeders?|languages?|audio|subtitles?)\s*[:=]|(?:اسم الملف|اللغات|اللغة|الصوت|الترجمة)\s*[:=]/iu;
const videoExtension = /\.(?:mkv|mp4|avi|mov|webm|m4v|ts|m2ts)(?=\s|$)/iu;
const languageNames = new Intl.DisplayNames(["ar"], { type: "language" });
const languageHints: readonly (readonly [string, RegExp])[] = [
  ["ar", /\bArabic\b|العربية|عربي/iu],
  ["en", /\bEnglish\b|الإنجليزية|إنجليزي/iu],
  ["ja", /\bJapanese\b|اليابانية/iu],
  ["fr", /\bFrench\b|الفرنسية/iu],
  ["de", /\bGerman\b|الألمانية/iu],
  ["es", /\bSpanish\b|الإسبانية/iu],
  ["it", /\bItalian\b|الإيطالية/iu],
  ["pt", /\bPortuguese\b|البرتغالية/iu],
  ["ru", /\bRussian\b|الروسية/iu],
  ["ko", /\bKorean\b|الكورية/iu],
  ["zh", /\bChinese\b|الصينية/iu],
  ["hi", /\bHindi\b|الهندية/iu],
  ["tr", /\bTurkish\b|التركية/iu],
  ["fa", /\bPersian\b|الفارسية/iu],
];

function cleanText(text: string) {
  return text
    .replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\uFE0F|\u200D/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function beforeMetadata(text: string) {
  return text.split(metadataStart, 1)[0].trim();
}

function reportedSize(text: string) {
  const match = /(?<![\d.,-])(\d+(?:\.\d+)?)\s*(TiB|GiB|MiB|TB|GB|MB)\b/iu.exec(text);
  if (!match) return null;
  const unit = match[2].toUpperCase();
  const base = unit.includes("I") ? 1024 : 1000;
  const exponent = unit.startsWith("T") ? 4 : unit.startsWith("G") ? 3 : 2;
  const bytes = Number(match[1]) * base ** exponent;
  return Number.isFinite(bytes) && bytes <= 10 * 1024 ** 4 ? bytes : null;
}

function reportedSeeders(text: string) {
  const match = /(?:👤\s*|\bseeders?\s*[:=]?\s*)(\d+)\b(?!\.)/iu.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value <= 4294967295 ? value : null;
}

function reportedCodec(text: string) {
  if (/\bAV1\b/iu.test(text)) return "AV1";
  if (/\b(?:HEVC|[hx][ .]?265)\b/iu.test(text)) return "HEVC";
  if (/\b(?:AVC|[hx][ .]?264)\b/iu.test(text)) return "H.264";
  return null;
}

function reportedHdr(text: string, hdr: boolean) {
  const hints = text.replace(/\b(?:no|non)[ -]?HDR(?:10\+?)?\b/giu, "");
  const formats: string[] = [];
  if (/\b(?:Dolby[ .]Vision|DoVi)\b/iu.test(hints)) formats.push("Dolby Vision");
  if (/\bHDR10\+/iu.test(hints)) formats.push("HDR10+");
  else if (/\bHDR10\b/iu.test(hints)) formats.push("HDR10");
  else if (/\bHDR\b/iu.test(hints)) formats.push("HDR");
  if (/\bHLG\b/iu.test(hints)) formats.push("HLG");
  return formats.length ? formats.join(" · ") : hdr ? "HDR" : null;
}

function audioHint(text: string, languages: Set<string>) {
  const normalized = text.replace(/[._-]+/gu, " ");
  const dual = /\bdual\s+audio\b/iu.test(normalized);
  const dubbed = /\b(?:dubbed|dub)\b/iu.test(normalized);
  const negated =
    /\b(?:no|not|without)\s+(?:english\s+)?(?:dub(?:bed)?|dual\s+audio)\b|\bdub(?:bed)?\s+(?:not\s+available|unavailable)\b/iu.test(
      normalized,
    );
  const foreignDub =
    /\b(?:arabic|french|german|spanish|italian|portuguese|russian|korean|chinese|hindi|tamil|telugu|turkish|persian)\s+dub(?:bed)?\b|\bdub(?:bed)?\s*(?::|in)?\s*(?:arabic|french|german|spanish|italian|portuguese|russian|korean|chinese|hindi|tamil|telugu|turkish|persian)\b/iu.test(
      normalized,
    );
  return {
    audioTag: !negated && dual ? "Dual Audio" : !negated && dubbed ? "Dubbed" : null,
    // A release-label heuristic only; native track metadata remains authoritative.
    englishInferred: !languages.has("en") && !negated && !foreignDub && (dual || dubbed),
  };
}

export function sourceLanguageLabel(language: string) {
  try {
    return languageNames.of(language) ?? language;
  } catch {
    // An unrecognized provider tag must not break the source drawer or become another language.
    return language;
  }
}

export function formatSourceSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const unit = bytes >= 1e12 ? "TB" : bytes >= 1e9 ? "GB" : bytes >= 1e6 ? "MB" : "KB";
  const divisor = unit === "TB" ? 1e12 : unit === "GB" ? 1e9 : unit === "MB" ? 1e6 : 1e3;
  return `${Number((bytes / divisor).toFixed(2))} ${unit}`;
}

/** Display hints only: never selects files, changes native facts, or establishes playable tracks. */
export function formatSource(candidate: SourceCandidate) {
  const release = candidate.release.slice(0, 8192);
  const text = `${candidate.label.slice(0, 1024)} ${release}`;
  const firstLine = release.split(/\r?\n/u, 1)[0];
  const leading = cleanText(beforeMetadata(firstLine))
    .replace(/\b\d+(?:\.\d+)?\s*(?:TiB|GiB|MiB|TB|GB|MB)\b.*$/iu, "")
    .trim();
  const explicitFile = /(?:📁|\bfile(?:name)?\s*[:=]|اسم الملف\s*[:=])\s*([^\r\n]+)/iu.exec(
    release,
  );
  const fileText = explicitFile ? cleanText(beforeMetadata(explicitFile[1])) : leading;
  const extension = videoExtension.exec(fileText);
  // Without a video extension, a folder marker may describe a pack, not a chosen filename.
  const filename = extension ? fileText.slice(0, extension.index + extension[0].length) : null;
  const releaseTitle = leading && (explicitFile || !filename) ? leading : null;
  const resolutionHint = /\b(4320|2160|1440|1080|720|576|540|480|360)p\b/iu.exec(text);
  const languages = new Set(candidate.reportedLanguages);
  // Only explicit language/audio/subtitle labels add hints. Country flags and title words do not.
  for (const section of release.matchAll(
    /(?:\b(?:languages?|audio|subtitles?|dubbed)|اللغات|اللغة|الصوت|الترجمة)\s*[:=]\s*([^\r\n📁💾👤⚙🌐]+)/giu,
  )) {
    if (/\b(?:no|not|without|none|unavailable)\b|لا توجد|بدون/iu.test(section[1])) continue;
    for (const [code, hint] of languageHints) {
      if (hint.test(section[1])) languages.add(code);
    }
  }
  return {
    providerLabel: cleanText(candidate.label.slice(0, 1024)),
    releaseTitle,
    filename,
    resolution:
      candidate.resolution ??
      (resolutionHint ? Number(resolutionHint[1]) : /\b4K\b/iu.test(text) ? 2160 : null),
    codec: candidate.codec ?? reportedCodec(text),
    hdr: reportedHdr(text, candidate.hdr),
    sizeBytes: candidate.sizeBytes ?? reportedSize(release),
    seeders: candidate.seeders ?? reportedSeeders(release),
    reportedLanguages: [...languages],
    ...audioHint(text, languages),
  };
}

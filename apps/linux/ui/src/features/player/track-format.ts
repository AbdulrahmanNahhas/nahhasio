import type { PlayerTrack } from "./bridge";

const languageNames = new Intl.DisplayNames(["ar"], { type: "language" });

/** Decorative language markers, never evidence of a dub's country or origin. */
export function trackFlag(language?: string | null) {
  if (!language) return null;
  const tag = language.trim().replace(/_/gu, "-");
  try {
    const region = new Intl.Locale(tag).region;
    if (region && /^[A-Z]{2}$/u.test(region)) {
      return String.fromCodePoint(...[...region].map((letter) => 127397 + letter.charCodeAt(0)));
    }
  } catch {
    // Preserve unknown native tags without inventing a language.
  }
  const flags = new Map<string, string>(
    Object.entries({
      en: "🇬🇧",
      eng: "🇬🇧",
      ja: "🇯🇵",
      jpn: "🇯🇵",
      ar: "🌐",
      ara: "🌐",
      fr: "🇫🇷",
      fra: "🇫🇷",
      fre: "🇫🇷",
      de: "🇩🇪",
      deu: "🇩🇪",
      ger: "🇩🇪",
      es: "🇪🇸",
      spa: "🇪🇸",
      it: "🇮🇹",
      ita: "🇮🇹",
      pt: "🇵🇹",
      por: "🇵🇹",
      ru: "🇷🇺",
      rus: "🇷🇺",
      ko: "🇰🇷",
      kor: "🇰🇷",
      zh: "🇨🇳",
      zho: "🇨🇳",
      chi: "🇨🇳",
      hi: "🇮🇳",
      hin: "🇮🇳",
      tr: "🇹🇷",
      tur: "🇹🇷",
      fa: "🇮🇷",
      fas: "🇮🇷",
      per: "🇮🇷",
    }),
  );
  return flags.get(tag.toLowerCase().split("-", 1)[0]) ?? null;
}

export function trackLanguage(track: PlayerTrack) {
  const code = track.language?.trim();
  if (!code) return "لغة غير محددة";
  try {
    return languageNames.of(code) ?? code;
  } catch {
    // Native tags that Intl does not recognize stay visible, without guessing a language.
    return code;
  }
}

export function trackSecondary(track: PlayerTrack) {
  return [
    track.title?.trim() || `مسار ${track.id}`,
    track.codec?.trim(),
    track.external ? "ملف خارجي" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function trackLabel(track: PlayerTrack) {
  return `${trackLanguage(track)} · ${trackSecondary(track)}`;
}

export function groupTracks(tracks: readonly PlayerTrack[]) {
  const groups = new Map<string, { language: string; tracks: PlayerTrack[] }>();
  for (const track of tracks) {
    const language = trackLanguage(track);
    const group = groups.get(language);
    if (group) group.tracks.push(track);
    else groups.set(language, { language, tracks: [track] });
  }
  return [...groups.values()];
}

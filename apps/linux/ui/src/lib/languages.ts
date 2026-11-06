const names = new Intl.DisplayNames(["ar"], { type: "language" });
export function workLanguages(work: { languages?: string[]; dubLanguages?: string[] }) {
  return work.languages ?? (work.dubLanguages?.includes("ar") ? ["ar"] : ["en"]);
}
export function languageName(code: string) {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

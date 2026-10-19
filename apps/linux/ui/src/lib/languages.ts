const names = new Intl.DisplayNames(["ar"], { type: "language" });
export function languageName(code: string) {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

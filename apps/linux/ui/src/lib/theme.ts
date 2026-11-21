// Device-local presentation only. No account, server or playback preference is changed.
export type Theme = "dark" | "light" | "system";
type UiSize = "standard" | "large";
const key = "nahhasio:appearance:theme:v1";
const sizeKey = "nahhasio:appearance:size:v1";
const prefersLight = "(prefers-color-scheme: light)";
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(key);
    return saved === "light" || saved === "system" ? saved : "dark";
  } catch {
    return "dark";
  }
}
function apply(theme: Theme) {
  const dark = theme === "system" ? !window.matchMedia(prefersLight).matches : theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", dark);
}
export function initializeAppearance() {
  apply(readTheme());
  document.documentElement.dataset.uiSize = readUiSize();
  window.matchMedia(prefersLight).addEventListener("change", () => {
    if (readTheme() === "system") apply("system");
  });
}
export function saveTheme(theme: Theme) {
  localStorage.setItem(key, theme);
  apply(theme);
}

export function readUiSize(): UiSize {
  try {
    return localStorage.getItem(sizeKey) === "large" ? "large" : "standard";
  } catch {
    return "standard";
  }
}

export function saveUiSize(size: UiSize) {
  localStorage.setItem(sizeKey, size);
  document.documentElement.dataset.uiSize = size;
}

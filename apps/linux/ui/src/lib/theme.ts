// Device-local presentation only. No account, server or playback preference is changed.
export type Theme = "dark" | "light";
const key = "nahhasio:appearance:theme:v1";
export function readTheme(): Theme {
  try {
    return localStorage.getItem(key) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}
export function initializeTheme() {
  apply(readTheme());
}
export function saveTheme(theme: Theme) {
  localStorage.setItem(key, theme);
  apply(theme);
}

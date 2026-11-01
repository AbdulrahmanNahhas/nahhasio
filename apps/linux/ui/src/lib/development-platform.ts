/// <reference types="vite/client" />

// Vite replaces DEV with false in packaged builds; the browser adapter is never shipped.
export function developmentBrowserAvailable() {
  return (
    import.meta.env?.DEV &&
    window.location.origin === "http://127.0.0.1:23110" &&
    !window.webkit?.messageHandlers?.nahhasio
  );
}

import { defineConfig } from "@playwright/test";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const port = Number(process.env.NAHHASIO_UI_TEST_PORT ?? 23110);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("NAHHASIO_UI_TEST_PORT must be a local port between 1024 and 65535.");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command:
      process.env.NAHHASIO_BROWSER_DEVELOPMENT_TEST === "1"
        ? `pnpm exec vite --host 127.0.0.1 --port ${port} --strictPort`
        : `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});

import { defineConfig } from "@playwright/test";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:23110",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command: "pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 23110 --strictPort",
    url: "http://127.0.0.1:23110",
    reuseExistingServer: !process.env.CI,
  },
});

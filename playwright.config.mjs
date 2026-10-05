import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "browser.spec.mjs",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  outputDir: "tmp/playwright-results",
  use: {
    baseURL: "http://127.0.0.1:4318",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/e2e-server.mjs",
    url: "http://127.0.0.1:4318/api/auth/status",
    reuseExistingServer: false,
    timeout: 30000,
  },
});

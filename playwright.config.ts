import { defineConfig, devices } from "@playwright/test";

/**
 * Konfigurasi Playwright (E2E + aksesibilitas axe-core).
 *
 * Env:
 *   E2E_BASE_URL      URL aplikasi yang diuji (default http://localhost:3002).
 *                     JANGAN arahkan ke produksi.
 *   E2E_START_SERVER  "1" = Playwright menjalankan `npm run start` sendiri
 *                     (butuh `npm run build` lebih dulu).
 *   E2E_EMAIL / E2E_PASSWORD  kredensial opsional untuk alur terautentikasi
 *                     (uji dilewati bila kosong).
 *
 * Contoh:
 *   npm run test:e2e                          # semua browser
 *   npm run test:e2e -- --project=chromium    # satu browser
 *   npm run test:a11y                         # hanya pemindaian axe (@a11y)
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3002";
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  // Suite alur bisnis (destruktif, butuh seed demo & sesi per peran) punya konfigurasi
  // sendiri: playwright.flows.config.ts — jangan ikut dijalankan suite default.
  testIgnore: ["**/flows/**"],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  reporter: isCI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "iphone-14", use: { ...devices["iPhone 14"] } },
  ],
  webServer:
    process.env.E2E_START_SERVER === "1"
      ? {
          command: "npm run start",
          url: `${baseURL}/login`,
          reuseExistingServer: !isCI,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
        }
      : undefined,
});

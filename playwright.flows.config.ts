import { defineConfig, devices } from "@playwright/test";

/**
 * Konfigurasi Playwright untuk uji E2E ALUR BISNIS (tests/e2e/flows/**).
 *
 * Suite ini MENGUBAH DATA (membuat siklus, unit, akun, jawaban, mengaktifkan
 * mode pemeliharaan, dst.). JANGAN PERNAH arahkan ke produksi.
 *
 * Prasyarat: aplikasi berjalan pada basis data sekali-pakai yang di-seed dengan
 * `SEED_DEMO=true npm run db:seed:demo` lalu `npm run db:seed`
 * (SEED_SUPERADMIN_EMAIL/PASSWORD = E2E_SUPERADMIN_EMAIL/PASSWORD di bawah).
 *
 * Env:
 *   E2E_BASE_URL              default http://localhost:3097 (hanya localhost/127.0.0.1)
 *   E2E_SUPERADMIN_EMAIL      default superadmin@e2e.test
 *   E2E_SUPERADMIN_PASSWORD   default SuperE2e2026
 *   E2E_ADMIN2_EMAIL          default admin2@e2e.test (Admin LPM dari seed produksi)
 *
 * Jalankan:
 *   npx playwright test -c playwright.flows.config.ts
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3097";

// Pengaman: suite ini destruktif — tolak apa pun selain host lokal.
{
  const u = new URL(baseURL);
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  if (!localHosts.includes(u.hostname) || u.port === "3002") {
    throw new Error(
      `playwright.flows.config.ts: E2E_BASE_URL=${baseURL} ditolak. ` +
        "Suite alur bisnis hanya boleh dijalankan pada server lokal sekali-pakai (bukan port 3002 / produksi)."
    );
  }
}

const chromium = { ...devices["Desktop Chrome"] };

export default defineConfig({
  testDir: "./tests/e2e/flows",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Satu worker: alur saling bergantung & batas laju login (5/mnt per email+IP, 30/mnt per IP).
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  outputDir: "./test-results/flows",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/flows" }],
  ],
  use: {
    baseURL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    acceptDownloads: true,
    ...chromium,
  },
  projects: [
    // Login sekali per peran (storageState) + data awal bersama.
    { name: "flows-setup", testMatch: /flows\.setup\.ts/ },
    {
      // Berkas dijalankan berurutan menurut nama (01-… s.d. 07-…) karena
      // workers=1 & fullyParallel=false; tiap tahap memakai data tahap sebelumnya
      // (lihat .auth/state.json). Kegagalan satu berkas tidak menghentikan berikutnya.
      name: "flows",
      testMatch: /\d\d-[\w-]+\.spec\.ts/,
      dependencies: ["flows-setup"],
    },
  ],
});

import { expect, test } from "@playwright/test";
import { expectNoA11yViolations, hasCredentials } from "./fixtures";

/**
 * Alur terautentikasi — OPSIONAL. Butuh akun uji non-produksi:
 *   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
 * Dilewati otomatis bila variabel tidak diisi.
 */
test.describe("Alur terautentikasi", () => {
  test.skip(!hasCredentials, "E2E_EMAIL / E2E_PASSWORD tidak diatur.");
  // Hindari memicu pembatas laju login dengan terlalu banyak worker paralel.
  test.describe.configure({ mode: "serial" });

  // Header Set-Cookie sesi dari server (sumber kebenaran atribut cookie; tidak
  // bergantung pada cara tiap browser menyimpan cookie Secure di http://127.0.0.1).
  let sessionSetCookie: string | null = null;

  test.beforeEach(async ({ page }) => {
    sessionSetCookie = null;
    page.on("response", async (res) => {
      const v = await res.headerValue("set-cookie").catch(() => null);
      if (v && /lpm_session=[^;]+/.test(v)) sessionSetCookie = v;
    });
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: /^Email/ })
      .fill(process.env.E2E_EMAIL!);
    await page
      .getByRole("textbox", { name: /^Kata Sandi/ })
      .fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page.waitForURL(/\/(dashboard|no-access)/);
  });

  test("login berhasil membuka dashboard", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("cookie sesi bersifat httpOnly", async () => {
    expect(sessionSetCookie, "Set-Cookie sesi saat login").not.toBeNull();
    const header = sessionSetCookie!;
    expect(header).toMatch(/;\s*HttpOnly/i);
    expect(header).toMatch(/;\s*SameSite=Lax/i);
    expect(header).toMatch(/;\s*Path=\//i);
    // Build produksi: prefix __Host- mewajibkan Secure.
    if (/__Host-lpm_session=/.test(header)) {
      expect(header).toMatch(/;\s*Secure/i);
    }
  });

  test("halaman /login mengarahkan pengguna yang sudah masuk", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/(dashboard|no-access)/);
  });

  test("dashboard tanpa pelanggaran axe @a11y", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // Grafik (SVG recharts) dikecualikan: dinilai manual.
    await expectNoA11yViolations(page, testInfo, {
      exclude: [".recharts-wrapper"],
    });
  });
});

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

  test.beforeEach(async ({ page }) => {
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

  test("cookie sesi bersifat httpOnly", async ({ context }) => {
    const cookies = await context.cookies();
    const session = cookies.find((c) => /lpm_session/.test(c.name));
    expect(session, "cookie sesi").toBeDefined();
    expect(session!.httpOnly).toBe(true);
    expect(session!.sameSite).toBe("Lax");
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

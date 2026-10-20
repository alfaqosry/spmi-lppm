import { expect, test } from "@playwright/test";
import { axeScan, pageAs, type RoleKey } from "./helpers";

/**
 * Pemindaian axe-core (WCAG 2.0 A/AA + 2.1 AA) pada halaman terautentikasi
 * utama per peran. Grafik recharts dikecualikan (dinilai manual).
 * Hasil lengkap dilampirkan (axe-<halaman>.json) pada laporan HTML.
 */
const PAGES: { role: RoleKey; path: string; prep?: "verifikasi" }[] = [
  { role: "superadmin", path: "/dashboard" },
  { role: "superadmin", path: "/audit" },
  { role: "superadmin", path: "/audit", prep: "verifikasi" },
  { role: "superadmin", path: "/siklus" },
  { role: "superadmin", path: "/unit" },
  { role: "superadmin", path: "/role-penempatan" },
  { role: "superadmin", path: "/analitik" },
  { role: "superadmin", path: "/pengaturan" },
  { role: "superadmin", path: "/profil" },
  { role: "superadmin", path: "/penetapan" },
  { role: "head", path: "/dashboard" },
  { role: "head", path: "/audit" },
  { role: "head", path: "/profil" },
];

for (const p of PAGES) {
  const label = `${p.role}${p.path.replace(/\//g, "-")}${p.prep ? `-${p.prep}` : ""}`;
  test(`@a11y ${label} tanpa pelanggaran axe`, async ({
    browser,
  }, testInfo) => {
    const { context, page } = await pageAs(browser, p.role);
    await page.goto(p.path);
    await expect(page.locator("h1").first()).toBeVisible();
    if (p.prep === "verifikasi") {
      await page.getByRole("tab", { name: "Panel Verifikasi LPM" }).click();
    }
    await page.waitForLoadState("networkidle");
    const violations = await axeScan(page, testInfo, label);
    await context.close();
    expect(violations, `Pelanggaran axe pada ${label}`).toEqual([]);
  });
}

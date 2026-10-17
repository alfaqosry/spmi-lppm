import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** Tag standar yang diperiksa: WCAG 2.0 A/AA + WCAG 2.1 AA. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];

/** Halaman publik (tanpa login) yang wajib lolos uji render & aksesibilitas. */
export const PUBLIC_PAGES = [
  { path: "/login", name: "Login" },
  { path: "/kebijakan-privasi", name: "Kebijakan Privasi" },
  { path: "/syarat-ketentuan", name: "Syarat & Ketentuan" },
] as const;

/**
 * Jalankan pemindaian axe-core dan gagal bila ada pelanggaran.
 * Hasil lengkap dilampirkan ke laporan Playwright untuk ditelusuri.
 */
export async function expectNoA11yViolations(
  page: Page,
  testInfo: TestInfo,
  options: { exclude?: string[] } = {}
) {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  for (const sel of options.exclude ?? []) builder = builder.exclude(sel);
  const results = await builder.analyze();

  await testInfo.attach("axe-results.json", {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });

  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
  }));
  expect(summary, "Pelanggaran aksesibilitas (axe-core)").toEqual([]);
}

/** Pastikan tidak ada scroll horizontal pada viewport saat ini. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, "lebar konten melebihi viewport (px)").toBeLessThanOrEqual(
    0
  );
}

export const hasCredentials = Boolean(
  process.env.E2E_EMAIL && process.env.E2E_PASSWORD
);

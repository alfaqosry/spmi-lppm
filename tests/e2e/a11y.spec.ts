import { test } from "@playwright/test";
import { expectNoA11yViolations, PUBLIC_PAGES } from "./fixtures";

/**
 * Pemindaian aksesibilitas otomatis (axe-core) — WCAG 2.0 A/AA & 2.1 AA.
 * Jalankan khusus: `npm run test:a11y` (filter tag @a11y).
 */
test.describe("Aksesibilitas @a11y", () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) tanpa pelanggaran axe @a11y`, async ({
      page,
    }, testInfo) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoA11yViolations(page, testInfo);
    });
  }

  test("login dengan pesan error tanpa pelanggaran axe @a11y", async ({
    page,
  }, testInfo) => {
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: /^Email/ })
      .fill(`tidak-ada-${test.info().project.name}@contoh.ac.id`);
    await page
      .getByRole("textbox", { name: /^Kata Sandi/ })
      .fill("SalahSekali123");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page
      .getByRole("alert")
      .or(page.getByText(/salah|tidak valid|gagal/i))
      .first()
      .waitFor();
    await expectNoA11yViolations(page, testInfo);
  });

  test("halaman 404 tanpa pelanggaran axe @a11y", async ({
    page,
  }, testInfo) => {
    await page.goto("/halaman-yang-tidak-ada-xyz");
    await expectNoA11yViolations(page, testInfo);
  });

  test("login pada lebar 320px tanpa pelanggaran axe @a11y", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/login");
    await expectNoA11yViolations(page, testInfo);
  });
});

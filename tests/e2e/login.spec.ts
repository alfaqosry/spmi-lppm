import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./fixtures";

test.describe("Halaman login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("menampilkan form email, kata sandi, dan tombol masuk", async ({
    page,
  }) => {
    await expect(page.getByRole("textbox", { name: /^Email/ })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /^Kata Sandi/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Masuk", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Email/ })).toHaveAttribute(
      "type",
      "email"
    );
    await expect(
      page.getByRole("textbox", { name: /^Kata Sandi/ })
    ).toHaveAttribute("type", "password");
    await expect(page.getByRole("textbox", { name: /^Email/ })).toHaveAttribute(
      "autocomplete",
      "username"
    );
  });

  test("kredensial salah menampilkan pesan error inline", async ({ page }) => {
    await page
      .getByRole("textbox", { name: /^Email/ })
      .fill(`tidak-ada-${test.info().project.name}@contoh.ac.id`);
    await page
      .getByRole("textbox", { name: /^Kata Sandi/ })
      .fill("SalahSekali123");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();

    // Pesan error harus tampil di halaman yang sama (tanpa navigasi).
    const alert = page
      .getByRole("alert")
      .or(page.getByText(/salah|tidak valid|gagal/i));
    await expect(alert.first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    // Pesan generik: tidak membedakan "email tidak terdaftar" vs "sandi salah".
    await expect(page.locator("body")).not.toContainText(
      /tidak terdaftar|tidak ditemukan/i
    );
  });

  test("field wajib divalidasi sebelum dikirim", async ({ page }) => {
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    const valid = await page
      .getByRole("textbox", { name: /^Email/ })
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
    await expect(page).toHaveURL(/\/login/);
  });

  test("urutan Tab: email -> kata sandi -> tombol Masuk", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Navigasi keyboard diuji pada perangkat desktop.");
    await page.getByRole("textbox", { name: /^Email/ }).focus();
    await expect(page.getByRole("textbox", { name: /^Email/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("textbox", { name: /^Kata Sandi/ })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Masuk", exact: true })
    ).toBeFocused();
  });

  test("email dapat dicapai dengan Tab dari awal halaman", async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(isMobile, "Navigasi keyboard diuji pada perangkat desktop.");
    // Safari/WebKit default tidak memfokuskan semua elemen via Tab.
    test.skip(browserName === "webkit", "WebKit: Tab hanya ke field form.");
    const email = page.getByRole("textbox", { name: /^Email/ });
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      if (await email.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(email).toBeFocused();
  });

  test("indikator fokus terlihat pada field aktif", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Navigasi keyboard diuji pada perangkat desktop.");
    await page.getByRole("textbox", { name: /^Email/ }).focus();
    const style = await page
      .getByRole("textbox", { name: /^Email/ })
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          outline: s.outlineStyle !== "none" && s.outlineWidth !== "0px",
          shadow: s.boxShadow !== "none",
          border: s.borderColor,
        };
      });
    expect(style.outline || style.shadow).toBe(true);
  });

  test("tidak ada scroll horizontal pada lebar 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/login");
    await expectNoHorizontalScroll(page);
  });

  test("tetap terbaca pada zoom teks 200% (reflow)", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await expectNoHorizontalScroll(page);
    await expect(
      page.getByRole("button", { name: "Masuk", exact: true })
    ).toBeVisible();
  });
});

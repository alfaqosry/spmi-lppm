import { expect, test } from "@playwright/test";
import { PUBLIC_PAGES } from "./fixtures";

test.describe("Halaman publik", () => {
  for (const { path, name } of PUBLIC_PAGES) {
    test(`${name} (${path}) dirender tanpa error`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      const res = await page.goto(path);
      expect(res?.status(), `status HTTP ${path}`).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page).toHaveTitle(/\S/);
      expect(await page.locator("html").getAttribute("lang")).toBeTruthy();
      expect(errors, "error JavaScript di halaman").toEqual([]);
    });
  }

  test("pengguna tanpa sesi diarahkan dari /dashboard ke /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByRole("textbox", { name: /^Email/ })).toBeVisible();
  });

  test("rute terproteksi lain juga diarahkan ke /login", async ({ page }) => {
    for (const path of ["/audit", "/pengaturan", "/profil"]) {
      await page.goto(path);
      await expect(page, `redirect dari ${path}`).toHaveURL(/\/login(\?|$)/);
    }
  });
});

test.describe("SEO & berkas meta", () => {
  test("robots.txt tersedia", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toMatch(/User-Agent:/i);
    // Area aplikasi privat tidak boleh dirayapi.
    expect(body).toMatch(/Disallow:/i);
  });

  test("sitemap.xml tersedia & valid XML", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/xml/);
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("<loc>");
    // Halaman privat tidak boleh muncul di sitemap.
    expect(body).not.toMatch(/\/(dashboard|pengaturan|audit)\b/);
  });
});

test.describe("Halaman 404", () => {
  test("rute tak dikenal menampilkan halaman 404 yang ramah", async ({
    page,
  }) => {
    const res = await page.goto("/halaman-yang-tidak-ada-xyz");
    expect(res?.status()).toBe(404);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(/tidak ditemukan/i).first()).toBeVisible();
    // Menyediakan jalan kembali bagi pengguna.
    await expect(page.locator("a[href]").first()).toBeVisible();
    // Tidak membocorkan detail internal/stack trace.
    await expect(page.locator("body")).not.toContainText(/at .*\.js:\d+/);
  });
});

test.describe("Header keamanan", () => {
  test("respons halaman login memuat header keamanan dasar", async ({
    request,
  }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
    expect(
      h["content-security-policy"] ?? h["x-frame-options"],
      "CSP frame-ancestors atau X-Frame-Options"
    ).toBeTruthy();
  });
});

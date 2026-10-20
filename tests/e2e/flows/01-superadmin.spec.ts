import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  OK_MSG,
  fillLogin,
  acceptConsentIfShown,
  anonPage,
  login,
  pageAs,
  readState,
  storageFile,
  writeState,
} from "./helpers";

/**
 * Superadmin: pengaturan identitas/SEO, validasi rentang keamanan, mode
 * pemeliharaan, pembuatan superadmin baru, dan penampil log.
 * TC-SET-01, 05, 07 (validasi rentang), 08, 09.
 */
test.use({ storageState: storageFile("superadmin") });

async function openTab(page: Page, name: string) {
  await page.goto("/pengaturan");
  await page.getByRole("tab", { name }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute(
    "aria-selected",
    "true"
  );
}

test("TC-SET-01 identitas & SEO tersimpan dan tampil di judul halaman", async ({
  page,
  browser,
}) => {
  const { run } = readState();
  const newName = `SPMI E2E ${run}`;
  await openTab(page, "Identitas & SEO");
  const nameInput = page.getByRole("textbox", { name: /^Nama Sistem/ });
  const original = await nameInput.inputValue();
  const keywords = page.getByRole("textbox", { name: /Kata Kunci/ });

  try {
    await nameInput.fill(newName);
    await keywords.fill(`spmi, e2e, ${run}`);
    await page.getByRole("button", { name: "Simpan Identitas" }).click();
    await expect(page.getByText(OK_MSG)).toBeVisible();

    // Persist setelah muat ulang.
    await openTab(page, "Identitas & SEO");
    await expect(nameInput).toHaveValue(newName);
    await expect(keywords).toHaveValue(`spmi, e2e, ${run}`);

    // Tampil di halaman login (tanpa sesi).
    const { context: anon, page: p } = await anonPage(browser);
    await p.goto("/login");
    await expect(p.locator("h1")).toHaveText(newName);
    // Nama sistem dipakai sebagai application-name. CATATAN (temuan rendah):
    // judul tab memakai sufiks tetap "SPMI Universitas Pahlawan", bukan Nama
    // Sistem, walau petunjuk form menyebut "Tampil di judul halaman & tab".
    await expect(p.locator('meta[name="application-name"]')).toHaveAttribute(
      "content",
      newName
    );
    await anon.close();
  } finally {
    await openTab(page, "Identitas & SEO");
    await nameInput.fill(original || "Sistem Informasi SPMI");
    await page.getByRole("button", { name: "Simpan Identitas" }).click();
    await expect(page.getByText(OK_MSG)).toBeVisible();
  }
});

test("TC-SET-07 kebijakan keamanan: rentang divalidasi di klien & server", async ({
  page,
}) => {
  await openTab(page, "Keamanan");
  const days = page.getByRole("spinbutton", { name: /^Masa Sesi/ });
  const save = page.getByRole("button", { name: "Simpan Kebijakan Keamanan" });

  // Validasi klien (pesan Indonesia inline).
  await days.fill("31");
  await save.click();
  await expect(page.getByText("Nilai maksimal 30.")).toBeVisible();
  await days.fill("0");
  await save.click();
  await expect(page.getByText("Nilai minimal 1.")).toBeVisible();

  // Validasi server: lewati batasan HTML (klien jahat / DevTools).
  await page
    .locator("form")
    .filter({ has: save })
    .evaluate((f) => {
      (f as HTMLFormElement).noValidate = true;
      f.querySelectorAll("input").forEach((i) => {
        i.removeAttribute("min");
        i.removeAttribute("max");
      });
    });
  await days.fill("31");
  await save.click();
  await expect(
    page.getByText("Nilai security.sessionDays harus bilangan bulat 1–30.")
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: /^Maks\. Percobaan Login/ })
    .fill("9");
  await days.fill("7");
  await save.click();
  await expect(
    page.getByText("Nilai security.loginMaxAttempts harus bilangan bulat 1–5.")
  ).toBeVisible();

  // Nilai valid tersimpan.
  await page
    .getByRole("spinbutton", { name: /^Maks\. Percobaan Login/ })
    .fill("5");
  await days.fill("7");
  await save.click();
  await expect(page.getByText(OK_MSG)).toBeVisible();
  await openTab(page, "Keamanan");
  await expect(days).toHaveValue("7");
});

test("TC-SET-08 mode pemeliharaan: non-superadmin diblokir, superadmin tetap bisa", async ({
  page,
  browser,
}) => {
  const { run } = readState();
  const msg = `Pemeliharaan E2E ${run}`;
  const box = page.getByRole("checkbox", {
    name: "Aktifkan mode pemeliharaan",
  });
  const save = page.getByRole("button", { name: "Simpan", exact: true });

  await openTab(page, "Pemeliharaan");
  await box.check();
  await page.getByRole("textbox", { name: "Pesan Pemeliharaan" }).fill(msg);
  await save.click();
  await expect(page.getByText(OK_MSG)).toBeVisible();

  try {
    // Admin LPM dengan sesi aktif melihat halaman pemeliharaan.
    const admin = await pageAs(browser, "lpmAdmin");
    await admin.page.goto("/dashboard");
    await expect(admin.page.getByText(msg)).toBeVisible();
    await expect(
      admin.page.getByRole("heading", {
        name: "Dashboard Monitoring & Analisis",
      })
    ).toHaveCount(0);
    // Route handler juga menolak (503).
    const exp = await admin.page.request.get("/api/export?cycleId=1");
    expect(exp.status()).toBe(503);
    await admin.context.close();

    // Login baru non-superadmin ditolak dengan pesan pemeliharaan.
    const { context: anon, page: p } = await anonPage(browser);
    await fillLogin(p, ACCOUNTS.lpmMember.email, ACCOUNTS.lpmMember.password);
    await expect(p.getByText(msg)).toBeVisible();
    await expect(p).toHaveURL(/\/login/);
    await anon.close();

    // Superadmin tetap dapat memakai sistem.
    await page.goto("/dashboard");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(msg)).toHaveCount(0);
  } finally {
    await openTab(page, "Pemeliharaan");
    await box.uncheck();
    await save.click();
    await expect(page.getByText(OK_MSG)).toBeVisible();
  }

  // Setelah dimatikan, admin kembali normal.
  const admin = await pageAs(browser, "lpmAdmin");
  await admin.page.goto("/dashboard");
  await expect(admin.page.getByText(msg)).toHaveCount(0);
  await expect(admin.page.locator("h1").first()).toBeVisible();
  await admin.context.close();
});

test("TC-SET-09 buat superadmin baru (validasi + login), Admin LPM tidak bisa buka Pengaturan", async ({
  page,
  browser,
}) => {
  const { run } = readState();
  const sa = {
    name: `Superadmin E2E ${run}`,
    email: `sa-${run}@e2e.test`,
    password: `SaBaru${run}9`,
  };
  await openTab(page, "Superadmin");
  const form = page.locator("form").filter({ hasText: "Buat Superadmin Baru" });
  // React 19 mengosongkan form setelah setiap aksi: isi ulang semua field.
  const submit = async (email: string, password: string) => {
    await form.getByRole("textbox", { name: /^Nama Lengkap/ }).fill(sa.name);
    await form.getByRole("textbox", { name: /^Email/ }).fill(email);
    await form.getByLabel(/^Kata Sandi/).fill(password);
    await form.getByRole("button", { name: "Buat Superadmin" }).click();
  };

  // Kebijakan kata sandi (server): huruf + angka.
  await submit(sa.email, "abcdefgh");
  await expect(form.getByRole("alert")).toContainText(/angka/i);

  // Email duplikat (beda huruf besar) ditolak.
  await submit(ACCOUNTS.superadmin.email.toUpperCase(), sa.password);
  await expect(form.getByRole("alert")).toHaveText("Email sudah terdaftar.");

  await submit(sa.email, sa.password);
  await expect(form.getByText(OK_MSG)).toBeVisible();
  await openTab(page, "Superadmin");
  await expect(page.getByText(sa.email)).toBeVisible();
  writeState({ newSuperadmin: sa });

  // Superadmin baru dapat login & membuka Pengaturan.
  const { context: ctx, page: p } = await anonPage(browser);
  await login(p, sa.email, sa.password);
  await acceptConsentIfShown(p);
  await p.goto("/pengaturan");
  await expect(p).toHaveURL(/\/pengaturan/);
  await expect(
    p.getByRole("heading", { name: "Pengaturan Sistem" })
  ).toBeVisible();
  await ctx.close();

  // Admin LPM dialihkan dari /pengaturan.
  const admin = await pageAs(browser, "lpmAdmin");
  await admin.page.goto("/pengaturan");
  await expect(admin.page).toHaveURL(/\/dashboard/);
  await admin.context.close();
});

test("TC-SET-05 penampil log: login gagal tercatat dengan email tersamar, aktivitas tercatat", async ({
  page,
  browser,
}) => {
  const { run } = readState();
  const bogus = `tidakada-${run}@e2e.test`;
  const { context: anon, page: p } = await anonPage(browser);
  await fillLogin(p, bogus, "SalahSekali1");
  await expect(p.getByText("Email atau kata sandi salah.")).toBeVisible();
  await anon.close();

  await openTab(page, "Log & Pemantauan");
  const panel = page.getByRole("tabpanel");
  // Email disamarkan (t***@e2e.test), tidak utuh.
  await expect(panel.getByText("t***@e2e.test").first()).toBeVisible();
  await expect(panel.getByText(bogus)).toHaveCount(0);
  await expect(panel.getByText("Akun tidak ditemukan").first()).toBeVisible();
  // Log aktivitas berisi perubahan pengaturan & pembuatan superadmin.
  await expect(panel.getByText("settings.update").first()).toBeVisible();
  await expect(panel.getByText("superadmin.create").first()).toBeVisible();
});

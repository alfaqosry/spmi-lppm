import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  UNITS,
  acceptConsentIfShown,
  anonPage,
  fakePdfFile,
  isPdf,
  login,
  need,
  pageAs,
  pdfFile,
  pdfText,
  storageFile,
  textFile,
  writeState,
  readState,
} from "./helpers";

/**
 * Auditee (Kepala/Anggota Unit TI): hanya melihat butir yang berlaku untuk
 * unitnya (UI & payload), menjawab Ya+bukti / Tidak+alasan, RTL, peringatan
 * isian belum disimpan, banner batas waktu, RBAC halaman admin, bukti &
 * laporan unit lain ditolak, rangkap jabatan.
 */
test.use({ storageState: storageFile("head") });

/**
 * Form jawaban sebuah butir. Ditambatkan pada teks butir (bukan peran ARIA)
 * agar tetap ditemukan walau grupnya terlipat (atribut hidden).
 */
function answerForm(page: Page, question: string): Locator {
  return page
    .locator("div.rounded-xl.border")
    .filter({ has: page.locator("p", { hasText: question }) })
    .filter({ has: page.locator('input[name="questionId"]') })
    .locator("form")
    .first();
}
/** Kartu butir (induk langsung form jawaban). */
const card = (form: Locator) => form.locator("xpath=..");

/** Buka grup standar yang terlipat (grup lengkap dilipat dengan atribut hidden). */
async function reveal(form: Locator) {
  // Klik sebelum hidrasi React hilang begitu saja → ulangi sampai grup terbuka.
  await expect(async () => {
    if (!(await form.isVisible())) {
      // Tombol header grup = saudara sebelum panel ber-atribut hidden.
      await form.evaluate((f) => {
        const panel = f.closest("div[hidden]");
        (panel?.previousElementSibling as HTMLElement | null)?.click();
      });
    }
    await expect(form).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
}

async function choose(form: Locator, label: "Ya" | "Tidak") {
  await reveal(form);
  await form
    .locator("label")
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .click();
}

async function submit(form: Locator) {
  await form.getByRole("button", { name: "Simpan Jawaban" }).click();
}

test("TC-SIK-05/HE-01 banner batas waktu & hanya butir yang berlaku untuk unit", async ({
  page,
}) => {
  const q = need("q");
  const std = need("std");
  await page.goto("/audit");
  const banner = page
    .getByRole("status")
    .filter({ hasText: "Batas pengisian" });
  await expect(banner).toContainText("Segera berakhir");
  await expect(banner).toContainText(/hari lagi|Hari terakhir/);

  for (const t of [q.umum1, q.umum2, q.prodi1, q.ti1]) {
    await expect(page.getByText(t, { exact: true })).toBeVisible();
  }
  for (const t of [q.perpus1, q.biro1, q.moved, std.perpus, std.biro]) {
    await expect(page.getByText(t, { exact: true })).toHaveCount(0);
  }
  // Progres hanya menghitung butir yang berlaku (4).
  await expect(page.getByText(/^\d+\/4 \(\d+%\)$/)).toBeVisible();
});

test("koordinator #4: HTML & payload RSC /audit tidak memuat butir/standar unit lain", async ({
  page,
}) => {
  const q = need("q");
  const std = need("std");
  const forbidden = [q.perpus1, q.biro1, q.moved, std.perpus, std.biro];

  // (1) HTML dokumen (SSR + payload RSC ter-inline).
  const html = await (await page.request.get("/audit")).text();
  expect(html).toContain(q.ti1);
  for (const f of forbidden)
    expect(html, `HTML memuat "${f}"`).not.toContain(f);

  // (2) Respons RSC saat navigasi sisi klien ke /audit.
  const bodies: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/audit")) {
      try {
        bodies.push(await r.text());
      } catch {
        /* abaikan */
      }
    }
  });
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Audit & Verifikasi" }).click();
  await expect(page).toHaveURL(/\/audit/);
  await expect(page.getByText(q.ti1, { exact: true })).toBeVisible();
  const rsc = bodies.join("\n");
  expect(rsc.length).toBeGreaterThan(0);
  for (const f of forbidden) expect(rsc, `RSC memuat "${f}"`).not.toContain(f);
});

test("TC-AUD-07/10/09 jawaban Ya: tanpa bukti, tautan berbahaya, berkas palsu ditolak; PDF diterima", async ({
  page,
}) => {
  const q = need("q");
  await page.goto("/audit");
  const form = answerForm(page, q.umum1);
  await choose(form, "Ya");
  await submit(form);
  await expect(form.getByRole("alert")).toHaveText(
    "Jawaban Ya wajib disertai bukti (file atau tautan)."
  );

  const link = form.getByRole("textbox", { name: /Atau tautan bukti/ });
  for (const bad of [
    "javascript:alert(document.cookie)",
    "data:text/html,<b>x</b>",
  ]) {
    await choose(form, "Ya");
    await link.fill(bad);
    await submit(form);
    await expect(form.getByRole("alert")).toHaveText(
      "Tautan bukti tidak valid. Gunakan alamat http/https."
    );
  }
  for (const [file, msg] of [
    [fakePdfFile(), "Berkas bukan PDF yang valid."],
    [
      textFile(),
      "Tipe file tidak diizinkan. Hanya berkas PDF yang diperbolehkan.",
    ],
  ] as const) {
    await choose(form, "Ya");
    await link.fill("");
    await form.getByLabel(/^Bukti/).setInputFiles(file);
    await submit(form);
    await expect(form.getByRole("alert")).toHaveText(msg);
  }

  await choose(form, "Ya");
  await link.fill("");
  await form.getByLabel(/^Bukti/).setInputFiles(pdfFile("bukti-ti.pdf"));
  await submit(form);
  await expect(form.getByRole("status")).toHaveText("Berhasil disimpan.");
  await expect(card(form).getByText("Menunggu Verifikasi")).toBeVisible();
  const ev = form.getByRole("link", { name: /Bukti terunggah saat ini/ });
  const href = await ev.getAttribute("href");
  expect(href).toMatch(/^\/uploads\/bukti\/[\w-]+\.pdf$/);
  writeState({ evidence: { ...readState().evidence, ti: href! } });
  await expect(page.getByText(/^1\/4 \(25%\)$/)).toBeVisible();

  // Jawaban Ya dengan tautan https (butir kedua).
  const f2 = answerForm(page, q.prodi1);
  await choose(f2, "Ya");
  await f2
    .getByRole("textbox", { name: /Atau tautan bukti/ })
    .fill("https://drive.example.com/bukti-e2e");
  await submit(f2);
  await expect(f2.getByRole("status")).toHaveText("Berhasil disimpan.");
});

test("TC-AUD-08/15 jawaban Tidak: alasan wajib; RTL tersimpan", async ({
  page,
}) => {
  const q = need("q");
  const reason = `Belum tersedia (E2E ${readState().run})`;
  const rtl = `RTL E2E ${readState().run}: susun dokumen bulan depan`;
  await page.goto("/audit");
  const form = answerForm(page, q.umum2);
  await choose(form, "Tidak");
  await submit(form);
  await expect(form.getByText("Kolom ini wajib diisi.")).toBeVisible();
  await form.getByRole("textbox", { name: /^Alasan/ }).fill(reason);
  await submit(form);
  await expect(form.getByRole("status")).toHaveText("Berhasil disimpan.");

  const rtlForm = card(form)
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Simpan RTL" }) });
  await rtlForm
    .getByRole("textbox", { name: "Rencana tindak lanjut" })
    .fill(rtl);
  await rtlForm.getByRole("button", { name: "Simpan RTL" }).click();
  await expect(rtlForm.getByRole("status")).toHaveText("Berhasil disimpan.");
  writeState({ rtl });
});

test("HE-08 peringatan isian belum disimpan saat meninggalkan halaman", async ({
  page,
}) => {
  const q = need("q");
  await page.goto("/audit");
  const form = answerForm(page, q.ti1);
  await choose(form, "Tidak");
  await expect(card(form).getByText("Belum disimpan")).toBeVisible();
  await expect(page.getByText("1 isian belum disimpan")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const dlg = page.getByRole("alertdialog", {
    name: "Buang isian yang belum disimpan?",
  });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Tetap di sini" }).click();
  await expect(dlg).toBeHidden();
  await expect(page).toHaveURL(/\/audit/);
  await expect(page.getByText("1 isian belum disimpan")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await dlg.getByRole("button", { name: "Buang perubahan" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("TC-AUD-11/12 manipulasi field tersembunyi (unitId / existingFile) ditolak", async ({
  page,
  browser,
}) => {
  const q = need("q");
  const ids = need("unitIds");

  // Siapkan bukti unit Perpustakaan (oleh Kepala Perpustakaan).
  const perpus = await pageAs(browser, "perpusHead");
  await perpus.page.goto("/audit");
  const pf = answerForm(perpus.page, q.perpus1);
  await choose(pf, "Ya");
  await pf.getByLabel(/^Bukti/).setInputFiles(pdfFile("bukti-perpus.pdf"));
  await submit(pf);
  await expect(pf.getByRole("status")).toHaveText("Berhasil disimpan.");
  const perpusHref = await pf
    .getByRole("link", { name: /Bukti terunggah saat ini/ })
    .getAttribute("href");
  writeState({ evidence: { ...readState().evidence, perpus: perpusHref! } });
  await perpus.context.close();

  /** Ubah nilai input tersembunyi tepat sebelum kirim (React menimpanya saat render ulang). */
  const tamperAndSubmit = async (
    form: Locator,
    name: string,
    value: string
  ) => {
    await form.evaluate(
      (f, [n, v]) => {
        const el = f.querySelector<HTMLInputElement>(`input[name="${n}"]`)!;
        el.value = v;
        (f as HTMLFormElement).requestSubmit(
          f.querySelector<HTMLButtonElement>('button[type="submit"]')!
        );
      },
      [name, value] as const
    );
  };

  await page.goto("/audit");
  // unitId → unit lain.
  const form = answerForm(page, q.umum1);
  await choose(form, "Tidak");
  await form.getByRole("textbox", { name: /^Alasan/ }).fill("uji IDOR");
  await tamperAndSubmit(form, "unitId", String(ids[UNITS.perpus]));
  await expect(form.getByRole("alert")).toHaveText(
    "Anda tidak memiliki akses ke unit tersebut."
  );

  // existingFile → "meminjam" bukti unit lain.
  await page.goto("/audit");
  const f2 = answerForm(page, q.umum1);
  await choose(f2, "Ya");
  await f2.getByRole("textbox", { name: /Atau tautan bukti/ }).fill("");
  await tamperAndSubmit(f2, "existingFile", perpusHref!);
  await expect(f2.getByRole("alert")).toHaveText(
    "Jawaban Ya wajib disertai bukti (file atau tautan)."
  );
  // Bukti asli butir ini tidak berubah.
  await page.goto("/audit");
  const f3 = answerForm(page, q.umum1);
  await choose(f3, "Ya");
  await expect(
    f3.getByRole("link", { name: /Bukti terunggah saat ini/ })
  ).toHaveAttribute("href", readState().evidence!.ti!);
});

test("TC-AUD-19 bukti unit lain tidak dapat diunduh; bukti unit sendiri bisa", async ({
  page,
  browser,
}) => {
  const ev = need("evidence");
  expect((await page.request.get(ev.ti!)).status()).toBe(200);
  expect((await page.request.get(ev.perpus!)).status()).toBe(403);
  // Rute baru & URL lama.
  expect(
    (
      await page.request.get(ev.perpus!.replace("/uploads/", "/api/files/"))
    ).status()
  ).toBe(403);

  // Anggota unit TI juga boleh membaca bukti unitnya.
  const member = await pageAs(browser, "member");
  const r = await member.page.request.get(ev.ti!);
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("application/pdf");
  expect(r.headers()["cache-control"]).toContain("no-store");
  expect((await member.page.request.get(ev.perpus!)).status()).toBe(403);
  await member.context.close();

  // Kepala Perpustakaan tidak boleh membaca bukti TI.
  const perpus = await pageAs(browser, "perpusHead");
  expect((await perpus.page.request.get(ev.ti!)).status()).toBe(403);
  await perpus.context.close();

  // Tanpa sesi.
  const anon = await anonPage(browser);
  expect((await anon.page.request.get(ev.ti!)).status()).toBe(401);
  await anon.context.close();
});

test("TC-ANL-05/07 ekspor PDF: unit sendiri boleh, unit lain & keseluruhan ditolak, parameter divalidasi", async ({
  page,
}) => {
  const cycleId = need("cycleId");
  const ids = need("unitIds");
  const own = await page.request.get(
    `/api/export?cycleId=${cycleId}&unitId=${ids[UNITS.ti]}`
  );
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toBe("application/pdf");
  expect(isPdf(await own.body())).toBe(true);

  const other = await page.request.get(
    `/api/export?cycleId=${cycleId}&unitId=${ids[UNITS.perpus]}`
  );
  expect(other.status()).toBe(403);
  expect(await other.json()).toEqual({ error: "Akses ditolak." });
  expect(
    (await page.request.get(`/api/export?cycleId=${cycleId}`)).status()
  ).toBe(403);
  expect((await page.request.get(`/api/export`)).status()).toBe(400);
  expect(
    (
      await page.request.get(`/api/export?cycleId=${cycleId}&unitId=abc`)
    ).status()
  ).toBe(400);
});

test("koordinator #5: PDF unit TI tidak memuat standar/butir unit lain", async ({
  page,
}) => {
  const cycleId = need("cycleId");
  const ids = need("unitIds");
  const std = need("std");
  const q = need("q");
  const res = await page.request.get(
    `/api/export?cycleId=${cycleId}&unitId=${ids[UNITS.ti]}`
  );
  const text = pdfText(await res.body());
  // Sanity: ekstraksi bekerja (standar milik TI ada).
  expect(text).toContain(std.ti);
  for (const f of [std.perpus, std.biro, q.perpus1, q.biro1, q.moved]) {
    expect(text, `PDF unit TI memuat "${f}"`).not.toContain(f);
  }
});

test("TC-DSH-02 dashboard unit: unduh PDF unit sendiri", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard Unit" })
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: `Unduh laporan PDF ${UNITS.ti}` })
    .click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/^Laporan_Unit_.*\.pdf$/);
});

test("TC-SIK-06/UNT-05 auditee (kepala & anggota) dialihkan dari halaman admin", async ({
  page,
  browser,
}) => {
  const paths = [
    "/siklus",
    "/unit",
    "/role-penempatan",
    "/pengaturan",
    "/analitik",
  ];
  for (const p of paths) {
    await page.goto(p);
    await expect(page, p).toHaveURL(/\/dashboard/);
  }
  const member = await pageAs(browser, "member");
  for (const p of paths) {
    await member.page.goto(p);
    await expect(member.page, p).toHaveURL(/\/dashboard/);
  }
  // Menu admin tidak tampil.
  const nav = member.page.getByRole("navigation", { name: "Menu utama" });
  for (const label of [
    "Siklus & Periode",
    "Unit Audit",
    "Role & Penempatan",
    "Pengaturan",
    "Analitik & Laporan",
  ]) {
    await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
  }
  await member.context.close();
});

test("TC-ROL-05/AUD-20 rangkap jabatan: pemilih unit & butir sesuai unit aktif", async ({
  browser,
}) => {
  const u = need("multiUser");
  const q = need("q");
  const e2eUnit = need("e2eUnitName");
  const { context, page } = await anonPage(browser);
  await login(page, u.email, u.password);
  await acceptConsentIfShown(page);
  await page.goto("/audit");
  const picker = page.getByRole("group", { name: "Pilih unit yang diisi" });
  await expect(picker.getByRole("button")).toHaveCount(2);
  const tiBtn = picker.getByRole("button", { name: UNITS.ti });
  const e2eBtn = picker.getByRole("button", { name: new RegExp(e2eUnit) });
  await expect(e2eBtn).toContainText("Kepala");

  await tiBtn.click();
  // Grup yang sudah lengkap dilipat (atribut hidden) — periksa keberadaan di DOM.
  await expect(page.getByText(q.ti1, { exact: true })).toHaveCount(1);

  // Isian belum disimpan → konfirmasi saat pindah unit.
  await choose(answerForm(page, q.prodi1), "Tidak");
  await e2eBtn.click();
  const dlg = page.getByRole("alertdialog", {
    name: "Buang isian yang belum disimpan?",
  });
  await expect(dlg).toContainText(e2eUnit);
  await dlg.getByRole("button", { name: "Buang perubahan" }).click();
  await expect(e2eBtn).toHaveAttribute("aria-pressed", "true");

  // Unit E2E (kategori Biro): butir Biro tampil, butir TI/Prodi tidak.
  await expect(page.getByText(q.biro1, { exact: true })).toHaveCount(1);
  await expect(page.getByText(q.umum1, { exact: true })).toHaveCount(1);
  await expect(page.getByText(q.ti1, { exact: true })).toHaveCount(0);
  await expect(page.getByText(q.prodi1, { exact: true })).toHaveCount(0);
  await context.close();
});

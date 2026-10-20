import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  UNITS,
  isPdf,
  need,
  pageAs,
  pdfText,
  readState,
  storageFile,
  writeState,
} from "./helpers";

/**
 * Verifikasi LPM (Anggota LPM): Sesuai / Minta Revisi (+catatan), RTL tampil
 * di panel, auditee melihat "Perlu Revisi" & filter, jawaban ulang kembali
 * menunggu verifikasi, progres dashboard, analitik & ekspor PDF.
 */
test.use({ storageState: storageFile("lpmMember") });

async function openPanel(page: Page) {
  await page.goto("/audit");
  await page.getByRole("tab", { name: "Panel Verifikasi LPM" }).click();
  await page
    .getByRole("combobox", { name: "Saring berdasarkan unit" })
    .selectOption({ label: UNITS.ti });
}

/** Baris verifikasi untuk sebuah butir. */
function verifyRow(page: Page, question: string): Locator {
  return page
    .locator("div.px-4.py-3")
    .filter({ has: page.getByText(question, { exact: true }) });
}

async function openVerify(row: Locator) {
  const btn = row.getByRole("button", { name: "Verifikasi", exact: true });
  if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
}

test("TC-AUD-13 verifikasi (Sesuai) & bukti dapat dibuka LPM", async ({
  page,
}) => {
  const q = need("q");
  const ev = need("evidence");
  await openPanel(page);
  const row = verifyRow(page, q.umum1);
  await openVerify(row);
  const pdf = row.getByRole("link", { name: "Lihat Bukti PDF" });
  await expect(pdf).toHaveAttribute("href", ev.ti!);
  expect((await page.request.get(ev.ti!)).status()).toBe(200);
  expect((await page.request.get(ev.perpus!)).status()).toBe(200);

  await row.getByRole("button", { name: "Verifikasi (Sesuai)" }).click();
  await expect(row.getByText("Terverifikasi", { exact: true })).toBeVisible();
  await expect(row.getByText(`oleh ${ACCOUNTS.lpmMember.name}`)).toBeVisible();
});

test("TC-AUD-14/15 minta revisi: catatan wajib; RTL auditee tampil", async ({
  page,
}) => {
  const q = need("q");
  const rtl = need("rtl");
  const note = `Lengkapi SK pendukung (E2E ${readState().run})`;
  await openPanel(page);
  const row = verifyRow(page, q.umum2);
  await openVerify(row);
  await expect(row.getByText(`RTL: ${rtl}`)).toBeVisible();
  await expect(row.getByText(/^Alasan: /)).toBeVisible();

  await row.getByRole("button", { name: "Minta Revisi" }).click();
  await expect(row.getByRole("alert")).toHaveText(
    "Catatan revisi wajib diisi."
  );
  // React 19 mengosongkan form setelah aksi; reset dapat tiba setelah fill()
  // → isi & kirim ulang sampai status berubah.
  const notes = row.getByRole("textbox", { name: /^Catatan Verifikasi/ });
  await expect(async () => {
    await notes.fill(note);
    await expect(notes).toHaveValue(note);
    await row.getByRole("button", { name: "Minta Revisi" }).click();
    await expect(row.getByText("Perlu Revisi", { exact: true })).toBeVisible({
      timeout: 4_000,
    });
  }).toPass({ timeout: 30_000 });
  writeState({ revisionNote: note });

  // Saring status.
  await page
    .getByRole("combobox", { name: "Saring berdasarkan status verifikasi" })
    .selectOption("revision");
  await expect(verifyRow(page, q.umum2)).toBeVisible();
  await expect(verifyRow(page, q.umum1)).toHaveCount(0);
});

test("TC-AUD-15/HE-02 auditee melihat badge 'Perlu Revisi', catatan LPM & filter revisi", async ({
  browser,
}) => {
  const q = need("q");
  const note = need("revisionNote");
  const { context, page } = await pageAs(browser, "head");
  await page.goto("/audit");
  await expect(page.getByText("1 butir perlu revisi")).toBeVisible();
  await expect(page.getByText(`Catatan revisi LPM: ${note}`)).toBeVisible();

  const filter = page.getByRole("button", {
    name: "Tampilkan hanya yang perlu revisi",
  });
  await filter.click();
  await expect(
    page.getByRole("button", { name: "Tampilkan semua butir" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(q.umum2, { exact: true })).toBeVisible();
  await expect(page.getByText(q.umum1, { exact: true })).toBeHidden();
  await expect(page.getByText(q.ti1, { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Tampilkan semua butir" }).click();
  await context.close();
});

test("TC-DSH-01/03 dashboard LPM: progres per unit diperbarui", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard Monitoring & Analisis" })
  ).toBeVisible();
  const table = page.getByRole("table", {
    name: "Progres pengisian audit per unit",
  });
  const status = (unit: string) =>
    table.getByRole("row").filter({ hasText: unit }).getByRole("cell").nth(3);
  await expect(status(UNITS.ti)).toHaveText(/Selesai|Sedang Mengisi/);
  await expect(status(UNITS.perpus)).toHaveText("Sedang Mengisi");
  await expect(status(UNITS.mnj)).toHaveText("Belum Mulai");
});

test("TC-ANL-01/02/03 analitik: tampil per siklus; unduh PDF keseluruhan & per unit", async ({
  page,
}) => {
  const cycleId = need("cycleId");
  const cycleName = need("cycleName");
  const std = need("std");
  await page.goto("/analitik");
  // Pemilih siklus langsung memuat siklus terpilih (tanpa tombol "Tampilkan").
  const select = page.locator("select#cycleId");
  await select.selectOption({ label: "Siklus 2025/2026" });
  await expect(page).not.toHaveURL(new RegExp(`cycleId=${cycleId}(&|$)`));
  await expect(page).toHaveURL(/cycleId=\d+/);
  await select.selectOption(String(cycleId));
  await expect(page).toHaveURL(new RegExp(`cycleId=${cycleId}(&|$)`));
  await expect(
    page.getByRole("heading", { name: "Analitik & Laporan Audit" })
  ).toBeVisible();

  const dl = page.waitForEvent("download");
  await page
    .getByRole("button", { name: `Unduh laporan PDF ${cycleName}` })
    .click();
  const d = await dl;
  expect(d.suggestedFilename()).toBe(
    `Laporan_Audit_SPMI_${cycleName.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`
  );

  const res = await page.request.get(`/api/export?cycleId=${cycleId}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const body = await res.body();
  expect(isPdf(body)).toBe(true);
  expect(body.length).toBeGreaterThan(2_000);
  const text = pdfText(body);
  expect(text).toContain(std.umum);
  // Blok tanda tangan memuat Ketua LPM yang ditunjuk (TC-ROL-08 / N-02).
  expect(text).toContain(ACCOUNTS.lpmAdmin2.name!);

  const dl2 = page.waitForEvent("download");
  await page
    .getByRole("button", { name: `Unduh laporan PDF ${UNITS.ti}` })
    .click();
  expect((await dl2).suggestedFilename()).toMatch(
    /^Laporan_Unit_Program_Studi_Teknik_Informatika_/
  );
});

test("TC-ANL-08 ganti siklus di dropdown lalu unduh → PDF siklus yang dipilih", async ({
  page,
}) => {
  const cycleId = need("cycleId");
  await page.goto(`/analitik?cycleId=${cycleId}`);
  const select = page.locator("select#cycleId");
  await select.selectOption({ label: "Siklus 2025/2026" });
  // Tombol unduh mengikuti siklus terpilih (halaman dimuat ulang saat berganti).
  const btn = page.getByRole("button", {
    name: "Unduh laporan PDF Siklus 2025/2026",
  });
  await expect(btn).toBeEnabled();
  await expect(
    page.getByRole("button", { name: `Unduh laporan PDF ${need("cycleName")}` })
  ).toHaveCount(0);
  const dl = page.waitForEvent("download");
  await btn.click();
  expect(
    (await dl).suggestedFilename(),
    "HE-07: PDF harus untuk siklus yang dipilih di dropdown"
  ).toContain("Siklus_2025_2026");
});

test("TC-AUD-16 auditee mengubah jawaban → kembali 'Menunggu Verifikasi'", async ({
  browser,
  page,
}) => {
  const q = need("q");
  const head = await pageAs(browser, "head");
  await head.page.goto("/audit");
  const form = head.page
    .locator("div.rounded-xl.border")
    .filter({ has: head.page.locator("p", { hasText: q.umum2 }) })
    .filter({ has: head.page.locator('input[name="questionId"]') })
    .locator("form")
    .first();
  await form
    .getByRole("textbox", { name: /^Alasan/ })
    .fill("Alasan diperbarui setelah revisi (E2E)");
  await form.getByRole("button", { name: "Simpan Jawaban" }).click();
  await expect(form.getByRole("status")).toHaveText("Berhasil disimpan.");
  await expect(head.page.getByText("1 butir perlu revisi")).toHaveCount(0);
  await head.context.close();

  // LPM: status kembali menunggu, catatan & verifikator dihapus.
  await openPanel(page);
  const row = verifyRow(page, q.umum2);
  await expect(
    row.getByText("Menunggu Verifikasi", { exact: true })
  ).toBeVisible();
  await expect(row.getByText(/^oleh /)).toHaveCount(0);
});

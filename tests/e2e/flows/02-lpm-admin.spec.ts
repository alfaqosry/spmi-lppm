import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  OK_MSG,
  UNITS,
  anonPage,
  fakePdfFile,
  fillLogin,
  jsPdfFile,
  need,
  pageAs,
  pdfFile,
  readState,
  setMaintenance,
  storageFile,
  textFile,
  wibDate,
  writeState,
} from "./helpers";
import {
  addQuestionsBulk,
  addStandard,
  openCategory,
  readUnitIds,
  selectScopeTab,
  standardBlock,
  standardForm,
} from "./audit-ui";

/**
 * Admin LPM: siklus, unit, akun & penempatan, Ketua LPM, dokumen, standar &
 * butir (cakupan semua/kategori/unit), ubah cakupan, hapus dengan konfirmasi
 * ketik, aturan cakupan standar ⊇ butir, dan penolakan saat pemeliharaan.
 */
test.use({ storageState: storageFile("lpmAdmin") });

// Jaring pengaman: jangan pernah meninggalkan mode pemeliharaan menyala.
test.afterAll(async ({ browser }) => {
  await setMaintenance(browser, false);
});

/** Form ubah-nama standar yang sedang terbuka (hanya satu pada satu waktu). */
const editStandardForm = (page: Page) =>
  page
    .locator("form")
    .filter({ has: page.getByRole("textbox", { name: "Nama standar" }) })
    .filter({ has: page.getByRole("button", { name: "Batal" }) });

const S = () => readState();
const names = () => {
  const r = S().run;
  return {
    cycle: `E2E Siklus ${r}`,
    unitTmp: `E2E Unit Awal ${r}`,
    unit: `E2E Unit ${r}`,
    unitDel: `E2E Hapus Unit ${r}`,
    std: {
      umum: `E2E Std Umum ${r}`,
      prodi: `E2E Std Prodi ${r}`,
      ti: `E2E Std TI ${r}`,
      perpus: `E2E Std Perpus ${r}`,
      biro: `E2E Std Biro ${r}`,
      hapus: `E2E Std Hapus ${r}`,
      maint: `E2E Std Maint ${r}`,
      uiScope: `E2E Std UIScope ${r}`,
    },
    q: {
      umum1: `E2E Q Umum satu ${r}?`,
      umum2: `E2E Q Umum dua ${r}?`,
      prodi1: `E2E Q Prodi ${r}?`,
      moved: `E2E Q Pindah ${r}?`,
      ti1: `E2E Q TI ${r}?`,
      perpus1: `E2E Q Perpus ${r}?`,
      biro1: `E2E Q Biro ${r}?`,
      hapus1: `E2E Q Hapus ${r}?`,
      maint1: `E2E Q Maint ${r}?`,
    },
  };
};

/* ------------------------------------------------------------------ */
/*  Siklus                                                             */
/* ------------------------------------------------------------------ */

test("TC-SIK-01/03 siklus baru: validasi tanggal lalu tersimpan", async ({
  page,
}) => {
  const n = names();
  await page.goto("/siklus");
  await page.getByRole("button", { name: "Siklus Baru" }).click();
  const dlg = page.getByRole("dialog", { name: "Siklus Audit Baru" });
  await dlg.getByRole("textbox", { name: /^Nama Siklus/ }).fill(n.cycle);
  // Tanggal selesai < mulai ditolak server.
  await dlg.getByLabel(/^Tanggal Mulai/).fill(wibDate(5));
  await dlg.getByLabel(/^Batas Waktu/).fill(wibDate(-1));
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg.getByRole("alert")).toHaveText(
    "Tanggal selesai tidak boleh sebelum tanggal mulai."
  );
  // Tahun di luar 2000–2100 ditolak.
  await dlg.getByRole("textbox", { name: /^Nama Siklus/ }).fill(n.cycle);
  await dlg.getByLabel(/^Tanggal Mulai/).fill("1999-01-01");
  await dlg.getByLabel(/^Batas Waktu/).fill(wibDate(5));
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg.getByRole("alert")).toHaveText(
    "Tanggal mulai di luar rentang yang diizinkan."
  );
  // Valid (batas waktu 5 hari lagi → banner "segera berakhir" bagi auditee).
  await dlg.getByRole("textbox", { name: /^Nama Siklus/ }).fill(n.cycle);
  await dlg.getByLabel(/^Tanggal Mulai/).fill(wibDate(-1));
  await dlg.getByLabel(/^Batas Waktu/).fill(wibDate(5));
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg).toBeHidden();
  writeState({ cycleName: n.cycle });
  const card = page.locator("div.card").filter({ hasText: n.cycle });
  await expect(card).toBeVisible();
  await expect(card.getByText("Arsip")).toBeVisible();
});

test("TC-SIK-02 aktifkan siklus lewat dialog konfirmasi", async ({ page }) => {
  const n = names();
  await page.goto("/siklus");
  const card = page.locator("div.card").filter({ hasText: n.cycle });
  await card.getByRole("button", { name: "Aktifkan" }).click();
  const dlg = page.getByRole("alertdialog", { name: "Aktifkan siklus?" });
  await expect(dlg).toContainText(n.cycle);
  // Batal tidak mengubah apa pun.
  await dlg.getByRole("button", { name: "Batal" }).click();
  await expect(card.getByText("Arsip")).toBeVisible();

  await card.getByRole("button", { name: "Aktifkan" }).click();
  await expect(dlg).toContainText(/dinonaktifkan/);
  await dlg.getByRole("button", { name: "Aktifkan" }).click();
  await expect(page.getByRole("status")).toContainText(
    `Siklus “${n.cycle}” sekarang aktif.`
  );
  await expect(card.getByText("Aktif", { exact: true })).toBeVisible();
  // Hanya satu siklus aktif.
  await expect(page.getByText("Aktif", { exact: true })).toHaveCount(1);

  // id siklus dari pemilih siklus Analitik.
  await page.goto("/analitik");
  const value = await page
    .locator("select#cycleId option", { hasText: n.cycle })
    .getAttribute("value");
  expect(Number(value)).toBeGreaterThan(0);
  writeState({ cycleId: Number(value) });
});

test("TC-SIK-07 siklus aktif tidak dapat dihapus; konfirmasi ketik nama wajib", async ({
  page,
}) => {
  const n = names();
  await page.goto("/siklus");
  const card = page.locator("div.card").filter({ hasText: n.cycle });
  await card.getByRole("button", { name: "Hapus" }).click();
  const dlg = page.getByRole("alertdialog", { name: "Hapus siklus audit?" });
  const del = dlg.getByRole("button", { name: "Hapus Permanen" });
  await expect(del).toBeDisabled();
  await dlg.getByRole("textbox").fill("salah");
  await expect(del).toBeDisabled();
  await dlg.getByRole("textbox").fill(n.cycle);
  await expect(del).toBeEnabled();
  await del.click();
  // Server menolak (siklus aktif). Pesan sebaiknya menjelaskan alasannya.
  await expect(dlg.getByRole("alert")).toBeVisible();
  const text = (await dlg.getByRole("alert").textContent()) ?? "";
  await dlg.getByRole("button", { name: "Batal" }).click();
  await page.reload();
  await expect(card).toBeVisible();
  expect(
    text,
    "APP BUG: pesan galat menyalahkan koneksi, bukan 'Siklus aktif tidak dapat dihapus'"
  ).toContain("Siklus aktif tidak dapat dihapus");
});

/* ------------------------------------------------------------------ */
/*  Unit                                                               */
/* ------------------------------------------------------------------ */

test("TC-UNT-01/03 unit: tambah, ubah nama, hapus", async ({ page }) => {
  const n = names();
  await page.goto("/unit");
  for (const name of [n.unitTmp, n.unitDel]) {
    await page.getByRole("button", { name: "Unit Baru" }).click();
    const dlg = page.getByRole("dialog", { name: "Unit Audit Baru" });
    await dlg.getByRole("textbox", { name: /^Nama Unit/ }).fill(name);
    await dlg.getByRole("combobox", { name: /^Kategori/ }).selectOption("Biro");
    await dlg
      .getByRole("textbox", { name: /^Deskripsi/ })
      .fill("Dibuat oleh uji E2E");
    await dlg.getByRole("button", { name: "Simpan" }).click();
    await expect(dlg).toBeHidden();
    await expect(
      page.getByRole("heading", { name, exact: true })
    ).toBeVisible();
  }

  // Ubah nama.
  await page.getByRole("button", { name: `Ubah unit ${n.unitTmp}` }).click();
  const edit = page.getByRole("dialog", { name: "Ubah Unit Audit" });
  await edit.getByRole("textbox", { name: /^Nama Unit/ }).fill(n.unit);
  await edit.getByRole("button", { name: "Perbarui" }).click();
  await expect(edit).toBeHidden();
  await expect(
    page.getByRole("heading", { name: n.unit, exact: true })
  ).toBeVisible();

  // Hapus (dialog dampak).
  await page.getByRole("button", { name: `Hapus unit ${n.unitDel}` }).click();
  const dlg = page.getByRole("alertdialog", { name: "Hapus unit audit?" });
  await expect(dlg).toContainText("tidak dapat dibatalkan");
  await dlg.getByRole("button", { name: "Hapus Permanen" }).click();
  await expect(page.getByRole("status")).toContainText("telah dihapus");
  await expect(
    page.getByRole("heading", { name: n.unitDel, exact: true })
  ).toHaveCount(0);
  writeState({ e2eUnitName: n.unit });

  // id unit (untuk uji cakupan & IDOR).
  writeState({ unitIds: await readUnitIds(page) });
  const ids = S().unitIds!;
  for (const u of [UNITS.ti, UNITS.perpus, UNITS.mnj, UNITS.biro, n.unit]) {
    expect(ids[u], `id unit ${u}`).toBeGreaterThan(0);
  }
});

/* ------------------------------------------------------------------ */
/*  Akun, penempatan, Ketua LPM                                        */
/* ------------------------------------------------------------------ */

async function openAccountForm(page: Page, quick: string) {
  await page.goto("/role-penempatan");
  await page
    .locator("div.card")
    .filter({ hasText: "Tambah Akun Cepat" })
    .getByRole("button", { name: quick, exact: true })
    .click();
  const dlg = page.getByRole("dialog", { name: "Akun Pengguna Baru" });
  await expect(dlg).toBeVisible();
  return dlg;
}

async function fillAccount(
  dlg: ReturnType<Page["getByRole"]>,
  a: { name: string; email: string; password: string; unit?: string }
) {
  await dlg.getByRole("textbox", { name: /^Nama Lengkap/ }).fill(a.name);
  await dlg.getByRole("textbox", { name: /^Email/ }).fill(a.email);
  await dlg.getByLabel(/^Kata Sandi/).fill(a.password);
  if (a.unit) {
    await dlg.getByRole("combobox", { name: /^Unit/ }).selectOption({
      label: a.unit,
    });
  }
}

test("TC-ROL-01/02/03/04/10 validasi pembuatan akun", async ({ page }) => {
  const r = S().run;
  let dlg = await openAccountForm(page, "Anggota Unit");
  // R-01: auditee tanpa unit → validasi (wajib pilih unit).
  await fillAccount(dlg, {
    name: `E2E Val ${r}`,
    email: `val-${r}@e2e.test`,
    password: "Valid12345",
  });
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg.getByText("Pilih salah satu opsi.")).toBeVisible();

  // R-02: sandi 7 karakter → validasi klien; "abcdefgh" → server.
  await fillAccount(dlg, {
    name: `E2E Val ${r}`,
    email: `val-${r}@e2e.test`,
    password: "abc1234",
    unit: UNITS.biro,
  });
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg.getByText("Minimal 8 karakter (saat ini 7).")).toBeVisible();
  await fillAccount(dlg, {
    name: `E2E Val ${r}`,
    email: `val-${r}@e2e.test`,
    password: "abcdefgh",
    unit: UNITS.biro,
  });
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg.getByRole("alert")).toContainText(/angka/);

  // R-03: email terdaftar (huruf besar) ditolak.
  await fillAccount(dlg, {
    name: `E2E Val ${r}`,
    email: ACCOUNTS.member.email.toUpperCase(),
    password: "Valid12345",
    unit: UNITS.biro,
  });
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg.getByRole("alert")).toHaveText("Email sudah terdaftar.");
  await page.keyboard.press("Escape");

  // R-04: unit sudah punya Kepala.
  dlg = await openAccountForm(page, "Kepala Unit");
  await fillAccount(dlg, {
    name: `E2E Kepala ${r}`,
    email: `kepala2-${r}@e2e.test`,
    password: "Valid12345",
    unit: UNITS.ti,
  });
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg.getByRole("alert")).toContainText(
    `sudah memiliki Kepala Unit (${ACCOUNTS.head.name})`
  );
  await page.keyboard.press("Escape");

  // R-10: Admin LPM tidak dapat memberi peran Superadmin.
  dlg = await openAccountForm(page, "Admin LPM");
  await fillAccount(dlg, {
    name: `E2E Esk ${r}`,
    email: `esk-${r}@e2e.test`,
    password: "Valid12345",
  });
  await dlg
    .getByRole("combobox", { name: /^Peran/ })
    .selectOption("superadmin");
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg.getByRole("alert")).toHaveText(
    "Hanya Superadmin yang dapat memberikan peran Superadmin."
  );
});

test("TC-ROL-05 akun baru + penempatan kepala di unit kedua (rangkap jabatan)", async ({
  page,
}) => {
  const r = S().run;
  const unit = need("e2eUnitName");
  const multi = {
    name: `E2E Multi ${r}`,
    email: `multi-${r}@e2e.test`,
    password: "Rangkap2026x",
  };
  const privacy = {
    name: `E2E Privasi ${r}`,
    email: `privasi-${r}@e2e.test`,
    password: "Privasi2026x",
  };
  const guest = {
    name: `E2E Tamu ${r}`,
    email: `tamu-${r}@e2e.test`,
    password: "Tamu2026xx",
  };

  for (const [quick, a, u] of [
    ["Anggota Unit", multi, UNITS.ti],
    ["Anggota Unit", privacy, UNITS.perpus],
    ["Pengunjung (Tamu)", guest, undefined],
  ] as const) {
    const dlg = await openAccountForm(page, quick);
    await fillAccount(dlg, { ...a, unit: u });
    await dlg.getByRole("button", { name: "Simpan" }).click();
    await expect(dlg).toBeHidden();
    await expect(
      page.getByRole("row").filter({ hasText: a.email })
    ).toBeVisible();
  }
  writeState({ multiUser: multi, privacyUser: privacy, guestUser: guest });

  // Tentukan E2E Multi sebagai kepala E2E Unit.
  const card = page
    .locator("div.card")
    .filter({ has: page.getByRole("heading", { name: unit, exact: true }) });
  await card.getByRole("button", { name: "+ Tentukan kepala unit" }).click();
  const dlg = page.getByRole("dialog", { name: "Tentukan Kepala Unit" });
  await dlg.getByRole("searchbox").fill(multi.email);
  await dlg
    .getByRole("combobox", { name: /^Pilih Akun/ })
    .selectOption({ label: `${multi.name} — ${multi.email} (1 unit)` });
  await expect(dlg.getByText("rangkap jabatan diperbolehkan")).toBeVisible();
  await dlg.getByRole("button", { name: "Tempatkan" }).click();
  await expect(dlg).toBeHidden();
  await expect(card).toContainText(`Kepala Unit:${multi.name}`);
  // Peran global menjadi Kepala Unit (ada keanggotaan head).
  await expect(
    page.getByRole("row").filter({ hasText: multi.email })
  ).toContainText("Kepala Unit");
});

test("TC-ROL-07 hapus penempatan terakhir → akun menjadi Pengunjung", async ({
  page,
}) => {
  const r = S().run;
  const a = {
    name: `E2E Lepas ${r}`,
    email: `lepas-${r}@e2e.test`,
    password: "Lepas2026x",
  };
  const dlg = await openAccountForm(page, "Anggota Unit");
  await fillAccount(dlg, { ...a, unit: UNITS.biro });
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg).toBeHidden();
  await page
    .getByRole("button", { name: `Hapus ${a.name} dari ${UNITS.biro}` })
    .click();
  const confirm = page.getByRole("alertdialog", { name: "Hapus penempatan?" });
  await confirm.getByRole("button", { name: "Hapus Penempatan" }).click();
  await expect(confirm).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: a.email })
  ).toContainText("Pengunjung (Tamu)");
});

test("TC-ROL-08 tunjuk Ketua LPM (hanya satu; menggantikan yang lama)", async ({
  page,
}) => {
  await page.goto("/role-penempatan");
  const a1 = ACCOUNTS.lpmAdmin;
  const a2 = ACCOUNTS.lpmAdmin2;
  const appoint = async (name: string) => {
    await page
      .getByRole("button", { name: `Tunjuk ${name} sebagai Ketua LPM` })
      .click();
    const dlg = page.getByRole("alertdialog", {
      name: "Tunjuk sebagai Ketua LPM?",
    });
    await dlg.getByRole("button", { name: "Tunjuk" }).click();
    await expect(dlg).toBeHidden();
    await expect(page.getByText(`Ditandatangani oleh: ${name}`)).toBeVisible();
  };
  // Idempoten: bila A2 sudah Ketua (run sebelumnya), tunjuk A1 dulu.
  const a2IsHead = await page
    .getByRole("button", { name: `Cabut status Ketua LPM dari ${a2.name}` })
    .isVisible();
  if (a2IsHead) await appoint(a1.name!);
  await appoint(a2.name!);
  await expect(
    page.getByRole("button", { name: `Cabut status Ketua LPM dari ${a2.name}` })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Cabut status Ketua LPM dari / })
  ).toHaveCount(1);
});

test("TC-ROL-11 Admin LPM tidak dapat menghapus akun sendiri (pesan jelas)", async ({
  page,
}) => {
  const me = ACCOUNTS.lpmAdmin;
  await page.goto("/role-penempatan");
  await page.getByRole("button", { name: `Hapus akun ${me.name}` }).click();
  const dlg = page.getByRole("alertdialog", { name: "Hapus akun?" });
  await dlg.getByRole("button", { name: "Hapus", exact: true }).click();
  await expect(dlg.getByRole("alert")).toBeVisible();
  const msg = (await dlg.getByRole("alert").textContent()) ?? "";
  await dlg.getByRole("button", { name: "Batal" }).click();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: me.email })
  ).toBeVisible();
  expect(
    msg,
    "APP BUG: AppError dari action yang melempar tidak sampai ke UI (pesan generik 'Periksa koneksi')"
  ).toContain("Tidak dapat menghapus akun sendiri.");
});

test("TC-ROL-12 menonaktifkan akun lewat form Ubah Akun", async ({
  page,
  browser,
}) => {
  const r = S().run;
  const a = {
    name: `E2E Nonaktif ${r}`,
    email: `nonaktif-${r}@e2e.test`,
    password: "Nonaktif2026",
  };
  const dlg = await openAccountForm(page, "Anggota LPM");
  await fillAccount(dlg, a);
  await dlg.getByRole("button", { name: "Simpan" }).click();
  await expect(dlg).toBeHidden();

  await page.getByRole("button", { name: `Ubah akun ${a.name}` }).click();
  const edit = page.getByRole("dialog", { name: "Ubah Akun" });
  await edit.getByRole("checkbox", { name: "Akun aktif" }).uncheck();
  await edit.getByRole("button", { name: "Perbarui" }).click();
  await expect(edit).toBeHidden();
  const status = page
    .getByRole("row")
    .filter({ hasText: a.email })
    .getByRole("cell")
    .nth(4);
  await expect(
    status,
    "APP BUG: centang 'Akun aktif' dilepas tetapi akun tetap Aktif"
  ).toHaveText("Nonaktif", { timeout: 5_000 });

  // Akun nonaktif tidak dapat login (pesan generik).
  const { context, page: p } = await anonPage(browser);
  await fillLogin(p, a.email, a.password);
  await expect(p.getByText("Email atau kata sandi salah.")).toBeVisible();
  await context.close();
});

/* ------------------------------------------------------------------ */
/*  Dokumen penetapan & evaluasi                                       */
/* ------------------------------------------------------------------ */

async function openDocForm(page: Page, type: "penetapan" | "evaluasi") {
  await page.goto(`/${type}`);
  await page.getByRole("button", { name: "Unggah Dokumen" }).click();
  const dlg = page.getByRole("dialog", { name: "Unggah Dokumen" });
  await expect(dlg).toBeVisible();
  return dlg;
}

async function fillDoc(
  dlg: ReturnType<Page["getByRole"]>,
  title: string,
  opts: { file?: ReturnType<typeof pdfFile>; link?: string }
) {
  await dlg
    .getByRole("combobox", { name: /^Siklus Audit/ })
    .selectOption({ label: need("cycleName") });
  await dlg.getByRole("textbox", { name: /^Judul Dokumen/ }).fill(title);
  if (opts.file) await dlg.getByLabel(/^Unggah File/).setInputFiles(opts.file);
  if (opts.link !== undefined)
    await dlg.getByRole("textbox", { name: /^Tautan/ }).fill(opts.link);
  await dlg.getByRole("button", { name: "Unggah", exact: true }).click();
}

/**
 * Isi & kirim form dokumen lalu periksa hasilnya; ulangi bila reset form
 * React 19 (setelah aksi sebelumnya) datang terlambat & mengosongkan isian.
 */
async function submitDoc(
  dlg: ReturnType<Page["getByRole"]>,
  title: string,
  opts: { file?: ReturnType<typeof pdfFile>; link?: string },
  check: () => Promise<void>
) {
  await expect(async () => {
    if (!(await dlg.isVisible())) return; // sudah sukses & tertutup
    await fillDoc(dlg, title, opts);
    await check();
  }).toPass({ timeout: 30_000 });
}

test("TC-DOK-01/04/05 penetapan: unggah PDF; berkas palsu/non-PDF/aktif ditolak", async ({
  page,
}) => {
  const r = S().run;
  const title = `E2E SK Penetapan ${r}`;
  const dlg = await openDocForm(page, "penetapan");
  for (const [file, msg] of [
    [fakePdfFile(), "Berkas bukan PDF yang valid."],
    [
      textFile(),
      "Tipe file tidak diizinkan. Hanya berkas PDF yang diperbolehkan.",
    ],
    [jsPdfFile(), /skrip\/aksi aktif/],
  ] as const) {
    await submitDoc(dlg, title, { file }, () =>
      expect(dlg.getByRole("alert")).toContainText(msg, { timeout: 4_000 })
    );
  }
  await submitDoc(dlg, title, { file: pdfFile("sk.pdf") }, () =>
    expect(dlg).toBeHidden({ timeout: 6_000 })
  );

  const card = page.locator("div.card").filter({ hasText: title });
  await expect(card.getByText("PDF", { exact: true })).toBeVisible();
  const href = await card
    .getByRole("link", { name: new RegExp(`Lihat File ${title}`) })
    .getAttribute("href");
  expect(href).toMatch(/^\/uploads\/penetapan\/[\w-]+\.pdf$/);
  // Nama berkas acak (tanpa nama asli).
  expect(href).not.toContain("sk.pdf");
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  writeState({ docPenetapan: { title, href: href! } });
});

test("TC-DOK-02/03 evaluasi: tautan https tersimpan; tanpa berkas/tautan & skema berbahaya ditolak", async ({
  page,
}) => {
  const r = S().run;
  const title = `E2E Laporan Evaluasi ${r}`;
  const dlg = await openDocForm(page, "evaluasi");
  await submitDoc(dlg, title, {}, () =>
    expect(dlg.getByRole("alert")).toHaveText(
      "Unggah file atau isi tautan dokumen.",
      { timeout: 4_000 }
    )
  );
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://user:pass@example.com/x.pdf",
  ]) {
    await submitDoc(dlg, title, { link: bad }, () =>
      expect(dlg.getByRole("alert")).toHaveText(
        "Tautan tidak valid. Gunakan alamat http/https.",
        { timeout: 4_000 }
      )
    );
  }
  await submitDoc(
    dlg,
    title,
    { link: "https://example.com/evaluasi-e2e.pdf" },
    () => expect(dlg).toBeHidden({ timeout: 6_000 })
  );
  const card = page.locator("div.card").filter({ hasText: title });
  const link = card.getByRole("link", {
    name: new RegExp(`Buka Tautan ${title}`),
  });
  await expect(link).toHaveAttribute(
    "href",
    "https://example.com/evaluasi-e2e.pdf"
  );
  await expect(link).toHaveAttribute("target", "_blank");
});

test("TC-DOK-07/08 auditee: dokumen baca-saja; hapus dokumen → berkas 404, tanpa sesi 401", async ({
  page,
  browser,
}) => {
  const r = S().run;
  const { title, href } = need("docPenetapan");

  // Auditee: dapat melihat, tanpa tombol kelola.
  const head = await pageAs(browser, "head");
  await head.page.goto("/penetapan");
  await expect(head.page.getByRole("heading", { name: title })).toBeVisible();
  await expect(
    head.page.getByRole("button", { name: "Unggah Dokumen" })
  ).toHaveCount(0);
  await expect(
    head.page.getByRole("button", { name: /^Hapus dokumen/ })
  ).toHaveCount(0);
  expect((await head.page.request.get(href)).status()).toBe(200);
  await head.context.close();

  // Tanpa sesi: 401.
  const anon = await anonPage(browser);
  expect((await anon.page.request.get(href)).status()).toBe(401);
  await anon.context.close();

  // Dokumen sementara untuk dihapus.
  const tmp = `E2E Dok Hapus ${r}`;
  const dlg = await openDocForm(page, "penetapan");
  await submitDoc(dlg, tmp, { file: pdfFile() }, () =>
    expect(dlg).toBeHidden({ timeout: 6_000 })
  );
  const card = page.locator("div.card").filter({ hasText: tmp });
  const tmpHref = await card
    .getByRole("link", { name: new RegExp(`Lihat File ${tmp}`) })
    .getAttribute("href");
  await page.getByRole("button", { name: `Hapus dokumen ${tmp}` }).click();
  await page
    .getByRole("alertdialog", { name: "Hapus dokumen?" })
    .getByRole("button", { name: "Hapus", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  expect((await page.request.get(tmpHref!)).status()).toBe(404);
});

/* ------------------------------------------------------------------ */
/*  Standar & butir pertanyaan                                         */
/* ------------------------------------------------------------------ */

test("TC-AUD-01/02 standar Umum + butir massal; duplikat dalam cakupan ditolak", async ({
  page,
}) => {
  const n = names();
  await openCategory(page, "umum");
  await addStandard(page, n.std.umum, { scopeType: "all" });
  await expect(standardBlock(page, n.std.umum)).toBeVisible();
  const form = await addStandard(page, n.std.umum, { scopeType: "all" });
  await expect(form.getByRole("alert")).toHaveText(
    "Standar dengan nama tersebut sudah ada pada cakupan ini."
  );
  await addQuestionsBulk(page, n.std.umum, [n.q.umum1, n.q.umum2]);
  await expect(standardBlock(page, n.std.umum)).toContainText(
    "2 butir pertanyaan"
  );
});

test("standar per kategori & per unit beserta butirnya", async ({ page }) => {
  const n = names();
  const ids = need("unitIds");

  await openCategory(page, "Program Studi");
  await selectScopeTab(page, "Semua Program Studi");
  await addStandard(page, n.std.prodi, {
    scopeType: "category",
    scopeCategory: "Program Studi",
  });
  await addQuestionsBulk(page, n.std.prodi, [n.q.prodi1, n.q.moved]);

  await selectScopeTab(page, UNITS.ti);
  await addStandard(page, n.std.ti, {
    scopeType: "unit",
    scopeUnitId: ids[UNITS.ti],
  });
  await addQuestionsBulk(page, n.std.ti, [n.q.ti1]);

  await openCategory(page, "Perpustakaan");
  await selectScopeTab(page, UNITS.perpus);
  // Nama awal; diganti di uji "ubah nama" agar sekaligus menguji pelestarian cakupan.
  await addStandard(page, `${n.std.perpus} awal`, {
    scopeType: "unit",
    scopeUnitId: ids[UNITS.perpus],
  });
  await addQuestionsBulk(page, `${n.std.perpus} awal`, [n.q.perpus1]);

  await openCategory(page, "Biro");
  await selectScopeTab(page, "Semua Biro");
  await addStandard(page, n.std.biro, {
    scopeType: "category",
    scopeCategory: "Biro",
  });
  await addQuestionsBulk(page, n.std.biro, [n.q.biro1]);
  await addStandard(page, n.std.maint, {
    scopeType: "category",
    scopeCategory: "Biro",
  });
  await addQuestionsBulk(page, n.std.maint, [n.q.maint1]);

  writeState({
    std: {
      umum: n.std.umum,
      prodi: n.std.prodi,
      ti: n.std.ti,
      perpus: n.std.perpus,
      biro: n.std.biro,
    },
    q: {
      umum1: n.q.umum1,
      umum2: n.q.umum2,
      prodi1: n.q.prodi1,
      moved: n.q.moved,
      ti1: n.q.ti1,
      perpus1: n.q.perpus1,
      biro1: n.q.biro1,
    },
  });
});

test("koordinator #1: ubah nama standar ber-cakupan unit → cakupan tetap unit (tidak pindah ke Umum)", async ({
  page,
  browser,
}) => {
  const n = names();
  await openCategory(page, "Perpustakaan");
  await selectScopeTab(page, UNITS.perpus);
  const block = standardBlock(page, `${n.std.perpus} awal`);
  await block
    .getByRole("button", { name: `Ubah standar ${n.std.perpus} awal` })
    .click();
  const edit = editStandardForm(page);
  await edit.getByRole("textbox", { name: "Nama standar" }).fill(n.std.perpus);
  await edit.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(standardBlock(page, n.std.perpus)).toBeVisible();
  await expect(standardBlock(page, n.std.perpus)).toContainText(
    "1 butir pertanyaan"
  );

  // Cakupan tetap unit Perpustakaan: butir masih bisa ditambah dengan cakupan unit itu.
  await addQuestionsBulk(page, n.std.perpus, [`${n.q.perpus1} tambahan`]);

  // Auditee Perpustakaan tetap melihat standar & butirnya.
  const perpus = await pageAs(browser, "perpusHead");
  await perpus.page.goto("/audit");
  await expect(
    perpus.page.getByText(n.std.perpus, { exact: true })
  ).toBeVisible();
  await expect(
    perpus.page.getByText(n.q.perpus1, { exact: true })
  ).toBeVisible();
  await perpus.context.close();

  // Butir tambahan dihapus lagi agar total tetap terkendali.
  await openCategory(page, "Perpustakaan");
  await selectScopeTab(page, UNITS.perpus);
  const blk = standardBlock(page, n.std.perpus);
  await blk.getByRole("button", { name: "Hapus pertanyaan nomor 2" }).click();
  await page
    .getByRole("alertdialog", { name: "Hapus pertanyaan?" })
    .getByRole("button", { name: "Hapus", exact: true })
    .click();
  await expect(blk).toContainText("1 butir pertanyaan");
});

test("koordinator #2: nama standar sama — ditolak di cakupan yang sama, diterima di cakupan lain", async ({
  page,
}) => {
  const n = names();
  const ids = need("unitIds");
  await openCategory(page, "Perpustakaan");
  await selectScopeTab(page, UNITS.perpus);
  const form = await addStandard(page, n.std.perpus, {
    scopeType: "unit",
    scopeUnitId: ids[UNITS.perpus],
  });
  await expect(form.getByRole("alert")).toHaveText(
    "Standar dengan nama tersebut sudah ada pada cakupan ini."
  );

  // Unit lain (Manajemen) & kategori lain: nama sama diterima.
  await openCategory(page, "Program Studi");
  await selectScopeTab(page, UNITS.mnj);
  const f2 = await addStandard(page, n.std.perpus, {
    scopeType: "unit",
    scopeUnitId: ids[UNITS.mnj],
  });
  await expect(f2.getByRole("status")).toHaveText(OK_MSG);
  await selectScopeTab(page, "Semua Program Studi");
  const f3 = await addStandard(page, n.std.perpus, {
    scopeType: "category",
    scopeCategory: "Program Studi",
  });
  await expect(f3.getByRole("status")).toHaveText(OK_MSG);
});

test("REGRESI UI: standar yang dibuat di tab unit hanya tampil di tab unit itu", async ({
  page,
}) => {
  // Tanpa injeksi cakupan: perilaku murni UI.
  const n = names();
  await openCategory(page, "Perpustakaan");
  await selectScopeTab(page, UNITS.perpus);
  await standardForm(page)
    .getByPlaceholder(/mis\. Standar Tata Pamong/)
    .fill(n.std.uiScope);
  await standardForm(page)
    .getByRole("button", { name: "Tambah Standar" })
    .click();
  await expect(standardBlock(page, n.std.uiScope)).toBeVisible();

  await openCategory(page, "umum");
  await expect(
    standardBlock(page, n.std.uiScope),
    "APP BUG (regresi working tree = v1.2.0 audit-workspace.tsx): form tidak mengirim cakupan tab & semua standar tampil di semua tab"
  ).toHaveCount(0);
});

test("TC-AUD ubah cakupan butir (kategori → unit tertentu dalam kategori yang sama)", async ({
  page,
}) => {
  const n = names();
  await openCategory(page, "Program Studi");
  await selectScopeTab(page, "Semua Program Studi");
  const block = standardBlock(page, n.std.prodi);
  await block.getByRole("button", { name: "Ubah pertanyaan nomor 2" }).click();
  await block
    .getByRole("combobox", { name: /^Cakupan Pertanyaan/ })
    .selectOption("unit");
  await block
    .getByRole("combobox", { name: /^Unit/ })
    .selectOption({ label: `${UNITS.mnj} (Program Studi)` });
  await block.getByRole("button", { name: "Perbarui" }).click();
  await expect(block.getByText(n.q.moved)).toHaveCount(0);
  await selectScopeTab(page, UNITS.mnj);
  await expect(
    standardBlock(page, n.std.prodi).getByText(n.q.moved)
  ).toBeVisible();
});

test("UNT: kategori unit tidak dapat diubah bila butir khusus unit berada di standar kategori lama", async ({
  page,
}) => {
  // Program Studi Manajemen punya butir ber-cakupan unit di bawah standar
  // kategori "Program Studi" (uji "ubah cakupan butir" di atas).
  await page.goto("/unit");
  await page.getByRole("button", { name: `Ubah unit ${UNITS.mnj}` }).click();
  const dlg = page.getByRole("dialog", { name: "Ubah Unit Audit" });
  await dlg.getByRole("combobox", { name: /^Kategori/ }).selectOption("Biro");
  await dlg.getByRole("button", { name: "Perbarui" }).click();
  await expect(dlg.getByRole("alert")).toContainText(
    "Kategori unit tidak dapat diubah:"
  );
  await page.keyboard.press("Escape");
  await page.reload();
  const card = page.locator("div.card").filter({
    has: page.getByRole("heading", { name: UNITS.mnj, exact: true }),
  });
  await expect(card.getByText("Program Studi", { exact: true })).toBeVisible();
});

test("UNT: unit tidak dapat dihapus selama masih ada standar/butir khusus unit", async ({
  page,
}) => {
  // Manajemen punya standar ber-cakupan unit (koordinator #2) & butir unit.
  await page.goto("/unit");
  await page.getByRole("button", { name: `Hapus unit ${UNITS.mnj}` }).click();
  const dlg = page.getByRole("alertdialog", { name: "Hapus unit audit?" });
  await dlg.getByRole("button", { name: "Hapus Permanen" }).click();
  await expect(dlg.getByRole("alert")).toContainText(
    "Unit tidak dapat dihapus: masih ada"
  );
  await dlg.getByRole("button", { name: "Batal" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: UNITS.mnj, exact: true })
  ).toBeVisible();
});

test("koordinator #3: butir tidak boleh lebih luas dari standar induk / dipindah ke standar unit lain", async ({
  page,
}) => {
  const n = names();
  const msg =
    "Cakupan butir pertanyaan harus sama dengan atau lebih sempit daripada cakupan standar induknya.";
  await openCategory(page, "Program Studi");
  await selectScopeTab(page, UNITS.ti);
  const block = standardBlock(page, n.std.ti);

  // Pindah ke standar milik unit Perpustakaan → ditolak.
  await block.getByRole("button", { name: "Ubah pertanyaan nomor 1" }).click();
  await block
    .getByRole("combobox", { name: /^Standar/ })
    .selectOption({ label: n.std.perpus });
  await block.getByRole("button", { name: "Perbarui" }).click();
  await expect(block.getByRole("alert")).toHaveText(msg);

  // Cakupan "Semua Unit" di bawah standar unit → ditolak.
  await block
    .getByRole("combobox", { name: /^Standar/ })
    .selectOption({ label: n.std.ti });
  await block
    .getByRole("combobox", { name: /^Cakupan Pertanyaan/ })
    .selectOption("all");
  await block.getByRole("button", { name: "Perbarui" }).click();
  await expect(block.getByRole("alert")).toHaveText(msg);

  // Data tidak berubah.
  await openCategory(page, "Program Studi");
  await selectScopeTab(page, UNITS.ti);
  await expect(standardBlock(page, n.std.ti).getByText(n.q.ti1)).toBeVisible();
});

test("TC-AUD-18 hapus standar berisi butir wajib konfirmasi ketik nama", async ({
  page,
}) => {
  const n = names();
  await openCategory(page, "umum");
  await addStandard(page, n.std.hapus, { scopeType: "all" });
  await addQuestionsBulk(page, n.std.hapus, [n.q.hapus1]);
  await page
    .getByRole("button", { name: `Hapus standar ${n.std.hapus}` })
    .click();
  const dlg = page.getByRole("alertdialog", {
    name: "Hapus standar dari seluruh siklus?",
  });
  await expect(dlg).toContainText("1");
  const del = dlg.getByRole("button", { name: "Hapus permanen" });
  await expect(del).toBeDisabled();
  await dlg.getByRole("textbox").fill("bukan nama");
  await expect(del).toBeDisabled();
  await dlg.getByRole("textbox").fill(n.std.hapus.toUpperCase());
  await expect(del).toBeEnabled();
  await del.click();
  await expect(dlg).toBeHidden();
  await expect(standardBlock(page, n.std.hapus)).toHaveCount(0);
  await openCategory(page, "umum");
  await expect(page.getByText(n.q.hapus1)).toHaveCount(0);
});

test("koordinator #6: mode pemeliharaan → Admin LPM ditolak membuat/mengubah/menghapus standar & butir", async ({
  page,
  browser,
}) => {
  const n = names();
  const toggle = (on: boolean) => setMaintenance(browser, on);
  // Halaman admin dimuat SEBELUM pemeliharaan aktif (form masih terbuka).
  await openCategory(page, "Biro");
  await selectScopeTab(page, "Semua Biro");
  const block = standardBlock(page, n.std.maint);
  await expect(block).toContainText("1 butir pertanyaan");

  await toggle(true);
  try {
    const maintMsg = /pemeliharaan/i;
    // create standar
    const form = await addStandard(page, `${n.std.maint} baru`, {
      scopeType: "category",
      scopeCategory: "Biro",
    });
    await expect(form.getByRole("alert")).toContainText(maintMsg);

    // update standar (ubah nama)
    await block
      .getByRole("button", { name: `Ubah standar ${n.std.maint}` })
      .click();
    const edit = editStandardForm(page);
    await edit
      .getByRole("textbox", { name: "Nama standar" })
      .fill(`${n.std.maint} X`);
    await edit.getByRole("button", { name: "Simpan", exact: true }).click();
    // Form ubah-nama tidak menampilkan ActionFeedback: tetap terbuka bila gagal.
    await expect(edit).toBeVisible();
    await edit.getByRole("button", { name: "Batal" }).click();

    // create butir (massal)
    await block
      .getByRole("button", { name: "Kelola / Tambah Butir Pertanyaan" })
      .click();
    const dlg = page.getByRole("dialog", { name: "Butir Pertanyaan" });
    await dlg
      .getByRole("textbox", { name: "Teks butir pertanyaan baru" })
      .fill("Butir saat pemeliharaan?");
    await dlg.getByRole("button", { name: "Tambah ke Daftar" }).click();
    await dlg.getByRole("button", { name: "Simpan (1)", exact: true }).click();
    await expect(dlg.getByRole("alert")).toContainText(maintMsg);
    await dlg.getByRole("button", { name: "Tutup", exact: true }).click();

    // update butir
    await block
      .getByRole("button", { name: "Ubah pertanyaan nomor 1" })
      .click();
    await block
      .getByRole("textbox", { name: /^Teks Pertanyaan/ })
      .fill("Diubah saat pemeliharaan?");
    await block.getByRole("button", { name: "Perbarui" }).click();
    await expect(block.getByRole("alert")).toContainText(maintMsg);
    await block.getByRole("button", { name: "Batal" }).click();

    // delete butir & standar
    await block
      .getByRole("button", { name: "Hapus pertanyaan nomor 1" })
      .click();
    let confirm = page.getByRole("alertdialog", { name: "Hapus pertanyaan?" });
    await confirm.getByRole("button", { name: "Hapus", exact: true }).click();
    await expect(confirm.getByRole("alert")).toBeVisible();
    await confirm.getByRole("button", { name: "Batal" }).click();

    await page
      .getByRole("button", { name: `Hapus standar ${n.std.maint}` })
      .click();
    confirm = page.getByRole("alertdialog", {
      name: "Hapus standar dari seluruh siklus?",
    });
    await confirm.getByRole("textbox").fill(n.std.maint);
    await confirm.getByRole("button", { name: "Hapus permanen" }).click();
    await expect(confirm.getByRole("alert")).toBeVisible();
    await confirm.getByRole("button", { name: "Batal" }).click();
  } finally {
    await toggle(false);
  }

  // Tidak ada yang berubah.
  await openCategory(page, "Biro");
  await selectScopeTab(page, "Semua Biro");
  await expect(standardBlock(page, n.std.maint)).toContainText(
    "1 butir pertanyaan"
  );
  await expect(page.getByText(n.q.maint1)).toBeVisible();
  await expect(standardBlock(page, `${n.std.maint} baru`)).toHaveCount(0);
  await expect(standardBlock(page, `${n.std.maint} X`)).toHaveCount(0);
  await expect(page.getByText("Butir saat pemeliharaan?")).toHaveCount(0);
  await expect(page.getByText("Diubah saat pemeliharaan?")).toHaveCount(0);
});

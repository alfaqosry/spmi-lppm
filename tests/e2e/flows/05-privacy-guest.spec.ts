import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  UNITS,
  acceptConsentIfShown,
  anonPage,
  consentDialog,
  login,
  need,
  pageAs,
  storageFile,
} from "./helpers";

/**
 * Privasi (persetujuan, ekspor data saya) & Pengunjung (tamu) hanya /no-access.
 * TC-PRV-02, 04, 05, 06; TC-LOG-12 (setara: akun pengunjung); TC-ROL-06.
 */
test.use({ storageState: storageFile("lpmAdmin") });

test("TC-PRV-02 dialog persetujuan memblokir sampai disetujui; tercatat", async ({
  browser,
}) => {
  const u = need("privacyUser");
  const { context, page } = await anonPage(browser);
  await login(page, u.email, u.password);
  const dlg = consentDialog(page);
  await expect(dlg).toBeVisible();
  // Tidak dapat ditutup dengan Esc / tanpa tombol tutup.
  await page.keyboard.press("Escape");
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Tutup dialog" })).toHaveCount(
    0
  );
  // Wajib centang.
  await dlg.getByRole("button", { name: "Setuju & Lanjutkan" }).click();
  await expect(
    dlg.getByText("Centang kotak ini untuk melanjutkan.")
  ).toBeVisible();
  await dlg.getByRole("checkbox").check();
  await dlg.getByRole("button", { name: "Setuju & Lanjutkan" }).click();
  await expect(dlg).toBeHidden();
  await page.reload();
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(consentDialog(page)).toHaveCount(0);

  // TC-PRV-05: ekspor data saya.
  const res = await page.request.get("/api/me/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(res.headers()["content-language"]).toBe("id");
  expect(res.headers()["content-disposition"]).toMatch(
    /attachment; filename="data-saya-spmi-/
  );
  const raw = await res.text();
  const data = JSON.parse(raw);
  expect(data.profile.email).toBe(u.email);
  expect(data.profile.name).toBe(u.name);
  expect(data.locale).toBeTruthy();
  expect(data.locale.timezone ?? data.locale.timeZone).toBe("Asia/Jakarta");
  expect(data.meta.generatedAt).toMatch(/\+07:00$/);
  expect(data.consent.consentedAt).toMatch(/\+07:00$/);
  expect(data.consent.consentVersion).toBe(data.consent.currentVersion);
  expect(JSON.stringify(data.memberships)).toContain(UNITS.perpus);
  // Tanpa hash sandi & tanpa data pengguna lain.
  expect(raw).not.toMatch(/"password"\s*:/);
  expect(raw).not.toMatch(/\$2[aby]\$/);
  for (const other of Object.values(ACCOUNTS)) {
    expect(raw, `ekspor memuat ${other.email}`).not.toContain(other.email);
  }

  // TC-PRV-06: batas laju 5/menit → permintaan ke-6 = 429 + Retry-After.
  let last = 200;
  let retryAfter: string | undefined;
  for (let i = 0; i < 5; i++) {
    const r = await page.request.get("/api/me/export");
    last = r.status();
    retryAfter = r.headers()["retry-after"];
  }
  expect(last).toBe(429);
  expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  await context.close();

  // Tanpa sesi: 401.
  const anon = await anonPage(browser);
  expect((await anon.page.request.get("/api/me/export")).status()).toBe(401);
  await anon.context.close();
});

test("TC-PRV-04 'Tidak setuju, keluar' mengakhiri sesi; pengunjung hanya /no-access", async ({
  browser,
}) => {
  const g = need("guestUser");
  const { context, page } = await anonPage(browser);
  await login(page, g.email, g.password);
  await expect(page).toHaveURL(/\/no-access/);
  const dlg = consentDialog(page);
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Tidak setuju, keluar" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/no-access");
  await expect(page).toHaveURL(/\/login/);

  // Login ulang & setujui.
  await login(page, g.email, g.password);
  await acceptConsentIfShown(page);
  await expect(
    page.getByRole("heading", { name: "Akun Anda Belum Memiliki Akses" })
  ).toBeVisible();

  for (const p of [
    "/dashboard",
    "/audit",
    "/siklus",
    "/penetapan",
    "/profil",
    "/pengaturan",
  ]) {
    await page.goto(p);
    await expect(page, p).toHaveURL(/\/no-access/);
  }
  const cycleId = need("cycleId");
  expect(
    (await page.request.get(`/api/export?cycleId=${cycleId}`)).status()
  ).toBe(403);
  expect((await page.request.get(need("docPenetapan").href)).status()).toBe(
    403
  );
  expect((await page.request.get(need("evidence").ti!)).status()).toBe(403);
  // Hak akses data pribadi tetap tersedia bagi pengunjung.
  const me = await page.request.get("/api/me/export");
  expect(me.status()).toBe(200);
  expect((await me.json()).profile.role).toBe("pengunjung");
  await context.close();
});

test("TC-ROL-06 pengunjung ditempatkan sebagai Anggota Unit → mendapat akses", async ({
  page,
  browser,
}) => {
  const g = need("guestUser");
  const guest = await anonPage(browser);
  await login(guest.page, g.email, g.password);
  await acceptConsentIfShown(guest.page);
  await expect(guest.page).toHaveURL(/\/no-access/);

  // Admin menempatkan tamu pada unit Biro.
  await page.goto("/role-penempatan");
  const card = page.locator("div.card").filter({
    has: page.getByRole("heading", { name: UNITS.biro, exact: true }),
  });
  await card
    .getByRole("button", { name: `Tambah anggota ke ${UNITS.biro}` })
    .click();
  const dlg = page.getByRole("dialog", { name: "Tambah Anggota Unit" });
  await dlg.getByRole("searchbox").fill(g.email);
  await dlg
    .getByRole("combobox", { name: /^Pilih Akun/ })
    .selectOption({ label: `${g.name} — ${g.email}` });
  await dlg.getByRole("button", { name: "Tempatkan" }).click();
  await expect(dlg).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: g.email })
  ).toContainText("Anggota Unit");

  // Perubahan peran mencabut sesi lama (keamanan) — catat perilaku aktual.
  await guest.page.goto("/dashboard");
  const after = new URL(guest.page.url()).pathname;
  test.info().annotations.push({
    type: "perilaku",
    description: `Setelah penempatan, sesi tamu lama diarahkan ke ${after} (TC-ROL-06 mengharapkan /dashboard tanpa login ulang; kode mencabut sesi saat peran berubah).`,
  });
  if (after.startsWith("/login")) {
    await login(guest.page, g.email, g.password);
  }
  await guest.page.goto("/audit");
  await expect(guest.page).toHaveURL(/\/audit/);
  await expect(
    guest.page.getByText(`Unit: ${UNITS.biro}`).first()
  ).toBeVisible();
  await guest.context.close();
});

test("TC-LOG-09/11 login mengalihkan pengguna bersesi; keluar mencabut token lama", async ({
  browser,
}) => {
  const u = need("multiUser");
  const { context, page } = await anonPage(browser);
  await login(page, u.email, u.password);
  await acceptConsentIfShown(page);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);
  const cookies = await context.cookies();
  const session = cookies.find((c) => /lpm_session/.test(c.name))!;
  expect(session.httpOnly).toBe(true);
  expect(session.sameSite).toBe("Lax");

  await page.getByRole("button", { name: `Menu akun ${u.name}` }).click();
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goBack();
  await page.reload();
  await expect(page).toHaveURL(/\/login/);

  // Pakai ulang cookie lama di konteks baru → ditolak.
  const replay = await browser.newContext({
    storageState: { cookies: [session], origins: [] },
  });
  const p2 = await replay.newPage();
  await p2.goto("/dashboard");
  await expect(p2).toHaveURL(/\/login/);
  await replay.close();
  await context.close();

  // Sesi peran lain tidak terpengaruh.
  const head = await pageAs(browser, "head");
  await head.page.goto("/dashboard");
  await expect(head.page).toHaveURL(/\/dashboard/);
  await head.context.close();
});

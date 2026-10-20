import { expect, test, type Page } from "@playwright/test";
import {
  UNITS,
  anonPage,
  callAction,
  findActionIds,
  need,
  pageAs,
  storageFile,
} from "./helpers";

/**
 * Uji negatif keamanan lintas modul: Server Action dipanggil langsung oleh
 * peran yang salah (id action diambil dari chunk JS klien), POST action dari
 * Origin lain, akses tanpa sesi, path traversal, dan batas laju ekspor.
 * TC-SIK-06, TC-UNT-05, TC-AUD-21 (setara), TC-ROL-10, TC-SEC-12, TC-ANL-06/07.
 */
test.use({ storageState: storageFile("head") });

async function myId(page: Page): Promise<number> {
  const r = await page.request.get("/api/me/export");
  expect(r.status()).toBe(200);
  return (await r.json()).profile.id as number;
}

/**
 * Penolakan action: galat 5xx (action melempar; pesan disamarkan di produksi)
 * ATAU galat dikembalikan sebagai nilai berisi "Akses ditolak".
 */
function expectDenied(r: { status: number; text: string }) {
  const denied = r.status >= 500 || r.text.includes("Akses ditolak");
  expect(denied, `respons action: ${r.status} ${r.text.slice(0, 200)}`).toBe(
    true
  );
  expect(r.text).not.toContain('"ok":true');
}

/** id butir dari form jawaban auditee (input tersembunyi questionId). */
async function questionIdOf(page: Page, question: string): Promise<number> {
  await page.goto("/audit");
  const v = await page
    .locator("div.rounded-xl.border")
    .filter({ has: page.locator("p", { hasText: question }) })
    .locator('input[name="questionId"]')
    .first()
    .inputValue();
  return Number(v);
}

test("TC-AUD-21 auditee memanggil deleteQuestion langsung → ditolak", async ({
  page,
}) => {
  const q = need("q");
  const qid = await questionIdOf(page, q.ti1);
  expect(qid).toBeGreaterThan(0);
  const ids = await findActionIds(page, [
    "deleteQuestion",
    "deleteStandard",
    "verifyResponse",
  ]);
  expect(
    ids.deleteQuestion,
    "id action deleteQuestion ditemukan di chunk klien"
  ).toBeTruthy();

  const r = await callAction(page, "/audit", ids.deleteQuestion, [qid]);
  expectDenied(r);
  // Butir masih ada.
  await page.goto("/audit");
  await expect(page.getByText(q.ti1, { exact: true })).toHaveCount(1);
});

test("TC-SIK-06/UNT-05 Anggota LPM memanggil action Admin (siklus/unit) → ditolak", async ({
  browser,
}) => {
  const cycleName = need("cycleName");
  const cycleId = need("cycleId");
  const unitName = need("e2eUnitName");
  const unitId = need("unitIds")[unitName];

  // Temukan id action dari halaman yang hanya dapat dibuka admin.
  const admin = await pageAs(browser, "lpmAdmin");
  await admin.page.goto("/siklus");
  const cyc = await findActionIds(admin.page, [
    "deactivateCycle",
    "deleteCycle",
  ]);
  await admin.page.goto("/unit");
  const unit = await findActionIds(admin.page, ["deleteUnit"]);
  expect(cyc.deactivateCycle && unit.deleteUnit).toBeTruthy();

  const member = await pageAs(browser, "lpmMember");
  await member.page.goto("/dashboard");
  expectDenied(
    await callAction(member.page, "/siklus", cyc.deactivateCycle, [cycleId])
  );
  expectDenied(
    await callAction(member.page, "/unit", unit.deleteUnit, [unitId])
  );
  await member.context.close();

  // Auditee juga.
  const head = await pageAs(browser, "head");
  await head.page.goto("/dashboard");
  expectDenied(
    await callAction(head.page, "/siklus", cyc.deactivateCycle, [cycleId])
  );
  await head.context.close();

  // Tidak ada yang berubah.
  await admin.page.goto("/siklus");
  const card = admin.page.locator("div.card").filter({ hasText: cycleName });
  await expect(card.getByText("Aktif", { exact: true })).toBeVisible();
  await admin.page.goto("/unit");
  await expect(
    admin.page.getByRole("heading", { name: unitName, exact: true })
  ).toBeVisible();
  await admin.context.close();
});

test("TC-ROL-10 eskalasi hak: auditee menempatkan diri ke unit lain / Anggota LPM jadi Ketua → ditolak", async ({
  browser,
}) => {
  const ev = need("evidence");
  const perpusId = need("unitIds")[UNITS.perpus];
  const admin = await pageAs(browser, "lpmAdmin");
  await admin.page.goto("/role-penempatan");
  const ids = await findActionIds(admin.page, ["assignMember", "setLpmHead"]);
  expect(ids.assignMember && ids.setLpmHead).toBeTruthy();

  const member = await pageAs(browser, "member");
  await member.page.goto("/dashboard");
  const self = await myId(member.page);
  const r1 = await callAction(
    member.page,
    "/role-penempatan",
    ids.assignMember,
    [perpusId, self, "head"]
  );
  expect(r1.text).toContain("Akses ditolak. Hanya Admin LPM.");
  // Masih tidak boleh membaca bukti unit Perpustakaan.
  expect((await member.page.request.get(ev.perpus!)).status()).toBe(403);
  await member.context.close();

  const lpm = await pageAs(browser, "lpmMember");
  await lpm.page.goto("/dashboard");
  const lpmSelf = await myId(lpm.page);
  const r2 = await callAction(lpm.page, "/role-penempatan", ids.setLpmHead, [
    lpmSelf,
  ]);
  expect(r2.text).toContain("Akses ditolak. Hanya Admin LPM.");
  await lpm.context.close();

  // Kontrol positif: mekanisme pemanggilan benar-benar mencapai action.
  const a2 = await pageAs(browser, "lpmAdmin2");
  await a2.page.goto("/dashboard");
  const a2Id = await myId(a2.page);
  await a2.context.close();
  const ok = await callAction(admin.page, "/role-penempatan", ids.setLpmHead, [
    a2Id,
  ]);
  expect(ok.text).toMatch(/"ok":true/);

  await admin.page.goto("/role-penempatan");
  await expect(
    admin.page.getByRole("button", { name: /^Cabut status Ketua LPM dari / })
  ).toHaveCount(1);
  await expect(
    admin.page.getByRole("button", {
      name: "Cabut status Ketua LPM dari Admin LPM",
    })
  ).toBeVisible();
  await admin.context.close();
});

test("Admin LPM memanggil action khusus Superadmin (hapus log) → ditolak", async ({
  browser,
}) => {
  const sa = await pageAs(browser, "superadmin");
  await sa.page.goto("/pengaturan");
  const ids = await findActionIds(sa.page, [
    "clearActivityLogs",
    "clearLoginLogs",
  ]);
  expect(ids.clearActivityLogs && ids.clearLoginLogs).toBeTruthy();

  const admin = await pageAs(browser, "lpmAdmin");
  await admin.page.goto("/dashboard");
  for (const id of [ids.clearActivityLogs, ids.clearLoginLogs]) {
    const r = await callAction(admin.page, "/pengaturan", id, []);
    expect(r.text).toContain("Akses ditolak. Hanya Superadmin.");
  }
  await admin.context.close();

  await sa.page.goto("/pengaturan");
  await sa.page.getByRole("tab", { name: "Log & Pemantauan" }).click();
  const panel = sa.page.getByRole("tabpanel");
  await expect(panel.getByText("settings.update").first()).toBeVisible();
  await expect(panel.getByText("Login berhasil").first()).toBeVisible();
  await sa.context.close();
});

test("TC-SEC-12 POST Server Action dari Origin lain ditolak (walau peran berhak)", async ({
  page,
  browser,
}) => {
  const q = need("q");
  const qid = await questionIdOf(page, q.ti1);
  // Admin LPM berhak menghapus butir — hanya Origin yang salah.
  const admin = await pageAs(browser, "lpmAdmin");
  await admin.page.goto("/audit");
  const ids = await findActionIds(admin.page, ["deleteQuestion"]);
  expect(ids.deleteQuestion).toBeTruthy();
  const res = await admin.page.request.post("/audit", {
    headers: {
      Origin: "https://evil.example",
      "Next-Action": ids.deleteQuestion,
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
    },
    data: JSON.stringify([qid]),
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  await admin.context.close();
  await page.goto("/audit");
  await expect(page.getByText(q.ti1, { exact: true })).toHaveCount(1);
});

test("TC-DOK-08/TC-ANL-07 tanpa sesi: 401; path traversal: 404; parameter salah: 400/404", async ({
  browser,
  page,
}) => {
  const ev = need("evidence");
  const anon = await anonPage(browser);
  const r = anon.page.request;
  expect((await r.get(ev.ti!)).status()).toBe(401);
  expect((await r.get("/api/export?cycleId=1")).status()).toBe(401);
  expect((await r.get("/api/me/export")).status()).toBe(401);
  for (const p of [
    "/api/files/bukti/..%2F..%2F..%2Fpackage.json",
    "/api/files/..%2F.env",
    "/api/files/bukti/%2e%2e%2fsecret.pdf",
    "/api/files/lain/abc.pdf",
  ]) {
    expect((await r.get(p)).status(), p).toBe(404);
  }
  await anon.context.close();

  const lpm = await pageAs(browser, "lpmMember");
  expect(
    (await lpm.page.request.get("/api/export?cycleId=99999999")).status()
  ).toBe(404);
  expect((await lpm.page.request.get("/api/export?cycleId=abc")).status()).toBe(
    400
  );
  await lpm.context.close();
  // Auditee: bukti yang tidak ada → 404 (bukan 500).
  expect(
    (await page.request.get("/api/files/bukti/0-tidak-ada.pdf")).status()
  ).toBe(404);
});

test("TC-ANL-06 batas laju ekspor: permintaan ke-11 dalam 1 menit → 429 + Retry-After", async ({
  browser,
}) => {
  const cycleId = need("cycleId");
  const { context, page } = await pageAs(browser, "lpmAdmin2");
  let last = 0;
  let retry: string | undefined;
  for (let i = 0; i < 11; i++) {
    const res = await page.request.get(`/api/export?cycleId=${cycleId}`);
    last = res.status();
    retry = res.headers()["retry-after"];
  }
  expect(last).toBe(429);
  expect(Number(retry)).toBeGreaterThanOrEqual(1);
  await context.close();
});

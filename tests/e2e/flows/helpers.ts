import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

/* ------------------------------------------------------------------------ */
/*  Lokasi berkas sesi & state bersama antar-berkas uji                      */
/* ------------------------------------------------------------------------ */

export const AUTH_DIR = path.join(__dirname, ".auth");
export const STATE_FILE = path.join(AUTH_DIR, "state.json");

/* ------------------------------------------------------------------------ */
/*  Akun uji (seed demo + seed produksi pada DB sekali-pakai)                */
/* ------------------------------------------------------------------------ */

export type RoleKey =
  | "superadmin"
  | "lpmAdmin"
  | "lpmAdmin2"
  | "lpmMember"
  | "head"
  | "member"
  | "perpusHead";

export const ACCOUNTS: Record<
  RoleKey,
  { email: string; password: string; name?: string }
> = {
  superadmin: {
    email: process.env.E2E_SUPERADMIN_EMAIL || "superadmin@e2e.test",
    password: process.env.E2E_SUPERADMIN_PASSWORD || "SuperE2e2026",
    name: "Superadmin",
  },
  // seed-demo.ts
  lpmAdmin: {
    email: "admin@lpm.ac.id",
    password: "admin123",
    name: "Administrator LPM",
  },
  // seed.ts (SEED_ADMIN_*), nama default "Admin LPM"
  lpmAdmin2: {
    email: process.env.E2E_ADMIN2_EMAIL || "admin2@e2e.test",
    password: process.env.E2E_ADMIN2_PASSWORD || "AdminE2e2026",
    name: "Admin LPM",
  },
  lpmMember: {
    email: "anggota.lpm@lpm.ac.id",
    password: "unit123",
    name: "Rina Marlina, S.Si.",
  },
  head: {
    email: "kepala.prodi@lpm.ac.id",
    password: "unit123",
    name: "Dr. Siti Aminah, M.Kom.",
  },
  member: {
    email: "anggota.prodi@lpm.ac.id",
    password: "unit123",
    name: "Ahmad Fauzi, S.Kom.",
  },
  perpusHead: {
    email: "kepala.perpus@lpm.ac.id",
    password: "unit123",
    name: "Dewi Lestari, M.Pd.",
  },
};

export const storageFile = (role: RoleKey) =>
  path.join(AUTH_DIR, `${role}.json`);

/** Unit dari seed demo. */
export const UNITS = {
  ti: "Program Studi Teknik Informatika",
  mnj: "Program Studi Manajemen",
  perpus: "Perpustakaan Pusat",
  biro: "Biro Administrasi Umum",
} as const;

/* ------------------------------------------------------------------------ */
/*  State bersama                                                            */
/* ------------------------------------------------------------------------ */

export type FlowState = {
  run: string;
  cycleName?: string;
  cycleId?: number;
  /** id unit menurut nama. */
  unitIds?: Record<string, number>;
  e2eUnitName?: string;
  multiUser?: { email: string; password: string; name: string };
  privacyUser?: { email: string; password: string; name: string };
  guestUser?: { email: string; password: string; name: string };
  newSuperadmin?: { email: string; password: string; name: string };
  std?: {
    umum: string;
    prodi: string;
    ti: string;
    perpus: string;
    biro: string;
  };
  q?: {
    umum1: string;
    umum2: string;
    prodi1: string;
    moved: string;
    ti1: string;
    perpus1: string;
    biro1: string;
  };
  /** path logis bukti (/uploads/bukti/...) */
  evidence?: { ti?: string; perpus?: string };
  docPenetapan?: { title: string; href: string };
  revisionNote?: string;
  rtl?: string;
};

export function readState(): FlowState {
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as FlowState;
}

export function writeState(patch: Partial<FlowState>) {
  const cur = fs.existsSync(STATE_FILE) ? readState() : ({} as FlowState);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...cur, ...patch }, null, 2));
}

/** Ambil nilai state yang wajib ada (gagal jelas bila tahap sebelumnya gagal). */
export function need<K extends keyof FlowState>(
  key: K
): NonNullable<FlowState[K]> {
  const v = readState()[key];
  if (v === undefined || v === null) {
    throw new Error(
      `State "${String(key)}" belum ada — tahap uji sebelumnya gagal/dilewati.`
    );
  }
  return v as NonNullable<FlowState[K]>;
}

/* ------------------------------------------------------------------------ */
/*  Login & sesi                                                             */
/* ------------------------------------------------------------------------ */

export async function fillLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /^Email/ }).fill(email);
  await page.getByRole("textbox", { name: /^Kata Sandi/ }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

/** Login lewat UI; menunggu dialihkan dari /login. */
export async function login(page: Page, email: string, password: string) {
  await fillLogin(page, email, password);
  await page.waitForURL(/\/(dashboard|no-access)/, { timeout: 20_000 });
}

export function consentDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Persetujuan Kebijakan Privasi" });
}

/** Setujui kebijakan privasi bila dialog persetujuan tampil. */
export async function acceptConsentIfShown(page: Page) {
  const dlg = consentDialog(page);
  try {
    await dlg.waitFor({ state: "visible", timeout: 4_000 });
  } catch {
    return false;
  }
  await dlg.getByRole("checkbox").check();
  await dlg.getByRole("button", { name: "Setuju & Lanjutkan" }).click();
  await expect(dlg).toBeHidden();
  return true;
}

/** Konteks baru dengan sesi peran tertentu (dari flows.setup.ts). */
export async function contextAs(
  browser: Browser,
  role: RoleKey
): Promise<BrowserContext> {
  return browser.newContext({ storageState: storageFile(role) });
}

/** Konteks tanpa sesi (eksplisit: `test.use({storageState})` ikut terwariskan). */
export async function anonPage(browser: Browser) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  return { context, page };
}

export async function pageAs(browser: Browser, role: RoleKey) {
  const context = await contextAs(browser, role);
  const page = await context.newPage();
  return { context, page };
}

/* ------------------------------------------------------------------------ */
/*  Berkas uji                                                               */
/* ------------------------------------------------------------------------ */

/** PDF minimal yang valid (magic bytes %PDF-, tanpa /JavaScript). */
export function pdfFile(name = "bukti-e2e.pdf") {
  const body =
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n";
  return { name, mimeType: "application/pdf", buffer: Buffer.from(body) };
}

/** HTML yang diganti nama menjadi .pdf (harus ditolak: magic bytes). */
export function fakePdfFile() {
  return {
    name: "palsu.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "<!doctype html><html><body><script>alert(1)</script></body></html>"
    ),
  };
}

/** Berkas non-PDF. */
export function textFile() {
  return {
    name: "catatan.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bukan pdf"),
  };
}

/** PDF dengan aksi aktif /JavaScript (harus ditolak). */
export function jsPdfFile() {
  return {
    name: "aktif.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/OpenAction<</S/JavaScript/JS(app.alert(1))>>>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
    ),
  };
}

/* ------------------------------------------------------------------------ */
/*  Utilitas tanggal (WIB)                                                   */
/* ------------------------------------------------------------------------ */

/** YYYY-MM-DD di zona Asia/Jakarta, digeser `days` hari. */
export function wibDate(days = 0): string {
  const now = new Date(Date.now() + 7 * 3600_000 + days * 86_400_000);
  return now.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------------ */
/*  Server Actions (uji negatif peran)                                       */
/* ------------------------------------------------------------------------ */

/**
 * Temukan id Server Action dari chunk JS klien yang dimuat halaman
 * (`createServerReference("<id>", …, "<namaEkspor>")`).
 */
export async function findActionIds(
  page: Page,
  names: string[]
): Promise<Record<string, string>> {
  const srcs: string[] = await page.evaluate(() => {
    const tags = Array.from(document.querySelectorAll("script[src]")).map(
      (s) => (s as HTMLScriptElement).src
    );
    const res = performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((n) => /\.js(\?|$)/.test(n));
    return Array.from(new Set([...tags, ...res]));
  });
  const found: Record<string, string> = {};
  const re = /createServerReference\)\("([0-9a-f]{20,})",[^"]*?"(\w+)"\)/g;
  for (const src of srcs) {
    if (!src.includes("/_next/")) continue;
    const text = await (await page.request.get(src)).text();
    for (const m of text.matchAll(re)) {
      if (names.includes(m[2])) found[m[2]] = m[1];
    }
  }
  return found;
}

/**
 * Panggil Server Action langsung (POST + header Next-Action) dari dalam
 * halaman — memakai cookie sesi & Origin halaman, persis seperti klien jahat
 * yang memanggil action dengan argumen pilihannya sendiri.
 */
export async function callAction(
  page: Page,
  routePath: string,
  actionId: string,
  args: unknown[]
): Promise<{ status: number; text: string }> {
  return page.evaluate(
    async ({ routePath, actionId, args }) => {
      const r = await fetch(routePath, {
        method: "POST",
        headers: {
          "Next-Action": actionId,
          Accept: "text/x-component",
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: JSON.stringify(args),
      });
      return { status: r.status, text: await r.text() };
    },
    { routePath, actionId, args }
  );
}

/* ------------------------------------------------------------------------ */
/*  Aksesibilitas                                                            */
/* ------------------------------------------------------------------------ */

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];

export type AxeSummary = {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: string[];
};

export async function axeScan(
  page: Page,
  testInfo: TestInfo,
  label: string,
  exclude: string[] = [".recharts-wrapper"]
): Promise<AxeSummary[]> {
  let builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  for (const sel of exclude) builder = builder.exclude(sel);
  const results = await builder.analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 8),
  }));
  await testInfo.attach(`axe-${label}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  return summary;
}

/* ------------------------------------------------------------------------ */
/*  Lain-lain                                                                */
/* ------------------------------------------------------------------------ */

/** Pesan sukses standar `ActionFeedback`. */
export const OK_MSG = "Berhasil disimpan.";

/** Ekspektasi pengalihan: buka `path`, lalu URL harus cocok `to`. */
export async function expectRedirect(page: Page, p: string, to: RegExp) {
  await page.goto(p);
  await expect(page).toHaveURL(to);
}

export function isPdf(buf: Buffer) {
  return buf.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Nyalakan/matikan mode pemeliharaan lewat UI Pengaturan (sebagai superadmin). */
export async function setMaintenance(
  browser: Browser,
  on: boolean,
  message?: string
) {
  const { context, page } = await pageAs(browser, "superadmin");
  try {
    await page.goto("/pengaturan");
    await page.getByRole("tab", { name: "Pemeliharaan" }).click();
    const box = page.getByRole("checkbox", {
      name: "Aktifkan mode pemeliharaan",
    });
    if (on) await box.check();
    else await box.uncheck();
    if (message !== undefined) {
      await page
        .getByRole("textbox", { name: "Pesan Pemeliharaan" })
        .fill(message);
    }
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText(OK_MSG)).toBeVisible();
  } finally {
    await context.close();
  }
}

/**
 * Ekstraksi teks kasar dari PDF (jsPDF): gabungkan isi mentah + seluruh
 * stream yang dapat di-inflate, lalu ambil literal string `( … )` milik
 * operator teks. Cukup untuk memeriksa ada/tidaknya sebuah frasa ASCII.
 */
export function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const parts: string[] = [raw];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const m of raw.matchAll(re)) {
    try {
      parts.push(
        zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1")
      );
    } catch {
      /* stream tidak terkompresi */
    }
  }
  const all = parts.join("\n");
  const strings: string[] = [];
  const unescape = (s: string) => s.replace(/\\([()\\])/g, "$1");
  for (const m of all.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
    strings.push(unescape(m[1]));
  }
  for (const m of all.matchAll(/\[((?:\((?:\\.|[^\\)])*\)|[^\]])*)\]\s*TJ/g)) {
    const seg = [...m[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((x) =>
      unescape(x[1])
    );
    strings.push(seg.join(""));
  }
  return strings.join("\n");
}

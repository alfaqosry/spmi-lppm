import { readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { SECRET_KEYS, SETTING_DEFAULTS } from "@/lib/settings";
import { CONSENT_VERSION, needsConsent } from "@/lib/privacy";
import { isQuestionForUnit } from "@/lib/scope";
import { redactText } from "@/lib/redact";
import { toIsoDate, toIsoJakarta } from "@/lib/format";
import {
  UPLOAD_FOLDERS,
  legacyUploadRoot,
  locateUpload,
  parseUploadPath,
  uploadRoot,
} from "@/lib/upload";

/* =====================================================================
   Kualitas Data (ISO/IEC 25012) — pemeriksaan otomatis SPMI
   ---------------------------------------------------------------------
   Kumpulan aturan bernama yang memeriksa data produksi terhadap
   karakteristik kualitas data ISO/IEC 25012 dan aturan bisnis SPMI
   (AB-xx di docs/01-PERANCANGAN.md §9).

   SELURUH aturan HANYA MEMBACA (findMany + stat/readdir). Tidak ada
   penulisan ke database maupun berkas. Data dimuat sekali per jalankan
   (memo per konteks) lalu dievaluasi di memori — volume SPMI kecil
   (ratusan–ribuan baris).

   Keluaran tidak memuat data pribadi: hanya id baris (`sampleIds`).
   Dokumentasi: docs/iso/25012-KUALITAS-DATA.md, docs/iso/KAMUS-DATA.md.
   ===================================================================== */

export type DqSeverity = "high" | "medium" | "low";

/** Karakteristik ISO/IEC 25012 (nama Indonesia). */
export type DqCharacteristic =
  | "Akurasi"
  | "Kelengkapan"
  | "Konsistensi"
  | "Kredibilitas"
  | "Kekinian"
  | "Aksesibilitas"
  | "Kepatuhan"
  | "Kerahasiaan"
  | "Efisiensi"
  | "Presisi"
  | "Ketertelusuran"
  | "Keterpahaman"
  | "Ketersediaan"
  | "Portabilitas"
  | "Keterpulihan";

export type DqCheckResult = {
  /** Jumlah objek yang diperiksa. */
  total: number;
  /** Jumlah objek yang melanggar aturan. */
  violations: number;
  /** Contoh id pelanggar (maks. SAMPLE_LIMIT) — tanpa data pribadi. */
  sampleIds: (number | string)[];
};

export type DqRule = {
  id: string;
  characteristic: DqCharacteristic;
  description: string;
  severity: DqSeverity;
  /** Rujukan aturan bisnis / kode (opsional). */
  ref?: string;
  check(ctx: DqContext): Promise<DqCheckResult>;
};

export type DqRuleResult = DqCheckResult & {
  id: string;
  characteristic: DqCharacteristic;
  description: string;
  severity: DqSeverity;
  ref?: string;
  status: "pass" | "fail" | "error";
  /** Persentase objek yang lolos (100 bila total = 0). */
  passRate: number;
  durationMs: number;
  /** Nama error (tanpa pesan/detail internal) bila aturan gagal dijalankan. */
  error?: string;
};

export type DqReport = {
  /** Persentase bobot aturan yang lolos (high=3, medium=2, low=1). */
  score: number;
  checkedAt: string;
  summary: {
    rules: number;
    passed: number;
    failed: number;
    errors: number;
    byCharacteristic: Record<string, { rules: number; passed: number }>;
  };
  results: DqRuleResult[];
};

export const SEVERITY_WEIGHT: Record<DqSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const SAMPLE_LIMIT = 10;

/** Toleransi jam (clock skew) untuk aturan "timestamp tidak di masa depan". */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Retensi akun Pengunjung tak berperan (docs/legal/RoPA.md). */
const PENGUNJUNG_RETENTION_DAYS = 180;

/** Sama dengan `EMAIL_RE` di src/lib/validate.ts (tidak diekspor di sana). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Hash bcrypt (bcryptjs: $2a$/$2b$, cost 2 digit, 53 karakter salt+hash). */
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
/** Hasil `maskEmail()` (src/lib/redact.ts): "a***@domain", "a***", "*", "". */
const MASKED_EMAIL_RE = /^(?:[^\s@*]\*\*\*(?:@[^\s@]+)?|\*?)$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Karakter kontrol C0 (selain \t \n \r), DEL, dan U+FFFD (hasil salah decode). */
const BAD_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/;
/** Pola mojibake umum UTF-8 yang terbaca sebagai Latin-1/Windows-1252. */
const MOJIBAKE_RE = /\u00C3[\u0080-\u00BF]|\u00E2\u20AC|\u00C2[\u00A0-\u00BF]/;

const LPM_ROLES = new Set(["superadmin", "lpm_admin", "lpm_member"]);
const AUDITEE_ROLES = new Set(["auditee_head", "auditee_member"]);
/** Sama dengan NO_UNIT_ROLES di src/lib/actions/units.ts. */
const NO_UNIT_ROLES = new Set([
  "superadmin",
  "lpm_admin",
  "lpm_member",
  "pengunjung",
]);
const PROGRESS_STATUSES = new Set(["belum_mulai", "mengisi", "selesai"]);
const SCOPE_TYPES = new Set(["all", "category", "unit"]);
/** Sama dengan BOOL_KEYS di src/lib/actions/settings.ts. */
const BOOL_SETTING_KEYS = [
  "log.login.enabled",
  "log.activity.enabled",
  "sso.enabled",
  "maintenance.enabled",
];
/** Sama dengan NUMBER_RANGES di src/lib/actions/settings.ts. */
const NUMBER_SETTING_RANGES: Record<string, [number, number]> = {
  "security.sessionDays": [1, 30],
  "security.loginMaxAttempts": [1, 5],
  "security.loginWindowMinutes": [1, 60],
  "log.loginRetentionDays": [0, 3650],
  "log.activityRetentionDays": [0, 3650],
};
const BRANDING_SETTING_KEYS = ["site.logo", "site.favicon", "site.ogImage"];

/* ------------------------------ Pemuat data ------------------------------ */

type Db = typeof prisma;

const loaders = {
  users: (db: Db) =>
    db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        password: true,
        ssoId: true,
        role: true,
        unitId: true,
        isUnitHead: true,
        isLpmHead: true,
        isActive: true,
        consentedAt: true,
        consentVersion: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  units: (db: Db) =>
    db.unit.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  memberships: (db: Db) =>
    db.unitMembership.findMany({
      select: {
        id: true,
        userId: true,
        unitId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  cycles: (db: Db) =>
    db.auditCycle.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  standards: (db: Db) =>
    db.auditStandard.findMany({
      select: {
        id: true,
        cycleId: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  questions: (db: Db) =>
    db.auditQuestion.findMany({
      select: {
        id: true,
        cycleId: true,
        standardId: true,
        questionText: true,
        scopeType: true,
        scopeCategory: true,
        scopeUnitId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  responses: (db: Db) =>
    db.auditResponse.findMany({
      select: {
        id: true,
        cycleId: true,
        unitId: true,
        auditQuestionId: true,
        answer: true,
        evidenceFile: true,
        evidenceLink: true,
        reason: true,
        status: true,
        lpmNotes: true,
        rtl: true,
        verifiedBy: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  documents: (db: Db) =>
    db.document.findMany({
      select: {
        id: true,
        cycleId: true,
        type: true,
        title: true,
        filePath: true,
        link: true,
        uploadedBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  progress: (db: Db) =>
    db.unitProgress.findMany({
      select: {
        id: true,
        cycleId: true,
        unitId: true,
        status: true,
        lastUpdatedBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { id: "asc" },
    }),
  settings: (db: Db) =>
    db.appSetting.findMany({
      select: { id: true, key: true, value: true, isSecret: true },
      orderBy: { id: "asc" },
    }),
  loginLogs: (db: Db) =>
    db.loginLog.findMany({
      select: {
        id: true,
        email: true,
        userId: true,
        message: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    }),
  activityLogs: (db: Db) =>
    db.activityLog.findMany({
      select: { id: true, userId: true, detail: true, createdAt: true },
      orderBy: { id: "asc" },
    }),
};

type Loaded<K extends keyof typeof loaders> = Awaited<
  ReturnType<(typeof loaders)[K]>
>;

export type LocatedFile = { absPath: string; legacy: boolean } | null;

export type DqContext = {
  now: Date;
  users(): Promise<Loaded<"users">>;
  units(): Promise<Loaded<"units">>;
  memberships(): Promise<Loaded<"memberships">>;
  cycles(): Promise<Loaded<"cycles">>;
  standards(): Promise<Loaded<"standards">>;
  questions(): Promise<Loaded<"questions">>;
  responses(): Promise<Loaded<"responses">>;
  documents(): Promise<Loaded<"documents">>;
  progress(): Promise<Loaded<"progress">>;
  settingRows(): Promise<Loaded<"settings">>;
  /** Nilai pengaturan efektif (default ditimpa DB), seperti getSettings(). */
  settings(): Promise<Record<string, string>>;
  loginLogs(): Promise<Loaded<"loginLogs">>;
  activityLogs(): Promise<Loaded<"activityLogs">>;
  /** Cari berkas fisik untuk path logis `/uploads/<folder>/<nama>` (memo). */
  locate(logical: string): Promise<LocatedFile>;
  /** Path logis seluruh berkas di UPLOAD_DIR (folder whitelist). */
  storedUploads(): Promise<string[]>;
};

function memo<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined;
  return () => (p ??= fn());
}

/** Buat konteks pemeriksaan (pemuatan data malas + memo per jalankan). */
export function createDqContext(
  db: Db = prisma,
  now: Date = new Date()
): DqContext {
  const settingRows = memo(() => loaders.settings(db));
  const located = new Map<string, Promise<LocatedFile>>();
  return {
    now,
    users: memo(() => loaders.users(db)),
    units: memo(() => loaders.units(db)),
    memberships: memo(() => loaders.memberships(db)),
    cycles: memo(() => loaders.cycles(db)),
    standards: memo(() => loaders.standards(db)),
    questions: memo(() => loaders.questions(db)),
    responses: memo(() => loaders.responses(db)),
    documents: memo(() => loaders.documents(db)),
    progress: memo(() => loaders.progress(db)),
    settingRows,
    settings: memo(async () => {
      const values: Record<string, string> = { ...SETTING_DEFAULTS };
      for (const r of await settingRows()) {
        if (Object.hasOwn(SETTING_DEFAULTS, r.key) && r.value != null) {
          values[r.key] = r.value;
        }
      }
      return values;
    }),
    loginLogs: memo(() => loaders.loginLogs(db)),
    activityLogs: memo(() => loaders.activityLogs(db)),
    locate(logical) {
      let p = located.get(logical);
      if (!p) {
        p = (async () => {
          const parsed = parseUploadPath(logical);
          if (!parsed) return null;
          const found = await locateUpload(parsed);
          if (!found) return null;
          return {
            absPath: found.absPath,
            legacy: found.absPath.startsWith(legacyUploadRoot() + path.sep),
          };
        })();
        located.set(logical, p);
      }
      return p;
    },
    storedUploads: memo(async () => {
      const out: string[] = [];
      for (const folder of UPLOAD_FOLDERS) {
        let names: string[] = [];
        try {
          const entries = await readdir(path.join(uploadRoot(), folder), {
            withFileTypes: true,
          });
          names = entries.filter((e) => e.isFile()).map((e) => e.name);
        } catch {
          /* folder belum ada */
        }
        for (const n of names) out.push(`/uploads/${folder}/${n}`);
      }
      return out.sort();
    }),
  };
}

/* ------------------------------ Utilitas -------------------------------- */

/** Akumulator hasil: hitung total & pelanggar, simpan contoh id. */
class Tally {
  total = 0;
  violations = 0;
  sampleIds: (number | string)[] = [];
  add(ok: boolean, id: number | string): void {
    this.total++;
    if (!ok) {
      this.violations++;
      if (this.sampleIds.length < SAMPLE_LIMIT) this.sampleIds.push(id);
    }
  }
  result(): DqCheckResult {
    return {
      total: this.total,
      violations: this.violations,
      sampleIds: this.sampleIds,
    };
  }
}

function blank(v: string | null | undefined): boolean {
  return !v || v.trim() === "";
}

/** Sama dengan isSafeHttpUrl di src/lib/errors.ts (modul itu bergantung pada next/navigation). */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}

function groupCount<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/** Tandai setiap anggota kelompok berisi > 1 elemen sebagai pelanggar. */
function duplicatesTally<T extends { id: number }>(
  items: T[],
  key: (t: T) => string | null
): DqCheckResult {
  const t = new Tally();
  const keyed = items.filter((i) => key(i) != null);
  const groups = groupCount(keyed, (i) => key(i) as string);
  for (const it of keyed) {
    t.add((groups.get(key(it) as string)?.length ?? 0) <= 1, it.id);
  }
  return t.result();
}

/** Semua path berkas yang dirujuk data (bukti, dokumen, aset branding). */
async function referencedFiles(
  ctx: DqContext
): Promise<{ ref: string; path: string; folder?: string }[]> {
  const [responses, documents, settings] = await Promise.all([
    ctx.responses(),
    ctx.documents(),
    ctx.settings(),
  ]);
  const out: { ref: string; path: string; folder?: string }[] = [];
  for (const r of responses) {
    if (r.evidenceFile)
      out.push({
        ref: `response:${r.id}`,
        path: r.evidenceFile,
        folder: "bukti",
      });
  }
  for (const d of documents) {
    if (d.filePath)
      out.push({ ref: `document:${d.id}`, path: d.filePath, folder: d.type });
  }
  for (const k of BRANDING_SETTING_KEYS) {
    const v = settings[k];
    if (v) out.push({ ref: `setting:${k}`, path: v, folder: "branding" });
  }
  return out;
}

/** Status progres yang seharusnya (aturan AB-11 / recalcUnitProgress). */
function expectedProgressStatus(answered: number, total: number): string {
  if (answered > 0 && total > 0 && answered >= total) return "selesai";
  if (answered > 0) return "mengisi";
  return "belum_mulai";
}

/* -------------------------------- Aturan -------------------------------- */

export const DQ_RULES: DqRule[] = [
  /* ----------------------------- Akun & unit ----------------------------- */
  {
    id: "DQ-01",
    characteristic: "Akurasi",
    severity: "high",
    description:
      "Email akun berformat valid dan kanonik (huruf kecil, tanpa spasi tepi).",
    ref: "emailField() src/lib/validate.ts",
    async check(ctx) {
      const t = new Tally();
      for (const u of await ctx.users()) {
        const e = u.email;
        t.add(EMAIL_RE.test(e) && e === e.trim().toLowerCase(), u.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-02",
    characteristic: "Konsistensi",
    severity: "high",
    description:
      "Email & username unik tanpa membedakan huruf besar/kecil (satu orang = satu akun).",
    async check(ctx) {
      const users = await ctx.users();
      const a = duplicatesTally(users, (u) => u.email.trim().toLowerCase());
      const b = duplicatesTally(users, (u) =>
        u.username ? `u:${u.username.trim().toLowerCase()}` : null
      );
      return {
        total: a.total + b.total,
        violations: a.violations + b.violations,
        sampleIds: [...a.sampleIds, ...b.sampleIds].slice(0, SAMPLE_LIMIT),
      };
    },
  },
  {
    id: "DQ-03",
    characteristic: "Konsistensi",
    severity: "high",
    description:
      "Peran ↔ unit: akun auditee punya unit utama & ≥1 penempatan; akun superadmin/LPM/pengunjung tanpa unit & tanpa penempatan.",
    ref: "AB-13, AB-14",
    async check(ctx) {
      const [users, memberships] = await Promise.all([
        ctx.users(),
        ctx.memberships(),
      ]);
      const byUser = groupCount(memberships, (m) => String(m.userId));
      const t = new Tally();
      for (const u of users) {
        const n = byUser.get(String(u.id))?.length ?? 0;
        if (AUDITEE_ROLES.has(u.role)) t.add(u.unitId != null && n > 0, u.id);
        else if (NO_UNIT_ROLES.has(u.role))
          t.add(u.unitId == null && n === 0 && !u.isUnitHead, u.id);
        else t.add(false, u.id); // peran tak dikenal
      }
      return t.result();
    },
  },
  {
    id: "DQ-04",
    characteristic: "Konsistensi",
    severity: "medium",
    description:
      "Sinkronisasi akun auditee: peran auditee_head ⇔ punya penempatan head, is_unit_head sesuai, unit utama termasuk penempatannya.",
    ref: "syncUserAccess() src/lib/actions/units.ts",
    async check(ctx) {
      const [users, memberships] = await Promise.all([
        ctx.users(),
        ctx.memberships(),
      ]);
      const byUser = groupCount(memberships, (m) => String(m.userId));
      const t = new Tally();
      for (const u of users) {
        if (!AUDITEE_ROLES.has(u.role)) continue;
        const ms = byUser.get(String(u.id)) ?? [];
        const hasHead = ms.some((m) => m.role === "head");
        t.add(
          (u.role === "auditee_head") === hasHead &&
            u.isUnitHead === hasHead &&
            ms.some((m) => m.unitId === u.unitId),
          u.id
        );
      }
      return t.result();
    },
  },
  {
    id: "DQ-05",
    characteristic: "Konsistensi",
    severity: "high",
    description:
      "Penempatan valid: peran penempatan hanya head/member dan setiap unit punya paling banyak satu Kepala Unit.",
    ref: "AB-12 assertHeadAvailable()",
    async check(ctx) {
      const ms = await ctx.memberships();
      const heads = groupCount(
        ms.filter((m) => m.role === "head"),
        (m) => String(m.unitId)
      );
      const t = new Tally();
      for (const m of ms) {
        const okRole = m.role === "head" || m.role === "member";
        const okHead =
          m.role !== "head" || (heads.get(String(m.unitId))?.length ?? 0) <= 1;
        t.add(okRole && okHead, m.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-06",
    characteristic: "Konsistensi",
    severity: "high",
    description:
      "Paling banyak satu Ketua LPM, dan Ketua LPM adalah akun aktif berperan lpm_admin/superadmin.",
    ref: "AB-15 setLpmHead()",
    async check(ctx) {
      const heads = (await ctx.users()).filter((u) => u.isLpmHead);
      const t = new Tally();
      for (const u of heads) {
        t.add(
          heads.length <= 1 &&
            u.isActive &&
            (u.role === "lpm_admin" || u.role === "superadmin"),
          u.id
        );
      }
      return t.result();
    },
  },
  {
    id: "DQ-07",
    characteristic: "Ketersediaan",
    severity: "high",
    description:
      "Tersedia minimal satu Superadmin aktif (sistem tetap dapat dikelola).",
    ref: "deleteAccount() — larangan menghapus superadmin terakhir",
    async check(ctx) {
      const n = (await ctx.users()).filter(
        (u) => u.role === "superadmin" && u.isActive
      ).length;
      return { total: 1, violations: n >= 1 ? 0 : 1, sampleIds: [] };
    },
  },
  {
    id: "DQ-08",
    characteristic: "Aksesibilitas",
    severity: "medium",
    description:
      "Akun aktif punya cara masuk (kata sandi lokal atau tertaut SSO).",
    async check(ctx) {
      const t = new Tally();
      for (const u of await ctx.users()) {
        if (!u.isActive) continue;
        t.add(!blank(u.password) || !blank(u.ssoId), u.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-09",
    characteristic: "Kerahasiaan",
    severity: "high",
    description:
      "Kata sandi lokal hanya tersimpan sebagai hash bcrypt (tidak ada teks polos).",
    ref: "hashPassword() src/lib/password.ts",
    async check(ctx) {
      const t = new Tally();
      for (const u of await ctx.users()) {
        if (u.password == null) continue;
        t.add(BCRYPT_RE.test(u.password), u.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-10",
    characteristic: "Kepatuhan",
    severity: "high",
    description:
      "Persetujuan privasi konsisten: waktu & versi terisi berpasangan, versi berformat tanggal ISO, tidak melebihi versi berlaku, dan waktu setuju ≥ tanggal versi.",
    ref: "UU 27/2022 PDP; CONSENT_VERSION src/lib/privacy.ts",
    async check(ctx) {
      const t = new Tally();
      for (const u of await ctx.users()) {
        const at = u.consentedAt;
        const v = u.consentVersion;
        if (at == null && v == null) continue;
        let ok = at != null && v != null;
        if (ok && v != null && at != null) {
          ok =
            ISO_DATE_RE.test(v) &&
            v <= CONSENT_VERSION &&
            (toIsoDate(at) ?? "") >= v;
        }
        t.add(ok, u.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-11",
    characteristic: "Kepatuhan",
    severity: "low",
    description:
      "Akun aktif telah menyetujui kebijakan privasi versi berlaku (diminta ulang saat login berikutnya).",
    ref: "needsConsent()",
    async check(ctx) {
      const t = new Tally();
      for (const u of await ctx.users()) {
        if (!u.isActive) continue;
        t.add(!needsConsent(u), u.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-12",
    characteristic: "Keterpahaman",
    severity: "low",
    description:
      "Nama (akun, unit, siklus, standar, dokumen) terisi, rapi (tanpa spasi tepi/ganda), nama unit unik, dan teks butir pertanyaan ≥ 10 karakter.",
    async check(ctx) {
      const [users, units, cycles, standards, documents, questions] =
        await Promise.all([
          ctx.users(),
          ctx.units(),
          ctx.cycles(),
          ctx.standards(),
          ctx.documents(),
          ctx.questions(),
        ]);
      const tidy = (s: string) =>
        s.trim() !== "" && s === s.trim() && !/\s{2,}/.test(s);
      const unitNames = groupCount(units, (u) => u.name.trim().toLowerCase());
      const t = new Tally();
      for (const u of users) t.add(tidy(u.name), `user:${u.id}`);
      for (const u of units)
        t.add(
          tidy(u.name) &&
            tidy(u.category) &&
            (unitNames.get(u.name.trim().toLowerCase())?.length ?? 0) <= 1,
          `unit:${u.id}`
        );
      for (const c of cycles) t.add(tidy(c.name), `cycle:${c.id}`);
      for (const s of standards) t.add(tidy(s.name), `standard:${s.id}`);
      for (const d of documents) t.add(tidy(d.title), `document:${d.id}`);
      for (const q of questions)
        t.add(q.questionText.trim().length >= 10, `question:${q.id}`);
      return t.result();
    },
  },

  /* --------------------------- Siklus & instrumen -------------------------- */
  {
    id: "DQ-13",
    characteristic: "Konsistensi",
    severity: "high",
    description: "Paling banyak satu siklus audit aktif.",
    ref: "AB-01",
    async check(ctx) {
      const active = (await ctx.cycles()).filter((c) => c.isActive);
      const t = new Tally();
      for (const c of active) t.add(active.length <= 1, c.id);
      return t.result();
    },
  },
  {
    id: "DQ-14",
    characteristic: "Akurasi",
    severity: "high",
    description: "Tanggal mulai siklus ≤ tanggal selesai.",
    ref: "AB-04",
    async check(ctx) {
      const t = new Tally();
      for (const c of await ctx.cycles())
        t.add(c.startDate.getTime() <= c.endDate.getTime(), c.id);
      return t.result();
    },
  },
  {
    id: "DQ-15",
    characteristic: "Kekinian",
    severity: "medium",
    description:
      "Siklus yang ditandai aktif belum melewati tanggal selesai (status aktif tidak usang).",
    ref: "AB-02 isCycleOpen()",
    async check(ctx) {
      const t = new Tally();
      const today = toIsoDate(ctx.now) ?? "";
      for (const c of await ctx.cycles()) {
        if (!c.isActive) continue;
        t.add((toIsoDate(c.endDate) ?? "") >= today, c.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-16",
    characteristic: "Konsistensi",
    severity: "high",
    description:
      "Hierarki siklus konsisten: butir pertanyaan satu siklus dengan standarnya, jawaban satu siklus dengan butirnya.",
    ref: "assertStandardInCycle(), saveResponse()",
    async check(ctx) {
      const [standards, questions, responses] = await Promise.all([
        ctx.standards(),
        ctx.questions(),
        ctx.responses(),
      ]);
      const stdCycle = new Map(standards.map((s) => [s.id, s.cycleId]));
      const qCycle = new Map(questions.map((q) => [q.id, q.cycleId]));
      const t = new Tally();
      for (const q of questions)
        t.add(stdCycle.get(q.standardId) === q.cycleId, `question:${q.id}`);
      for (const r of responses)
        t.add(qCycle.get(r.auditQuestionId) === r.cycleId, `response:${r.id}`);
      return t.result();
    },
  },
  {
    id: "DQ-17",
    characteristic: "Akurasi",
    severity: "medium",
    description:
      "Cakupan butir valid: all (tanpa target), category (kategori terisi & dipakai ≥1 unit), unit (unit target ada).",
    ref: "readScope() src/lib/actions/questions.ts; src/lib/scope.ts",
    async check(ctx) {
      const [questions, units] = await Promise.all([
        ctx.questions(),
        ctx.units(),
      ]);
      const categories = new Set(units.map((u) => u.category));
      const unitIds = new Set(units.map((u) => u.id));
      const t = new Tally();
      for (const q of questions) {
        let ok = SCOPE_TYPES.has(q.scopeType);
        if (q.scopeType === "all")
          ok = q.scopeCategory == null && q.scopeUnitId == null;
        if (q.scopeType === "category")
          ok = !blank(q.scopeCategory) && categories.has(q.scopeCategory!);
        if (q.scopeType === "unit")
          ok = q.scopeUnitId != null && unitIds.has(q.scopeUnitId);
        t.add(ok, q.id);
      }
      return t.result();
    },
  },

  /* --------------------------- Jawaban & verifikasi ------------------------ */
  {
    id: "DQ-18",
    characteristic: "Konsistensi",
    severity: "medium",
    description:
      "Jawaban hanya untuk butir yang berlaku bagi unit penjawab (sesuai cakupan).",
    ref: "AB-08 isQuestionForUnit()",
    async check(ctx) {
      const [responses, questions, units] = await Promise.all([
        ctx.responses(),
        ctx.questions(),
        ctx.units(),
      ]);
      const qs = new Map(questions.map((q) => [q.id, q]));
      const us = new Map(units.map((u) => [u.id, u]));
      const t = new Tally();
      for (const r of responses) {
        const q = qs.get(r.auditQuestionId);
        const u = us.get(r.unitId);
        t.add(Boolean(q && u && isQuestionForUnit(q, u)), r.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-19",
    characteristic: "Kelengkapan",
    severity: "high",
    description:
      "Setiap jawaban terisi Ya/Tidak; jawaban Ya disertai bukti (berkas atau tautan).",
    ref: "AB-06 saveResponse()",
    async check(ctx) {
      const t = new Tally();
      for (const r of await ctx.responses()) {
        if (r.answer === "tidak") continue;
        t.add(
          r.answer === "ya" &&
            (!blank(r.evidenceFile) || !blank(r.evidenceLink)),
          r.id
        );
      }
      return t.result();
    },
  },
  {
    id: "DQ-20",
    characteristic: "Kelengkapan",
    severity: "high",
    description: "Jawaban Tidak disertai alasan.",
    ref: "AB-06 saveResponse()",
    async check(ctx) {
      const t = new Tally();
      for (const r of await ctx.responses()) {
        if (r.answer !== "tidak") continue;
        t.add(!blank(r.reason), r.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-21",
    characteristic: "Ketertelusuran",
    severity: "high",
    description:
      "Data verifikasi konsisten: pending tanpa verifikator; verified/revision punya verified_by & verified_at; revision punya catatan LPM.",
    ref: "AB-09, AB-10 verifyResponse()",
    async check(ctx) {
      const t = new Tally();
      for (const r of await ctx.responses()) {
        let ok: boolean;
        if (r.status === "pending")
          ok = r.verifiedBy == null && r.verifiedAt == null;
        else
          ok =
            r.verifiedBy != null &&
            r.verifiedAt != null &&
            (r.status !== "revision" || !blank(r.lpmNotes));
        t.add(ok, r.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-22",
    characteristic: "Kredibilitas",
    severity: "medium",
    description:
      "Verifikasi jawaban dan unggahan dokumen dilakukan oleh akun berperan LPM/superadmin.",
    ref: "requireLpm() src/lib/guards.ts",
    async check(ctx) {
      const [responses, documents, users] = await Promise.all([
        ctx.responses(),
        ctx.documents(),
        ctx.users(),
      ]);
      const role = new Map(users.map((u) => [u.id, u.role as string]));
      const t = new Tally();
      for (const r of responses) {
        if (r.verifiedBy == null) continue;
        t.add(LPM_ROLES.has(role.get(r.verifiedBy) ?? ""), `response:${r.id}`);
      }
      for (const d of documents) {
        if (d.uploadedBy == null) continue;
        t.add(LPM_ROLES.has(role.get(d.uploadedBy) ?? ""), `document:${d.id}`);
      }
      return t.result();
    },
  },
  {
    id: "DQ-23",
    characteristic: "Kekinian",
    severity: "medium",
    description:
      "Progres unit (unit_progress) sama dengan hasil hitung ulang dari jawaban & butir yang berlaku; unit yang sudah menjawab punya baris progres.",
    ref: "AB-11 recalcUnitProgress()",
    async check(ctx) {
      const [progress, questions, responses, units] = await Promise.all([
        ctx.progress(),
        ctx.questions(),
        ctx.responses(),
        ctx.units(),
      ]);
      const us = new Map(units.map((u) => [u.id, u]));
      const qByCycle = groupCount(questions, (q) => String(q.cycleId));
      const qs = new Map(questions.map((q) => [q.id, q]));
      const answered = new Map<string, number>();
      for (const r of responses) {
        if (r.answer == null) continue;
        const q = qs.get(r.auditQuestionId);
        const u = us.get(r.unitId);
        if (!q || !u || q.cycleId !== r.cycleId || !isQuestionForUnit(q, u))
          continue;
        const k = `${r.cycleId}:${r.unitId}`;
        answered.set(k, (answered.get(k) ?? 0) + 1);
      }
      const t = new Tally();
      const seen = new Set<string>();
      for (const p of progress) {
        const k = `${p.cycleId}:${p.unitId}`;
        seen.add(k);
        const u = us.get(p.unitId);
        const total = u
          ? (qByCycle.get(String(p.cycleId)) ?? []).filter((q) =>
              isQuestionForUnit(q, u)
            ).length
          : 0;
        t.add(
          PROGRESS_STATUSES.has(p.status) &&
            p.status === expectedProgressStatus(answered.get(k) ?? 0, total),
          p.id
        );
      }
      for (const k of answered.keys()) {
        if (!seen.has(k)) t.add(false, k);
      }
      return t.result();
    },
  },

  /* -------------------------- Dokumen, tautan, berkas ---------------------- */
  {
    id: "DQ-24",
    characteristic: "Kelengkapan",
    severity: "high",
    description: "Dokumen Penetapan/Evaluasi memiliki berkas PDF atau tautan.",
    ref: "AB-22 createDocument()",
    async check(ctx) {
      const t = new Tally();
      for (const d of await ctx.documents())
        t.add(!blank(d.filePath) || !blank(d.link), d.id);
      return t.result();
    },
  },
  {
    id: "DQ-25",
    characteristic: "Kepatuhan",
    severity: "high",
    description:
      "Tautan bukti & tautan dokumen hanya http/https tanpa kredensial di URL.",
    ref: "isSafeHttpUrl() src/lib/errors.ts",
    async check(ctx) {
      const [responses, documents] = await Promise.all([
        ctx.responses(),
        ctx.documents(),
      ]);
      const t = new Tally();
      for (const r of responses)
        if (r.evidenceLink)
          t.add(isSafeHttpUrl(r.evidenceLink), `response:${r.id}`);
      for (const d of documents)
        if (d.link) t.add(isSafeHttpUrl(d.link), `document:${d.id}`);
      return t.result();
    },
  },
  {
    id: "DQ-26",
    characteristic: "Kepatuhan",
    severity: "high",
    description:
      "Path berkas tersimpan berformat kanonik /uploads/<folder>/<nama> di folder yang benar (bukti → bukti, dokumen → jenisnya, aset → branding).",
    ref: "parseUploadPath() src/lib/upload.ts",
    async check(ctx) {
      const t = new Tally();
      for (const f of await referencedFiles(ctx)) {
        const p = parseUploadPath(f.path);
        t.add(
          Boolean(p && p.logical === f.path && p.folder === f.folder),
          f.ref
        );
      }
      return t.result();
    },
  },
  {
    id: "DQ-27",
    characteristic: "Ketersediaan",
    severity: "high",
    description:
      "Setiap berkas yang dirujuk database benar-benar ada di UPLOAD_DIR (atau folder lama public/uploads).",
    ref: "locateUpload() src/lib/upload.ts",
    async check(ctx) {
      const t = new Tally();
      for (const f of await referencedFiles(ctx)) {
        t.add((await ctx.locate(f.path)) != null, f.ref);
      }
      return t.result();
    },
  },
  {
    id: "DQ-28",
    characteristic: "Portabilitas",
    severity: "low",
    description:
      "Berkas yang dirujuk sudah berada di penyimpanan privat UPLOAD_DIR (bukan folder lama public/uploads) sehingga ikut backup & dapat dipindah utuh.",
    ref: "ADR-0006",
    async check(ctx) {
      const t = new Tally();
      for (const f of await referencedFiles(ctx)) {
        const loc = await ctx.locate(f.path);
        if (!loc) continue; // tidak ada → sudah dilaporkan DQ-27
        t.add(!loc.legacy, f.ref);
      }
      return t.result();
    },
  },
  {
    id: "DQ-29",
    characteristic: "Efisiensi",
    severity: "low",
    description:
      "Tidak ada berkas yatim di UPLOAD_DIR (berkas yang tidak dirujuk jawaban, dokumen, maupun pengaturan branding).",
    ref: "cleanupUnreferencedUploads()",
    async check(ctx) {
      const refs = new Set((await referencedFiles(ctx)).map((f) => f.path));
      const t = new Tally();
      for (const p of await ctx.storedUploads()) {
        t.add(refs.has(p), p.split("/").slice(-2).join("/"));
      }
      return t.result();
    },
  },

  /* ------------------------------ Lintas tabel ----------------------------- */
  {
    id: "DQ-30",
    characteristic: "Konsistensi",
    severity: "high",
    description:
      "Integritas referensial: penempatan, unit utama, verifikator, pengunggah, dan pembaru progres merujuk baris yang ada (tidak ada penempatan yatim).",
    async check(ctx) {
      const [users, units, ms, responses, documents, progress] =
        await Promise.all([
          ctx.users(),
          ctx.units(),
          ctx.memberships(),
          ctx.responses(),
          ctx.documents(),
          ctx.progress(),
        ]);
      const uid = new Set(users.map((u) => u.id));
      const nid = new Set(units.map((u) => u.id));
      const t = new Tally();
      for (const m of ms)
        t.add(uid.has(m.userId) && nid.has(m.unitId), `membership:${m.id}`);
      for (const u of users)
        if (u.unitId != null) t.add(nid.has(u.unitId), `user:${u.id}`);
      for (const r of responses)
        if (r.verifiedBy != null)
          t.add(uid.has(r.verifiedBy), `response:${r.id}`);
      for (const d of documents)
        if (d.uploadedBy != null)
          t.add(uid.has(d.uploadedBy), `document:${d.id}`);
      for (const p of progress)
        if (p.lastUpdatedBy != null)
          t.add(uid.has(p.lastUpdatedBy), `progress:${p.id}`);
      return t.result();
    },
  },
  {
    id: "DQ-31",
    characteristic: "Akurasi",
    severity: "medium",
    description:
      "Timestamp masuk akal: tidak di masa depan (toleransi 5 menit) dan updated_at ≥ created_at.",
    async check(ctx) {
      const limit = ctx.now.getTime() + FUTURE_TOLERANCE_MS;
      const t = new Tally();
      const visit = (
        table: string,
        rows: {
          id: number;
          createdAt: Date;
          updatedAt?: Date;
          extra?: (Date | null)[];
        }[]
      ) => {
        for (const r of rows) {
          const dates = [r.createdAt, r.updatedAt, ...(r.extra ?? [])].filter(
            (d): d is Date => d instanceof Date
          );
          const notFuture = dates.every((d) => d.getTime() <= limit);
          const ordered =
            !r.updatedAt ||
            r.updatedAt.getTime() >= r.createdAt.getTime() - 1000;
          t.add(notFuture && ordered, `${table}:${r.id}`);
        }
      };
      const [users, units, ms, cycles, standards, questions, responses] =
        await Promise.all([
          ctx.users(),
          ctx.units(),
          ctx.memberships(),
          ctx.cycles(),
          ctx.standards(),
          ctx.questions(),
          ctx.responses(),
        ]);
      const [documents, progress, loginLogs, activityLogs] = await Promise.all([
        ctx.documents(),
        ctx.progress(),
        ctx.loginLogs(),
        ctx.activityLogs(),
      ]);
      visit(
        "users",
        users.map((u) => ({ ...u, extra: [u.consentedAt] }))
      );
      visit("units", units);
      visit("unit_memberships", ms);
      visit("audit_cycles", cycles);
      visit("audit_standards", standards);
      visit("audit_questions", questions);
      visit(
        "audit_responses",
        responses.map((r) => ({ ...r, extra: [r.verifiedAt] }))
      );
      visit("documents", documents);
      visit("unit_progress", progress);
      visit("login_logs", loginLogs);
      visit("activity_logs", activityLogs);
      return t.result();
    },
  },
  {
    id: "DQ-32",
    characteristic: "Portabilitas",
    severity: "low",
    description:
      "Teks bebas bersih dari karakter kontrol, U+FFFD, dan mojibake (aman diekspor ke PDF/JSON UTF-8).",
    async check(ctx) {
      const [users, units, standards, questions, responses, documents] =
        await Promise.all([
          ctx.users(),
          ctx.units(),
          ctx.standards(),
          ctx.questions(),
          ctx.responses(),
          ctx.documents(),
        ]);
      const clean = (...vals: (string | null | undefined)[]) =>
        vals.every((v) => !v || (!BAD_CHAR_RE.test(v) && !MOJIBAKE_RE.test(v)));
      const t = new Tally();
      for (const u of users) t.add(clean(u.name), `user:${u.id}`);
      for (const u of units)
        t.add(clean(u.name, u.category, u.description), `unit:${u.id}`);
      for (const s of standards) t.add(clean(s.name), `standard:${s.id}`);
      for (const q of questions)
        t.add(clean(q.questionText, q.scopeCategory), `question:${q.id}`);
      for (const r of responses)
        t.add(clean(r.reason, r.lpmNotes, r.rtl), `response:${r.id}`);
      for (const d of documents) t.add(clean(d.title), `document:${d.id}`);
      return t.result();
    },
  },

  /* --------------------------- Log, privasi, pengaturan -------------------- */
  {
    id: "DQ-33",
    characteristic: "Kepatuhan",
    severity: "high",
    description:
      "Retensi log dipatuhi: tidak ada log login/aktivitas yang lebih tua dari masa simpan Pengaturan (+1 hari toleransi tugas harian).",
    ref: "purgeExpiredData() src/lib/privacy.ts; UU 27/2022 PDP",
    async check(ctx) {
      const settings = await ctx.settings();
      const t = new Tally();
      const apply = (
        prefix: string,
        days: number,
        rows: { id: number; createdAt: Date }[]
      ) => {
        if (!Number.isFinite(days) || days <= 0) return; // 0 = tanpa batas
        const cut = ctx.now.getTime() - (Math.floor(days) + 1) * DAY_MS;
        for (const r of rows)
          t.add(r.createdAt.getTime() >= cut, `${prefix}:${r.id}`);
      };
      apply(
        "login_logs",
        Number(settings["log.loginRetentionDays"]),
        await ctx.loginLogs()
      );
      apply(
        "activity_logs",
        Number(settings["log.activityRetentionDays"]),
        await ctx.activityLogs()
      );
      return t.result();
    },
  },
  {
    id: "DQ-34",
    characteristic: "Kerahasiaan",
    severity: "high",
    description:
      "Log tidak memuat data pribadi utuh: email log login tersamarkan (a***@domain); pesan log login & detail log aktivitas sudah tersanitasi (email/telepon/token).",
    ref: "recordLogin(), recordActivity() src/lib/logs.ts; redactText()",
    async check(ctx) {
      const t = new Tally();
      for (const l of await ctx.loginLogs()) {
        t.add(
          MASKED_EMAIL_RE.test(l.email) &&
            (!l.message || redactText(l.message) === l.message),
          `login_logs:${l.id}`
        );
      }
      for (const a of await ctx.activityLogs()) {
        t.add(
          !a.detail || redactText(a.detail) === a.detail,
          `activity_logs:${a.id}`
        );
      }
      return t.result();
    },
  },
  {
    id: "DQ-35",
    characteristic: "Ketertelusuran",
    severity: "low",
    description:
      "Log login/aktivitas yang memiliki user_id merujuk akun yang masih ada (jejak audit dapat ditelusuri ke pelaku).",
    async check(ctx) {
      const uid = new Set((await ctx.users()).map((u) => u.id));
      const t = new Tally();
      for (const l of await ctx.loginLogs())
        if (l.userId != null) t.add(uid.has(l.userId), `login_logs:${l.id}`);
      for (const a of await ctx.activityLogs())
        if (a.userId != null) t.add(uid.has(a.userId), `activity_logs:${a.id}`);
      return t.result();
    },
  },
  {
    id: "DQ-36",
    characteristic: "Kepatuhan",
    severity: "low",
    description:
      "Akun Pengunjung tanpa penempatan yang dibuat > 180 hari lalu masih tercatat login dalam masa simpan log (selain itu wajib dihapus menurut RoPA).",
    ref: "docs/legal/RoPA.md — retensi akun Pengunjung 180 hari",
    async check(ctx) {
      const [users, memberships, loginLogs] = await Promise.all([
        ctx.users(),
        ctx.memberships(),
        ctx.loginLogs(),
      ]);
      const placed = new Set(memberships.map((m) => m.userId));
      const recent = new Set(
        loginLogs.filter((l) => l.userId != null).map((l) => l.userId)
      );
      const cut = ctx.now.getTime() - PENGUNJUNG_RETENTION_DAYS * DAY_MS;
      const t = new Tally();
      for (const u of users) {
        if (u.role !== "pengunjung" || placed.has(u.id)) continue;
        if (u.createdAt.getTime() >= cut) continue;
        t.add(recent.has(u.id), u.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-37",
    characteristic: "Kerahasiaan",
    severity: "high",
    description:
      "Pengaturan rahasia (sso.clientSecret) yang terisi ditandai is_secret agar tidak pernah dikirim ke klien.",
    ref: "AB-23 SECRET_KEYS src/lib/settings.ts",
    async check(ctx) {
      const t = new Tally();
      for (const r of await ctx.settingRows()) {
        if (!(SECRET_KEYS as string[]).includes(r.key) || blank(r.value))
          continue;
        t.add(r.isSecret, r.id);
      }
      return t.result();
    },
  },
  {
    id: "DQ-38",
    characteristic: "Presisi",
    severity: "medium",
    description:
      "Nilai pengaturan sah: key dikenal, boolean bernilai true/false, angka bulat dalam rentang yang diizinkan form Pengaturan.",
    ref: "BOOL_KEYS, NUMBER_RANGES src/lib/actions/settings.ts",
    async check(ctx) {
      const t = new Tally();
      for (const r of await ctx.settingRows()) {
        let ok = Object.hasOwn(SETTING_DEFAULTS, r.key);
        const v = (r.value ?? "").trim();
        if (ok && BOOL_SETTING_KEYS.includes(r.key))
          ok = v === "true" || v === "false";
        const range = NUMBER_SETTING_RANGES[r.key];
        if (ok && range) {
          const n = Number(v);
          ok =
            /^\d+$/.test(v) &&
            Number.isInteger(n) &&
            n >= range[0] &&
            n <= range[1];
        }
        t.add(ok, r.id);
      }
      return t.result();
    },
  },
];

/* ------------------------------- Runner --------------------------------- */

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Jalankan satu aturan; error ditangkap menjadi status "error" (tanpa detail). */
export async function runRule(
  rule: DqRule,
  ctx: DqContext
): Promise<DqRuleResult> {
  const started = Date.now();
  const base = {
    id: rule.id,
    characteristic: rule.characteristic,
    description: rule.description,
    severity: rule.severity,
    ...(rule.ref ? { ref: rule.ref } : {}),
  };
  try {
    const r = await rule.check(ctx);
    return {
      ...base,
      ...r,
      sampleIds: r.sampleIds.slice(0, SAMPLE_LIMIT),
      status: r.violations === 0 ? "pass" : "fail",
      passRate:
        r.total === 0
          ? 100
          : round1(((r.total - r.violations) / r.total) * 100),
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      ...base,
      total: 0,
      violations: 0,
      sampleIds: [],
      status: "error",
      passRate: 0,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.name : "Error",
    };
  }
}

/** Skor = Σ bobot aturan lolos / Σ bobot seluruh aturan × 100 (1 desimal). */
export function scoreResults(results: DqRuleResult[]): number {
  const all = results.reduce((s, r) => s + SEVERITY_WEIGHT[r.severity], 0);
  if (all === 0) return 100;
  const ok = results
    .filter((r) => r.status === "pass")
    .reduce((s, r) => s + SEVERITY_WEIGHT[r.severity], 0);
  return round1((ok / all) * 100);
}

/**
 * Jalankan seluruh aturan kualitas data (hanya-baca) dan kembalikan laporan.
 * Aturan dijalankan berurutan agar beban ke database tetap ringan.
 */
export async function runDataQuality(
  options: { ctx?: DqContext; rules?: DqRule[] } = {}
): Promise<DqReport> {
  const ctx = options.ctx ?? createDqContext();
  const rules = options.rules ?? DQ_RULES;
  const results: DqRuleResult[] = [];
  for (const rule of rules) results.push(await runRule(rule, ctx));

  const byCharacteristic: Record<string, { rules: number; passed: number }> =
    {};
  for (const r of results) {
    const c = (byCharacteristic[r.characteristic] ??= { rules: 0, passed: 0 });
    c.rules++;
    if (r.status === "pass") c.passed++;
  }
  return {
    score: scoreResults(results),
    checkedAt: toIsoJakarta(ctx.now) ?? ctx.now.toISOString(),
    summary: {
      rules: results.length,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail").length,
      errors: results.filter((r) => r.status === "error").length,
      byCharacteristic,
    },
    results,
  };
}

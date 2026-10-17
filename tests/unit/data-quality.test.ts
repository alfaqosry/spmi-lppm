import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/* Prisma tiruan: hanya `findMany` yang tersedia — pemanggilan metode lain
   (create/update/delete) akan melempar error, sehingga test juga membuktikan
   bahwa seluruh aturan bersifat HANYA-BACA. */
const h = vi.hoisted(() => ({
  data: {} as Record<string, any[]>,
  calls: [] as string[],
}));

vi.mock("@/lib/prisma", () => {
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get(_t, method: string) {
          h.calls.push(`${name}.${method}`);
          if (method !== "findMany") return undefined;
          return async () => h.data[name] ?? [];
        },
      }
    );
  return {
    prisma: {
      user: model("user"),
      unit: model("unit"),
      unitMembership: model("unitMembership"),
      auditCycle: model("auditCycle"),
      auditStandard: model("auditStandard"),
      auditQuestion: model("auditQuestion"),
      auditResponse: model("auditResponse"),
      document: model("document"),
      unitProgress: model("unitProgress"),
      appSetting: model("appSetting"),
      loginLog: model("loginLog"),
      activityLog: model("activityLog"),
    },
  };
});

import {
  DQ_RULES,
  createDqContext,
  isSafeHttpUrl,
  runDataQuality,
  runRule,
  scoreResults,
  type DqReport,
  type DqRuleResult,
} from "@/lib/data-quality";
import { CONSENT_VERSION } from "@/lib/privacy";

const NOW = new Date("2026-10-17T05:00:00.000Z"); // 12:00 WIB
const T0 = new Date("2026-10-01T03:00:00.000Z");
const HASH = "$2b$10$" + "a".repeat(53);
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

let dir = "";

type Rows = typeof h.data;

function user(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    name: `Pengguna ${id}`,
    email: `user${id}@up.ac.id`,
    username: null,
    password: HASH,
    ssoId: null,
    role: "pengunjung",
    unitId: null,
    isUnitHead: false,
    isLpmHead: false,
    isActive: true,
    consentedAt: new Date("2026-10-17T02:00:00.000Z"),
    consentVersion: CONSENT_VERSION,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

/** Data bersih: seluruh aturan harus lolos. */
function cleanData(): Rows {
  const ts = { createdAt: T0, updatedAt: T0 };
  return {
    user: [
      user(1, { role: "superadmin", isLpmHead: true, email: "admin@up.ac.id" }),
      user(2, { role: "lpm_member" }),
      user(3, { role: "auditee_head", unitId: 10, isUnitHead: true }),
      user(4, {
        role: "auditee_member",
        unitId: 10,
        password: null,
        ssoId: "sso-4",
        username: "2101001",
      }),
      user(5),
    ],
    unit: [
      {
        id: 10,
        name: "Program Studi Keperawatan",
        category: "Program Studi",
        description: null,
        ...ts,
      },
      {
        id: 11,
        name: "Biro Administrasi Umum",
        category: "Biro",
        description: "Biro",
        ...ts,
      },
    ],
    unitMembership: [
      { id: 1, userId: 3, unitId: 10, role: "head", ...ts },
      { id: 2, userId: 4, unitId: 10, role: "member", ...ts },
    ],
    auditCycle: [
      {
        id: 1,
        name: "Siklus 2026",
        startDate: date("2026-09-01"),
        endDate: date("2026-12-31"),
        isActive: true,
        ...ts,
      },
    ],
    auditStandard: [{ id: 100, cycleId: 1, name: "Standar Pendidikan", ...ts }],
    auditQuestion: [
      q(200, { scopeType: "all" }),
      q(201, { scopeType: "category", scopeCategory: "Program Studi" }),
      q(202, { scopeType: "unit", scopeUnitId: 11 }),
    ],
    auditResponse: [
      resp(500, 200, {
        answer: "ya",
        evidenceFile: "/uploads/bukti/a.pdf",
        status: "verified",
        verifiedBy: 2,
        verifiedAt: T0,
      }),
      resp(501, 201, {
        answer: "tidak",
        reason: "Belum ada SOP.",
        status: "revision",
        lpmNotes: "Lengkapi SOP.",
        verifiedBy: 1,
        verifiedAt: T0,
      }),
    ],
    document: [
      {
        id: 300,
        cycleId: 1,
        type: "penetapan",
        title: "Kebijakan SPMI",
        filePath: "/uploads/penetapan/b.pdf",
        link: null,
        uploadedBy: 1,
        ...ts,
      },
      {
        id: 301,
        cycleId: 1,
        type: "evaluasi",
        title: "Laporan AMI",
        filePath: null,
        link: "https://drive.example.ac.id/laporan",
        uploadedBy: 2,
        ...ts,
      },
    ],
    unitProgress: [
      {
        id: 1,
        cycleId: 1,
        unitId: 10,
        status: "selesai",
        lastUpdatedBy: 3,
        ...ts,
      },
    ],
    appSetting: [
      { id: 1, key: "log.loginRetentionDays", value: "90", isSecret: false },
      { id: 2, key: "sso.clientSecret", value: "rahasia", isSecret: true },
      { id: 3, key: "sso.enabled", value: "true", isSecret: false },
    ],
    loginLog: [
      {
        id: 1,
        email: "a***@up.ac.id",
        userId: 1,
        message: null,
        createdAt: ago(1),
      },
    ],
    activityLog: [
      {
        id: 1,
        userId: 1,
        detail: "Membuat akun u***@up.ac.id (pengunjung)",
        createdAt: ago(2),
      },
    ],
  };
}

function q(id: number, over: Record<string, unknown>) {
  return {
    id,
    cycleId: 1,
    standardId: 100,
    questionText: `Apakah unit memiliki dokumen mutu nomor ${id}?`,
    scopeType: "all",
    scopeCategory: null,
    scopeUnitId: null,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

function resp(id: number, questionId: number, over: Record<string, unknown>) {
  return {
    id,
    cycleId: 1,
    unitId: 10,
    auditQuestionId: questionId,
    answer: null,
    evidenceFile: null,
    evidenceLink: null,
    reason: null,
    status: "pending",
    lpmNotes: null,
    rtl: null,
    verifiedBy: null,
    verifiedAt: null,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  };
}

async function run(): Promise<DqReport> {
  return runDataQuality({ ctx: createDqContext(undefined, NOW) });
}

function byId(report: DqReport, id: string): DqRuleResult {
  const r = report.results.find((x) => x.id === id);
  if (!r) throw new Error(`aturan ${id} tidak ada`);
  return r;
}

function failedIds(report: DqReport): string[] {
  return report.results.filter((r) => r.status !== "pass").map((r) => r.id);
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "spmi-dq-"));
  await mkdir(path.join(dir, "bukti"), { recursive: true });
  await mkdir(path.join(dir, "penetapan"), { recursive: true });
  await writeFile(path.join(dir, "bukti", "a.pdf"), "%PDF-1.4");
  await writeFile(path.join(dir, "penetapan", "b.pdf"), "%PDF-1.4");
  process.env.UPLOAD_DIR = dir;
});

afterAll(async () => {
  delete process.env.UPLOAD_DIR;
  await rm(dir, { recursive: true, force: true });
});

beforeEach(() => {
  h.data = cleanData();
  h.calls = [];
});

describe("runDataQuality — data bersih", () => {
  it("seluruh aturan lolos, skor 100, waktu ISO 8601 +07:00", async () => {
    const r = await run();
    expect(failedIds(r)).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.summary).toMatchObject({
      rules: DQ_RULES.length,
      passed: DQ_RULES.length,
      failed: 0,
      errors: 0,
    });
    expect(r.checkedAt).toBe("2026-10-17T12:00:00.000+07:00");
  });

  it("hanya membaca (findMany) — tidak ada penulisan ke database", async () => {
    await run();
    expect(h.calls.length).toBeGreaterThan(0);
    expect(h.calls.every((c) => c.endsWith(".findMany"))).toBe(true);
  });

  it("aturan berjumlah 20–40, id unik, bertipe karakteristik ISO 25012", () => {
    expect(DQ_RULES.length).toBeGreaterThanOrEqual(20);
    expect(DQ_RULES.length).toBeLessThanOrEqual(40);
    expect(new Set(DQ_RULES.map((r) => r.id)).size).toBe(DQ_RULES.length);
    const chars = new Set(DQ_RULES.map((r) => r.characteristic));
    expect(chars.size).toBeGreaterThanOrEqual(13);
  });
});

describe("aturan akun & unit", () => {
  it("DQ-01/02: email tidak kanonik dan duplikat (case-insensitive)", async () => {
    h.data.user.push(user(6, { email: "Admin@UP.ac.id" }));
    h.data.user.push(user(7, { email: "bukan-email" }));
    const r = await run();
    expect(byId(r, "DQ-01").sampleIds).toEqual([6, 7]);
    expect(byId(r, "DQ-02")).toMatchObject({ violations: 2 });
    expect(byId(r, "DQ-02").sampleIds).toEqual([1, 6]);
  });

  it("DQ-03/04: peran tidak sinkron dengan unit/penempatan", async () => {
    h.data.user[4].unitId = 10; // pengunjung dengan unit
    h.data.user[2].isUnitHead = false; // auditee_head tanpa flag
    const r = await run();
    expect(byId(r, "DQ-03").sampleIds).toEqual([5]);
    expect(byId(r, "DQ-04").sampleIds).toEqual([3]);
  });

  it("DQ-05/06: dua kepala unit & dua Ketua LPM", async () => {
    h.data.unitMembership[1].role = "head";
    h.data.user[1].isLpmHead = true; // lpm_member + duplikat
    const r = await run();
    expect(byId(r, "DQ-05")).toMatchObject({
      violations: 2,
      sampleIds: [1, 2],
    });
    expect(byId(r, "DQ-06")).toMatchObject({ violations: 2 });
  });

  it("DQ-07/08/09: tanpa superadmin aktif, akun tanpa cara masuk, sandi polos", async () => {
    h.data.user[0].isActive = false;
    h.data.user[0].isLpmHead = false;
    h.data.user[4].password = "rahasia123";
    h.data.user[1].password = null;
    const r = await run();
    expect(byId(r, "DQ-07").status).toBe("fail");
    expect(byId(r, "DQ-08").sampleIds).toEqual([2]);
    expect(byId(r, "DQ-09").sampleIds).toEqual([5]);
  });

  it("DQ-10/11: persetujuan tidak berpasangan & versi lama", async () => {
    h.data.user[1].consentedAt = null; // versi tanpa waktu
    h.data.user[4].consentVersion = "2026-01-01";
    h.data.user[4].consentedAt = new Date("2026-02-01T00:00:00Z");
    h.data.user[3].consentVersion = "2099-01-01"; // melebihi versi berlaku
    const r = await run();
    expect(byId(r, "DQ-10").sampleIds).toEqual([2, 4]);
    expect(byId(r, "DQ-11").sampleIds).toEqual([2, 4, 5]);
  });

  it("DQ-12: nama unit ganda & butir terlalu pendek", async () => {
    h.data.unit[1].name = "program studi keperawatan";
    h.data.auditQuestion[0].questionText = "SOP?";
    const r = await run();
    expect(byId(r, "DQ-12").sampleIds).toEqual([
      "unit:10",
      "unit:11",
      "question:200",
    ]);
  });
});

describe("aturan siklus, instrumen, jawaban", () => {
  it("DQ-13/14/15: dua siklus aktif, tanggal terbalik, siklus aktif kedaluwarsa", async () => {
    h.data.auditCycle.push({
      ...h.data.auditCycle[0],
      id: 2,
      name: "Siklus 2025",
      startDate: date("2025-12-31"),
      endDate: date("2025-01-01"),
    });
    const r = await run();
    expect(byId(r, "DQ-13").violations).toBe(2);
    expect(byId(r, "DQ-14").sampleIds).toEqual([2]);
    expect(byId(r, "DQ-15").sampleIds).toEqual([2]);
  });

  it("DQ-15: tanggal selesai = hari ini (WIB) masih dianggap terbuka", async () => {
    h.data.auditCycle[0].endDate = date("2026-10-17");
    expect(byId(await run(), "DQ-15").status).toBe("pass");
  });

  it("DQ-16/17/18: butir lintas siklus, cakupan tidak valid, jawaban di luar cakupan", async () => {
    h.data.auditStandard.push({
      ...h.data.auditStandard[0],
      id: 101,
      cycleId: 2,
    });
    h.data.auditQuestion[0].standardId = 101;
    h.data.auditQuestion[1].scopeCategory = "Fakultas"; // tidak dipakai unit mana pun
    h.data.auditResponse.push(resp(502, 202, { answer: "tidak", reason: "x" }));
    const r = await run();
    expect(byId(r, "DQ-16").sampleIds).toEqual(["question:200"]);
    expect(byId(r, "DQ-17").sampleIds).toEqual([201]);
    expect(byId(r, "DQ-18").sampleIds).toContain(502);
  });

  it("DQ-19/20: Ya tanpa bukti, Tidak tanpa alasan, jawaban kosong", async () => {
    h.data.auditResponse[0].evidenceFile = null;
    h.data.auditResponse[1].reason = "   ";
    h.data.auditResponse.push(resp(503, 200, { unitId: 11 }));
    const r = await run();
    expect(byId(r, "DQ-19").sampleIds).toEqual([500, 503]);
    expect(byId(r, "DQ-20").sampleIds).toEqual([501]);
  });

  it("DQ-21/22: verifikasi tidak konsisten & verifikator bukan LPM", async () => {
    h.data.auditResponse[0].verifiedBy = 3; // auditee_head
    h.data.auditResponse[1].lpmNotes = null; // revision tanpa catatan
    h.data.auditResponse.push(
      resp(504, 200, {
        unitId: 11,
        answer: "tidak",
        reason: "x",
        verifiedBy: 1,
      })
    );
    const r = await run();
    expect(byId(r, "DQ-21").sampleIds).toEqual([501, 504]);
    expect(byId(r, "DQ-22").sampleIds).toEqual(["response:500"]);
  });

  it("DQ-23: progres usang setelah butir baru ditambahkan", async () => {
    h.data.auditQuestion.push(q(203, { scopeType: "all" }));
    expect(byId(await run(), "DQ-23").sampleIds).toEqual([1]);
  });

  it("DQ-23: unit sudah menjawab tetapi tidak punya baris progres", async () => {
    h.data.auditResponse.push(
      resp(505, 202, { unitId: 11, answer: "tidak", reason: "x" })
    );
    expect(byId(await run(), "DQ-23").sampleIds).toEqual(["1:11"]);
  });
});

describe("aturan dokumen & berkas", () => {
  it("DQ-24/25/26/27: dokumen kosong, tautan berbahaya, path salah, berkas hilang", async () => {
    h.data.document[1].link = null; // dokumen tanpa berkas & tautan
    h.data.auditResponse[0].evidenceLink = "javascript:alert(1)";
    h.data.auditResponse[0].evidenceFile = "/uploads/penetapan/a.pdf"; // folder salah
    h.data.document[0].filePath = "/uploads/penetapan/hilang.pdf";
    const r = await run();
    expect(byId(r, "DQ-24").sampleIds).toEqual([301]);
    expect(byId(r, "DQ-25").sampleIds).toEqual(["response:500"]);
    expect(byId(r, "DQ-26").sampleIds).toEqual(["response:500"]);
    expect(byId(r, "DQ-27").sampleIds).toEqual([
      "response:500",
      "document:300",
    ]);
    // a.pdf & b.pdf kini tidak dirujuk → berkas yatim
    expect(byId(r, "DQ-29").sampleIds).toEqual([
      "bukti/a.pdf",
      "penetapan/b.pdf",
    ]);
  });

  it("DQ-26: path traversal ditolak", async () => {
    h.data.document[0].filePath = "/uploads/penetapan/../../.env";
    expect(byId(await run(), "DQ-26").status).toBe("fail");
  });

  it("DQ-27: aset branding di Pengaturan ikut diperiksa", async () => {
    h.data.appSetting.push({
      id: 9,
      key: "site.logo",
      value: "/uploads/branding/logo.png",
      isSecret: false,
    });
    expect(byId(await run(), "DQ-27").sampleIds).toEqual(["setting:site.logo"]);
  });

  it("isSafeHttpUrl: hanya http/https tanpa kredensial", () => {
    expect(isSafeHttpUrl("https://up.ac.id/a")).toBe(true);
    expect(isSafeHttpUrl("ftp://up.ac.id")).toBe(false);
    expect(isSafeHttpUrl("https://u:p@up.ac.id")).toBe(false);
    expect(isSafeHttpUrl("bukan url")).toBe(false);
  });
});

describe("aturan lintas tabel, log, pengaturan", () => {
  it("DQ-30: penempatan yatim & unit utama tidak ada", async () => {
    h.data.unitMembership.push({
      ...h.data.unitMembership[1],
      id: 3,
      unitId: 99,
    });
    h.data.user[3].unitId = 98;
    const r = await run();
    expect(byId(r, "DQ-30").sampleIds).toEqual(["membership:3", "user:4"]);
  });

  it("DQ-31/32: timestamp di masa depan & teks mojibake", async () => {
    h.data.unit[0].updatedAt = new Date(NOW.getTime() + 60 * 60 * 1000);
    h.data.auditResponse[0].createdAt = new Date("2026-10-02T00:00:00Z");
    h.data.auditResponse[0].updatedAt = T0; // updated < created
    h.data.auditResponse[1].reason = "Belum adaâ€™ SOP";
    const r = await run();
    expect(byId(r, "DQ-31").sampleIds).toEqual([
      "units:10",
      "audit_responses:500",
    ]);
    expect(byId(r, "DQ-32").sampleIds).toEqual(["response:501"]);
  });

  it("DQ-33: log melewati masa simpan; 0 = tanpa batas", async () => {
    h.data.loginLog.push({ ...h.data.loginLog[0], id: 2, createdAt: ago(95) });
    h.data.activityLog.push({
      ...h.data.activityLog[0],
      id: 2,
      createdAt: ago(400),
    });
    let r = await run();
    expect(byId(r, "DQ-33").sampleIds).toEqual([
      "login_logs:2",
      "activity_logs:2",
    ]);

    h.data.appSetting[0].value = "0";
    h.data.appSetting.push({
      id: 8,
      key: "log.activityRetentionDays",
      value: "0",
      isSecret: false,
    });
    r = await run();
    expect(byId(r, "DQ-33")).toMatchObject({ status: "pass", total: 0 });
  });

  it("DQ-33: log tepat di batas toleransi (+1 hari) masih lolos", async () => {
    h.data.loginLog[0].createdAt = ago(90.5);
    expect(byId(await run(), "DQ-33").status).toBe("pass");
  });

  it("DQ-36: akun Pengunjung > 180 hari tanpa login dalam masa simpan log", async () => {
    h.data.user[4].createdAt = ago(200); // pengunjung lama, tanpa log login
    h.data.user[4].updatedAt = ago(200);
    h.data.user.push(user(6, { createdAt: ago(200), updatedAt: ago(200) }));
    h.data.loginLog.push({ ...h.data.loginLog[0], id: 3, userId: 6 });
    h.data.user.push(user(7, { createdAt: ago(30), updatedAt: ago(30) }));
    const r = byId(await run(), "DQ-36");
    expect(r).toMatchObject({ total: 2, violations: 1, sampleIds: [5] });
  });

  it("DQ-34/35: email utuh di log & log merujuk akun terhapus", async () => {
    h.data.loginLog.push({
      id: 2,
      email: "budi@up.ac.id",
      userId: 77,
      message: null,
      createdAt: ago(1),
    });
    h.data.activityLog.push({
      id: 2,
      userId: null,
      detail: "Telp 081234567890",
      createdAt: ago(1),
    });
    const r = await run();
    expect(byId(r, "DQ-34").sampleIds).toEqual([
      "login_logs:2",
      "activity_logs:2",
    ]);
    expect(byId(r, "DQ-35").sampleIds).toEqual(["login_logs:2"]);
  });

  it("DQ-37/38: secret tidak ditandai, nilai pengaturan tidak sah", async () => {
    h.data.appSetting[1].isSecret = false;
    h.data.appSetting[2].value = "on";
    h.data.appSetting.push(
      { id: 4, key: "security.sessionDays", value: "45", isSecret: false },
      { id: 5, key: "kunci.asing", value: "x", isSecret: false },
      { id: 6, key: "security.loginMaxAttempts", value: "3.5", isSecret: false }
    );
    const r = await run();
    expect(byId(r, "DQ-37").sampleIds).toEqual([2]);
    expect(byId(r, "DQ-38").sampleIds).toEqual([3, 4, 5, 6]);
  });
});

describe("runner & skor", () => {
  it("aturan yang melempar error → status error tanpa detail, runner tetap jalan", async () => {
    const boom = {
      id: "X-01",
      characteristic: "Akurasi" as const,
      severity: "high" as const,
      description: "uji",
      check: async () => {
        throw new TypeError("rahasia internal user@x.id");
      },
    };
    const ctx = createDqContext(undefined, NOW);
    const res = await runRule(boom, ctx);
    expect(res).toMatchObject({
      status: "error",
      error: "TypeError",
      passRate: 0,
    });
    expect(JSON.stringify(res)).not.toContain("rahasia");

    const report = await runDataQuality({ ctx, rules: [boom, DQ_RULES[0]] });
    expect(report.summary).toMatchObject({ rules: 2, passed: 1, errors: 1 });
    expect(report.score).toBe(50); // 3 / (3+3)
  });

  it("skor berbobot (high=3, medium=2, low=1) & passRate", async () => {
    const mk = (severity: DqRuleResult["severity"], pass: boolean) =>
      ({ severity, status: pass ? "pass" : "fail" }) as DqRuleResult;
    expect(scoreResults([mk("high", true), mk("low", false)])).toBe(75);
    expect(scoreResults([mk("medium", false), mk("low", true)])).toBe(33.3);
    expect(scoreResults([])).toBe(100);

    h.data.user.push(user(6, { email: "X@up.ac.id" }));
    const r = byId(await run(), "DQ-01");
    expect(r).toMatchObject({ total: 6, violations: 1, passRate: 83.3 });
  });

  it("sampleIds dibatasi 10", async () => {
    for (let i = 0; i < 15; i++)
      h.data.user.push(user(100 + i, { email: `X${i}@a.id` }));
    const r = byId(await run(), "DQ-01");
    expect(r.violations).toBe(15);
    expect(r.sampleIds).toHaveLength(10);
  });
});

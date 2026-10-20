import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/**
 * Uji server action standar & butir pertanyaan (cakupan standar, 20 Okt 2026):
 * RBAC, whitelist cakupan, validasi referensi kategori/unit, konsistensi
 * cakupan standar vs butir, cek duplikat nama per cakupan, dan penguncian
 * transaksi (pengganti unique index yang dihapus).
 */

type Std = {
  id: number;
  cycleId: number;
  name: string;
  order: number;
  scopeType: string;
  scopeCategory: string | null;
  scopeUnitId: number | null;
};
type Q = {
  id: number;
  cycleId: number;
  standardId: number;
  scopeType: string;
  scopeCategory: string | null;
  scopeUnitId: number | null;
};

const h = vi.hoisted(() => ({
  denied: false,
  maintenance: false,
  units: [] as { id: number; category: string }[],
  cycles: [] as number[],
  standards: [] as Std[],
  questions: [] as Q[],
  locks: [] as string[],
  logs: [] as { action: string; entityId: unknown; detail?: string }[],
}));

function matches(row: Record<string, unknown>, where: Record<string, unknown>) {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === "object" && "not" in v) {
      return row[k] !== (v as { not: unknown }).not;
    }
    return (row[k] ?? null) === (v ?? null);
  });
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/net", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/lib/upload", () => ({ cleanupUnreferencedUploads: vi.fn() }));
vi.mock("@/lib/logs", () => ({
  recordActivity: async (i: {
    action: string;
    entityId: unknown;
    detail?: string;
  }) => {
    h.logs.push({ action: i.action, entityId: i.entityId, detail: i.detail });
  },
}));
vi.mock("@/lib/guards", async () => {
  const { AppError } = await import("@/lib/errors");
  return {
    requireLpm: async () => {
      if (h.maintenance)
        throw new AppError("Sistem sedang dalam pemeliharaan.");
      if (h.denied) throw new AppError("Akses ditolak. Hanya pengguna LPM.");
      return { id: 7, name: "Admin LPM", role: "lpm_admin" };
    },
  };
});
vi.mock("@/lib/prisma", () => {
  const db = {
    $queryRaw: async (strings: TemplateStringsArray, id: number) => {
      const sql = strings.join("?");
      if (sql.includes("audit_cycles")) {
        h.locks.push(`cycle:${id}`);
        return h.cycles.includes(id) ? [{ id }] : [];
      }
      h.locks.push(`standard:${id}`);
      return h.standards.some((s) => s.id === id) ? [{ id }] : [];
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    unit: {
      findUnique: async ({ where }: { where: { id: number } }) =>
        h.units.find((u) => u.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { category: string } }) =>
        h.units.find((u) => u.category === where.category) ?? null,
    },
    auditStandard: {
      findUnique: async ({ where }: { where: { id: number } }) =>
        h.standards.find((s) => s.id === where.id) ?? null,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        h.standards
          .filter((s) => matches(s, where))
          .sort((a, b) => b.order - a.order)[0] ?? null,
      create: async ({ data }: { data: Omit<Std, "id"> }) => {
        const row = { id: 100 + h.standards.length, ...data };
        h.standards.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<Std>;
      }) => {
        const row = h.standards.find((s) => s.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    auditQuestion: {
      findUnique: async ({ where }: { where: { id: number } }) => {
        const q = h.questions.find((x) => x.id === where.id);
        if (!q) return null;
        const u = h.units.find((x) => x.id === q.scopeUnitId);
        return { ...q, scopeUnit: u ? { category: u.category } : null };
      },
      findMany: async ({ where }: { where: { standardId: number } }) =>
        h.questions
          .filter((q) => q.standardId === where.standardId)
          .map((q) => {
            const u = h.units.find((x) => x.id === q.scopeUnitId);
            return { ...q, scopeUnit: u ? { category: u.category } : null };
          }),
      create: async ({ data }: { data: Omit<Q, "id"> }) => {
        const row = { id: 500 + h.questions.length, ...data };
        h.questions.push(row);
        return row;
      },
      createMany: async ({ data }: { data: Omit<Q, "id">[] }) => {
        for (const d of data)
          h.questions.push({ id: 500 + h.questions.length, ...d });
        return { count: data.length };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<Q>;
      }) => {
        const row = h.questions.find((q) => q.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
  };
  return { prisma: db };
});

import {
  createQuestion,
  createQuestionsBulk,
  createStandard,
  updateQuestion,
  updateStandard,
} from "@/lib/actions/questions";

function fd(fields: Record<string, string | number>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, String(v));
  return f;
}

const std = (over: Partial<Std> & { id: number }): Std => ({
  cycleId: 1,
  name: `Standar ${over.id}`,
  order: 1,
  scopeType: "all",
  scopeCategory: null,
  scopeUnitId: null,
  ...over,
});

beforeEach(() => {
  h.denied = false;
  h.maintenance = false;
  h.units = [
    { id: 10, category: "Biro" },
    { id: 11, category: "Biro" },
    { id: 20, category: "Program Studi" },
    { id: 30, category: "Fakultas Khusus" },
  ];
  h.cycles = [1, 2];
  h.standards = [
    std({ id: 1 }),
    std({ id: 2, scopeType: "category", scopeCategory: "Biro" }),
    std({ id: 3, scopeType: "unit", scopeUnitId: 10 }),
    std({ id: 4, cycleId: 2 }),
  ];
  h.questions = [];
  h.locks = [];
  h.logs = [];
});

describe("RBAC & mode pemeliharaan", () => {
  it("menolak non-LPM tanpa menyentuh database", async () => {
    h.denied = true;
    const r = await createStandard(undefined, fd({ cycleId: 1, name: "X" }));
    expect(r?.error).toMatch(/Akses ditolak/);
    expect(h.locks).toHaveLength(0);
    const r2 = await updateStandard(undefined, fd({ id: 1, name: "X" }));
    expect(r2?.error).toMatch(/Akses ditolak/);
    expect(h.standards[0].name).toBe("Standar 1");
  });

  it("menolak saat mode pemeliharaan", async () => {
    h.maintenance = true;
    const r = await createQuestion(
      undefined,
      fd({ cycleId: 1, standardId: 1, questionText: "Q" })
    );
    expect(r?.error).toMatch(/pemeliharaan/);
    expect(h.questions).toHaveLength(0);
  });
});

describe("createStandard", () => {
  it("menyimpan cakupan, mengunci siklus, dan mencatat log", async () => {
    const r = await createStandard(
      undefined,
      fd({ cycleId: 1, name: "Baru", scopeType: "unit", scopeUnitId: 20 })
    );
    expect(r).toEqual({ ok: true });
    const created = h.standards.at(-1)!;
    expect(created).toMatchObject({
      name: "Baru",
      scopeType: "unit",
      scopeUnitId: 20,
      scopeCategory: null,
    });
    expect(h.locks).toContain("cycle:1");
    expect(h.logs).toEqual([
      {
        action: "standard.create",
        entityId: created.id,
        detail: "scope=unit:20",
      },
    ]);
  });

  it("menolak jenis cakupan di luar whitelist", async () => {
    const r = await createStandard(
      undefined,
      fd({ cycleId: 1, name: "X", scopeType: "global" })
    );
    expect(r?.error).toMatch(/Cakupan standar tidak valid/);
  });

  it("menolak kategori yang tidak dikenal, menerima & menormalkan yang dikenal", async () => {
    const bad = await createStandard(
      undefined,
      fd({
        cycleId: 1,
        name: "X",
        scopeType: "category",
        scopeCategory: "Hacker",
      })
    );
    expect(bad?.error).toMatch(/Kategori unit tidak dikenal/);

    const ok = await createStandard(
      undefined,
      fd({
        cycleId: 1,
        name: "X",
        scopeType: "category",
        scopeCategory: "biro",
      })
    );
    expect(ok).toEqual({ ok: true });
    expect(h.standards.at(-1)!.scopeCategory).toBe("Biro");

    // Kategori non-bawaan diterima bila ada unit dengan kategori tsb.
    const custom = await createStandard(
      undefined,
      fd({
        cycleId: 1,
        name: "Y",
        scopeType: "category",
        scopeCategory: "Fakultas Khusus",
      })
    );
    expect(custom).toEqual({ ok: true });
  });

  it("menolak unit cakupan yang tidak ada / tidak valid", async () => {
    const missing = await createStandard(
      undefined,
      fd({ cycleId: 1, name: "X", scopeType: "unit", scopeUnitId: 999 })
    );
    expect(missing?.error).toMatch(/Unit cakupan tidak ditemukan/);
    const junk = await createStandard(
      undefined,
      fd({ cycleId: 1, name: "X", scopeType: "unit", scopeUnitId: "1 OR 1=1" })
    );
    expect(junk?.error).toMatch(/Unit tidak valid/);
  });

  it("menolak siklus yang tidak ada", async () => {
    const r = await createStandard(undefined, fd({ cycleId: 99, name: "X" }));
    expect(r?.error).toMatch(/Siklus tidak ditemukan/);
  });

  it("duplikat nama hanya ditolak pada cakupan yang sama", async () => {
    const dup = await createStandard(
      undefined,
      fd({ cycleId: 1, name: "Standar 3", scopeType: "unit", scopeUnitId: 10 })
    );
    expect(dup?.error).toMatch(/sudah ada pada cakupan ini/);
    const other = await createStandard(
      undefined,
      fd({ cycleId: 1, name: "Standar 3", scopeType: "unit", scopeUnitId: 11 })
    );
    expect(other).toEqual({ ok: true });
  });
});

describe("updateStandard", () => {
  it("ubah nama tanpa field cakupan MEMPERTAHANKAN cakupan lama", async () => {
    const r = await updateStandard(
      undefined,
      fd({ id: 3, name: "Ganti Nama" })
    );
    expect(r).toEqual({ ok: true });
    expect(h.standards[2]).toMatchObject({
      name: "Ganti Nama",
      scopeType: "unit",
      scopeUnitId: 10,
    });
    expect(h.locks).toEqual(["cycle:1", "standard:3"]);
    expect(h.logs[0]).toMatchObject({ action: "standard.update", entityId: 3 });
  });

  it("menolak standar yang tidak ada", async () => {
    const r = await updateStandard(undefined, fd({ id: 999, name: "X" }));
    expect(r?.error).toMatch(/Standar tidak ditemukan/);
  });

  it("mengecek duplikat nama pada cakupan tujuan (tidak termasuk dirinya)", async () => {
    h.standards.push(
      std({ id: 5, name: "Kembar", scopeType: "unit", scopeUnitId: 11 })
    );
    const dup = await updateStandard(
      undefined,
      fd({ id: 3, name: "Kembar", scopeType: "unit", scopeUnitId: 11 })
    );
    expect(dup?.error).toMatch(/sudah ada pada cakupan ini/);
    // Simpan ulang nama sendiri tidak dianggap duplikat.
    const self = await updateStandard(
      undefined,
      fd({ id: 3, name: "Standar 3" })
    );
    expect(self).toEqual({ ok: true });
  });

  it("menolak perubahan cakupan bila ada butir di luar cakupan baru", async () => {
    h.questions.push({
      id: 1,
      cycleId: 1,
      standardId: 1,
      scopeType: "unit",
      scopeCategory: null,
      scopeUnitId: 20,
    });
    const r = await updateStandard(
      undefined,
      fd({
        id: 1,
        name: "Standar 1",
        scopeType: "category",
        scopeCategory: "Biro",
      })
    );
    expect(r?.error).toMatch(/1 butir pertanyaan/);
    expect(h.standards[0].scopeType).toBe("all");
  });

  it("mengizinkan penyempitan cakupan bila semua butir tetap tercakup", async () => {
    h.questions.push({
      id: 1,
      cycleId: 1,
      standardId: 1,
      scopeType: "unit",
      scopeCategory: null,
      scopeUnitId: 10,
    });
    const r = await updateStandard(
      undefined,
      fd({
        id: 1,
        name: "Standar 1",
        scopeType: "category",
        scopeCategory: "Biro",
      })
    );
    expect(r).toEqual({ ok: true });
    expect(h.standards[0]).toMatchObject({
      scopeType: "category",
      scopeCategory: "Biro",
    });
    expect(h.logs[0].detail).toBe("scope=category:Biro");
  });
});

describe("createQuestion / createQuestionsBulk: konsistensi cakupan", () => {
  const add = (standardId: number, scope: Record<string, string | number>) =>
    createQuestion(
      undefined,
      fd({ cycleId: 1, standardId, questionText: "Butir", ...scope })
    );

  it("standar dari siklus lain ditolak (IDOR)", async () => {
    const r = await add(4, {});
    expect(r?.error).toMatch(/tidak ditemukan pada siklus ini/);
  });

  it("standar unit A tidak menerima butir unit B / umum / kategori", async () => {
    expect(
      (await add(3, { scopeType: "unit", scopeUnitId: 11 }))?.error
    ).toMatch(/lebih sempit/);
    expect((await add(3, { scopeType: "all" }))?.error).toMatch(/lebih sempit/);
    expect(
      (await add(3, { scopeType: "category", scopeCategory: "Biro" }))?.error
    ).toMatch(/lebih sempit/);
    expect(await add(3, { scopeType: "unit", scopeUnitId: 10 })).toEqual({
      ok: true,
    });
  });

  it("standar kategori hanya menerima kategori sama atau unit berkategori sama", async () => {
    expect(
      (await add(2, { scopeType: "category", scopeCategory: "Program Studi" }))
        ?.error
    ).toMatch(/lebih sempit/);
    expect(
      (await add(2, { scopeType: "unit", scopeUnitId: 20 }))?.error
    ).toMatch(/lebih sempit/);
    expect(await add(2, { scopeType: "unit", scopeUnitId: 11 })).toEqual({
      ok: true,
    });
    expect(
      await add(2, { scopeType: "category", scopeCategory: "Biro" })
    ).toEqual({ ok: true });
  });

  it("standar umum menerima cakupan apa pun", async () => {
    expect(await add(1, { scopeType: "unit", scopeUnitId: 20 })).toEqual({
      ok: true,
    });
    expect(h.locks).toContain("standard:1");
  });

  it("bulk memakai aturan yang sama", async () => {
    const r = await createQuestionsBulk(
      undefined,
      fd({
        cycleId: 1,
        standardId: 3,
        texts: JSON.stringify(["a", "b"]),
        scopeType: "unit",
        scopeUnitId: 11,
      })
    );
    expect(r?.error).toMatch(/lebih sempit/);
    expect(h.questions).toHaveLength(0);
  });
});

describe("updateQuestion", () => {
  beforeEach(() => {
    h.questions.push({
      id: 1,
      cycleId: 1,
      standardId: 3,
      scopeType: "unit",
      scopeCategory: null,
      scopeUnitId: 10,
    });
  });

  it("tanpa field cakupan, cakupan lama dipertahankan", async () => {
    const r = await updateQuestion(
      undefined,
      fd({ id: 1, questionText: "Ubah" })
    );
    expect(r).toEqual({ ok: true });
    expect(h.questions[0]).toMatchObject({
      scopeType: "unit",
      scopeUnitId: 10,
    });
  });

  it("menolak pelebaran cakupan di luar standar induk", async () => {
    const r = await updateQuestion(
      undefined,
      fd({ id: 1, questionText: "Ubah", scopeType: "all" })
    );
    expect(r?.error).toMatch(/lebih sempit/);
    expect(h.questions[0].scopeType).toBe("unit");
  });

  it("menolak pindah ke standar siklus lain atau standar dengan cakupan tak cocok", async () => {
    const other = await updateQuestion(
      undefined,
      fd({
        id: 1,
        questionText: "x",
        standardId: 4,
        scopeType: "unit",
        scopeUnitId: 10,
      })
    );
    expect(other?.error).toMatch(/tidak ditemukan pada siklus ini/);

    h.standards.push(std({ id: 6, scopeType: "unit", scopeUnitId: 11 }));
    const mismatch = await updateQuestion(
      undefined,
      fd({
        id: 1,
        questionText: "x",
        standardId: 6,
        scopeType: "unit",
        scopeUnitId: 10,
      })
    );
    expect(mismatch?.error).toMatch(/lebih sempit/);
    expect(h.questions[0].standardId).toBe(3);
  });

  it("menolak pertanyaan yang tidak ada", async () => {
    const r = await updateQuestion(
      undefined,
      fd({ id: 999, questionText: "x" })
    );
    expect(r?.error).toMatch(/Pertanyaan tidak ditemukan/);
  });
});

it("AppError tetap kelas yang sama (sanity untuk mock guards)", () => {
  expect(new AppError("x")).toBeInstanceOf(Error);
});

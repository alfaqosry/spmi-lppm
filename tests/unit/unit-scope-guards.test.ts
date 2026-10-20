import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integritas cakupan saat unit diubah/dihapus (20 Okt 2026):
 * - updateUnit menolak perubahan kategori bila ada butir khusus unit di bawah
 *   standar berkategori lama (aturan "butir ⊆ standar", AB-28 / DQ-40).
 * - deleteUnit menolak bila masih ada standar/butir khusus unit tersebut
 *   (FK SET NULL akan membuat instrumen yatim / tersembunyi).
 */

const h = vi.hoisted(() => ({
  unit: { id: 7, category: "Program Studi" } as {
    id: number;
    category: string;
  } | null,
  conflictQuestions: 0,
  scopedStandards: 0,
  scopedQuestions: 0,
  unitUpdated: false,
  unitDeleted: false,
  lastQuestionCountWhere: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/net", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("@/lib/upload", () => ({ cleanupUnreferencedUploads: vi.fn() }));
vi.mock("@/lib/logs", () => ({ recordActivity: vi.fn() }));
vi.mock("@/lib/guards", () => ({
  requireLpmAdmin: async () => ({ id: 1, name: "Admin", role: "lpm_admin" }),
}));
vi.mock("@/lib/auth", () => ({
  hashPassword: async (p: string) => `hash:${p}`,
  isSuperadmin: (r: string) => r === "superadmin",
  revokeUserSessions: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    unit: {
      findUnique: async () => (h.unit ? { category: h.unit.category } : null),
      update: async () => {
        h.unitUpdated = true;
        return {};
      },
      delete: async () => {
        h.unitDeleted = true;
        return {};
      },
    },
    auditQuestion: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        h.lastQuestionCountWhere = where;
        return "standard" in where ? h.conflictQuestions : h.scopedQuestions;
      },
    },
    auditStandard: { count: async () => h.scopedStandards },
    unitMembership: { findMany: async () => [] },
    auditResponse: { findMany: async () => [] },
  },
}));

import { deleteUnit, updateUnit } from "@/lib/actions/units";

function unitForm(category: string) {
  const fd = new FormData();
  fd.set("id", "7");
  fd.set("name", "Prodi Teknik Informatika");
  fd.set("category", category);
  return fd;
}

beforeEach(() => {
  h.unit = { id: 7, category: "Program Studi" };
  h.conflictQuestions = 0;
  h.scopedStandards = 0;
  h.scopedQuestions = 0;
  h.unitUpdated = false;
  h.unitDeleted = false;
  h.lastQuestionCountWhere = null;
});

describe("updateUnit — perubahan kategori", () => {
  it("kategori tetap: tidak memeriksa konflik dan tersimpan", async () => {
    const res = await updateUnit(undefined, unitForm("Program Studi"));
    expect(res).toEqual({ ok: true });
    expect(h.lastQuestionCountWhere).toBeNull();
    expect(h.unitUpdated).toBe(true);
  });

  it("kategori berubah tanpa konflik: tersimpan", async () => {
    const res = await updateUnit(undefined, unitForm("Pusat"));
    expect(res).toEqual({ ok: true });
    expect(h.lastQuestionCountWhere).toMatchObject({
      scopeType: "unit",
      scopeUnitId: 7,
      standard: { scopeType: "category", scopeCategory: "Program Studi" },
    });
    expect(h.unitUpdated).toBe(true);
  });

  it("kategori berubah dengan butir di bawah standar kategori lama: ditolak", async () => {
    h.conflictQuestions = 3;
    const res = await updateUnit(undefined, unitForm("Pusat"));
    expect(res?.error).toMatch(/Kategori unit tidak dapat diubah: 3 butir/);
    expect(h.unitUpdated).toBe(false);
  });

  it("unit tidak ditemukan: ditolak tanpa update", async () => {
    h.unit = null;
    const res = await updateUnit(undefined, unitForm("Pusat"));
    expect(res?.error).toMatch(/Unit tidak ditemukan/);
    expect(h.unitUpdated).toBe(false);
  });
});

describe("deleteUnit — instrumen khusus unit", () => {
  it("tanpa standar/butir khusus: terhapus", async () => {
    const res = await deleteUnit(7);
    expect(res?.error).toBeUndefined();
    expect(h.unitDeleted).toBe(true);
  });

  it("masih ada standar/butir khusus unit: ditolak dengan pesan asli", async () => {
    h.scopedStandards = 1;
    h.scopedQuestions = 4;
    const res = await deleteUnit(7);
    expect(res?.error).toMatch(/1 standar dan 4 butir khusus unit ini/);
    expect(h.unitDeleted).toBe(false);
  });
});

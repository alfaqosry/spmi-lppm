import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  unit: { findUnique: vi.fn() },
  auditQuestion: { findMany: vi.fn() },
  auditResponse: { count: vi.fn() },
  unitProgress: { upsert: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { recalcUnitProgress } from "@/lib/progress";

const questions = [
  { id: 1, scopeType: "all", scopeCategory: null, scopeUnitId: null },
  { id: 2, scopeType: "category", scopeCategory: "Biro", scopeUnitId: null },
  { id: 3, scopeType: "unit", scopeCategory: null, scopeUnitId: 99 },
];

beforeEach(() => {
  vi.clearAllMocks();
  db.unit.findUnique.mockResolvedValue({ id: 5, category: "Program Studi" });
  db.auditQuestion.findMany.mockResolvedValue(questions);
});

describe("recalcUnitProgress", () => {
  it("hanya menghitung pertanyaan yang relevan untuk unit", async () => {
    db.auditResponse.count.mockResolvedValue(0);
    const r = await recalcUnitProgress(1, 5);
    expect(r).toEqual({
      totalQuestions: 1,
      answered: 0,
      status: "belum_mulai",
    });
    expect(db.auditResponse.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        cycleId: 1,
        unitId: 5,
        auditQuestionId: { in: [1] },
      }),
    });
  });

  it("status 'mengisi' bila sebagian dijawab", async () => {
    db.unit.findUnique.mockResolvedValue({ id: 5, category: "Biro" });
    db.auditResponse.count.mockResolvedValue(1);
    const r = await recalcUnitProgress(1, 5, 42);
    expect(r.status).toBe("mengisi");
    expect(db.unitProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cycleId_unitId: { cycleId: 1, unitId: 5 } },
        update: { status: "mengisi", lastUpdatedBy: 42 },
      })
    );
  });

  it("status 'selesai' bila semua pertanyaan relevan dijawab", async () => {
    db.auditResponse.count.mockResolvedValue(1);
    const r = await recalcUnitProgress(1, 5);
    expect(r.status).toBe("selesai");
  });

  it("tanpa pertanyaan relevan tetap 'belum_mulai'", async () => {
    db.auditQuestion.findMany.mockResolvedValue([]);
    db.auditResponse.count.mockResolvedValue(0);
    const r = await recalcUnitProgress(1, 5);
    expect(r).toEqual({
      totalQuestions: 0,
      answered: 0,
      status: "belum_mulai",
    });
  });

  it("unit tidak ditemukan -> semua pertanyaan dihitung", async () => {
    db.unit.findUnique.mockResolvedValue(null);
    db.auditResponse.count.mockResolvedValue(2);
    const r = await recalcUnitProgress(1, 5);
    expect(r.totalQuestions).toBe(3);
    expect(r.status).toBe("mengisi");
  });
});

import { describe, expect, it } from "vitest";
import {
  cycleDeadline,
  formatCycleDeadline,
  isResponseDirty,
  standardDeleteImpact,
} from "@/components/audit/audit-helpers";

// Kolom DATE dibaca Prisma sebagai 00:00 UTC pada tanggal tersebut.
const END = new Date(Date.UTC(2026, 9, 31)); // Sabtu, 31 Okt 2026
const wib = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(Date.UTC(y, m, d, h - 7, min));

describe("formatCycleDeadline (HE-01)", () => {
  it("memformat akhir hari dalam WIB", () => {
    expect(formatCycleDeadline(END)).toBe("Sabtu, 31 Oktober 2026 23.59 WIB");
  });
});

describe("cycleDeadline (HE-01)", () => {
  it("terbuka & netral bila > 7 hari", () => {
    const d = cycleDeadline({ isActive: true, endDate: END }, wib(2026, 9, 17));
    expect(d.state).toBe("open");
    expect(d.daysLeft).toBe(14);
    expect(d.remainingText).toBe("sisa 14 hari");
  });

  it("peringatan bila ≤ 7 hari", () => {
    const d = cycleDeadline({ isActive: true, endDate: END }, wib(2026, 9, 24));
    expect(d.state).toBe("soon");
    expect(d.daysLeft).toBe(7);
  });

  it("hari terakhir sampai 23.59 WIB", () => {
    const d = cycleDeadline(
      { isActive: true, endDate: END },
      wib(2026, 9, 31, 23, 59)
    );
    expect(d.state).toBe("soon");
    expect(d.daysLeft).toBe(0);
    expect(d.remainingText).toBe("hari terakhir");
  });

  it("ditutup setelah lewat batas", () => {
    const d = cycleDeadline({ isActive: true, endDate: END }, wib(2026, 10, 1));
    expect(d.state).toBe("closed");
    expect(d.daysLeft).toBeNull();
    expect(d.closedReason).toMatch(/Batas waktu/);
  });

  it("ditutup bila siklus nonaktif", () => {
    const d = cycleDeadline(
      { isActive: false, endDate: END },
      wib(2026, 9, 17)
    );
    expect(d.state).toBe("closed");
    expect(d.closedReason).toMatch(/dinonaktifkan/);
  });
});

describe("isResponseDirty (HE-08)", () => {
  const saved = {
    answer: "ya" as const,
    evidenceLink: "https://a.b",
    reason: null,
  };
  const cur = {
    answer: "ya",
    evidenceLink: "https://a.b",
    reason: null,
    hasFile: false,
  };

  it("tidak kotor bila sama dengan tersimpan", () => {
    expect(isResponseDirty(saved, cur)).toBe(false);
  });
  it("kotor bila jawaban berubah", () => {
    expect(isResponseDirty(saved, { ...cur, answer: "tidak" })).toBe(true);
  });
  it("kotor bila memilih berkas", () => {
    expect(isResponseDirty(saved, { ...cur, hasFile: true })).toBe(true);
  });
  it("kotor bila tautan berubah, abaikan spasi tepi", () => {
    expect(isResponseDirty(saved, { ...cur, evidenceLink: "https://x" })).toBe(
      true
    );
    expect(
      isResponseDirty(saved, { ...cur, evidenceLink: " https://a.b " })
    ).toBe(false);
  });
  it("butir belum dijawab: kotor hanya bila diisi", () => {
    const empty = {
      answer: null,
      evidenceLink: null,
      reason: null,
      hasFile: false,
    };
    expect(isResponseDirty(undefined, empty)).toBe(false);
    expect(isResponseDirty(undefined, { ...empty, answer: "tidak" })).toBe(
      true
    );
  });
  it("alasan yang berubah", () => {
    const s = { answer: "tidak" as const, evidenceLink: null, reason: "a" };
    expect(
      isResponseDirty(s, {
        answer: "tidak",
        evidenceLink: null,
        reason: "b",
        hasFile: false,
      })
    ).toBe(true);
  });
});

describe("standardDeleteImpact (HE-03)", () => {
  const questions = [
    {
      id: 1,
      standardId: 10,
      scopeType: "all",
      scopeCategory: null,
      scopeUnitId: null,
    },
    {
      id: 2,
      standardId: 10,
      scopeType: "category",
      scopeCategory: "Biro",
      scopeUnitId: null,
    },
    {
      id: 3,
      standardId: 10,
      scopeType: "unit",
      scopeCategory: null,
      scopeUnitId: 7,
    },
    {
      id: 4,
      standardId: 10,
      scopeType: "category",
      scopeCategory: "Biro",
      scopeUnitId: null,
    },
    {
      id: 5,
      standardId: 11,
      scopeType: "all",
      scopeCategory: null,
      scopeUnitId: null,
    },
  ];
  const responses = [
    { auditQuestionId: 1, unitId: 7, evidenceFile: "/u/a.pdf" },
    { auditQuestionId: 1, unitId: 8, evidenceFile: null },
    { auditQuestionId: 2, unitId: 8, evidenceFile: "/u/b.pdf" },
    { auditQuestionId: 5, unitId: 9, evidenceFile: "/u/c.pdf" },
  ];

  it("menghitung butir, cakupan, jawaban, unit & bukti lintas kategori", () => {
    const impact = standardDeleteImpact(
      10,
      questions,
      responses,
      new Map([[7, "Prodi A"]])
    );
    expect(impact).toEqual({
      questionCount: 4,
      scopes: ["Umum", "Kategori Biro", "Unit Prodi A"],
      responseCount: 3,
      unitCount: 2,
      evidenceCount: 2,
    });
  });

  it("standar kosong", () => {
    expect(standardDeleteImpact(99, questions, responses).questionCount).toBe(
      0
    );
  });
});

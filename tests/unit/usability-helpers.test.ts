import { describe, expect, it } from "vitest";
import {
  exportErrorMessage,
  exportUrl,
  filenameFromDisposition,
  retryAfterSeconds,
} from "@/components/reports/export-pdf";
import {
  describeDeadline,
  formatDeadline,
} from "@/components/dashboard/deadline";
import {
  cycleDeleteImpact,
  matchesConfirmation,
} from "@/components/cycles/cycle-impact";
import { unitDeleteImpact } from "@/components/units/unit-impact";

/** Kolom DATE dibaca Prisma sebagai 00:00 UTC pada tanggal tersebut. */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Waktu WIB → Date. */
const wib = (iso: string) => new Date(`${iso}+07:00`);

describe("filenameFromDisposition (HE-06)", () => {
  it("membaca filename dalam tanda kutip", () => {
    expect(
      filenameFromDisposition(
        'attachment; filename="Laporan_Unit_Biro_Siklus_2026.pdf"'
      )
    ).toBe("Laporan_Unit_Biro_Siklus_2026.pdf");
  });
  it("memprioritaskan filename* (RFC 5987)", () => {
    expect(
      filenameFromDisposition(
        "attachment; filename=\"a.pdf\"; filename*=UTF-8''Laporan%20Audit.pdf"
      )
    ).toBe("Laporan Audit.pdf");
  });
  it("membuang komponen path dan memakai fallback bila kosong", () => {
    expect(filenameFromDisposition('attachment; filename="../../x.pdf"')).toBe(
      "x.pdf"
    );
    expect(filenameFromDisposition(null, "f.pdf")).toBe("f.pdf");
    expect(filenameFromDisposition("attachment", "f.pdf")).toBe("f.pdf");
  });
});

describe("retryAfterSeconds & exportErrorMessage (HE-06)", () => {
  it("membaca detik dan tanggal HTTP", () => {
    expect(retryAfterSeconds("42")).toBe(42);
    const now = Date.parse("2026-10-17T00:00:00Z");
    expect(retryAfterSeconds("Sat, 17 Oct 2026 00:00:30 GMT", now)).toBe(30);
    expect(retryAfterSeconds("abc")).toBeNull();
    expect(retryAfterSeconds(null)).toBeNull();
  });
  it("memberi pesan sesuai status", () => {
    expect(exportErrorMessage(401)).toMatch(/login ulang/i);
    expect(exportErrorMessage(403)).toMatch(/tidak berhak/);
    expect(exportErrorMessage(429, 37)).toContain("37 detik");
    expect(exportErrorMessage(429)).toMatch(/Terlalu sering/);
    expect(exportErrorMessage(503)).toMatch(/pemeliharaan/);
    expect(exportErrorMessage(500)).toMatch(/gagal disiapkan/);
  });
  it("membentuk URL ekspor", () => {
    expect(exportUrl(3)).toBe("/api/export?cycleId=3");
    expect(exportUrl(3, 9)).toBe("/api/export?cycleId=3&unitId=9");
  });
});

describe("describeDeadline (HE-01)", () => {
  const cycle = { isActive: true, endDate: day("2026-10-30") };

  it("memformat batas pengisian dalam WIB", () => {
    expect(formatDeadline(cycle.endDate)).toBe(
      "Jumat, 30 Oktober 2026 23.59 WIB"
    );
  });
  it("masih lama → open", () => {
    const d = describeDeadline(cycle, wib("2026-10-17T10:00:00"));
    expect(d.state).toBe("open");
    expect(d.daysLeft).toBe(13);
    expect(d.remainingLabel).toBe("sisa 13 hari");
  });
  it("≤ 7 hari → warning", () => {
    expect(describeDeadline(cycle, wib("2026-10-23T08:00:00")).state).toBe(
      "warning"
    );
    const last = describeDeadline(cycle, wib("2026-10-30T23:58:00"));
    expect(last.state).toBe("warning");
    expect(last.remainingLabel).toBe("hari terakhir");
  });
  it("lewat batas atau nonaktif → closed", () => {
    const after = describeDeadline(cycle, wib("2026-10-31T00:00:00"));
    expect(after.state).toBe("closed");
    expect(after.closedReason).toBe("expired");
    const off = describeDeadline(
      { ...cycle, isActive: false },
      wib("2026-10-17T00:00:00")
    );
    expect(off.closedReason).toBe("inactive");
  });
});

describe("ringkasan dampak hapus (HE-04, HE-05)", () => {
  it("siklus", () => {
    const lines = cycleDeleteImpact({
      units: 14,
      responses: 1234,
      evidence: 5,
      standards: 3,
      questions: 40,
      documents: 2,
    });
    expect(lines[0]).toBe(
      "1.234 jawaban audit dari 14 unit (termasuk 5 berkas bukti)"
    );
    expect(lines[1]).toBe("3 standar dan 40 butir pertanyaan");
  });
  it("unit", () => {
    const lines = unitDeleteImpact({
      memberships: 2,
      responses: 30,
      evidence: 0,
      progress: 1,
      scopedQuestions: 0,
    });
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("30 jawaban audit di semua siklus");
  });
  it("konfirmasi ketik nama", () => {
    expect(matchesConfirmation("  Siklus  2026 ", "Siklus 2026")).toBe(true);
    expect(matchesConfirmation("siklus 2026", "Siklus 2026")).toBe(false);
    expect(matchesConfirmation("", "")).toBe(false);
  });
});

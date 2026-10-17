import { describe, expect, it } from "vitest";
import { cycleClosedReason, endOfCycleDay, isCycleOpen } from "@/lib/cycles";

/**
 * Kolom DATE MySQL dibaca Prisma sebagai 00:00 UTC pada tanggal tersebut.
 * Batas pengisian = akhir hari endDate dalam WIB (UTC+7), inklusif.
 */
const end = new Date("2025-06-30T00:00:00.000Z"); // endDate = 30 Juni 2025

describe("endOfCycleDay (WIB)", () => {
  it("mengembalikan 00:00 WIB hari berikutnya (batas eksklusif)", () => {
    // 1 Juli 2025 00:00 WIB = 30 Juni 2025 17:00 UTC
    expect(endOfCycleDay(end).toISOString()).toBe("2025-06-30T17:00:00.000Z");
  });

  it("jam pada endDate diabaikan (masih hari yang sama di WIB)", () => {
    expect(
      endOfCycleDay(new Date("2025-06-30T15:45:00.000Z")).toISOString()
    ).toBe("2025-06-30T17:00:00.000Z");
  });

  it("instan yang sudah lewat tengah malam WIB jatuh ke hari berikutnya", () => {
    // 30 Juni 18:00 UTC = 1 Juli 01:00 WIB -> batas 2 Juli 00:00 WIB
    expect(
      endOfCycleDay(new Date("2025-06-30T18:00:00.000Z")).toISOString()
    ).toBe("2025-07-01T17:00:00.000Z");
  });

  it("melewati batas bulan & tahun", () => {
    expect(
      endOfCycleDay(new Date("2025-12-31T00:00:00.000Z")).toISOString()
    ).toBe("2025-12-31T17:00:00.000Z");
    expect(
      endOfCycleDay(new Date("2024-02-28T00:00:00.000Z")).toISOString()
    ).toBe("2024-02-28T17:00:00.000Z");
  });

  it("tidak memutasi tanggal masukan", () => {
    const input = new Date("2025-01-31T09:00:00.000Z");
    endOfCycleDay(input);
    expect(input.toISOString()).toBe("2025-01-31T09:00:00.000Z");
  });
});

describe("isCycleOpen", () => {
  it("false bila siklus tidak ada atau nonaktif", () => {
    expect(isCycleOpen(null)).toBe(false);
    expect(isCycleOpen(undefined)).toBe(false);
    expect(
      isCycleOpen(
        { isActive: false, endDate: end },
        new Date("2025-01-01T00:00:00Z")
      )
    ).toBe(false);
  });

  it("terbuka sampai 23:59:59 WIB pada endDate, tertutup tepat 00:00 WIB", () => {
    const c = { isActive: true, endDate: end };
    // 30 Juni 23:59:59 WIB
    expect(isCycleOpen(c, new Date("2025-06-30T16:59:59.999Z"))).toBe(true);
    // 1 Juli 00:00:00 WIB
    expect(isCycleOpen(c, new Date("2025-06-30T17:00:00.000Z"))).toBe(false);
  });
});

describe("cycleClosedReason", () => {
  it("memberi alasan yang sesuai", () => {
    expect(cycleClosedReason(null)).toMatch(/tidak ditemukan/);
    expect(cycleClosedReason({ isActive: false, endDate: end })).toMatch(
      /dinonaktifkan/
    );
    expect(
      cycleClosedReason(
        { isActive: true, endDate: end },
        new Date("2025-07-02T00:00:00Z")
      )
    ).toMatch(/Batas waktu/);
  });

  it("null bila siklus masih terbuka", () => {
    expect(
      cycleClosedReason(
        { isActive: true, endDate: end },
        new Date("2025-06-01T00:00:00Z")
      )
    ).toBeNull();
  });
});

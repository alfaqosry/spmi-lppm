import { describe, expect, it } from "vitest";
import {
  APP_TIME_ZONE,
  formatDate,
  formatDateTime,
  initials,
  percent,
  ROLE_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  toIsoDate,
  toIsoJakarta,
} from "@/lib/format";

describe("formatDate", () => {
  it("mengembalikan '-' untuk nilai kosong", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("")).toBe("-");
  });

  it("mengembalikan '-' untuk tanggal tidak valid", () => {
    expect(formatDate("bukan-tanggal")).toBe("-");
    expect(formatDate(new Date(Number.NaN))).toBe("-");
  });

  it("memformat Date & string ISO dengan locale id-ID", () => {
    const d = new Date("2025-01-05T03:30:00.000Z"); // 10:30 WIB
    const out = formatDate(d);
    expect(out).toMatch(/05/);
    expect(out).toMatch(/Jan/);
    expect(out).toMatch(/2025/);
    expect(formatDate(d.toISOString())).toBe(out);
  });

  it("selalu memakai tanggal WIB, bukan zona waktu server", () => {
    // 31 Des 2025 18:00 UTC = 1 Jan 2026 01:00 WIB
    const out = formatDate(new Date("2025-12-31T18:00:00.000Z"));
    expect(out).toMatch(/01/);
    expect(out).toMatch(/2026/);
    expect(APP_TIME_ZONE).toBe("Asia/Jakarta");
  });
});

describe("formatDateTime", () => {
  it("mengembalikan '-' untuk nilai kosong/tidak valid", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime("xx")).toBe("-");
  });

  it("menyertakan jam dan menit dalam WIB", () => {
    const out = formatDateTime(new Date("2025-12-31T07:07:00.000Z")); // 14:07 WIB
    expect(out).toMatch(/2025/);
    expect(out).toMatch(/14[.:]07/);
  });
});

describe("toIsoJakarta / toIsoDate", () => {
  it("menghasilkan ISO 8601 dengan offset +07:00", () => {
    expect(toIsoJakarta(new Date("2026-10-17T07:05:09.123Z"))).toBe(
      "2026-10-17T14:05:09.123+07:00"
    );
    expect(toIsoJakarta("2025-12-31T18:00:00Z")).toBe(
      "2026-01-01T01:00:00.000+07:00"
    );
  });

  it("instan yang sama dengan offset berbeda menghasilkan nilai yang sama", () => {
    const a = new Date(toIsoJakarta(new Date("2025-03-01T00:00:00Z"))!);
    expect(a.toISOString()).toBe("2025-03-01T00:00:00.000Z");
  });

  it("null untuk nilai kosong / tidak valid", () => {
    expect(toIsoJakarta(null)).toBeNull();
    expect(toIsoJakarta(undefined)).toBeNull();
    expect(toIsoJakarta("bukan-tanggal")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });

  it("toIsoDate mengambil tanggal WIB (YYYY-MM-DD)", () => {
    expect(toIsoDate(new Date("2025-06-30T00:00:00Z"))).toBe("2025-06-30");
    expect(toIsoDate(new Date("2025-06-30T18:00:00Z"))).toBe("2025-07-01");
  });
});

describe("percent", () => {
  it("mengembalikan 0 bila total 0 (hindari pembagian nol)", () => {
    expect(percent(5, 0)).toBe(0);
  });

  it("membulatkan ke bilangan bulat terdekat", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(10, 10)).toBe(100);
    expect(percent(0, 10)).toBe(0);
  });
});

describe("initials", () => {
  it("mengambil maksimal dua huruf awal kapital", () => {
    expect(initials("budi santoso")).toBe("BS");
    expect(initials("Ani Dwi Lestari")).toBe("AD");
    expect(initials("Rina")).toBe("R");
  });

  it("mengabaikan spasi berlebih & string kosong", () => {
    expect(initials("  siti   nur  ")).toBe("SN");
    expect(initials("")).toBe("");
  });
});

describe("label & style maps", () => {
  it("setiap status punya label dan style", () => {
    for (const key of Object.keys(STATUS_LABEL)) {
      expect(STATUS_STYLE[key], `style untuk ${key}`).toBeTruthy();
    }
  });

  it("memuat seluruh peran yang dikenal", () => {
    expect(Object.keys(ROLE_LABEL).sort()).toEqual(
      [
        "auditee_head",
        "auditee_member",
        "auditor",
        "lpm_admin",
        "lpm_member",
        "pengunjung",
        "superadmin",
      ].sort()
    );
  });
});

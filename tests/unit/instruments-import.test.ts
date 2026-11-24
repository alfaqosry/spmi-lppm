import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { generateInstrumentExcelBuffer } from "@/lib/excel-template";
import { importInstrumentsExcel } from "@/lib/actions/instruments-import";

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
  questionText: string;
  order: number;
  scopeType: string;
  scopeCategory: string | null;
  scopeUnitId: number | null;
};

const h = vi.hoisted(() => ({
  denied: false,
  maintenance: false,
  units: [
    { id: 1, name: "S1 Teknik Informatika", category: "Program Studi" },
    { id: 2, name: "Biro Administrasi Umum", category: "Biro" },
    { id: 3, name: "Perpustakaan", category: "Perpustakaan" },
  ],
  cycles: [10],
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
      return [];
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
    unit: {
      findMany: async () => h.units,
    },
    auditStandard: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        h.standards
          .filter((s) =>
            matches(s as unknown as Record<string, unknown>, where)
          )
          .sort((a, b) => b.order - a.order)[0] ?? null,
      create: async ({ data }: { data: Omit<Std, "id"> }) => {
        const row = { id: 100 + h.standards.length, ...data };
        h.standards.push(row);
        return row;
      },
    },
    auditQuestion: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        h.questions.filter((q) =>
          matches(q as unknown as Record<string, unknown>, where)
        ),
      create: async ({ data }: { data: Omit<Q, "id"> }) => {
        const row = { id: 1000 + h.questions.length, ...data };
        h.questions.push(row);
        return row;
      },
    },
  };
  return { prisma: db };
});

describe("generateInstrumentExcelBuffer", () => {
  it("menghasilkan workbook Excel dengan dua sheet dan header lengkap", () => {
    const buffer = generateInstrumentExcelBuffer(h.units);
    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(100);

    const wb = XLSX.read(buffer, { type: "buffer" });
    expect(wb.SheetNames).toContain("Template Instrumen");
    expect(wb.SheetNames).toContain("Panduan & Referensi");

    const sheet = wb.Sheets["Template Instrumen"];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    expect(rows.length).toBeGreaterThan(3);
    const headers = rows[0];
    expect(headers).toContain("Cakupan");
    expect(headers).toContain("Target Cakupan");
    expect(headers).toContain("Nama Standar");
    expect(headers).toContain("Pertanyaan / Butir Instrumen");

    const guideSheet = wb.Sheets["Panduan & Referensi"];
    const guideRows = XLSX.utils.sheet_to_json(guideSheet, {
      header: 1,
    }) as string[][];
    const flatGuide = guideRows.flat().map(String).join(" ");
    expect(flatGuide).toContain("PANDUAN PENGISIAN FORMAT IMPORT");
    expect(flatGuide).toContain("S1 Teknik Informatika");
    expect(flatGuide).toContain("Biro Administrasi Umum");
  });
});

describe("importInstrumentsExcel", () => {
  beforeEach(() => {
    h.denied = false;
    h.maintenance = false;
    h.standards = [];
    h.questions = [];
    h.locks = [];
    h.logs = [];
  });

  function createExcelFormData(rows: (string | number)[][], cycleId = 10) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Template Instrumen");
    const buffer = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const fd = new FormData();
    fd.set("cycleId", String(cycleId));
    const file = new File([new Uint8Array(buffer)], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    fd.set("file", file);
    return fd;
  }

  it("menolak pengguna non-LPM", async () => {
    h.denied = true;
    const fd = createExcelFormData([["Standar", "Pertanyaan"]]);
    const res = await importInstrumentsExcel(undefined, fd);
    expect(res?.error).toMatch(/Akses ditolak/i);
  });

  it("menolak berkas tanpa kolom wajib Nama Standar dan Pertanyaan", async () => {
    const fd = createExcelFormData([
      ["Kolom A", "Kolom B"],
      ["Nilai 1", "Nilai 2"],
    ]);
    const res = await importInstrumentsExcel(undefined, fd);
    expect(res?.error).toMatch(/Kolom wajib "Nama Standar" dan "Pertanyaan/i);
  });

  it("berhasil import standar dan pertanyaan massal lintas cakupan (Semua Unit, Kategori, Unit Tertentu)", async () => {
    const rows = [
      [
        "Cakupan",
        "Target Cakupan",
        "Nama Standar",
        "Urutan Standar",
        "Pertanyaan / Butir Instrumen",
        "Urutan Pertanyaan",
      ],
      // Row 1: Semua Unit
      [
        "Semua Unit",
        "",
        "Standar Tata Pamong",
        1,
        "Apakah terdapat struktur organisasi yang jelas?",
        1,
      ],
      // Row 2: Semua Unit (Standar sama, butir ke-2)
      [
        "Semua Unit",
        "",
        "Standar Tata Pamong",
        1,
        "Apakah ada uraian tugas tertulis bagi staf?",
        2,
      ],
      // Row 3: Kategori (Program Studi)
      [
        "Kategori",
        "Program Studi",
        "Standar Kurikulum",
        2,
        "Apakah kurikulum dievaluasi berkala?",
        1,
      ],
      // Row 4: Unit Tertentu (Perpustakaan)
      [
        "Unit Tertentu",
        "Perpustakaan",
        "Standar Koleksi",
        1,
        "Apakah koleksi buku memenuhi rasio mahasiswa?",
        1,
      ],
    ];

    const fd = createExcelFormData(rows);
    const res = await importInstrumentsExcel(undefined, fd);

    expect(res?.ok).toBe(true);
    expect(res?.summary?.standardsCreated).toBe(3);
    expect(res?.summary?.questionsCreated).toBe(4);
    expect(res?.summary?.questionsSkipped).toBe(0);

    // Verifikasi data di mock database
    expect(h.standards.length).toBe(3);
    expect(h.questions.length).toBe(4);

    const stdUmum = h.standards.find((s) => s.name === "Standar Tata Pamong");
    expect(stdUmum?.scopeType).toBe("all");

    const stdProdi = h.standards.find((s) => s.name === "Standar Kurikulum");
    expect(stdProdi?.scopeType).toBe("category");
    expect(stdProdi?.scopeCategory).toBe("Program Studi");

    const stdPerpus = h.standards.find((s) => s.name === "Standar Koleksi");
    expect(stdPerpus?.scopeType).toBe("unit");
    expect(stdPerpus?.scopeUnitId).toBe(3);

    // Kunci transaksi siklus terpanggil
    expect(h.locks).toContain("cycle:10");
  });

  it("menggunakan kembali standar yang sudah ada dan melewati pertanyaan duplikat", async () => {
    // Siapkan standar yang sudah ada sebelumnya
    h.standards.push({
      id: 50,
      cycleId: 10,
      name: "Standar Tata Pamong",
      order: 1,
      scopeType: "all",
      scopeCategory: null,
      scopeUnitId: null,
    });
    // Dan pertanyaan yang sudah ada
    h.questions.push({
      id: 500,
      cycleId: 10,
      standardId: 50,
      questionText: "Apakah terdapat struktur organisasi yang jelas?",
      order: 1,
      scopeType: "all",
      scopeCategory: null,
      scopeUnitId: null,
    });

    const rows = [
      [
        "Cakupan",
        "Target Cakupan",
        "Nama Standar",
        "Pertanyaan / Butir Instrumen",
      ],
      // Butir 1 (duplikat pertanyaan lama pada standar yang sudah ada)
      [
        "Semua Unit",
        "",
        "Standar Tata Pamong",
        "Apakah terdapat struktur organisasi yang jelas?",
      ],
      // Butir 2 (pertanyaan baru pada standar yang sudah ada)
      [
        "Semua Unit",
        "",
        "Standar Tata Pamong",
        "Pertanyaan baru untuk standar tata pamong",
      ],
    ];

    const fd = createExcelFormData(rows);
    const res = await importInstrumentsExcel(undefined, fd);

    expect(res?.ok).toBe(true);
    expect(res?.summary?.standardsCreated).toBe(0);
    expect(res?.summary?.standardsReused).toBe(1);
    expect(res?.summary?.questionsCreated).toBe(1);
    expect(res?.summary?.questionsSkipped).toBe(1);
  });

  it("menolak jika semua baris memiliki kategori atau unit yang tidak dikenal dan mencatat baris gagal", async () => {
    const rows = [
      [
        "Cakupan",
        "Target Cakupan",
        "Nama Standar",
        "Pertanyaan / Butir Instrumen",
      ],
      ["Kategori", "KategoriKhayalan", "Standar Test", "Pertanyaan 1"],
      ["Unit Tertentu", "UnitTidakAda", "Standar Test 2", "Pertanyaan 2"],
    ];

    const fd = createExcelFormData(rows);
    const res = await importInstrumentsExcel(undefined, fd);

    expect(res?.ok).toBe(false);
    expect(res?.error).toMatch(/tidak dapat diproses/i);
    expect(res?.summary?.failedCount).toBe(2);
    expect(res?.summary?.failedRows[0]?.rowNumber).toBe(2);
    expect(res?.summary?.failedRows[0]?.reason).toMatch(
      /Kategori unit "KategoriKhayalan" tidak dikenal/i
    );
    expect(res?.summary?.failedRows[1]?.rowNumber).toBe(3);
    expect(res?.summary?.failedRows[1]?.reason).toMatch(
      /Unit "UnitTidakAda" tidak ditemukan/i
    );
  });

  it("mencatat rincian baris yang berhasil dan baris yang gagal secara spesifik pada satu berkas", async () => {
    const rows = [
      [
        "Cakupan",
        "Target Cakupan",
        "Nama Standar",
        "Pertanyaan / Butir Instrumen",
      ],
      // Baris 2: Valid (Semua Unit)
      ["Semua Unit", "", "Standar Tata Pamong", "Pertanyaan valid baris 2"],
      // Baris 3: Gagal (Kategori salah)
      [
        "Kategori",
        "KategoriSalah",
        "Standar Tata Pamong",
        "Pertanyaan baris 3",
      ],
      // Baris 4: Valid (Semua Unit)
      ["Semua Unit", "", "Standar Tata Pamong", "Pertanyaan valid baris 4"],
    ];

    const fd = createExcelFormData(rows);
    const res = await importInstrumentsExcel(undefined, fd);

    expect(res?.ok).toBe(true);
    expect(res?.summary?.successCount).toBe(2);
    expect(res?.summary?.failedCount).toBe(1);

    // Baris yang berhasil
    expect(res?.summary?.successRows[0]?.rowNumber).toBe(2);
    expect(res?.summary?.successRows[0]?.questionText).toBe(
      "Pertanyaan valid baris 2"
    );
    expect(res?.summary?.successRows[0]?.status).toBe("created");

    expect(res?.summary?.successRows[1]?.rowNumber).toBe(4);
    expect(res?.summary?.successRows[1]?.questionText).toBe(
      "Pertanyaan valid baris 4"
    );
    expect(res?.summary?.successRows[1]?.status).toBe("created");

    // Baris yang gagal
    expect(res?.summary?.failedRows[0]?.rowNumber).toBe(3);
    expect(res?.summary?.failedRows[0]?.reason).toMatch(
      /Kategori unit "KategoriSalah" tidak dikenal/i
    );
  });
});

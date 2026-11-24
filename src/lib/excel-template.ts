import * as XLSX from "xlsx";
import { CATEGORIES } from "@/lib/scope";

export type UnitReference = {
  id: number;
  name: string;
  category: string;
};

/**
 * Membuat buffer Excel (.xlsx) berisi Template Import Standar & Pertanyaan SPMI.
 *
 * Terdiri dari 2 lembar kerja (worksheet):
 * 1. "Template Instrumen" : Tabel template pengisian beserta baris contoh nyata.
 * 2. "Panduan & Referensi" : Petunjuk teknis pengisian, daftar kategori resmi,
 *    dan daftar nama unit terdaftar agar admin dapat mencocokkan nama unit tanpa typo.
 */
export function generateInstrumentExcelBuffer(
  units: UnitReference[] = []
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // Sheet 1: Template Instrumen
  // -------------------------------------------------------------
  const templateHeaders = [
    "Cakupan",
    "Target Cakupan",
    "Nama Standar",
    "Urutan Standar",
    "Pertanyaan / Butir Instrumen",
    "Urutan Pertanyaan",
  ];

  // Ambil contoh unit pertama atau gunakan nama bawaan
  const sampleProdi =
    units.find(
      (u) =>
        u.category.toLowerCase().includes("prodi") ||
        u.category.toLowerCase().includes("program studi")
    )?.name ?? "S1 Teknik Informatika";
  const samplePerpus =
    units.find(
      (u) =>
        u.category.toLowerCase().includes("perpus") ||
        u.name.toLowerCase().includes("perpustakaan")
    )?.name ?? "Perpustakaan";

  const sampleRows: (string | number)[][] = [
    templateHeaders,
    // Contoh 1: Standar Umum (Semua Unit) - Butir 1
    [
      "Semua Unit",
      "",
      "Standar Tata Pamong dan Kerja Sama",
      1,
      "Apakah unit kerja memiliki dokumen rencana strategis (Renstra) atau program kerja tahunan yang disahkan pimpinan?",
      1,
    ],
    // Contoh 1: Standar Umum (Semua Unit) - Butir 2
    [
      "Semua Unit",
      "",
      "Standar Tata Pamong dan Kerja Sama",
      1,
      "Apakah terdapat struktur organisasi beserta uraian tugas (job description) yang terdokumentasi jelas untuk setiap personel?",
      2,
    ],
    // Contoh 1: Standar Umum (Semua Unit) - Butir 3
    [
      "Semua Unit",
      "",
      "Standar Tata Pamong dan Kerja Sama",
      1,
      "Apakah unit melaksanakan evaluasi berkala terhadap ketercapaian target program kerja minimal sekali per semester?",
      3,
    ],
    // Contoh 2: Standar Kategori (Misal: Program Studi) - Butir 1
    [
      "Kategori",
      "Program Studi",
      "Standar Kurikulum dan Pembelajaran",
      2,
      `Apakah kurikulum program studi (${sampleProdi}) ditinjau secara berkala bersama pakar, asosiasi profesi, dan alumni?`,
      1,
    ],
    // Contoh 2: Standar Kategori (Misal: Program Studi) - Butir 2
    [
      "Kategori",
      "Program Studi",
      "Standar Kurikulum dan Pembelajaran",
      2,
      "Apakah seluruh mata kuliah yang ditawarkan memiliki Rencana Pembelajaran Semester (RPS) mutakhir?",
      2,
    ],
    // Contoh 3: Standar Khusus Unit Tertentu (Misal: Perpustakaan) - Butir 1
    [
      "Unit Tertentu",
      samplePerpus,
      "Standar Layanan dan Otomasi Perpustakaan",
      1,
      "Apakah sistem otomasi perpustakaan (katalog online dan sirkulasi) berjalan lancar dan dapat diakses pengguna?",
      1,
    ],
    // Contoh 3: Standar Khusus Unit Tertentu - Butir 2
    [
      "Unit Tertentu",
      samplePerpus,
      "Standar Layanan dan Otomasi Perpustakaan",
      1,
      "Apakah terdapat evaluasi dan pembaruan berkala terhadap ketersediaan literatur dan e-journal terlanggan?",
      2,
    ],
  ];

  const wsTemplate = XLSX.utils.aoa_to_sheet(sampleRows);

  // Lebar kolom yang nyaman dibaca di Excel
  wsTemplate["!cols"] = [
    { wch: 16 }, // Cakupan
    { wch: 28 }, // Target Cakupan
    { wch: 40 }, // Nama Standar
    { wch: 16 }, // Urutan Standar
    { wch: 75 }, // Pertanyaan / Butir Instrumen
    { wch: 18 }, // Urutan Pertanyaan
  ];

  XLSX.utils.book_append_sheet(wb, wsTemplate, "Template Instrumen");

  // -------------------------------------------------------------
  // Sheet 2: Panduan & Referensi
  // -------------------------------------------------------------
  const guideRows: (string | number)[][] = [
    ["PANDUAN PENGISIAN FORMAT IMPORT STANDAR & PERTANYAAN SPMI"],
    [""],
    ["1. ATURAN PENGISIAN KOLOM:"],
    ["Kolom", "Wajib / Opsional", "Penjelasan & Aturan Nilai"],
    [
      "Cakupan",
      "Wajib",
      'Pilih salah satu: "Semua Unit" (berlaku untuk seluruh unit), "Kategori" (berlaku untuk 1 kategori unit), atau "Unit Tertentu" (khusus 1 unit).',
    ],
    [
      "Target Cakupan",
      "Kondisional",
      'Wajib diisi jika Cakupan adalah "Kategori" (tuliskan nama kategori) atau "Unit Tertentu" (tuliskan nama unit persis seperti pada daftar di bawah). Kosongkan jika Cakupan = "Semua Unit".',
    ],
    [
      "Nama Standar",
      "Wajib",
      'Nama standar induk / pengelompok instrumen (mis. "Standar Tata Pamong"). Jika 1 standar punya banyak butir, tuliskan nama standar yang sama di baris-baris berikutnya.',
    ],
    [
      "Urutan Standar",
      "Opsional",
      "Angka urutan tampilan standar (mis. 1, 2, 3...). Jika dikosongkan, sistem akan mengurutkan otomatis.",
    ],
    [
      "Pertanyaan / Butir Instrumen",
      "Wajib",
      "Kalimat butir instrumen audit/verifikasi yang akan dijawab oleh unit auditee.",
    ],
    [
      "Urutan Pertanyaan",
      "Opsional",
      "Angka urutan tampilan pertanyaan di dalam standar tersebut. Jika dikosongkan, sistem akan mengurutkan otomatis.",
    ],
    [""],
    [
      "2. DAFTAR KATEGORI UNIT RESMI (Gunakan pada kolom Target Cakupan jika Cakupan = Kategori):",
    ],
    ["No", "Nama Kategori Resmi"],
    ...CATEGORIES.map((cat, idx) => [idx + 1, cat]),
    [""],
    [
      "3. DAFTAR UNIT TERDAFTAR DI SISTEM (Gunakan pada kolom Target Cakupan jika Cakupan = Unit Tertentu):",
    ],
    ["No", "Nama Unit", "Kategori Unit"],
    ...units.map((u, idx) => [idx + 1, u.name, u.category]),
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);

  wsGuide["!cols"] = [{ wch: 18 }, { wch: 35 }, { wch: 80 }];

  XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan & Referensi");

  const buffer = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return new Uint8Array(buffer);
}

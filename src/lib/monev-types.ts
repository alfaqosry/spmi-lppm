/**
 * Tipe payload layanan wsstatistik.
 *
 * Endpoint eksternal mengembalikan JSON yang bentuknya tidak seragam antar
 * tabel (mis. `id_kdp` untuk dosen-prodi, `id_kmp` untuk mahasiswa-prodi).
 * Karena itu baris dimodelkan sebagai objek dengan kunci dinamis, bukan `any`,
 * agar tetap type-safe saat diakses lewat nama kolom.
 */

/** Satu baris nilai (prodi, unit, dosen, atau kategori). */
export type BarisNilai = {
  nilai?: number | string | null;
  predikat?: string | null;
  [kolom: string]: unknown;
};

/** Satu opsi jawaban pada grafik distribusi. */
export type OpsiJawaban = {
  id_jawaban?: number | string | null;
  pilihan?: string | null;
  jlh?: number | string | null;
};

/** Satu pertanyaan beserta distribusi jawabannya. */
export type BarisGrafik = {
  id_pertanyaan?: number | string | null;
  pertanyaan?: string | null;
  jawaban?: OpsiJawaban[] | null;
  [kolom: string]: unknown;
};

/** Potongan respons tabdosen / tabmhs / tabmhspro / tabmhsunit. */
export type TabelPayload = {
  meta?: MetaBundle | null;
  prodi?: BarisNilai[] | null;
  dosen?: BarisNilai[] | null;
  unit?: BarisNilai[] | null;
  kategori?: BarisNilai[] | null;
  grafik?: BarisGrafik[] | null;
};

/** Satu baris pada respons endpoint `semester`. */
export type SemesterApi = {
  id_smt?: string | number | null;
  nama?: string | null;
  aktif?: boolean | null;
  tersedia?: boolean | null;
  tersedia_pro?: boolean | null;
  tersedia_unit?: boolean | null;
  tersedia_dosen?: boolean | null;
  jumlah_jawaban_pro?: number | string | null;
  jumlah_jawaban_unit?: number | string | null;
  jumlah_jawaban_dosen?: number | string | null;
  date_start?: string | null;
  date_end?: string | null;
};

/** Respons endpoint `semester`. */
export type SemesterPayload = {
  success?: boolean;
  data?: SemesterApi[] | null;
};

/** Butir grafik hasil rekonstruksi database (bentuk sama dengan API). */
export type ButirGrafik = {
  id_pertanyaan: number;
  pertanyaan: string;
  jawaban: { id_jawaban: number; pilihan: string; jlh: number }[];
} & Record<string, unknown>;

/** Bundle empat tabel untuk satu semester. */
export type MonevBundleApi = {
  tabdosen: unknown;
  tabmhs: unknown;
  tabmhspro: unknown;
  tabmhsunit: unknown;
};

/** Baca nilai apa pun sebagai angka; bukan angka → 0. */
export function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Butir grafik hasil rekonstruksi: pertanyaan + distribusi jawaban. */
export type GrafikApi = {
  id_pertanyaan: number;
  pertanyaan: string;
  jawaban: { id_jawaban: number; pilihan: string; jlh: number }[];
  [kolom: string]: unknown;
};

/** Kategori/aspek hasil rekonstruksi (kunci id berbeda per sumber). */
export type KategoriApi = {
  id_sms: string;
  nm_lemb: string;
  nilai: number;
  predikat: string;
  [kolom: string]: string | number;
};

/** Baris peringkat prodi/unit. */
export type BarisProdiApi = {
  id_sms: string;
  nm_lemb: string;
  nilai: number;
  predikat: string;
};

/** Baris peringkat dosen. */
export type BarisDosenApi = {
  id_ptk: string;
  nm_ptk: string;
  nilai: number;
  predikat: string;
};

/** Meta ringkas yang menyertai setiap tabel. */
export type MetaBundle = {
  id_smt: string;
  semester: string;
  cached: boolean;
  generated_at: string;
  jumlah_prodi?: number;
  jumlah_dosen?: number;
  jumlah_unit?: number;
  jumlah_kategori?: number;
  jumlah_pertanyaan: number;
  jumlah_baris: number;
};

/** Satu tabel hasil rekonstruksi (null bila semester belum tersinkron). */
export type TabelBundle = {
  success: boolean;
  meta: MetaBundle;
  prodi?: BarisProdiApi[];
  dosen?: BarisDosenApi[];
  unit?: BarisProdiApi[];
  kategori?: KategoriApi[];
  grafik: GrafikApi[];
} | null;

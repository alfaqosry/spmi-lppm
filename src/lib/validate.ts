import { AppError } from "@/lib/errors";

/**
 * Validasi input sisi server (ASVS V5). Semua server action membaca FormData
 * HANYA melalui helper ini: field di-whitelist secara eksplisit, panjang
 * dibatasi, angka & enum divalidasi. Tidak ada objek input yang diteruskan
 * mentah ke Prisma (anti mass-assignment).
 */

/** Batas panjang standar (selaras dengan kolom database). */
export const LIMITS = {
  name: 160,
  email: 190,
  cycleName: 120,
  unitName: 160,
  category: 80,
  description: 2000,
  standardName: 160,
  questionText: 5000,
  title: 255,
  url: 500,
  longText: 5000,
  settingText: 1000,
} as const;

/** Hapus karakter kontrol (kecuali tab/baris baru) & normalisasi Unicode. */
export function cleanText(value: string, multiline = false): string {
  const v = value.normalize("NFC");
  return multiline
    ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    : v.replace(/[\u0000-\u001F\u007F]/g, " ");
}

type StrOpts = {
  max: number;
  required?: boolean;
  multiline?: boolean;
  label?: string;
};

/** Ambil teks dari FormData, trim, bersihkan, dan validasi panjang. */
export function str(formData: FormData, key: string, opts: StrOpts): string {
  const raw = formData.get(key);
  if (raw != null && typeof raw !== "string") {
    throw new AppError(`Isian ${opts.label ?? key} tidak valid.`);
  }
  const v = cleanText(String(raw ?? ""), opts.multiline).trim();
  if (opts.required && !v) {
    throw new AppError(`${opts.label ?? key} wajib diisi.`);
  }
  if (v.length > opts.max) {
    throw new AppError(
      `${opts.label ?? key} terlalu panjang (maksimal ${opts.max} karakter).`
    );
  }
  return v;
}

/** Validasi teks yang sudah ada (bukan dari FormData). */
export function checkText(value: unknown, opts: StrOpts): string {
  const v = cleanText(String(value ?? ""), opts.multiline).trim();
  if (opts.required && !v)
    throw new AppError(`${opts.label ?? "Isian"} wajib diisi.`);
  if (v.length > opts.max) {
    throw new AppError(
      `${opts.label ?? "Isian"} terlalu panjang (maksimal ${opts.max} karakter).`
    );
  }
  return v;
}

/** ID positif (int32). Kembalikan null bila kosong & tidak wajib. */
export function parseId(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n <= 0 || n > 2147483647) return null;
  return n;
}

/** ID wajib — lempar AppError bila tidak valid. */
export function requireId(value: unknown, label = "ID"): number {
  const n = parseId(value);
  if (n == null) throw new AppError(`${label} tidak valid.`);
  return n;
}

/** ID dari FormData (opsional). */
export function idField(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw == null || raw === "") return null;
  const n = parseId(raw);
  if (n == null) throw new AppError("Data tidak valid.");
  return n;
}

/** Bilangan bulat dalam rentang. */
export function intField(
  formData: FormData,
  key: string,
  opts: { min: number; max: number; fallback: number }
): number {
  const raw = formData.get(key);
  if (raw == null || raw === "") return opts.fallback;
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < opts.min || n > opts.max) {
    throw new AppError("Nilai angka tidak valid.");
  }
  return n;
}

/** Nilai enum dari daftar yang diizinkan. */
export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  message = "Pilihan tidak valid."
): T {
  const v = String(value ?? "");
  if (!(allowed as readonly string[]).includes(v)) throw new AppError(message);
  return v as T;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Email terstandar (huruf kecil) & tervalidasi. */
export function emailField(formData: FormData, key = "email"): string {
  const v = str(formData, key, {
    max: LIMITS.email,
    required: true,
    label: "Email",
  }).toLowerCase();
  if (!EMAIL_RE.test(v)) throw new AppError("Format email tidak valid.");
  return v;
}

/** Tanggal format YYYY-MM-DD (dari <input type="date">) → Date UTC tengah malam. */
export function dateField(
  formData: FormData,
  key: string,
  label: string
): Date {
  const v = String(formData.get(key) ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new AppError(`${label} tidak valid.`);
  const d = new Date(`${v}T00:00:00.000Z`);
  // Tolak tanggal mustahil (mis. 2025-02-31 yang digulirkan JS ke 3 Maret).
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    throw new AppError(`${label} tidak valid.`);
  }
  const y = d.getUTCFullYear();
  if (y < 2000 || y > 2100)
    throw new AppError(`${label} di luar rentang yang diizinkan.`);
  return d;
}

/** Ambil File dari FormData (atau null bila tidak ada / kosong). */
export function fileField(formData: FormData, key = "file"): File | null {
  const f = formData.get(key);
  if (!f || typeof f === "string") return null;
  if (!(f instanceof File) || f.size === 0) return null;
  return f;
}

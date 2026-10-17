/**
 * Kebijakan kata sandi (ASVS V2.1) — dipakai di SEMUA tempat kata sandi
 * ditetapkan: buat/ubah akun, ganti kata sandi mandiri, buat superadmin, seed.
 *
 * Modul ini sengaja tanpa dependensi (tanpa alias "@/") agar bisa diimpor
 * juga oleh prisma/seed.ts yang dijalankan dengan tsx.
 *
 * Aturan:
 *  - minimal 8 karakter
 *  - maksimal 72 byte UTF-8 (batas bcrypt; sisa byte akan diabaikan diam-diam)
 *  - mengandung minimal satu huruf DAN satu angka
 *  - tidak boleh sama dengan email / bagian lokal email
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/** Pesan kebijakan untuk ditampilkan di UI (petunjuk form). */
export const PASSWORD_POLICY_HINT =
  "Minimal 8 karakter, mengandung huruf dan angka.";

/** Kembalikan pesan kesalahan (Bahasa Indonesia) atau null bila valid. */
export function validatePassword(
  password: string,
  context?: { email?: string | null }
): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Kata sandi wajib diisi.";
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    return `Kata sandi maksimal ${PASSWORD_MAX_BYTES} karakter.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Kata sandi wajib mengandung huruf dan angka.";
  }
  const email = context?.email?.trim().toLowerCase();
  if (email) {
    const local = email.split("@")[0];
    const lower = password.toLowerCase();
    if (lower === email || (local.length >= 4 && lower === local)) {
      return "Kata sandi tidak boleh sama dengan email.";
    }
  }
  return null;
}

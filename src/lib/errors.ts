/**
 * Utilitas error untuk server actions.
 *
 * Tujuan keamanan: JANGAN pernah mengirim pesan error mentah dari database /
 * runtime ke klien, karena dapat membocorkan struktur internal (nama tabel,
 * kolom, kueri). Semua error tak terduga dipetakan ke pesan generik, sedangkan
 * detailnya dicatat ke log server.
 */

/** Error yang aman ditampilkan ke pengguna (pesan sudah dikurasi). */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

/** Lempar AppError (pesan aman untuk pengguna). */
export function fail(message: string): never {
  throw new AppError(message);
}

/**
 * Ubah error apa pun menjadi pesan yang aman untuk respons action.
 * - AppError  -> pesan aslinya (sudah dikurasi).
 * - lainnya   -> pesan fallback generik + log detail ke server.
 */
export function toActionError(
  e: unknown,
  fallback = "Terjadi kesalahan. Silakan coba lagi."
): string {
  if (e instanceof AppError) return e.message;
  // Catat detail ke log server (tidak dikirim ke klien).
  console.error("[action-error]", e);
  return fallback;
}

/**
 * Validasi skema URL: hanya izinkan http/https (atau kosong).
 * Mencegah `javascript:`, `data:`, `vbscript:`, dll.
 */
export function isSafeHttpUrl(value: string): boolean {
  if (!value) return true; // kosong = tidak ada tautan
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

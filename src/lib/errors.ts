import { unstable_rethrow } from "next/navigation";
import { logError } from "@/lib/redact";

/**
 * Utilitas error untuk server actions & route handler.
 *
 * Tujuan keamanan: JANGAN pernah mengirim pesan error mentah dari database /
 * runtime ke klien, karena dapat membocorkan struktur internal (nama tabel,
 * kolom, kueri). Semua error tak terduga dipetakan ke pesan generik Bahasa
 * Indonesia, sedangkan detailnya dicatat ke log server (sudah disamarkan —
 * tanpa email/token/secret).
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

/** Pemetaan kode error Prisma yang umum ke pesan yang aman. */
function prismaMessage(e: unknown): string | null {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code !== "string" || !/^P\d{4}$/.test(code)) return null;
  switch (code) {
    case "P2002":
      return "Data yang sama sudah ada.";
    case "P2003":
      return "Data terkait tidak ditemukan atau masih digunakan.";
    case "P2025":
      return "Data tidak ditemukan.";
    default:
      return null;
  }
}

/**
 * Ubah error apa pun menjadi pesan yang aman untuk respons action.
 * - error internal Next.js (redirect/notFound) -> dilempar ulang
 * - AppError  -> pesan aslinya (sudah dikurasi)
 * - Prisma    -> pesan generik per kode
 * - lainnya   -> pesan fallback generik + log detail (tersamarkan) ke server
 */
export function toActionError(
  e: unknown,
  fallback = "Terjadi kesalahan. Silakan coba lagi."
): string {
  unstable_rethrow(e);
  if (e instanceof AppError) return e.message;
  logError("[action-error]", e);
  return prismaMessage(e) ?? fallback;
}

/**
 * Validasi skema URL: hanya izinkan http/https (atau kosong).
 * Mencegah `javascript:`, `data:`, `vbscript:`, dll.
 */
export function isSafeHttpUrl(value: string): boolean {
  if (!value) return true; // kosong = tidak ada tautan
  try {
    const u = new URL(value);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}

/** Respons JSON error seragam untuk route handler (tanpa detail internal). */
export function jsonError(
  message: string,
  status: number,
  extraHeaders?: HeadersInit
) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(extraHeaders ?? {}),
    },
  });
}

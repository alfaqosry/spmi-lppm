import { prisma } from "@/lib/prisma";
import { CONTENT_LANGUAGE, LOCALE_METADATA } from "@/lib/privacy";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — pemeriksaan kesehatan untuk smoke test & pemantauan.
 * Publik, tanpa autentikasi, TIDAK terpengaruh mode pemeliharaan, dan tidak
 * membocorkan detail konfigurasi/error (hanya status ok/error).
 *
 * Bentuk: `{ status, db, version, locale }`. Field `locale` memuat metadata
 * lokal eksplisit (ISO 639-1, BCP 47, ISO 3166-1, zona waktu, ISO 8601;
 * ISO 4217 N/A) — lihat docs/iso/STANDAR-KODE-DATA.md. `smoke-test.ps1`
 * hanya memeriksa status 200 dan `"db":"ok"`.
 */
export async function GET() {
  const version = process.env.APP_VERSION || pkg.version || "0.0.0";
  let db: "ok" | "error" = "ok";
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000)
      ),
    ]);
  } catch {
    db = "error";
  }
  const ok = db === "ok";
  return new Response(
    JSON.stringify({
      status: ok ? "ok" : "error",
      db,
      version,
      locale: LOCALE_METADATA,
    }),
    {
      status: ok ? 200 : 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Language": CONTENT_LANGUAGE,
        "Cache-Control": "no-store",
      },
    }
  );
}

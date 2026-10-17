import { prisma } from "@/lib/prisma";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — pemeriksaan kesehatan untuk smoke test & pemantauan.
 * Publik, tanpa autentikasi, TIDAK terpengaruh mode pemeliharaan, dan tidak
 * membocorkan detail konfigurasi/error (hanya status ok/error).
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
    JSON.stringify({ status: ok ? "ok" : "error", db, version }),
    {
      status: ok ? 200 : 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

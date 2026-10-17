import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { getCurrentUser, isLpm, unitIdsOf } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/errors";
import { locateUpload, parseUploadPath, MIME_BY_EXT } from "@/lib/upload";
import { rateLimit, rateLimitMessage, LIMITS_RL } from "@/lib/ratelimit";
import { getSettings, isOn } from "@/lib/settings";
import { logError } from "@/lib/redact";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/<folder>/<nama>   (juga melayani URL lama /uploads/<folder>/<nama>
 * lewat rewrite di next.config.ts — path di database tidak perlu diubah)
 *
 * Otorisasi:
 *  - branding/   : publik (logo, favicon, gambar OG) — hanya tipe gambar.
 *  - penetapan/, evaluasi/ : semua pengguna login selain pengunjung, dan
 *                  berkas harus tercatat pada tabel dokumen.
 *  - bukti/      : LPM/superadmin; atau auditee yang ditempatkan pada unit
 *                  pemilik jawaban yang mereferensikan berkas tersebut.
 * Path tidak valid / traversal → 404. Tanpa sesi → 401. Tidak berhak → 403.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await ctx.params;
    const parsed = parseUploadPath(segments ?? []);
    if (!parsed) return jsonError("Berkas tidak ditemukan.", 404);

    const isPublic = parsed.folder === "branding";

    if (!isPublic) {
      const user = await getCurrentUser();
      if (!user)
        return jsonError("Sesi tidak valid. Silakan masuk kembali.", 401);
      if (user.role === "pengunjung") return jsonError("Akses ditolak.", 403);

      const settings = await getSettings();
      if (isOn(settings["maintenance.enabled"]) && user.role !== "superadmin") {
        return jsonError("Sistem sedang dalam pemeliharaan.", 503);
      }

      const rl = rateLimit(
        `files:${user.id}`,
        LIMITS_RL.files.limit,
        LIMITS_RL.files.windowMs
      );
      if (!rl.ok) {
        return jsonError(rateLimitMessage(rl.retryAfter), 429, {
          "Retry-After": String(rl.retryAfter ?? 60),
        });
      }

      if (parsed.folder === "bukti") {
        if (isLpm(user.role)) {
          const ref = await prisma.auditResponse.findFirst({
            where: { evidenceFile: parsed.logical },
            select: { id: true },
          });
          if (!ref) return jsonError("Berkas tidak ditemukan.", 404);
        } else {
          const ids = unitIdsOf(user);
          const own = ids.length
            ? await prisma.auditResponse.findFirst({
                where: { evidenceFile: parsed.logical, unitId: { in: ids } },
                select: { id: true },
              })
            : null;
          if (!own) {
            const exists = await prisma.auditResponse.findFirst({
              where: { evidenceFile: parsed.logical },
              select: { id: true },
            });
            return exists
              ? jsonError("Anda tidak berhak mengakses berkas ini.", 403)
              : jsonError("Berkas tidak ditemukan.", 404);
          }
        }
      } else {
        const doc = await prisma.document.findFirst({
          where: {
            filePath: parsed.logical,
            type: parsed.folder === "evaluasi" ? "evaluasi" : "penetapan",
          },
          select: { id: true },
        });
        if (!doc) return jsonError("Berkas tidak ditemukan.", 404);
      }
    }

    const found = await locateUpload(parsed);
    if (!found) return jsonError("Berkas tidak ditemukan.", 404);

    const download = new URL(request.url).searchParams.get("download") === "1";
    const asciiName = `${parsed.folder}-${parsed.name}`.replace(
      /[^A-Za-z0-9._-]/g,
      "_"
    );
    const stream = Readable.toWeb(
      createReadStream(found.absPath)
    ) as ReadableStream;

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": MIME_BY_EXT[parsed.ext] ?? "application/octet-stream",
        "Content-Length": String(found.size),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${asciiName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isPublic
          ? "public, max-age=86400"
          : "private, no-store",
        "Cross-Origin-Resource-Policy": isPublic
          ? "cross-origin"
          : "same-origin",
        "Last-Modified": found.mtime.toUTCString(),
      },
    });
  } catch (e) {
    logError("[files] gagal menyajikan berkas:", e);
    return jsonError("Gagal memuat berkas.", 500);
  }
}

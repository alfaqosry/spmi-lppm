import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/errors";
import {
  buildMyDataExport,
  CONTENT_LANGUAGE,
  exportAuditDetail,
} from "@/lib/privacy";
import { rateLimit, rateLimitMessage, LIMITS_RL } from "@/lib/ratelimit";
import { recordActivity } from "@/lib/logs";
import { clientIpFromHeaders } from "@/lib/net";
import { logError } from "@/lib/redact";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/export — "Ekspor data saya" (hak akses subjek data, UU 27/2022).
 * Mengembalikan seluruh data pribadi milik pengguna yang sedang login sebagai
 * JSON UTF-8 (lampiran), timestamp ISO 8601 +07:00, metadata `locale` eksplisit
 * dan header `Content-Language: id`. Berlaku untuk semua peran
 * termasuk pengunjung, dan tetap tersedia saat mode pemeliharaan.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return jsonError("Sesi tidak valid. Silakan masuk kembali.", 401);

    const rl = rateLimit(
      `me-export:${user.id}`,
      LIMITS_RL.meExport.limit,
      LIMITS_RL.meExport.windowMs
    );
    if (!rl.ok) {
      return jsonError(rateLimitMessage(rl.retryAfter), 429, {
        "Retry-After": String(rl.retryAfter ?? 60),
      });
    }

    const data = await buildMyDataExport(user.id);
    if (!data) return jsonError("Akun tidak ditemukan.", 404);

    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "privacy.export",
      entity: "user",
      entityId: user.id,
      detail: exportAuditDetail(user.email),
      ip: clientIpFromHeaders(request.headers),
    });

    const date = (data.meta.generatedAt ?? "").slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Language": CONTENT_LANGUAGE,
        "Content-Disposition": `attachment; filename="data-saya-spmi-${date}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    logError("[me-export] gagal:", e);
    return jsonError("Gagal menyiapkan ekspor data. Silakan coba lagi.", 500);
  }
}

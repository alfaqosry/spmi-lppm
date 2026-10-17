import { NextResponse } from "next/server";
import { getCurrentUser, isLpm } from "@/lib/auth";
import { canReadUnit } from "@/lib/guards";
import { buildReportData, buildUnitReportData } from "@/lib/report/data";
import { buildReportPdf } from "@/lib/report/pdf";
import { buildUnitReportPdf } from "@/lib/report/pdf-unit";
import { jsonError } from "@/lib/errors";
import { parseId } from "@/lib/validate";
import { rateLimit, rateLimitMessage, LIMITS_RL } from "@/lib/ratelimit";
import { recordActivity } from "@/lib/logs";
import { clientIpFromHeaders } from "@/lib/net";
import { logError } from "@/lib/redact";
import { getSettings, isOn } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/export?cycleId=<id>[&unitId=<id>]
 *
 * Otorisasi:
 *  - Laporan keseluruhan (tanpa unitId): hanya LPM (lpm_admin, lpm_member, superadmin).
 *  - Laporan per unit: LPM untuk semua unit; auditee (kepala/anggota) HANYA
 *    untuk unit tempat ia ditempatkan. Pengunjung ditolak.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return jsonError("Sesi tidak valid. Silakan masuk kembali.", 401);
    if (user.role === "pengunjung") return jsonError("Akses ditolak.", 403);

    const settings = await getSettings();
    if (isOn(settings["maintenance.enabled"]) && user.role !== "superadmin") {
      return jsonError("Sistem sedang dalam pemeliharaan.", 503);
    }

    const rl = rateLimit(
      `export:${user.id}`,
      LIMITS_RL.export.limit,
      LIMITS_RL.export.windowMs
    );
    if (!rl.ok) {
      return jsonError(rateLimitMessage(rl.retryAfter), 429, {
        "Retry-After": String(rl.retryAfter ?? 60),
      });
    }

    const url = new URL(request.url);
    const cycleId = parseId(url.searchParams.get("cycleId"));
    const unitParam = url.searchParams.get("unitId");
    const unitId = unitParam ? parseId(unitParam) : null;
    if (!cycleId) return jsonError("cycleId wajib diisi.", 400);
    if (unitParam && !unitId) return jsonError("unitId tidak valid.", 400);

    const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 80);
    const ip = clientIpFromHeaders(request.headers);

    // Laporan per unit (tabel observasi/visitasi).
    if (unitId) {
      if (!canReadUnit(user, unitId)) return jsonError("Akses ditolak.", 403);
      const data = await buildUnitReportData(cycleId, unitId);
      if (!data) return jsonError("Siklus atau unit tidak ditemukan.", 404);
      const pdf = buildUnitReportPdf(data);
      await recordActivity({
        userId: user.id,
        userName: user.name,
        action: "report.export_unit",
        entity: "report",
        entityId: `${cycleId}:${unitId}`,
        ip,
      });
      return new NextResponse(pdf as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Laporan_Unit_${slug(
            data.unit.name
          )}_${slug(data.cycle.name)}.pdf"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (!isLpm(user.role)) return jsonError("Akses ditolak.", 403);

    const data = await buildReportData(cycleId);
    if (!data) return jsonError("Siklus tidak ditemukan.", 404);

    const pdf = buildReportPdf(data);
    await recordActivity({
      userId: user.id,
      userName: user.name,
      action: "report.export",
      entity: "report",
      entityId: cycleId,
      ip,
    });

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Laporan_Audit_SPMI_${slug(
          data.cycle.name
        )}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    logError("[export] gagal membuat laporan:", e);
    return jsonError("Gagal membuat laporan. Silakan coba lagi.", 500);
  }
}

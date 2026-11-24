import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/errors";
import { generateInstrumentExcelBuffer } from "@/lib/excel-template";

export const dynamic = "force-dynamic";

/**
 * GET /api/audit/template-excel
 *
 * Mengunduh berkas format Excel (.xlsx) resmi untuk import massal standar dan pertanyaan.
 * Berisi lembar kerja Template Instrumen dan lembar kerja Referensi Kategori & Unit aktif.
 * Hanya dapat diakses oleh LPM (superadmin, lpm_admin, lpm_member).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return jsonError("Sesi tidak valid. Silakan masuk kembali.", 401);
    }

    const isLpm =
      user.role === "lpm_admin" ||
      user.role === "lpm_member" ||
      user.role === "superadmin";

    if (!isLpm) {
      return jsonError(
        "Akses ditolak. Hanya pengguna LPM yang dapat mengunduh template.",
        403
      );
    }

    const units = await prisma.unit.findMany({
      select: { id: true, name: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const uint8Array = generateInstrumentExcelBuffer(units);

    return new Response(Buffer.from(uint8Array), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="Template_Import_Standar_Pertanyaan_SPMI.xlsx"',
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Gagal membuat berkas template Excel.",
      500
    );
  }
}

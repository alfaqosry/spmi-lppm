import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildReportData, buildUnitReportData } from "@/lib/report/data";
import { buildReportPdf } from "@/lib/report/pdf";
import { buildUnitReportPdf } from "@/lib/report/pdf-unit";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== "lpm_admin" &&
      user.role !== "lpm_member" &&
      user.role !== "superadmin")
  ) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const url = new URL(request.url);
  const cycleId = Number(url.searchParams.get("cycleId"));
  const unitId = Number(url.searchParams.get("unitId"));
  if (!cycleId) {
    return NextResponse.json({ error: "cycleId wajib diisi" }, { status: 400 });
  }

  const slug = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_");

  // Laporan per unit (tabel observasi/visitasi).
  if (unitId) {
    const data = await buildUnitReportData(cycleId, unitId);
    if (!data) {
      return NextResponse.json(
        { error: "Siklus atau unit tidak ditemukan" },
        { status: 404 }
      );
    }
    const pdf = buildUnitReportPdf(data);
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Laporan_Unit_${slug(
          data.unit.name
        )}_${slug(data.cycle.name)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const data = await buildReportData(cycleId);
  if (!data) {
    return NextResponse.json({ error: "Siklus tidak ditemukan" }, { status: 404 });
  }

  const pdf = buildReportPdf(data);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Laporan_Audit_SPMI_${slug(
        data.cycle.name
      )}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

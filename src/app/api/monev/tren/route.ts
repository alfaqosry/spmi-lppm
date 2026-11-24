import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { trenNilaiDariDb } from "@/lib/monev-store";

/**
 * Tren nilai rata-rata per instrumen lintas semester.
 *
 * Berbeda dengan jumlah jawaban, nilai rata-rata menunjukkan mutu layanan.
 * Hanya semester yang pernah disinkronkan yang muncul, karena agregat dihitung
 * dari snapshot lokal (`monev_ringkasan`).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 }
    );
  }

  try {
    const data = await trenNilaiDariDb();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: "Gagal membaca tren nilai.", data: [] },
      { status: 500 }
    );
  }
}

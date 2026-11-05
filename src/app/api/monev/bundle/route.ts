import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { bacaBundleDariDb } from "@/lib/monev-store";
import { fetchExternal } from "@/app/api/wsstatistik/utils";
import type { TabelPayload } from "@/lib/monev-types";

/**
 * Bundle data monev untuk satu semester.
 *
 * Urutan sumber:
 *   1. Database lokal (hasil tombol "Sinkronkan") — cepat & tahan gangguan.
 *   2. Layanan wsstatistik — dipakai bila semester belum pernah disinkron.
 *
 * Parameter `sumber=lokal|eksternal` memaksa salah satu (dipakai halaman
 * untuk menampilkan data terbaru langsung dari API bila diinginkan).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const idSmt = searchParams.get("id_smt")?.trim();
  if (!idSmt) {
    return NextResponse.json(
      { error: "Parameter id_smt wajib diisi" },
      { status: 400 }
    );
  }

  const paksa = searchParams.get("sumber");

  if (paksa !== "eksternal") {
    try {
      const lokal = await bacaBundleDariDb(idSmt);
      const adaData = Boolean(
        lokal.tabdosen || lokal.tabmhs || lokal.tabmhspro || lokal.tabmhsunit
      );
      if (adaData) {
        return NextResponse.json({ sumber: "lokal", ...lokal });
      }
    } catch {
      // Abaikan: lanjut ke layanan eksternal.
    }
    if (paksa === "lokal") {
      return NextResponse.json({
        sumber: "lokal",
        tabdosen: null,
        tabmhs: null,
        tabmhspro: null,
        tabmhsunit: null,
      });
    }
  }

  const [tabdosen, tabmhs, tabmhspro, tabmhsunit] = await Promise.all([
    fetchExternal<TabelPayload>("tabdosen", { id_smt: idSmt }),
    fetchExternal<TabelPayload>("tabmhs", { id_smt: idSmt }),
    fetchExternal<TabelPayload>("tabmhspro", { id_smt: idSmt }),
    fetchExternal<TabelPayload>("tabmhsunit", { id_smt: idSmt }),
  ]);

  return NextResponse.json({
    sumber: "eksternal",
    tabdosen,
    tabmhs,
    tabmhspro,
    tabmhsunit,
  });
}

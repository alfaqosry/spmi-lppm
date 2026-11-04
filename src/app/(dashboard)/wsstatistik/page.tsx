import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { MonevStats } from "@/app/(dashboard)/components/monev-stats";
import { fetchExternal } from "@/app/api/wsstatistik/utils";

export const metadata: Metadata = {
  title: "Statistik Kuesioner",
  description: "Tampilan statistik utama yang diambil dari layanan wsstatistik.",
};

export const dynamic = "force-dynamic";

export default async function WsStatistikPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const semester = await fetchExternal("semester");
  const daftar: any[] = Array.isArray((semester as any)?.data)
    ? (semester as any).data
    : [];
  const aktif =
    daftar.find((s) => s?.aktif) ?? daftar.find((s) => s?.tersedia) ?? daftar[0];
  const idSmt = String(aktif?.id_smt ?? "");

  const [tabmhs, tabmhspro, tabmhsunit, tabdosen] = await Promise.all([
    fetchExternal("tabmhs", { id_smt: idSmt }),
    fetchExternal("tabmhspro", { id_smt: idSmt }),
    fetchExternal("tabmhsunit", { id_smt: idSmt }),
    fetchExternal("tabdosen", { id_smt: idSmt }),
  ]);

  return (
    <div className="p-6">
      <PageHeader
        icon={ClipboardList}
        title="Statistik Kuesioner"
        description="Data yang di-aggregate dari layanan eksternal wsstatistik."
      />
      <MonevStats
        semester={semester}
        initialIdSmt={idSmt}
        initialBundle={{ tabdosen, tabmhs, tabmhspro, tabmhsunit }}
      />
    </div>
  );
}

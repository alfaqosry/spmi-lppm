import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { MonevStats } from "@/app/(dashboard)/components/monev-stats";
import { fetchExternal } from "@/app/api/wsstatistik/utils";

export const metadata: Metadata = {
  title: "Monitoring & Evaluasi",
  description: "Modul monitoring dan evaluasi (monev) SPMI.",
};

export const dynamic = "force-dynamic";

export default async function MonevPage() {
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
        icon={Activity}
        title="Monitoring & Evaluasi (Monev)"
        description="Statistik kuesioner per semester, lengkap dengan grafik dan rincian per dosen."
      />
      <MonevStats
        semester={semester}
        initialIdSmt={idSmt}
        initialBundle={{ tabdosen, tabmhs, tabmhspro, tabmhsunit }}
      />
    </div>
  );
}

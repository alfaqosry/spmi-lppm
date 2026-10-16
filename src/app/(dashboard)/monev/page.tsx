import { redirect } from "next/navigation";
import { Activity, Construction } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Monev — SPMI" };

export default async function MonevPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <PageHeader
        icon={Activity}
        title="Monitoring & Evaluasi (Monev)"
        description="Modul ini disiapkan sebagai placeholder untuk integrasi API di masa mendatang."
      />
      <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-amber-300">
          <Construction className="h-7 w-7" />
        </div>
        <h2 className="text-base font-semibold text-white">Segera Hadir</h2>
        <p className="mt-2 max-w-md text-sm text-slate-400">
          Menu Monev akan diintegrasikan dengan API eksternal pada tahap
          pengembangan berikutnya. Untuk saat ini, silakan gunakan menu{" "}
          <span className="text-indigo-300">Dashboard</span> dan{" "}
          <span className="text-indigo-300">Audit &amp; Verifikasi</span> untuk
          memantau progres audit.
        </p>
      </div>
    </div>
  );
}

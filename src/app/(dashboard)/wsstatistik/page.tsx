import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { getCurrentUser, isLpmAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { MonevStats } from "@/app/(dashboard)/components/monev-stats";
import { MonevSyncPanel } from "@/app/(dashboard)/components/monev-sync-panel";
import { fetchExternal } from "@/app/api/wsstatistik/utils";
import {
  bacaBundleDariDb,
  bacaSemesterDariDb,
  statistikLokal,
  type MonevBundleLokal,
} from "@/lib/monev-store";
import type { SemesterApi, SemesterPayload } from "@/lib/monev-types";

export const metadata: Metadata = {
  title: "Statistik Kuesioner",
  description:
    "Tampilan statistik utama yang diambil dari layanan wsstatistik.",
};

export const dynamic = "force-dynamic";

export default async function WsStatistikPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [semesterLokal, statistik] = await Promise.all([
    bacaSemesterDariDb(),
    statistikLokal(),
  ]);
  const semester =
    semesterLokal ?? (await fetchExternal<SemesterPayload>("semester"));

  const daftar: SemesterApi[] = Array.isArray(semester?.data)
    ? semester.data
    : [];
  const aktif =
    daftar.find((s) => s?.aktif) ??
    daftar.find((s) => s?.tersedia) ??
    daftar[0];
  const idSmt = String(aktif?.id_smt ?? "");

  const bundleLokal = idSmt ? await bacaBundleDariDb(idSmt) : null;
  const adaLokal = Boolean(
    bundleLokal?.tabdosen ||
    bundleLokal?.tabmhs ||
    bundleLokal?.tabmhspro ||
    bundleLokal?.tabmhsunit
  );
  const initialBundle = adaLokal
    ? bundleLokal
    : {
        tabdosen: await fetchExternal("tabdosen", { id_smt: idSmt }),
        tabmhs: await fetchExternal("tabmhs", { id_smt: idSmt }),
        tabmhspro: await fetchExternal("tabmhspro", { id_smt: idSmt }),
        tabmhsunit: await fetchExternal("tabmhsunit", { id_smt: idSmt }),
      };

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
        initialBundle={initialBundle as MonevBundleLokal}
        sumberAwal={adaLokal ? "lokal" : "eksternal"}
        syncPanel={
          <MonevSyncPanel
            idSmt={idSmt}
            semesterNama={aktif?.nama ?? idSmt}
            statistik={statistik}
            bisaSinkron={isLpmAdmin(user.role)}
          />
        }
      />
    </div>
  );
}

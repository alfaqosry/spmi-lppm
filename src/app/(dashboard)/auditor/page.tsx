import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserCheck } from "lucide-react";
import { getCurrentUser, isLpmAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { getAuditorManagementData } from "@/lib/actions/auditors";
import { AuditorManager } from "@/components/auditor/auditor-manager";

export const metadata: Metadata = {
  title: "Manajemen Auditor",
  description:
    "Kelola akun auditor dan penugasan tim audit independen (2 auditor per unit) per siklus SPMI.",
};

export default async function AuditorPage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isLpmAdmin(user.role)) redirect("/dashboard");

  const { cycleId } = await searchParams;
  const requestedCycleId = cycleId ? parseInt(cycleId, 10) : undefined;
  const data = await getAuditorManagementData(
    Number.isFinite(requestedCycleId) ? requestedCycleId : undefined
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCheck}
        title="Manajemen Auditor SPMI"
        description="Kelola akun auditor independen dan penugasan 2 orang auditor per unit audit kerja per siklus, dengan penegakan aturan pencegahan konflik kepentingan."
      />

      <AuditorManager data={data} />
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { UnitManager } from "@/components/units/unit-manager";

export const metadata: Metadata = {
  title: "Unit Audit",
  description: "Kelola unit audit: program studi, biro, pusat, dan lembaga.",
};

export default async function UnitPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "lpm_admin" && user.role !== "superadmin")
    redirect("/dashboard");

  const [units, evidence] = await Promise.all([
    prisma.unit.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            users: true,
            memberships: true,
            responses: true,
            progress: true,
            scopedQuestions: true,
          },
        },
      },
    }),
    // Ringkasan dampak hapus unit (HE-05): jumlah berkas bukti per unit.
    prisma.auditResponse.groupBy({
      by: ["unitId"],
      where: { evidenceFile: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const evidencePerUnit = new Map(
    evidence.map((e) => [e.unitId, e._count._all])
  );

  return (
    <div>
      <PageHeader
        icon={Building2}
        title="Manajemen Unit Audit"
        description="Kelola unit audit (Prodi, Warek, Pusat, Biro, dll.). Untuk mengatur akun dan penempatannya, gunakan menu Role & Penempatan."
      />
      <UnitManager
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          category: u.category,
          description: u.description ?? "",
          userCount: u._count.users,
          impact: {
            memberships: u._count.memberships,
            responses: u._count.responses,
            progress: u._count.progress,
            scopedQuestions: u._count.scopedQuestions,
            evidence: evidencePerUnit.get(u.id) ?? 0,
          },
        }))}
      />
    </div>
  );
}

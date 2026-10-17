import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserCog } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { AccountManager } from "@/components/accounts/account-manager";

export const metadata: Metadata = {
  title: "Role & Penempatan",
  description: "Kelola akun pengguna, peran, dan penempatan pada unit audit.",
};

export default async function RolePenempatanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "lpm_admin" && user.role !== "superadmin")
    redirect("/dashboard");

  const [units, users] = await Promise.all([
    prisma.unit.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    }),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: {
        unit: { select: { name: true } },
        memberships: { select: { unitId: true, role: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        icon={UserCog}
        title="Manajemen Role & Penempatan"
        description="Kelola akun pengguna beserta perannya: Kepala Unit, Anggota Unit, Admin LPM, Anggota LPM, dan Pengunjung (Tamu). Tentukan juga penempatan akun pada masing-masing unit, atau hapus akun yang tidak diperlukan. Satu Admin LPM dapat ditunjuk sebagai Ketua LPM yang menandatangani dokumen laporan."
      />
      <AccountManager
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          category: u.category,
          description: u.description ?? "",
          userCount: u._count.users,
        }))}
        accounts={users.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          unitId: a.unitId,
          unitName: a.unit?.name ?? null,
          isActive: a.isActive,
          isSso: !a.password,
          isLpmHead: a.isLpmHead,
          memberships: a.memberships.map((m) => ({
            unitId: m.unitId,
            role: m.role === "head" ? ("head" as const) : ("member" as const),
          })),
        }))}
      />
    </div>
  );
}

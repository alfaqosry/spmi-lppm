import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { CycleManager } from "@/components/cycles/cycle-manager";
import { isCycleOpen } from "@/lib/cycles";

export const metadata = { title: "Siklus & Periode — SPMI" };

export default async function SiklusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "lpm_admin" && user.role !== "superadmin")
    redirect("/dashboard");

  const cycles = await prisma.auditCycle.findMany({
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    include: { _count: { select: { questions: true, documents: true } } },
  });

  return (
    <div>
      <PageHeader
        icon={CalendarClock}
        title="Manajemen Siklus & Periode Audit"
        description="Kelola periode audit multi-tahun, tetapkan batas waktu, dan aktifkan siklus berjalan."
      />
      <CycleManager
        cycles={cycles.map((c) => ({
          id: c.id,
          name: c.name,
          startDate: c.startDate.toISOString().slice(0, 10),
          endDate: c.endDate.toISOString().slice(0, 10),
          isActive: c.isActive,
          open: isCycleOpen(c),
          questions: c._count.questions,
          documents: c._count.documents,
        }))}
      />
    </div>
  );
}

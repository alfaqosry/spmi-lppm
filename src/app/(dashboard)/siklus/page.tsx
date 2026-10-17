import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import { CycleManager } from "@/components/cycles/cycle-manager";
import { endOfCycleDay, isCycleOpen } from "@/lib/cycles";

export const metadata: Metadata = {
  title: "Siklus & Periode",
  description: "Kelola siklus dan periode audit mutu internal.",
};

export default async function SiklusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "lpm_admin" && user.role !== "superadmin")
    redirect("/dashboard");

  const [cycles, unitResponses, evidence] = await Promise.all([
    prisma.auditCycle.findMany({
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
      include: {
        _count: {
          select: {
            questions: true,
            documents: true,
            standards: true,
            responses: true,
          },
        },
      },
    }),
    // Ringkasan dampak hapus siklus (HE-04): unit yang punya jawaban.
    prisma.auditResponse.groupBy({ by: ["cycleId", "unitId"] }),
    prisma.auditResponse.groupBy({
      by: ["cycleId"],
      where: { evidenceFile: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const unitsPerCycle = new Map<number, number>();
  for (const r of unitResponses) {
    unitsPerCycle.set(r.cycleId, (unitsPerCycle.get(r.cycleId) ?? 0) + 1);
  }
  const evidencePerCycle = new Map(
    evidence.map((e) => [e.cycleId, e._count._all])
  );
  const now = new Date();

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
          open: isCycleOpen(c, now),
          expired: now.getTime() >= endOfCycleDay(c.endDate).getTime(),
          questions: c._count.questions,
          documents: c._count.documents,
          standards: c._count.standards,
          responses: c._count.responses,
          units: unitsPerCycle.get(c.id) ?? 0,
          evidence: evidencePerCycle.get(c.id) ?? 0,
        }))}
      />
    </div>
  );
}

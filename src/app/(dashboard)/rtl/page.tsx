import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileEdit } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import {
  AuditorAuditWorkspace,
  type FindingRow,
  type AuditorSignatureInfo,
} from "@/components/auditor/auditor-audit-workspace";
import type {
  QuestionRow,
  ResponseRow,
} from "@/components/audit/audit-workspace";

export const metadata: Metadata = {
  title: "Rapat Tindak Lanjut (RTL)",
  description:
    "Kelola temuan, akar masalah, rencana tindak lanjut, dan efektivitas tindak lanjut untuk seluruh unit audit.",
};

export default async function RtlPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Hanya kepala LPM atau LPM admin/member yang boleh akses
  const isLpmRole =
    user.role === "lpm_admin" ||
    user.role === "lpm_member" ||
    user.role === "superadmin";
  if (!isLpmRole && !user.isLpmHead) redirect("/dashboard");

  const { unitId: unitIdParam } = await searchParams;
  const selectedUnitId = unitIdParam ? parseInt(unitIdParam, 10) : undefined;

  const activeCycle = await prisma.auditCycle.findFirst({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
  });

  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={FileEdit}
          title="Rapat Tindak Lanjut (RTL)"
          description="Kelola temuan dan tindak lanjut hasil audit."
        />
        <div className="card p-10 text-center text-sm text-slate-400">
          Tidak ada siklus audit yang sedang aktif.
        </div>
      </div>
    );
  }

  // Ambil semua unit
  const allUnits = await prisma.unit.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true },
  });

  // Unit yang dipilih — default ke unit pertama
  const targetUnitId =
    selectedUnitId && allUnits.some((u) => u.id === selectedUnitId)
      ? selectedUnitId
      : allUnits[0]?.id;

  const targetUnit = allUnits.find((u) => u.id === targetUnitId);

  if (!targetUnit) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={FileEdit}
          title="Rapat Tindak Lanjut (RTL)"
          description=""
        />
        <div className="card p-10 text-center text-sm text-slate-400">
          Belum ada unit terdaftar.
        </div>
      </div>
    );
  }

  // Ambil data untuk unit yang dipilih
  const [questions, responses, findings, allUnitAuditors, lpmHead, statuses] =
    await Promise.all([
      prisma.auditQuestion.findMany({
        where: { cycleId: activeCycle.id },
        include: {
          standard: { select: { id: true, name: true, order: true } },
        },
        orderBy: [
          { standard: { order: "asc" } },
          { order: "asc" },
          { id: "asc" },
        ],
      }),
      prisma.auditResponse.findMany({
        where: { cycleId: activeCycle.id, unitId: targetUnit.id },
        orderBy: [{ id: "asc" }],
      }),
      prisma.auditorFinding.findMany({
        where: { cycleId: activeCycle.id, unitId: targetUnit.id },
      }),
      prisma.unitAuditor.findMany({
        where: { cycleId: activeCycle.id, unitId: targetUnit.id },
        select: {
          role: true,
          user: { select: { id: true, name: true } },
        },
      }),
      prisma.user.findFirst({
        where: { isLpmHead: true, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.auditorAuditStatus.findMany({
        where: { cycleId: activeCycle.id, unitId: targetUnit.id },
      }),
    ]);

  const questionRows: QuestionRow[] = questions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    standardId: q.standardId,
    standardName: q.standard.name,
    order: q.order,
    scopeType: q.scopeType,
    scopeCategory: q.scopeCategory,
    scopeUnitId: q.scopeUnitId,
  }));

  const responseRows: ResponseRow[] = responses.map((r) => ({
    id: r.id,
    auditQuestionId: r.auditQuestionId,
    unitId: r.unitId,
    unitName: targetUnit.name,
    unitCategory: targetUnit.category,
    questionText: "",
    answer: r.answer,
    evidenceFile: r.evidenceFile,
    evidenceLink: r.evidenceLink,
    reason: r.reason,
    status: r.status,
    lpmNotes: r.lpmNotes,
    rtl: r.rtl,
    targetDate: r.targetDate ?? null,
    verifierName: null,
  }));

  const findingRows: FindingRow[] = findings.map((f) => ({
    id: f.id,
    cycleId: f.cycleId,
    unitId: f.unitId,
    auditQuestionId: f.auditQuestionId,
    temuan: f.temuan ?? "",
    akarMasalah: f.akarMasalah ?? "",
    rencanaTL: f.rencanaTL ?? "",
    efektivitasTL: f.efektivitasTL ?? "",
  }));

  const lead = allUnitAuditors.find((a) => a.role === "lead");
  const member = allUnitAuditors.find((a) => a.role === "member");

  const signature: AuditorSignatureInfo = {
    auditor1: lead
      ? { name: lead.user.name, role: "Auditor 1 / Ketua Tim" }
      : null,
    auditor2: member
      ? { name: member.user.name, role: "Auditor 2 / Anggota Tim" }
      : null,
    lpmHead: lpmHead ? { name: lpmHead.name } : null,
  };

  const finalizedUnitIds = statuses
    .filter((s) => s.finalized)
    .map((s) => s.unitId);

  // Assignment sintetis — LPM bisa edit semua unit tanpa penugasan formal
  const syntheticAssignments = [
    {
      unitId: targetUnit.id,
      role: "lead",
      unit: targetUnit,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileEdit}
        title="Rapat Tindak Lanjut (RTL)"
        description={`Siklus: ${activeCycle.name} — kelola temuan dan tindak lanjut seluruh unit.`}
      />

      {/* Pemilih unit */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-sm font-medium text-slate-400 shrink-0">
          Unit yang dilihat:
        </span>
        <div className="flex flex-wrap gap-2 flex-1">
          {allUnits.map((u) => (
            <a
              key={u.id}
              href={`/rtl?unitId=${u.id}`}
              className={[
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors",
                u.id === targetUnit.id
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-on-accent border-transparent shadow-sm"
                  : "border-[var(--border)] text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40",
              ].join(" ")}
            >
              {u.name}
            </a>
          ))}
        </div>
      </div>

      <AuditorAuditWorkspace
        cycleId={activeCycle.id}
        cycleName={activeCycle.name}
        assignments={syntheticAssignments}
        questions={questionRows}
        responses={responseRows}
        findings={findingRows}
        finalizedUnitIds={finalizedUnitIds}
        signatureByUnit={{ [targetUnit.id]: signature }}
        auditorId={user.id}
        isLpmView
      />
    </div>
  );
}

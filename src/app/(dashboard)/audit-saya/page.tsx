import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
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
  title: "Audit Saya",
  description:
    "Lembar temuan audit — isi temuan, akar masalah, rencana tindak lanjut, dan efektivitas tindak lanjut untuk setiap unit yang Anda ditugaskan.",
};

export default async function AuditSayaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "auditor") redirect("/dashboard");

  const activeCycle = await prisma.auditCycle.findFirst({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
  });

  if (!activeCycle) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={ClipboardCheck}
          title="Audit Saya"
          description="Lembar temuan audit berdasarkan unit yang Anda ditugaskan."
        />
        <div className="card p-10 text-center text-sm text-slate-400">
          Tidak ada siklus audit yang sedang aktif. Hubungi LPM untuk informasi
          lebih lanjut.
        </div>
      </div>
    );
  }

  const assignments = await prisma.unitAuditor.findMany({
    where: { userId: user.id, cycleId: activeCycle.id },
    select: {
      unitId: true,
      role: true,
      unit: { select: { id: true, name: true, category: true } },
    },
  });

  if (assignments.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={ClipboardCheck}
          title="Audit Saya"
          description={`Siklus: ${activeCycle.name}`}
        />
        <div className="card p-10 text-center text-sm text-slate-400">
          Anda belum ditugaskan ke unit mana pun pada siklus ini. Hubungi Admin
          LPM.
        </div>
      </div>
    );
  }

  const unitIds = assignments.map((a) => a.unitId);

  // Ambil semua data sekaligus
  const [questions, responses, findings, statuses, lpmHead] = await Promise.all(
    [
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
        where: { cycleId: activeCycle.id, unitId: { in: unitIds } },
        orderBy: [{ unitId: "asc" }, { id: "asc" }],
      }),
      prisma.auditorFinding.findMany({
        where: { cycleId: activeCycle.id, unitId: { in: unitIds } },
      }),
      prisma.auditorAuditStatus.findMany({
        where: {
          cycleId: activeCycle.id,
          unitId: { in: unitIds },
          auditorId: user.id,
        },
      }),
      prisma.user.findFirst({
        where: { isLpmHead: true, isActive: true },
        select: { id: true, name: true },
      }),
    ]
  );

  // Untuk setiap unit, cari auditor rekan (lead + member)
  const allUnitAuditors = await prisma.unitAuditor.findMany({
    where: { cycleId: activeCycle.id, unitId: { in: unitIds } },
    select: {
      unitId: true,
      role: true,
      user: { select: { id: true, name: true } },
    },
  });

  // Bangun map: unitId -> { lead, member }
  const auditorByUnit: Record<
    number,
    {
      lead?: { id: number; name: string };
      member?: { id: number; name: string };
    }
  > = {};
  for (const a of allUnitAuditors) {
    if (!auditorByUnit[a.unitId]) auditorByUnit[a.unitId] = {};
    if (a.role === "lead") auditorByUnit[a.unitId].lead = a.user;
    if (a.role === "member") auditorByUnit[a.unitId].member = a.user;
  }

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
    unitName: "",
    unitCategory: "",
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

  // Status finalisasi per unit
  const finalizedUnitIds = new Set(
    statuses.filter((s) => s.finalized).map((s) => s.unitId)
  );

  // Signature info per unit
  const signatureByUnit: Record<number, AuditorSignatureInfo> = {};
  for (const asg of assignments) {
    const auditors = auditorByUnit[asg.unitId] ?? {};
    signatureByUnit[asg.unitId] = {
      auditor1: auditors.lead
        ? { name: auditors.lead.name, role: "Auditor 1 / Ketua Tim" }
        : null,
      auditor2: auditors.member
        ? { name: auditors.member.name, role: "Auditor 2 / Anggota Tim" }
        : null,
      lpmHead: lpmHead ? { name: lpmHead.name } : null,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardCheck}
        title="Audit Saya"
        description={`Siklus: ${activeCycle.name} — isi temuan untuk ${assignments.length} unit yang Anda ditugaskan.`}
      />
      <AuditorAuditWorkspace
        cycleId={activeCycle.id}
        cycleName={activeCycle.name}
        unitCategory={assignments[0]?.unit.category ?? ""}
        assignments={assignments}
        questions={questionRows}
        responses={responseRows}
        findings={findingRows}
        finalizedUnitIds={Array.from(finalizedUnitIds)}
        signatureByUnit={signatureByUnit}
        auditorId={user.id}
      />
    </div>
  );
}

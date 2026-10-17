import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unitIdsOf, isHeadOfUnit } from "@/lib/auth";
import { PageHeader } from "@/components/ui/primitives";
import {
  AdminAuditWorkspace,
  AuditeeAuditWorkspace,
  type QuestionRow,
  type ResponseRow,
  type StandardRow,
} from "@/components/audit/audit-workspace";
import { cycleDeadline } from "@/components/audit/audit-helpers";
import { DeadlineBanner } from "@/components/audit/deadline-banner";

export const metadata: Metadata = {
  title: "Audit & Verifikasi",
  description:
    "Pengisian instrumen audit oleh unit dan verifikasi bukti oleh LPM.",
};

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isLpm =
    user.role === "lpm_admin" ||
    user.role === "lpm_member" ||
    user.role === "superadmin";

  const cycles = await prisma.auditCycle.findMany({
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
  });
  // LPM boleh melihat siklus terakhir walau nonaktif (untuk verifikasi arsip);
  // auditee HANYA boleh mengisi siklus yang sedang aktif.
  const activeCycle = isLpm
    ? (cycles.find((c) => c.isActive) ?? cycles[0] ?? null)
    : (cycles.find((c) => c.isActive) ?? null);

  if (!activeCycle) {
    return (
      <div>
        <PageHeader
          icon={ClipboardList}
          title="Audit & Verifikasi"
          description="Belum ada siklus audit."
        />
        <div className="card p-8 text-center text-sm text-slate-400">
          {isLpm
            ? "Buat siklus audit terlebih dahulu pada menu Siklus & Periode."
            : "Tidak ada siklus audit yang sedang aktif. Pengisian jawaban dibuka hanya ketika LPM mengaktifkan siklus. Silakan hubungi LPM."}
        </div>
      </div>
    );
  }

  const [units, standards, questions] = await Promise.all([
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.auditStandard.findMany({
      where: { cycleId: activeCycle.id },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { _count: { select: { questions: true } } },
    }),
    prisma.auditQuestion.findMany({
      where: { cycleId: activeCycle.id },
      include: { standard: { select: { id: true, name: true, order: true } } },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
  ]);

  const standardRows: StandardRow[] = standards.map((s) => ({
    id: s.id,
    name: s.name,
    order: s.order,
    questionCount: s._count.questions,
  }));

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

  const unitOptions = units.map((u) => ({
    id: u.id,
    name: u.name,
    category: u.category,
  }));

  if (
    user.role === "lpm_admin" ||
    user.role === "lpm_member" ||
    user.role === "superadmin"
  ) {
    const responses = await prisma.auditResponse.findMany({
      where: { cycleId: activeCycle.id },
      include: {
        unit: { select: { id: true, name: true, category: true } },
        question: { select: { questionText: true } },
        verifier: { select: { name: true } },
      },
      orderBy: [{ unit: { name: "asc" } }, { id: "asc" }],
    });

    const responseRows: ResponseRow[] = responses.map((r) => ({
      id: r.id,
      auditQuestionId: r.auditQuestionId,
      unitId: r.unitId,
      unitName: r.unit.name,
      unitCategory: r.unit.category,
      questionText: r.question.questionText,
      answer: r.answer,
      evidenceFile: r.evidenceFile,
      evidenceLink: r.evidenceLink,
      reason: r.reason,
      status: r.status,
      lpmNotes: r.lpmNotes,
      rtl: r.rtl,
      verifierName: r.verifier?.name ?? null,
    }));

    return (
      <div>
        <PageHeader
          icon={ClipboardList}
          title="Audit & Verifikasi"
          description={`Siklus: ${activeCycle.name} — kelola instrumen per kategori unit dan verifikasi jawaban auditee.`}
        />
        <AdminAuditWorkspace
          cycleId={activeCycle.id}
          cycleName={activeCycle.name}
          questions={questionRows}
          standards={standardRows}
          responses={responseRows}
          units={unitOptions}
        />
      </div>
    );
  }

  // Unit-unit tempat auditee ditempatkan (mendukung rangkap jabatan).
  const myUnitIds = unitIdsOf(user);
  const myUnits = units
    .filter((u) => myUnitIds.includes(u.id))
    .map((u) => ({
      id: u.id,
      name: u.name,
      category: u.category,
      isHead: isHeadOfUnit(user, u.id),
    }));

  const responses = await prisma.auditResponse.findMany({
    where: {
      cycleId: activeCycle.id,
      unitId: { in: myUnitIds.length ? myUnitIds : [-1] },
    },
  });

  const responseRows: ResponseRow[] = responses.map((r) => {
    const u = units.find((x) => x.id === r.unitId);
    return {
      id: r.id,
      auditQuestionId: r.auditQuestionId,
      unitId: r.unitId,
      unitName: u?.name ?? "",
      unitCategory: u?.category ?? "",
      questionText:
        questionRows.find((q) => q.id === r.auditQuestionId)?.questionText ??
        "",
      answer: r.answer,
      evidenceFile: r.evidenceFile,
      evidenceLink: r.evidenceLink,
      reason: r.reason,
      status: r.status,
      lpmNotes: r.lpmNotes,
      rtl: r.rtl,
      verifierName: null,
    };
  });

  // Status keterbukaan siklus (aktif & belum lewat batas waktu).
  // HE-01: batas pengisian (WIB) + sisa hari ditampilkan kepada auditee.
  const deadline = cycleDeadline(activeCycle);
  const cycleOpen = deadline.state !== "closed";
  const canAnswer =
    (user.role === "auditee_head" || user.role === "auditee_member") &&
    cycleOpen;

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        title="Audit & Verifikasi"
        description={`Siklus: ${activeCycle.name}${
          myUnits.length > 1
            ? ` — Anda ditempatkan pada ${myUnits.length} unit`
            : myUnits[0]
              ? ` — Unit: ${myUnits[0].name}`
              : ""
        }`}
      />
      <DeadlineBanner deadline={deadline} />
      <AuditeeAuditWorkspace
        cycleId={activeCycle.id}
        cycleName={activeCycle.name}
        myUnits={myUnits}
        questions={questionRows}
        responses={responseRows}
        units={unitOptions}
        canEdit={canAnswer}
      />
    </div>
  );
}

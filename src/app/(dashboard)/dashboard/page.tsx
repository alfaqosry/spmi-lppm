import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, unitIdsOf } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  Percent,
  TrendingUp,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Badge,
  ProgressBar,
} from "@/components/ui/primitives";
import { DashboardChartsLazy } from "@/components/dashboard/dashboard-charts-lazy";
import { percent, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import { isQuestionForUnit } from "@/lib/scope";
import { ExportPdfButton } from "@/components/reports/export-pdf-button";
import {
  describeDeadline,
  type DeadlineInfo,
} from "@/components/dashboard/deadline";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Ringkasan progres pengisian, kepatuhan, dan verifikasi audit mutu internal pada siklus aktif.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const activeCycle = await prisma.auditCycle.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (
    user.role !== "lpm_admin" &&
    user.role !== "lpm_member" &&
    user.role !== "superadmin"
  ) {
    return (
      <AuditeeDashboard
        unitIds={unitIdsOf(user)}
        cycleId={activeCycle?.id ?? null}
        cycleName={activeCycle?.name ?? "-"}
        deadline={activeCycle ? describeDeadline(activeCycle) : null}
      />
    );
  }

  const [totalUnits, totalCycles, totalQuestions, responses] =
    await Promise.all([
      prisma.unit.count(),
      prisma.auditCycle.count(),
      activeCycle
        ? prisma.auditQuestion.count({ where: { cycleId: activeCycle.id } })
        : Promise.resolve(0),
      activeCycle
        ? prisma.auditResponse.findMany({
            where: { cycleId: activeCycle.id },
            select: { answer: true, status: true },
          })
        : Promise.resolve([]),
    ]);

  const answered = responses.filter((r) => r.answer !== null).length;
  const yaCount = responses.filter((r) => r.answer === "ya").length;
  const tidakCount = responses.filter((r) => r.answer === "tidak").length;
  const verified = responses.filter((r) => r.status === "verified").length;
  const pending = responses.filter((r) => r.status === "pending").length;
  const revision = responses.filter((r) => r.status === "revision").length;

  const units = await prisma.unit.findMany({
    include: {
      progress: activeCycle
        ? { where: { cycleId: activeCycle.id } }
        : undefined,
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });

  // Total penilaian memperhitungkan cakupan: hanya pertanyaan relevan per unit.
  const allQuestions = activeCycle
    ? await prisma.auditQuestion.findMany({
        where: { cycleId: activeCycle.id },
        select: {
          id: true,
          scopeType: true,
          scopeCategory: true,
          scopeUnitId: true,
        },
      })
    : [];
  const totalPossible = units.reduce(
    (acc, u) =>
      acc + allQuestions.filter((q) => isQuestionForUnit(q, u)).length,
    0
  );
  const overall = percent(answered, totalPossible);

  const categoryMap = new Map<string, { total: number; done: number }>();
  for (const u of units) {
    const entry = categoryMap.get(u.category) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (u.progress?.[0]?.status === "selesai") entry.done += 1;
    categoryMap.set(u.category, entry);
  }
  const categoryData = Array.from(categoryMap.entries()).map(([name, v]) => ({
    name,
    selesai: v.done,
    belum: v.total - v.done,
    persen: percent(v.done, v.total),
  }));

  const statusData = [
    {
      name: "Belum Mulai",
      value: units.filter(
        (u) => !u.progress?.[0] || u.progress[0].status === "belum_mulai"
      ).length,
      color: "#94a3b8",
    },
    {
      name: "Mengisi",
      value: units.filter((u) => u.progress?.[0]?.status === "mengisi").length,
      color: "#f59e0b",
    },
    {
      name: "Selesai",
      value: units.filter((u) => u.progress?.[0]?.status === "selesai").length,
      color: "#10b981",
    },
  ];

  const answerData = [
    { name: "Ya", value: yaCount, color: "#6366f1" },
    { name: "Tidak", value: tidakCount, color: "#f43f5e" },
    {
      name: "Belum dijawab",
      value: Math.max(totalPossible - answered, 0),
      color: "#64748b",
    },
  ];

  const verificationData = [
    { name: "Terverifikasi", value: verified, color: "#10b981" },
    { name: "Menunggu", value: pending, color: "#f59e0b" },
    { name: "Revisi", value: revision, color: "#f43f5e" },
  ];

  return (
    <div>
      <PageHeader
        icon={TrendingUp}
        title="Dashboard Monitoring & Analisis"
        description={
          activeCycle
            ? `Siklus aktif: ${activeCycle.name}`
            : "Belum ada siklus audit aktif."
        }
        actions={
          <Badge
            className={
              activeCycle
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-400/30 bg-amber-500/10 text-amber-300"
            }
          >
            {activeCycle ? "Siklus Aktif" : "Tidak Ada Siklus Aktif"}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Unit"
          value={totalUnits}
          icon={Building2}
          hint={`${totalCycles} siklus tercatat`}
        />
        <StatCard
          label="Butir Pertanyaan"
          value={totalQuestions}
          icon={CalendarClock}
          tone="sky"
          hint={`${totalUnits} unit diaudit`}
        />
        <StatCard
          label="Jawaban Terisi"
          value={`${answered}/${totalPossible}`}
          icon={ClipboardCheck}
          tone="amber"
          hint={`${yaCount} Ya • ${tidakCount} Tidak`}
        />
        <StatCard
          label="Kepatuhan (Ya)"
          value={`${percent(yaCount, answered)}%`}
          icon={Percent}
          tone="emerald"
          hint={`${verified} terverifikasi`}
        />
      </div>

      <div className="mt-5">
        <DashboardChartsLazy
          categoryData={categoryData}
          statusData={statusData}
          answerData={answerData}
          verificationData={verificationData}
          overall={overall}
        />
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className="border-b border-indigo-400/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">
            Progres Pengisian per Unit
          </h2>
          <p className="text-xs text-slate-400">
            Pelacakan real-time status pengisian audit setiap unit.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">
              Progres pengisian audit per unit
            </caption>
            <thead>
              <tr className="border-b border-indigo-400/10 text-xs uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Unit
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Kategori
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Akun
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const status = u.progress?.[0]?.status ?? "belum_mulai";
                return (
                  <tr
                    key={u.id}
                    className="border-b border-slate-500/15 last:border-0 hover:bg-slate-500/[0.08]"
                  >
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{u.category}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {u._count.users} pengguna
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_STYLE[status]}>
                        {STATUS_LABEL[status]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {units.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Belum ada unit terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

async function AuditeeDashboard({
  unitIds,
  cycleId,
  cycleName,
  deadline,
}: {
  unitIds: number[];
  cycleId: number | null;
  cycleName: string;
  deadline: DeadlineInfo | null;
}) {
  if (unitIds.length === 0 || !cycleId) {
    return (
      <div>
        <PageHeader
          icon={TrendingUp}
          title="Dashboard"
          description="Ringkasan pengisian audit unit Anda."
        />
        <div className="card p-8 text-center text-sm text-slate-400">
          Unit Anda belum ditugaskan atau belum ada siklus audit aktif. Hubungi
          LPM di{" "}
          <a
            className="text-indigo-300 underline"
            href="mailto:lpm@universitaspahlawan.ac.id"
          >
            lpm@universitaspahlawan.ac.id
          </a>{" "}
          bila Anda merasa ini keliru.
        </div>
      </div>
    );
  }

  const [units, questions, answered, ya, tidak, verified, revision] =
    await Promise.all([
      prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, name: true, category: true },
        orderBy: { name: "asc" },
      }),
      prisma.auditQuestion.findMany({
        where: { cycleId },
        select: { scopeType: true, scopeCategory: true, scopeUnitId: true },
      }),
      prisma.auditResponse.count({
        where: { cycleId, unitId: { in: unitIds }, answer: { not: null } },
      }),
      prisma.auditResponse.count({
        where: { cycleId, unitId: { in: unitIds }, answer: "ya" },
      }),
      prisma.auditResponse.count({
        where: { cycleId, unitId: { in: unitIds }, answer: "tidak" },
      }),
      prisma.auditResponse.count({
        where: { cycleId, unitId: { in: unitIds }, status: "verified" },
      }),
      prisma.auditResponse.count({
        where: { cycleId, unitId: { in: unitIds }, status: "revision" },
      }),
    ]);

  // Total pertanyaan relevan lintas seluruh unit pengguna.
  const totalQuestions = units.reduce(
    (acc, u) => acc + questions.filter((q) => isQuestionForUnit(q, u)).length,
    0
  );

  return (
    <div>
      <PageHeader
        icon={TrendingUp}
        title="Dashboard Unit"
        description={`Progres pengisian audit — ${cycleName}${
          units.length > 1 ? ` • ${units.length} unit` : ""
        }`}
      />
      {deadline && <DeadlinePanel deadline={deadline} />}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Pertanyaan"
          value={totalQuestions}
          icon={CalendarClock}
          tone="sky"
        />
        <StatCard
          label="Terjawab"
          value={`${answered}/${totalQuestions}`}
          icon={ClipboardCheck}
          tone="amber"
          hint={`${percent(answered, totalQuestions)}% selesai`}
        />
        <StatCard
          label="Jawaban Ya"
          value={ya}
          icon={Percent}
          tone="emerald"
          hint={`${tidak} Tidak`}
        />
        <StatCard
          label="Perlu Revisi"
          value={revision}
          icon={TrendingUp}
          tone="rose"
          hint={`${verified} terverifikasi`}
        />
      </div>

      <div className="card mt-5 p-5">
        <h2 className="text-sm font-medium text-slate-200">
          Progres keseluruhan
        </h2>
        <ProgressBar
          value={percent(answered, totalQuestions)}
          label="Progres keseluruhan pengisian audit"
          className="mt-3 h-3 w-full"
        />
        <p className="mt-2 text-xs text-slate-400">
          {percent(answered, totalQuestions)}% pertanyaan telah dijawab.
        </p>
      </div>

      <section
        aria-labelledby="unit-anda"
        className="card mt-5 overflow-hidden"
      >
        <div className="border-b border-indigo-400/10 px-4 py-3">
          <h2 id="unit-anda" className="text-sm font-semibold text-white">
            {units.length > 1 ? "Unit yang Anda isi" : "Unit Anda"}
          </h2>
          <p className="text-xs text-slate-400">
            {units.length > 1
              ? "Anda ditempatkan pada beberapa unit (rangkap jabatan). Unduh laporan audit per unit."
              : "Unduh laporan audit unit Anda pada siklus aktif."}
          </p>
        </div>
        <ul className="divide-y divide-slate-500/15">
          {units.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            >
              <span className="min-w-0 text-sm break-words text-slate-200">
                {u.name}
              </span>
              <span className="flex items-center gap-2">
                <Badge className="border-indigo-400/25 bg-indigo-500/10 text-indigo-300">
                  {u.category}
                </Badge>
                <ExportPdfButton
                  cycleId={cycleId}
                  unitId={u.id}
                  ariaLabel={`Unduh laporan PDF ${u.name}`}
                  align="end"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
                >
                  PDF
                </ExportPdfButton>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Batas waktu pengisian siklus aktif bagi auditee (HE-01). */
function DeadlinePanel({ deadline }: { deadline: DeadlineInfo }) {
  if (deadline.state === "closed") {
    return (
      <div
        role="status"
        className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      >
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/20 text-xs font-bold"
        >
          !
        </span>
        <div>
          <p className="font-semibold">Periode pengisian ditutup</p>
          <p className="mt-0.5 text-xs text-amber-200">
            {deadline.closedReason === "inactive"
              ? "Siklus audit ini telah dinonaktifkan oleh LPM."
              : `Batas pengisian telah berakhir pada ${deadline.deadlineLabel}.`}{" "}
            Anda tidak dapat lagi mengisi jawaban audit. Hubungi LPM bila
            memerlukan perpanjangan.
          </p>
        </div>
      </div>
    );
  }

  const warning = deadline.state === "warning";
  return (
    <div
      className={`mb-4 flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        warning
          ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
          : "border-indigo-400/20 bg-indigo-500/5 text-slate-200"
      }`}
    >
      <CalendarClock
        className={`mt-0.5 h-5 w-5 shrink-0 ${
          warning ? "text-amber-300" : "text-indigo-300"
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p>
          <span className="font-semibold">Batas pengisian:</span>{" "}
          {deadline.deadlineLabel}
        </p>
        {warning && (
          <p className="mt-0.5 text-xs text-amber-200">
            Batas waktu sudah dekat. Segera lengkapi dan perbaiki jawaban audit
            sebelum periode pengisian ditutup.
          </p>
        )}
      </div>
      <Badge
        className={
          warning
            ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
            : "border-indigo-400/25 bg-indigo-500/10 text-indigo-300"
        }
      >
        {warning && <span className="sr-only">Peringatan: </span>}
        {deadline.remainingLabel.charAt(0).toUpperCase() +
          deadline.remainingLabel.slice(1)}
      </Badge>
    </div>
  );
}

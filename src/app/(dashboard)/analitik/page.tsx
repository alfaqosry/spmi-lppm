import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  PageHeader,
  StatCard,
  Badge,
  ProgressBar,
} from "@/components/ui/primitives";
import { AnalyticsChartsLazy } from "@/components/analytics/analytics-charts-lazy";
import { percent, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import { isQuestionForUnit } from "@/lib/scope";
import { CheckCircle2, FileWarning, Percent, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Analitik & Laporan",
  description:
    "Analisis kepatuhan per standar, kategori, dan unit serta ekspor laporan audit PDF.",
};

export default async function AnalitikPage({
  searchParams,
}: {
  searchParams: Promise<{ cycleId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (
    user.role !== "lpm_admin" &&
    user.role !== "lpm_member" &&
    user.role !== "superadmin"
  )
    redirect("/dashboard");

  const params = await searchParams;
  const cycles = await prisma.auditCycle.findMany({
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
  });
  if (cycles.length === 0) {
    return (
      <div>
        <PageHeader
          icon={BarChart3}
          title="Analitik & Laporan"
          description="Belum ada siklus audit."
        />
        <div className="card p-8 text-center text-sm text-slate-400">
          Buat siklus audit terlebih dahulu pada menu{" "}
          <a href="/siklus" className="text-indigo-300 underline">
            Siklus &amp; Periode
          </a>
          .
        </div>
      </div>
    );
  }

  const selectedId =
    Number(params.cycleId) ||
    cycles.find((c) => c.isActive)?.id ||
    cycles[0].id;
  const cycle = cycles.find((c) => c.id === selectedId) ?? cycles[0];

  const [questions, units, responses] = await Promise.all([
    prisma.auditQuestion.findMany({
      where: { cycleId: cycle.id },
      include: { standard: { select: { name: true, order: true } } },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.auditResponse.findMany({
      where: { cycleId: cycle.id },
      include: { unit: true },
    }),
  ]);

  const totalQuestions = questions.length;
  const answered = responses.filter((r) => r.answer).length;
  const ya = responses.filter((r) => r.answer === "ya").length;
  const tidak = responses.filter((r) => r.answer === "tidak").length;
  const verified = responses.filter((r) => r.status === "verified").length;
  const revision = responses.filter((r) => r.status === "revision").length;

  const perUnit = units.map((u) => {
    const rs = responses.filter((r) => r.unitId === u.id);
    const a = rs.filter((r) => r.answer).length;
    const y = rs.filter((r) => r.answer === "ya").length;
    return {
      id: u.id,
      name: u.name,
      category: u.category,
      answered: a,
      total: totalQuestions,
      kepatuhan: a ? Math.round((y / a) * 100) : 0,
      progress: percent(a, totalQuestions),
    };
  });

  // Kepatuhan per standar (induk butir pertanyaan).
  const standardMap = new Map<
    string,
    { qIds: number[]; total: number; order: number }
  >();
  for (const q of questions) {
    const key = q.standard?.name?.trim() || "Tanpa Standar";
    const entry = standardMap.get(key) ?? {
      qIds: [],
      total: 0,
      order: q.standard?.order ?? 0,
    };
    entry.qIds.push(q.id);
    entry.total += units.filter((u) => isQuestionForUnit(q, u)).length;
    standardMap.set(key, entry);
  }
  const perAspect = Array.from(standardMap.entries())
    .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
    .map(([name, v]) => {
      const idSet = new Set(v.qIds);
      const rs = responses.filter(
        (r) => idSet.has(r.auditQuestionId) && r.answer
      );
      const y = rs.filter((r) => r.answer === "ya").length;
      return {
        name,
        title: name,
        kepatuhan: rs.length ? Math.round((y / rs.length) * 100) : 0,
        terjawab: rs.length,
        total: v.total,
      };
    });

  const perCategory = new Map<
    string,
    { ya: number; total: number; units: number }
  >();
  for (const u of units) {
    const entry = perCategory.get(u.category) ?? { ya: 0, total: 0, units: 0 };
    entry.units += 1;
    const rs = responses.filter((r) => r.unitId === u.id && r.answer);
    entry.ya += rs.filter((r) => r.answer === "ya").length;
    entry.total += rs.length;
    perCategory.set(u.category, entry);
  }
  const categoryData = Array.from(perCategory.entries()).map(([name, v]) => ({
    name,
    kepatuhan: v.total ? Math.round((v.ya / v.total) * 100) : 0,
    unit: v.units,
  }));

  return (
    <div>
      <PageHeader
        icon={BarChart3}
        title="Analitik & Laporan Audit"
        description="Analisis kualitas institusi dan ekspor laporan untuk keperluan akreditasi."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="flex flex-wrap items-center gap-2"
              role="search"
              aria-label="Pilih siklus"
            >
              <label htmlFor="cycleId" className="sr-only">
                Siklus audit
              </label>
              <select
                id="cycleId"
                name="cycleId"
                defaultValue={cycle.id}
                className="input-base max-w-[220px]"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isActive ? "(aktif)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="min-h-10 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20"
              >
                Tampilkan
              </button>
            </form>
            <a
              href={`/api/export?cycleId=${cycle.id}`}
              className="flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-on-accent shadow-lg shadow-indigo-900/30 hover:from-indigo-600 hover:to-violet-600"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Unduh Laporan
              PDF
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Unit Diaudit"
          value={units.length}
          icon={Users}
          tone="sky"
        />
        <StatCard
          label="Jawaban Terisi"
          value={`${answered}/${totalQuestions * units.length}`}
          icon={CheckCircle2}
          tone="amber"
        />
        <StatCard
          label="Kepatuhan (Ya)"
          value={`${percent(ya, answered)}%`}
          icon={Percent}
          tone="emerald"
          hint={`${tidak} Tidak`}
        />
        <StatCard
          label="Perlu Revisi"
          value={revision}
          icon={FileWarning}
          tone="rose"
          hint={`${verified} terverifikasi`}
        />
      </div>

      <div className="mt-5">
        <AnalyticsChartsLazy
          perAspect={perAspect}
          categoryData={categoryData}
          answerData={[
            { name: "Ya", value: ya, color: "#6366f1" },
            { name: "Tidak", value: tidak, color: "#f43f5e" },
            {
              name: "Belum",
              value: Math.max(totalQuestions * units.length - answered, 0),
              color: "#64748b",
            },
          ]}
        />
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className="border-b border-indigo-400/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">
            Rekapitulasi Kepatuhan per Unit
          </h2>
          <p className="text-xs text-slate-400">{cycle.name}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">
              Rekapitulasi kepatuhan per unit — {cycle.name}
            </caption>
            <thead>
              <tr className="border-b border-indigo-400/10 text-[11px] uppercase tracking-wide text-slate-400">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Unit
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Kategori
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Progres
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Kepatuhan
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Laporan
                </th>
              </tr>
            </thead>
            <tbody>
              {perUnit.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-500/15 last:border-0 hover:bg-slate-500/[0.08]"
                >
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{u.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={u.progress}
                        label={`Progres ${u.name}`}
                        className="h-2 w-24"
                      />
                      <span className="text-[11px] text-slate-400">
                        {u.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-300">
                    {u.kepatuhan}%
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        STATUS_STYLE[
                          u.progress === 100
                            ? "selesai"
                            : u.progress > 0
                              ? "mengisi"
                              : "belum_mulai"
                        ]
                      }
                    >
                      {
                        STATUS_LABEL[
                          u.progress === 100
                            ? "selesai"
                            : u.progress > 0
                              ? "mengisi"
                              : "belum_mulai"
                        ]
                      }
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/export?cycleId=${cycle.id}&unitId=${u.id}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20"
                      aria-label={`Unduh laporan PDF ${u.name}`}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

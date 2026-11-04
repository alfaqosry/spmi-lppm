"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Building2,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Loader2,
  MessageSquare,
  Trophy,
  Users,
} from "lucide-react";
import { ChartPanel } from "@/components/charts/chart-panel";
import { DosenDetailModal } from "./dosen-detail-modal";

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

const trunc = (s: string, n = 30) =>
  typeof s === "string" && s.length > n ? `${s.slice(0, n - 1)}…` : String(s ?? "");

const SCORE: Record<string, number> = {
  "Sangat Baik": 5,
  Baik: 4,
  "Cukup Baik": 3,
  Cukup: 3,
  "Kurang Baik": 2,
  Kurang: 2,
  "Sangat Kurang": 1,
};

const predikatBadge: Record<string, string> = {
  "Sangat Baik": "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
  Baik: "border-indigo-400/30 bg-indigo-500/15 text-indigo-300",
  "Cukup Baik": "border-amber-400/30 bg-amber-500/15 text-amber-300",
  Cukup: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  Kurang: "border-rose-400/30 bg-rose-500/15 text-rose-300",
  "Sangat Kurang": "border-rose-400/30 bg-rose-500/15 text-rose-300",
};

const PIE_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#f43f5e", "#94a3b8"];

const tooltipStyle = {
  backgroundColor: "var(--modal-bg)",
  border: "1px solid rgba(129,140,248,0.25)",
  borderRadius: "0.75rem",
  fontSize: "12px",
  color: "var(--body-color)",
};

const GRID = "color-mix(in oklab, var(--color-slate-500) 18%, transparent)";
const TICK = { fill: "var(--color-slate-500)", fontSize: 11 } as const;
const LEGEND = { fontSize: 11, color: "var(--color-slate-500)" } as const;

/* ------------------------------------------------------------------ */
/* Sub-komponen                                                        */
/* ------------------------------------------------------------------ */

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "indigo",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  accent?: "indigo" | "emerald" | "amber" | "sky" | "violet";
}) {
  const tone: Record<string, string> = {
    indigo: "border-indigo-400/25 bg-indigo-500/15 text-indigo-300",
    emerald: "border-emerald-400/25 bg-emerald-500/15 text-emerald-300",
    amber: "border-amber-400/25 bg-amber-500/15 text-amber-300",
    sky: "border-sky-400/25 bg-sky-500/15 text-sky-300",
    violet: "border-violet-400/25 bg-violet-500/15 text-violet-300",
  };
  return (
    <div className="card flex items-start gap-3 p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone[accent]}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-semibold leading-tight text-white">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

function Predikat({ value }: { value?: string }) {
  const cls = predikatBadge[value ?? ""] ?? "border-slate-600/40 bg-slate-700/30 text-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {value ?? "-"}
    </span>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-3 mt-8 flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 text-indigo-400" aria-hidden="true" />
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
    </div>
  );
}

function RankingTable({
  rows,
  labelKey,
  subKey,
  emptyText = "Belum ada data.",
  onRowClick,
}: {
  rows: any[];
  labelKey: string;
  subKey?: string;
  emptyText?: string;
  onRowClick?: (row: any) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-6 text-center text-xs text-slate-400">{emptyText}</div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-800/80 backdrop-blur">
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="w-10 px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Nama</th>
              {subKey && <th className="px-3 py-2.5 font-medium">Keterangan</th>}
              <th className="w-40 px-3 py-2.5 font-medium">Nilai</th>
              <th className="w-32 px-3 py-2.5 font-medium">Predikat</th>
              {onRowClick && <th className="w-8 px-2 py-2.5"><span className="sr-only">Detail</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const nilai = num(r.nilai);
              return (
                <tr
                  key={`${r[labelKey]}-${i}`}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(r);
                          }
                        }
                      : undefined
                  }
                  className={`border-t border-slate-700/40 transition-colors hover:bg-indigo-500/5 ${
                    onRowClick
                      ? "cursor-pointer focus-visible:bg-indigo-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-400"
                      : ""
                  }`}
                >
                  <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-200">
                    {r[labelKey]}
                  </td>
                  {subKey && (
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {trunc(r[subKey], 44)}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700/60">
                        <div
                          className="h-full rounded-full bg-indigo-400"
                          style={{ width: `${Math.min(100, (nilai / 5) * 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-slate-300">
                        {nilai.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Predikat value={r.predikat} />
                  </td>
                  {onRowClick && (
                    <td className="px-2 py-2 text-slate-500">
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Komponen utama                                                      */
/* ------------------------------------------------------------------ */

export type MonevBundle = {
  tabdosen: any;
  tabmhs: any;
  tabmhspro: any;
  tabmhsunit: any;
};

export function MonevStats({
  semester,
  initialIdSmt,
  initialBundle,
}: {
  semester: any;
  initialIdSmt: string;
  initialBundle: MonevBundle;
}) {
  const [showAllDosen, setShowAllDosen] = useState(false);
  const [detail, setDetail] = useState<{ idptk: string; nama: string; nilai: number } | null>(
    null,
  );

  const semesters = list(semester?.data);

  const [idSmt, setIdSmt] = useState(initialIdSmt);
  const [bundle, setBundle] = useState<MonevBundle>(initialBundle);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (idSmt === initialIdSmt) {
      setBundle(initialBundle);
      setFetchError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setFetchError(null);

    const q = `?id_smt=${encodeURIComponent(idSmt)}`;
    const grab = (path: string) =>
      fetch(`${path}${q}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

    Promise.all([
      grab("/api/wsstatistik/tabdosen"),
      grab("/api/wsstatistik/tabmhs"),
      grab("/api/wsstatistik/tabmhspro"),
      grab("/api/wsstatistik/tabmhsunit"),
    ]).then(([tabdosen, tabmhs, tabmhspro, tabmhsunit]) => {
      if (!alive) return;
      setBundle({ tabdosen, tabmhs, tabmhspro, tabmhsunit });
      if (!tabdosen && !tabmhs && !tabmhspro && !tabmhsunit) {
        setFetchError("Data semester ini belum tersedia pada layanan kuesioner.");
      }
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [idSmt, initialIdSmt, initialBundle]);

  const { tabdosen, tabmhs, tabmhspro, tabmhsunit } = bundle;

  const data = useMemo(() => {
    const semesterList = list(semester?.data);
    const aktif =
      semesterList.find((s) => String(s?.id_smt) === idSmt) ??
      semesterList.find((s) => s?.aktif) ??
      semesterList[0] ??
      undefined;

    const dosenProdi = [...list(tabdosen?.prodi)].sort(
      (a, b) => num(b.nilai) - num(a.nilai),
    );
    const mhsProdi = [...list(tabmhspro?.prodi)].sort(
      (a, b) => num(b.nilai) - num(a.nilai),
    );
    const mhsUnit = [...list(tabmhsunit?.unit)].sort(
      (a, b) => num(b.nilai) - num(a.nilai),
    );
    const dosen = [...list(tabmhs?.dosen)].sort(
      (a, b) => num(b.nilai) - num(a.nilai),
    );

    // Tren jawaban per semester (semester tanpa jawaban sama sekali dilewati)
    const trend = [...semesterList]
      .reverse()
      .map((s) => {
        const [tahun = "", namaSmt = ""] = String(s.nama ?? "").split(" ");
        const short = tahun.includes("/")
          ? `${tahun.slice(2, 4)}/${tahun.slice(7, 9)} ${namaSmt}`
          : String(s.nama ?? "");
        return {
          name: short.trim(),
          Mahasiswa: num(s.jumlah_jawaban_unit),
          Prodi: num(s.jumlah_jawaban_pro),
          Dosen: num(s.jumlah_jawaban_dosen),
        };
      })
      .filter((t) => t.Mahasiswa + t.Prodi + t.Dosen > 0);

    // Distribusi pilihan jawaban mahasiswa (agregat seluruh pertanyaan)
    const distMap = new Map<string, number>();
    list(tabmhs?.grafik).forEach((q: any) => {
      list(q?.jawaban).forEach((a: any) => {
        distMap.set(a.pilihan, (distMap.get(a.pilihan) ?? 0) + num(a.jlh));
      });
    });
    const distribusi = [...distMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => (SCORE[b.name] ?? 0) - (SCORE[a.name] ?? 0));

    // Skor rata-rata per pertanyaan (mahasiswa) -> cari yang terendah
    const skorPertanyaan = list(tabmhs?.grafik)
      .map((q: any) => {
        let total = 0;
        let bobot = 0;
        list(q?.jawaban).forEach((a: any) => {
          const s = SCORE[a.pilihan] ?? 0;
          total += s * num(a.jlh);
          bobot += num(a.jlh);
        });
        return {
          name: trunc(q?.pertanyaan ?? "-", 46),
          skor: bobot ? total / bobot : 0,
        };
      })
      .filter((x) => x.skor > 0)
      .sort((a, b) => a.skor - b.skor)
      .slice(0, 8)
      .reverse();

    const totalPertanyaan =
      num(tabmhs?.meta?.jumlah_pertanyaan) +
      num(tabdosen?.meta?.jumlah_pertanyaan) +
      num(tabmhspro?.meta?.jumlah_pertanyaan) +
      num(tabmhsunit?.meta?.jumlah_pertanyaan);

    return {
      aktif,
      dosenProdi,
      mhsProdi,
      mhsUnit,
      dosen,
      trend,
      distribusi,
      skorPertanyaan,
      totalPertanyaan,
      jumlahDosenDinilai: num(tabmhs?.meta?.jumlah_dosen),
      jumlahProdiDosen: num(tabdosen?.meta?.jumlah_prodi),
      jumlahProdiMhs: num(tabmhspro?.meta?.jumlah_prodi),
      jumlahUnit: num(tabmhsunit?.meta?.jumlah_unit),
    };
  }, [semester, tabdosen, tabmhs, tabmhspro, tabmhsunit, idSmt]);

  const { aktif } = data;

  const topMhsProdi = data.mhsProdi.slice(0, 10).map((p) => ({
    name: trunc(p.nm_lemb, 26),
    nilai: num(p.nilai),
  }));
  const topDosenProdi = data.dosenProdi.slice(0, 10).map((p) => ({
    name: trunc(p.nm_lemb, 26),
    nilai: num(p.nilai),
  }));
  const unitChart = data.mhsUnit.map((u) => ({
    name: trunc(u.nm_lemb, 22),
    nilai: num(u.nilai),
  }));

  const dosenRows = showAllDosen ? data.dosen : data.dosen.slice(0, 10);

  const adaData =
    data.mhsProdi.length > 0 ||
    data.mhsUnit.length > 0 ||
    data.dosenProdi.length > 0 ||
    data.dosen.length > 0 ||
    data.distribusi.length > 0;

  const opsiSemester = semesters
    .map((s: any) => ({
      id: String(s?.id_smt ?? ""),
      nama: String(s?.nama ?? s?.id_smt ?? ""),
      aktif: Boolean(s?.aktif),
      tersedia: Boolean(
        s?.tersedia ||
          num(s?.jumlah_jawaban_unit) +
            num(s?.jumlah_jawaban_pro) +
            num(s?.jumlah_jawaban_dosen) >
            0,
      ),
    }))
    .filter((s) => s.id);

  const semesterTerpilih = opsiSemester.find((s) => s.id === idSmt);

  return (
    <div className="space-y-6">
      {/* ---------------- Filter ---------------- */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-semester"
            className="text-[11px] font-medium uppercase tracking-wide text-slate-500"
          >
            Filter Semester
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="filter-semester"
              value={idSmt}
              onChange={(e) => setIdSmt(e.target.value)}
              className="input-base w-full min-w-[220px] sm:w-auto"
            >
              {opsiSemester.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                  {s.aktif ? " — aktif" : s.tersedia ? "" : " — belum ada data"}
                </option>
              ))}
            </select>
            {loading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-indigo-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Memuat…
              </span>
            )}
          </div>
          {semesterTerpilih && (
            <p className="text-xs text-slate-400">
              {semesterTerpilih.aktif
                ? "Semester aktif saat ini."
                : semesterTerpilih.tersedia
                  ? "Menampilkan data semester terpilih."
                  : "Belum ada jawaban kuesioner pada semester ini."}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="rounded-full border border-slate-600/40 bg-slate-700/20 px-2.5 py-1">
            {opsiSemester.length} semester tersedia
          </span>
          {aktif?.date_start && (
            <span className="rounded-full border border-slate-600/40 bg-slate-700/20 px-2.5 py-1">
              {String(aktif.date_start).slice(0, 10)} –{" "}
              {String(aktif.date_end).slice(0, 10)}
            </span>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          {fetchError}
        </div>
      )}

      {!loading && !adaData && (
        <div className="card flex flex-col items-center gap-1.5 p-8 text-center">
          <p className="text-sm font-medium text-slate-200">
            Belum ada data jawaban pada semester ini
          </p>
          <p className="text-xs text-slate-400">
            {aktif?.nama ?? idSmt} tidak memiliki jawaban kuesioner. Pilih semester
            lain pada filter di atas.
          </p>
        </div>
      )}

      {adaData && (
        <>
      {/* ---------------- KPI ---------------- */}
      <div
        aria-busy={loading}
        className={`grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${
          loading ? "pointer-events-none opacity-50" : "opacity-100"
        }`}
      >
        <KpiCard
          icon={CalendarRange}
          label="Semester Terpilih"
          value={aktif?.nama ?? "-"}
          hint={
            aktif
              ? `${String(aktif.date_start ?? "").slice(0, 10)} – ${String(
                  aktif.date_end ?? "",
                ).slice(0, 10)}`
              : undefined
          }
          accent="violet"
        />
        <KpiCard
          icon={MessageSquare}
          label="Jawaban Mahasiswa"
          value={fmt(num(aktif?.jumlah_jawaban_unit))}
          hint="Unit layanan"
          accent="indigo"
        />
        <KpiCard
          icon={Users}
          label="Jawaban Dosen"
          value={fmt(num(aktif?.jumlah_jawaban_dosen))}
          hint="Kuesioner dosen"
          accent="emerald"
        />
        <KpiCard
          icon={GraduationCap}
          label="Dosen Dinilai"
          value={fmt(data.jumlahDosenDinilai)}
          hint={`${data.jumlahProdiDosen} prodi`}
          accent="sky"
        />
        <KpiCard
          icon={Building2}
          label="Unit Layanan"
          value={fmt(data.jumlahUnit)}
          hint={`${data.jumlahProdiMhs} prodi terpantau`}
          accent="amber"
        />
        <KpiCard
          icon={ClipboardList}
          label="Total Pertanyaan"
          value={fmt(data.totalPertanyaan)}
          hint="4 instrumen kuesioner"
          accent="indigo"
        />
      </div>

      {/* ---------------- Grafik ---------------- */}
      <div
        aria-busy={loading}
        className={`grid gap-4 transition-opacity lg:grid-cols-2 ${
          loading ? "pointer-events-none opacity-50" : "opacity-100"
        }`}
      >
        <ChartPanel
          title="Tren Jawaban per Semester"
          subtitle="Jumlah jawaban mahasiswa, prodi, dan dosen"
          valueLabel="Jumlah jawaban"
          height="h-72"
          rows={data.trend.map((t) => ({
            label: t.name,
            value: `${fmt(t.Mahasiswa)} (mhs) / ${fmt(t.Dosen)} (dosen)`,
          }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend} margin={{ top: 8, right: 12, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis
                tick={TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmt(v)}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => fmt(Number(v))} />
              <Legend wrapperStyle={LEGEND} />
              <Line
                type="monotone"
                dataKey="Mahasiswa"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="Dosen"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Distribusi Jawaban Mahasiswa"
          subtitle="Agregat seluruh pertanyaan kuesioner"
          valueLabel="Jumlah jawaban"
          height="h-72"
          rows={data.distribusi.map((d) => ({ label: d.name, value: fmt(d.value) }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.distribusi}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={94}
                paddingAngle={3}
                stroke="none"
              >
                {data.distribusi.map((d, i) => (
                  <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => fmt(Number(v))} />
              <Legend wrapperStyle={LEGEND} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Nilai per Prodi — Mahasiswa"
          subtitle="10 prodi dengan nilai tertinggi"
          valueLabel="Nilai"
          height="h-72"
          rows={topMhsProdi.map((p) => ({ label: p.name, value: p.nilai.toFixed(2) }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topMhsProdi}
              margin={{ top: 6, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="name"
                tick={TICK}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={70}
              />
              <YAxis domain={[0, 5]} tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(129,140,248,0.08)" }}
              />
              <Bar dataKey="nilai" name="Nilai" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Nilai per Unit Layanan"
          subtitle="Rata-rata kepuasan mahasiswa terhadap unit"
          valueLabel="Nilai"
          height="h-72"
          rows={unitChart.map((u) => ({ label: u.name, value: u.nilai.toFixed(2) }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={unitChart} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="name"
                tick={TICK}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={64}
              />
              <YAxis domain={[0, 5]} tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(16,185,129,0.08)" }}
              />
              <Bar dataKey="nilai" name="Nilai" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Nilai per Prodi — Dosen"
          subtitle="10 prodi dengan nilai tertinggi (kuesioner dosen)"
          valueLabel="Nilai"
          height="h-72"
          rows={topDosenProdi.map((p) => ({ label: p.name, value: p.nilai.toFixed(2) }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topDosenProdi}
              margin={{ top: 6, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="name"
                tick={TICK}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={70}
              />
              <YAxis domain={[0, 5]} tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(245,158,11,0.08)" }}
              />
              <Bar dataKey="nilai" name="Nilai" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Pertanyaan dengan Skor Terendah"
          subtitle="Prioritas perbaikan (skala 1–5)"
          valueLabel="Skor"
          height="h-72"
          rows={data.skorPertanyaan.map((q) => ({
            label: q.name,
            value: q.skor.toFixed(2),
          }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data.skorPertanyaan}
              margin={{ top: 4, right: 20, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 5]}
                tick={TICK}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={TICK}
                axisLine={false}
                tickLine={false}
                width={150}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(244,63,94,0.08)" }}
              />
              <Bar dataKey="skor" name="Skor" fill="#f43f5e" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      {/* ---------------- Tabel ---------------- */}
      <SectionTitle
        icon={Trophy}
        title="Peringkat Prodi — Kuesioner Mahasiswa"
        description={`${data.mhsProdi.length} prodi terurut berdasarkan nilai`}
      />
      <RankingTable rows={data.mhsProdi} labelKey="nm_lemb" />

      <SectionTitle
        icon={BarChart3}
        title="Peringkat Prodi — Kuesioner Dosen"
        description={`${data.dosenProdi.length} prodi terurut berdasarkan nilai`}
      />
      <RankingTable rows={data.dosenProdi} labelKey="nm_lemb" />

      <SectionTitle
        icon={Building2}
        title="Peringkat Unit Layanan"
        description="Kepuasan mahasiswa terhadap unit layanan"
      />
      <RankingTable rows={data.mhsUnit} labelKey="nm_lemb" />

      <SectionTitle
        icon={GraduationCap}
        title="Dosen dengan Nilai Tertinggi"
        description={`${data.dosen.length} dosen dinilai pada semester aktif`}
      />
      <RankingTable
        rows={dosenRows}
        labelKey="nm_ptk"
        emptyText="Belum ada data dosen."
        onRowClick={(r) =>
          setDetail({
            idptk: String(r.id_ptk ?? ""),
            nama: String(r.nm_ptk ?? "-"),
            nilai: num(r.nilai),
          })
        }
      />
      <p className="mt-2 text-center text-[11px] text-slate-500">
        Klik salah satu baris dosen untuk melihat rincian jawaban per pertanyaan.
      </p>
      {data.dosen.length > 10 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowAllDosen((v) => !v)}
            className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            {showAllDosen
              ? "Tampilkan 10 teratas"
              : `Tampilkan semua (${data.dosen.length})`}
          </button>
        </div>
      )}
        </>
      )}

      {detail && (
        <DosenDetailModal
          idptk={detail.idptk}
          nama={detail.nama}
          nilai={detail.nilai}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

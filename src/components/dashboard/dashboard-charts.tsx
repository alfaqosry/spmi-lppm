"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Datum = { name: string; value: number; color: string };

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

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

export function DashboardCharts({
  categoryData,
  statusData,
  answerData,
  verificationData,
  overall,
}: {
  categoryData: { name: string; selesai: number; belum: number; persen: number }[];
  statusData: Datum[];
  answerData: Datum[];
  verificationData: Datum[];
  overall: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Tingkat Penyelesaian per Kategori Unit"
        subtitle="Jumlah unit selesai vs belum per kategori"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(129,140,248,0.08)" }} />
            <Legend wrapperStyle={LEGEND} />
            <Bar dataKey="selesai" name="Selesai" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="belum" name="Belum Selesai" stackId="a" fill="#334155" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Breakdown Status Audit"
        subtitle="Distribusi status pengisian seluruh unit"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={statusData}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={82}
              paddingAngle={3}
              stroke="none"
            >
              {statusData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={LEGEND} />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Distribusi Capaian Kepatuhan SPMI"
        subtitle="Perbandingan jawaban Ya / Tidak / Belum dijawab"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={answerData}
              dataKey="value"
              nameKey="name"
              outerRadius={82}
              paddingAngle={3}
              stroke="none"
            >
              {answerData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={LEGEND} />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        title="Status Verifikasi LPM"
        subtitle="Ringkasan keputusan verifikasi bukti auditee"
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={verificationData} outerRadius={86}>
            <PolarGrid stroke={GRID} />
            <PolarAngleAxis dataKey="name" tick={TICK} />
            <Radar
              dataKey="value"
              stroke="#818cf8"
              fill="#6366f1"
              fillOpacity={0.35}
            />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </Panel>

      <div className="card p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Capaian Kepatuhan Institusi
            </h3>
            <p className="text-[11px] text-slate-400">
              Persentase butir pertanyaan yang telah dijawab pada siklus aktif.
            </p>
          </div>
          <span className="text-2xl font-semibold text-emerald-300">{overall}%</span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400"
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>
    </div>
  );
}

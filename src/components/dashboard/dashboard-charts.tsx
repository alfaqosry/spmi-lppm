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
import { ChartPanel } from "@/components/charts/chart-panel";
import { ProgressBar } from "@/components/ui/primitives";

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

/**
 * Grafik dasbor (recharts). Dimuat secara lazy lewat
 * dashboard-charts-lazy.tsx agar tidak membebani first load JS.
 */
export function DashboardCharts({
  categoryData,
  statusData,
  answerData,
  verificationData,
  overall,
}: {
  categoryData: {
    name: string;
    selesai: number;
    belum: number;
    persen: number;
  }[];
  statusData: Datum[];
  answerData: Datum[];
  verificationData: Datum[];
  overall: number;
}) {
  const asRows = (d: Datum[]) =>
    d.map((x) => ({ label: x.name, value: x.value }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartPanel
        title="Tingkat Penyelesaian per Kategori Unit"
        subtitle="Jumlah unit selesai vs belum per kategori"
        valueLabel="Selesai / Belum"
        rows={categoryData.map((c) => ({
          label: c.name,
          value: `${c.selesai} selesai, ${c.belum} belum (${c.persen}%)`,
        }))}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            data={categoryData}
            margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={GRID}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={TICK}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={TICK}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(129,140,248,0.08)" }}
            />
            <Legend wrapperStyle={LEGEND} />
            <Bar
              dataKey="selesai"
              name="Selesai"
              stackId="a"
              fill="#10b981"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="belum"
              name="Belum Selesai"
              stackId="a"
              fill="#64748b"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="Breakdown Status Audit"
        subtitle="Distribusi status pengisian seluruh unit"
        valueLabel="Jumlah unit"
        rows={asRows(statusData)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie
              rootTabIndex={-1}
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
      </ChartPanel>

      <ChartPanel
        title="Distribusi Capaian Kepatuhan SPMI"
        subtitle="Perbandingan jawaban Ya / Tidak / Belum dijawab"
        valueLabel="Jumlah jawaban"
        rows={asRows(answerData)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie
              rootTabIndex={-1}
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
      </ChartPanel>

      <ChartPanel
        title="Status Verifikasi LPM"
        subtitle="Ringkasan keputusan verifikasi bukti auditee"
        valueLabel="Jumlah jawaban"
        rows={asRows(verificationData)}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            accessibilityLayer={false}
            data={verificationData}
            outerRadius="70%"
          >
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
      </ChartPanel>

      <div className="card p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Capaian Kepatuhan Institusi
            </h2>
            <p className="text-xs text-slate-400">
              Persentase butir pertanyaan yang telah dijawab pada siklus aktif.
            </p>
          </div>
          <span className="text-2xl font-semibold text-emerald-300">
            {overall}%
          </span>
        </div>
        <ProgressBar
          value={overall}
          label="Capaian kepatuhan institusi"
          className="mt-3 h-3 w-full"
        />
      </div>
    </div>
  );
}

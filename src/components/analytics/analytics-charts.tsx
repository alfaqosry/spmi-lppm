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
 * Grafik analitik (recharts). Dimuat secara lazy lewat
 * analytics-charts-lazy.tsx agar tidak membebani first load JS.
 */
export function AnalyticsCharts({
  perAspect,
  categoryData,
  answerData,
}: {
  perAspect: { name: string; title: string; kepatuhan: number }[];
  categoryData: { name: string; kepatuhan: number }[];
  answerData: { name: string; value: number; color: string }[];
}) {
  const ranked = [...perAspect].sort((a, b) => b.kepatuhan - a.kepatuhan);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartPanel
        title="Profil Kepatuhan per Standar"
        subtitle="Persentase kepatuhan tiap standar (radar)"
        valueLabel="Kepatuhan"
        height="h-72"
        rows={perAspect.map((p) => ({
          label: p.name,
          value: `${p.kepatuhan}%`,
        }))}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            accessibilityLayer={false}
            data={perAspect}
            outerRadius="70%"
          >
            <PolarGrid stroke={GRID} />
            <PolarAngleAxis dataKey="name" tick={TICK} />
            <Radar
              dataKey="kepatuhan"
              name="Kepatuhan %"
              stroke="#818cf8"
              fill="#6366f1"
              fillOpacity={0.35}
            />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="Kepatuhan per Kategori Unit"
        subtitle="Rata-rata capaian kepatuhan setiap kategori"
        valueLabel="Kepatuhan"
        height="h-72"
        rows={categoryData.map((c) => ({
          label: c.name,
          value: `${c.kepatuhan}%`,
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
            <YAxis tick={TICK} axisLine={false} tickLine={false} unit="%" />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(129,140,248,0.08)" }}
            />
            <Bar
              dataKey="kepatuhan"
              name="Kepatuhan %"
              fill="#6366f1"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <ChartPanel
        title="Distribusi Jawaban Audit"
        subtitle="Sebaran jawaban Ya / Tidak / Belum dijawab"
        valueLabel="Jumlah jawaban"
        height="h-72"
        rows={answerData.map((a) => ({ label: a.name, value: a.value }))}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie
              rootTabIndex={-1}
              data={answerData}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={92}
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
        title="Peringkat Kepatuhan Standar"
        subtitle="Standar dengan capaian tertinggi hingga terendah"
        valueLabel="Kepatuhan"
        height="h-72"
        rows={ranked.map((p) => ({ label: p.name, value: `${p.kepatuhan}%` }))}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            accessibilityLayer={false}
            layout="vertical"
            data={ranked}
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={GRID}
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={TICK}
              axisLine={false}
              tickLine={false}
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={TICK}
              axisLine={false}
              tickLine={false}
              width={54}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(129,140,248,0.08)" }}
            />
            <Bar
              dataKey="kepatuhan"
              name="Kepatuhan %"
              fill="#10b981"
              radius={[0, 6, 6, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>
    </div>
  );
}
